// Сравнение: наивна проверка за конфликт (обхожда всички резервации)
// срещу индекс по ресурс/ден + двоично търсене.
// Стартиране:  npm run bench
import { buildIndex, getBucket } from '../src/lib/reservationIndex.js';
import { findExclusiveConflict } from '../src/lib/availability.js';

const RESOURCES = 200;
const DAYS = 30;
const PER_DAY = 10; // резервации на ресурс на ден
const QUERIES = 20000;

const reservations = [];
let id = 0;
for (let r = 0; r < RESOURCES; r++)
  for (let d = 0; d < DAYS; d++)
    for (let k = 0; k < PER_DAY; k++) {
      const start = 480 + k * 60;
      reservations.push({ id: String(id++), resourceId: `r${r}`, date: `d${d}`, start, end: start + 45, partySize: 1, status: 'active' });
    }

const queries = Array.from({ length: QUERIES }, (_, i) => {
  const start = 480 + ((i * 37) % 600);
  return { resourceId: `r${i % RESOURCES}`, date: `d${i % DAYS}`, start, end: start + 30 };
});

function naive(q) {
  for (const r of reservations)
    if (r.resourceId === q.resourceId && r.date === q.date && r.start < q.end && q.start < r.end) return r;
  return null;
}

let t = performance.now();
const index = buildIndex(reservations);
const buildMs = performance.now() - t;

t = performance.now();
let a = 0;
for (const q of queries) if (findExclusiveConflict(getBucket(index, q.resourceId, q.date), q.start, q.end)) a++;
const indexedMs = performance.now() - t;

t = performance.now();
let b = 0;
for (const q of queries.slice(0, 500)) if (naive(q)) b++;
const naiveMs = ((performance.now() - t) / 500) * QUERIES;

console.log(`Резервации: ${reservations.length.toLocaleString()} | заявки: ${QUERIES.toLocaleString()}`);
console.log(`Изграждане на индекса:     ${buildMs.toFixed(1)} ms (еднократно)`);
console.log(`Индекс + двоично търсене:  ${indexedMs.toFixed(1)} ms  (${((indexedMs / QUERIES) * 1000).toFixed(2)} µs/заявка)`);
console.log(`Наивно обхождане (оценка): ${naiveMs.toFixed(0)} ms  (${((naiveMs / QUERIES) * 1000).toFixed(0)} µs/заявка)`);
console.log(`Ускорение: ~${Math.round(naiveMs / indexedMs)}x`);
