// Индекс на активните резервации за един бизнес:
//
//   index[resourceId][dateKey] = [{ id, start, end, size }, ...]  (сортиран по start)
//
// Така проверката за конфликт гледа само "кофата" (bucket) на конкретния
// ресурс за конкретния ден, а не всички резервации -> O(log k) вместо O(N).
// Обновяването е immutable със structural sharing: при промяна се копират
// само засегнатата кофа и двата обекта над нея; всички други кофи запазват
// референцията си и мемоизираните React редове не се пререндерират.

import { insertSorted, removeById } from './intervals.js';

export const EMPTY_BUCKET = Object.freeze([]);

// label се пази в индекса, за да може мрежата да покаже името на клиента,
// без да зависи от целия byId обект (иначе всяка промяна би пререндерирала всички редове).
function toEntry(r) {
  return { id: r.id, start: r.start, end: r.end, size: r.partySize, label: r.customer?.split(' ')[0] ?? '' };
}

export function buildIndex(reservations) {
  const index = {};
  for (const r of reservations) {
    if (r.status !== 'active') continue;
    const byDate = (index[r.resourceId] ??= {});
    (byDate[r.date] ??= []).push(toEntry(r));
  }
  for (const byDate of Object.values(index)) {
    for (const bucket of Object.values(byDate)) bucket.sort((a, b) => a.start - b.start);
  }
  return index;
}

export function getBucket(index, resourceId, date) {
  return index[resourceId]?.[date] ?? EMPTY_BUCKET;
}

export function addToIndex(index, r) {
  if (r.status !== 'active') return index;
  const byDate = index[r.resourceId] ?? {};
  const bucket = byDate[r.date] ?? EMPTY_BUCKET;
  return {
    ...index,
    [r.resourceId]: { ...byDate, [r.date]: insertSorted(bucket, toEntry(r)) },
  };
}

export function removeFromIndex(index, r) {
  const byDate = index[r.resourceId];
  const bucket = byDate?.[r.date];
  if (!bucket) return index;
  const next = removeById(bucket, r.id);
  if (next === bucket) return index;
  return { ...index, [r.resourceId]: { ...byDate, [r.date]: next } };
}
