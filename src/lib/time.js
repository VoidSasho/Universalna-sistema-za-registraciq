// Помощни функции за време. Вътрешно времето в рамките на деня се пази
// като минути от полунощ (число) — сравненията и аритметиката са O(1),
// без създаване на Date обекти в "горещите" цикли.

/** "09:30" -> 570 */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Date -> "2026-11-20" (локално време) */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-11-20" -> Date (локална полунощ) */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** 0 = неделя ... 6 = събота */
export function weekdayOf(key) {
  return parseDateKey(key).getDay();
}

export function todayKey() {
  return toDateKey(new Date());
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDateBg(key) {
  return dateFormatter.format(parseDateKey(key));
}
