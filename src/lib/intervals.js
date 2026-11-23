// Операции върху сортирани масиви от интервали { id, start, end, size }.
// Масивите са сортирани по start и се третират като immutable:
// всяка промяна връща НОВ масив, а старият остава непроменен
// (structural sharing — React може да сравнява по референция).

/**
 * Двоично търсене: първият индекс i, за който arr[i].start >= value.
 * Сложност O(log n).
 */
export function lowerBound(arr, value) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].start < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Вмъкване на позицията, запазваща сортировката. O(log n) търсене + O(n) копие. */
export function insertSorted(arr, item) {
  const i = lowerBound(arr, item.start);
  const next = arr.slice();
  next.splice(i, 0, item);
  return next;
}

/** Премахване по id. Ако го няма — връща същата референция (без излишен рендер). */
export function removeById(arr, id) {
  const i = arr.findIndex((x) => x.id === id);
  if (i === -1) return arr;
  const next = arr.slice();
  next.splice(i, 1);
  return next;
}

/** Полуотворени интервали [aStart, aEnd) и [bStart, bEnd) */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
