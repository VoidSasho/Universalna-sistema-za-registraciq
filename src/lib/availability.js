// Ядро на системата: работно време, слотове, проверка за наличност и конфликти.
// Всички функции са чисти (без странични ефекти) -> лесни за тестване и мемоизиране.
//
// Два режима на ресурс (resource.mode):
//   'exclusive' — една резервация в даден момент (лекар, фризьор, маса, зала).
//                 Кофата е сортирана и БЕЗ припокривания -> краищата също са сортирани,
//                 затова конфликт се открива с едно двоично търсене: O(log k).
//   'shared'    — много резервации едновременно до капацитет (фитнес, йога група).
//                 Смята се пиковото натоварване в интервала с sweep-line: O(log k + m log m),
//                 където m е броят резервации, засягащи интервала (обикновено малък).

import { lowerBound } from './intervals.js';
import { toMinutes, weekdayOf, todayKey, nowMinutes, addDays } from './time.js';
import { getBucket } from './reservationIndex.js';

// ---------- работно време ----------

const periodsCache = new Map();

/** Работните периоди за дата като [[startMin, endMin], ...]. Кешира се по (бизнес, ден от седмицата). */
export function getWorkingPeriods(business, date) {
  if (business.closedDates?.includes(date)) return [];
  const wd = weekdayOf(date);
  const cacheKey = `${business.id}:${wd}`;
  let periods = periodsCache.get(cacheKey);
  if (!periods) {
    periods = (business.workingHours[wd] ?? []).map(([a, b]) => [toMinutes(a), toMinutes(b)]);
    periodsCache.set(cacheKey, periods);
  }
  return periods;
}

/** Периодът, в който попада минута t, или null. */
export function periodAt(periods, t) {
  for (const p of periods) if (t >= p[0] && t < p[1]) return p;
  return null;
}

/** Дали [start, end) е изцяло в един работен период. */
export function fitsWorkingHours(periods, start, end) {
  const p = periodAt(periods, start);
  return !!p && end <= p[1];
}

/** Колоните на мрежата: от най-ранното отваряне до най-късното затваряне през slotMinutes. */
export function getColumns(business, periods) {
  if (periods.length === 0) return [];
  const from = Math.min(...periods.map((p) => p[0]));
  const to = Math.max(...periods.map((p) => p[1]));
  const cols = [];
  for (let t = from; t < to; t += business.slotMinutes) cols.push(t);
  return cols;
}

// ---------- помощни ----------

export function maxServiceDuration(business) {
  return Math.max(...business.services.map((s) => s.duration));
}

export function serviceFitsResource(service, resource) {
  return !service || service.resourceTypes.includes(resource.type);
}

function withoutId(bucket, excludeId) {
  return excludeId ? bucket.filter((b) => b.id !== excludeId) : bucket;
}

/**
 * Пиково натоварване (сума от size) в [start, end) за 'shared' ресурс.
 * Разглеждат се само резервации с start в [start - maxDuration, end) — намерени с двоично търсене.
 */
export function peakLoad(bucket, start, end, maxDuration, excludeId) {
  const lo = lowerBound(bucket, start - maxDuration);
  const hi = lowerBound(bucket, end);
  const events = [];
  for (let i = lo; i < hi; i++) {
    const b = bucket[i];
    if (b.id === excludeId || b.end <= start) continue;
    events.push([Math.max(b.start, start), b.size]);
    events.push([b.end, -b.size]);
  }
  // при равни времена първо освобождаваме (-), после заемаме (+)
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let load = 0;
  let peak = 0;
  for (const [, delta] of events) {
    load += delta;
    if (load > peak) peak = load;
  }
  return peak;
}

/**
 * Конфликт за 'exclusive' ресурс. Съществуваща резервация [s, e + buffer) срещу нова [start, end + buffer).
 * Тъй като кофата няма припокривания, достатъчно е да проверим последната резервация,
 * започваща преди края на новата. O(log k).
 */
export function findExclusiveConflict(bucket, start, end, buffer = 0, excludeId) {
  const i = lowerBound(bucket, end + buffer);
  for (let j = i - 1; j >= 0; j--) {
    const b = bucket[j];
    if (b.id === excludeId) continue;
    return b.end + buffer > start ? b : null;
  }
  return null;
}

/**
 * Единична проверка дали ресурсът е свободен — използва се при валидация.
 * Връща { ok: true } или { ok: false, reason, conflictId? }.
 */
export function checkResource(business, resource, bucket, { start, end, partySize, excludeId }) {
  if (partySize > resource.capacity) return { ok: false, reason: 'capacity' };
  if (resource.mode === 'shared') {
    const peak = peakLoad(bucket, start, end, maxServiceDuration(business), excludeId);
    return peak + partySize <= resource.capacity ? { ok: true } : { ok: false, reason: 'full' };
  }
  const conflict = findExclusiveConflict(bucket, start, end, business.bufferMinutes ?? 0, excludeId);
  return conflict ? { ok: false, reason: 'overlap', conflictId: conflict.id } : { ok: true };
}

// ---------- изчисляване на цял ред от мрежата ----------

/**
 * Състоянието на всяка клетка за един ресурс и ден.
 *   closed     — извън работно време
 *   booked     — заета (exclusive), с bookingId
 *   editing    — резервацията, която в момента се редактира
 *   free       — може да започне избраната услуга тук
 *   blocked    — клетката е празна, но услугата не се побира (следваща резервация, буфер, затваряне)
 *   too-small  — капацитетът на ресурса е по-малък от броя хора
 *   full       — (shared) няма достатъчно места
 *   past       — часът вече е минал (opts.notBefore)
 *
 * За 'exclusive' се използват два указателя (two pointers) върху сортираната кофа:
 * колоните и резервациите се обхождат по веднъж -> O(C + k) за целия ред.
 */
export function computeRow(business, resource, bucket, columns, periods, opts) {
  const { duration, partySize, excludeId, serviceAllowed = true, notBefore = -1 } = opts;
  const step = business.slotMinutes;
  const buffer = business.bufferMinutes ?? 0;
  const cells = new Array(columns.length);
  let freeCount = 0;

  const tooSmall = partySize > resource.capacity;

  if (resource.mode === 'shared') {
    const maxDur = maxServiceDuration(business);
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      const period = periodAt(periods, c);
      if (!period) {
        cells[i] = { start: c, state: 'closed' };
        continue;
      }
      const load = peakLoad(bucket, c, c + step, maxDur, null);
      let state;
      if (c < notBefore) state = 'past';
      else if (tooSmall) state = 'too-small';
      else if (!serviceAllowed || c + duration > period[1]) state = 'blocked';
      else {
        const peak = peakLoad(bucket, c, c + duration, maxDur, excludeId);
        state = peak + partySize <= resource.capacity ? 'free' : 'full';
      }
      if (state === 'free') freeCount++;
      cells[i] = { start: c, state, load, capacity: resource.capacity };
    }
    return { cells, freeCount };
  }

  // exclusive
  const others = withoutId(bucket, excludeId);
  let occ = 0; // указател за заетост на клетката
  let q = 0; // указател за конфликт при старт
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    const period = periodAt(periods, c);
    if (!period) {
      cells[i] = { start: c, state: 'closed' };
      continue;
    }
    while (occ < bucket.length && bucket[occ].end <= c) occ++;
    const covering = occ < bucket.length && bucket[occ].start <= c ? bucket[occ] : null;
    if (covering && covering.id !== excludeId) {
      const isHead = covering.start >= c - step + 1 && covering.start <= c && (i === 0 || covering.start > columns[i - 1]);
      cells[i] = { start: c, state: 'booked', bookingId: covering.id, isHead, label: isHead ? covering.label : undefined };
      continue;
    }
    let state;
    if (c < notBefore) state = 'past';
    else if (tooSmall) state = 'too-small';
    else if (!serviceAllowed || c + duration > period[1]) state = 'blocked';
    else {
      while (q < others.length && others[q].end + buffer <= c) q++;
      const next = q < others.length ? others[q] : null;
      state = next && next.start < c + duration + buffer ? 'blocked' : 'free';
    }
    if (state === 'free') freeCount++;
    cells[i] = covering ? { start: c, state: 'editing', bookingId: covering.id, canStart: state === 'free' } : { start: c, state };
  }
  return { cells, freeCount };
}

// ---------- търсене ----------

/** Първата минута, от която може да се резервира за дата: -1 (бъдеще), сегашният час (днес), Infinity (минало). */
export function notBeforeFor(date) {
  const today = todayKey();
  if (date > today) return -1;
  if (date < today) return Infinity;
  return nowMinutes();
}

/** Дали стартът е в миналото спрямо реалния час. */
export function isInPast(date, start) {
  const today = todayKey();
  return date < today || (date === today && start < nowMinutes());
}

/**
 * Best-fit разпределение: от подходящите свободни ресурси избира този с НАЙ-МАЛЪК
 * достатъчен капацитет (напр. маса за 2-ма за двойка, а не маса за 8).
 * Така големите ресурси остават за големи групи.
 */
export function findBestResource(business, index, { date, start, end, partySize, serviceId, resourceType, excludeId }) {
  const service = business.services.find((s) => s.id === serviceId);
  const candidates = business.resources
    .filter((r) => serviceFitsResource(service, r) && (!resourceType || r.type === resourceType) && r.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity);
  for (const r of candidates) {
    const res = checkResource(business, r, getBucket(index, r.id, date), { start, end, partySize, excludeId });
    if (res.ok) return r;
  }
  return null;
}

/** Най-ранният свободен слот за услуга в следващите `days` дни. */
export function findNextAvailable(business, index, { fromDate, serviceId, partySize, resourceType, days = 14 }) {
  const service = business.services.find((s) => s.id === serviceId) ?? business.services[0];
  const resources = business.resources.filter(
    (r) => serviceFitsResource(service, r) && (!resourceType || r.type === resourceType) && r.capacity >= partySize,
  );
  for (let d = 0; d < days; d++) {
    const date = addDays(fromDate, d);
    const periods = getWorkingPeriods(business, date);
    for (const t of getColumns(business, periods)) {
      if (!fitsWorkingHours(periods, t, t + service.duration) || isInPast(date, t)) continue;
      for (const r of resources) {
        const res = checkResource(business, r, getBucket(index, r.id, date), {
          start: t,
          end: t + service.duration,
          partySize,
        });
        if (res.ok) return { date, start: t, resourceId: r.id };
      }
    }
  }
  return null;
}
