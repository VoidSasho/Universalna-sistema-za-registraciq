// Генератор на симулирани данни. Използва детерминиран PRNG (mulberry32),
// затова при един и същ seed данните са едни и същи — удобно за тестове и демо.
// Всяка генерирана резервация минава през същата проверка за конфликти,
// която използва и интерфейсът, т.е. симулираните данни са винаги валидни.

import { addDays, todayKey } from '../lib/time.js';
import { getColumns, getWorkingPeriods, checkResource } from '../lib/availability.js';
import { addToIndex, getBucket } from '../lib/reservationIndex.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const MALE = ['Иван', 'Георги', 'Николай', 'Петър', 'Стефан', 'Калоян', 'Борис', 'Мартин', 'Александър', 'Христо'];
const FEMALE = ['Мария', 'Елена', 'Десислава', 'Ралица', 'Виктория', 'Гергана', 'Цветелина', 'Йоана', 'Радост', 'Теодора'];
const SURNAMES = ['Петров', 'Иванов', 'Димитров', 'Стоянов', 'Николов', 'Георгиев', 'Христов', 'Тодоров', 'Колев', 'Ангелов'];

let idCounter = 0;
export function newId(prefix = 'r') {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/**
 * Генерира резервации за бизнес за дни [fromOffset, toOffset] спрямо днес.
 * density ∈ (0,1] — приблизителна заетост.
 */
export function generateReservations(business, { fromOffset = -2, toOffset = 13, density = 0.55, seed } = {}) {
  const rand = mulberry32(seed ?? hashString(business.id));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const base = todayKey();
  const out = [];
  let index = {};
  let n = 0;

  const add = (r) => {
    out.push(r);
    index = addToIndex(index, r); // отменените не влизат в индекса и не блокират слотове
  };

  for (let d = fromOffset; d <= toOffset; d++) {
    const date = addDays(base, d);
    const periods = getWorkingPeriods(business, date);
    const columns = getColumns(business, periods);
    if (!columns.length) continue;

    for (const resource of business.resources) {
      const services = business.services.filter((s) => s.resourceTypes.includes(resource.type));
      if (!services.length) continue;

      // за 'shared' — няколко групи на всеки слот, докато не стигнем случаен процент от капацитета
      const attemptsPerSlot = resource.mode === 'shared' ? Math.ceil(resource.capacity * density * 0.5) : 1;

      for (const t of columns) {
        for (let a = 0; a < attemptsPerSlot; a++) {
          if (rand() > density * 0.6) continue;
          const service = pick(services);
          const start = t;
          const end = start + service.duration;
          const period = periods.find((p) => start >= p[0] && start < p[1]);
          if (!period || end > period[1]) continue;
          const maxSize = Math.min(resource.capacity, business.maxPartySize);
          const partySize =
            resource.mode === 'shared'
              ? 1 + Math.floor(rand() * Math.min(3, maxSize))
              : Math.max(1, Math.ceil(maxSize / 2) + Math.floor(rand() * (maxSize - Math.ceil(maxSize / 2) + 1)));
          const check = checkResource(business, resource, getBucket(index, resource.id, date), { start, end, partySize });
          if (!check.ok) continue;
          n += 1;
          add({
            id: `${business.id}-seed-${n}`,
            businessId: business.id,
            resourceId: resource.id,
            serviceId: service.id,
            date,
            start,
            end,
            partySize,
            customer: rand() < 0.5 ? `${pick(MALE)} ${pick(SURNAMES)}` : `${pick(FEMALE)} ${pick(SURNAMES)}а`,
            phone: `+359 88${Math.floor(1000000 + rand() * 8999999)}`,
            note: '',
            status: rand() < 0.04 ? 'cancelled' : 'active',
            createdAt: Date.now(),
          });
        }
      }
    }
  }
  return out;
}
