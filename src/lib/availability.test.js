import { describe, it, expect } from 'vitest';
import { lowerBound, insertSorted } from './intervals.js';
import { buildIndex, addToIndex, removeFromIndex, getBucket } from './reservationIndex.js';
import { findExclusiveConflict, peakLoad, computeRow, checkResource, findBestResource } from './availability.js';
import { validateReservation } from './validation.js';
import { businessById, businesses } from '../config/businesses.js';
import { generateReservations } from '../data/seed.js';
import { reservationsReducer, makeBusinessSlice } from '../state/reservationsReducer.js';
import { addDays, todayKey } from './time.js';

const e = (id, start, end, size = 1) => ({ id, start, end, size });

describe('intervals', () => {
  it('lowerBound намира първия start >= стойност', () => {
    const arr = [e('a', 60, 90), e('b', 120, 150), e('c', 180, 240)];
    expect(lowerBound(arr, 0)).toBe(0);
    expect(lowerBound(arr, 120)).toBe(1);
    expect(lowerBound(arr, 121)).toBe(2);
    expect(lowerBound(arr, 999)).toBe(3);
  });
  it('insertSorted запазва реда и не мутира', () => {
    const arr = [e('a', 60, 90), e('c', 180, 240)];
    const next = insertSorted(arr, e('b', 120, 150));
    expect(next.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(arr).toHaveLength(2);
  });
});

describe('конфликти (exclusive)', () => {
  const bucket = [e('a', 540, 600), e('b', 660, 720)];
  it('открива припокриване', () => {
    expect(findExclusiveConflict(bucket, 570, 630)?.id).toBe('a');
    expect(findExclusiveConflict(bucket, 690, 750)?.id).toBe('b');
  });
  it('допира без припокриване е позволен', () => {
    expect(findExclusiveConflict(bucket, 600, 660)).toBeNull();
  });
  it('буферът блокира съседни слотове', () => {
    expect(findExclusiveConflict(bucket, 600, 660, 15)?.id).toBeTruthy();
  });
  it('excludeId позволява редакция на същата резервация', () => {
    expect(findExclusiveConflict(bucket, 540, 630, 0, 'a')).toBeNull();
  });
});

describe('капацитет (shared)', () => {
  const bucket = [e('a', 600, 660, 5), e('b', 630, 690, 4), e('c', 700, 760, 10)];
  it('пиково натоварване', () => {
    expect(peakLoad(bucket, 600, 700, 120)).toBe(9);
    expect(peakLoad(bucket, 660, 700, 120)).toBe(4);
    expect(peakLoad(bucket, 690, 700, 120)).toBe(0);
    expect(peakLoad(bucket, 600, 760, 120)).toBe(10);
  });
});

describe('индекс', () => {
  it('добавяне/премахване със structural sharing', () => {
    const r1 = { id: '1', resourceId: 'x', date: '2026-01-01', start: 60, end: 90, partySize: 1, status: 'active' };
    const r2 = { id: '2', resourceId: 'y', date: '2026-01-01', start: 60, end: 90, partySize: 1, status: 'active' };
    const idx = buildIndex([r1, r2]);
    const r3 = { ...r1, id: '3', start: 120, end: 150 };
    const idx2 = addToIndex(idx, r3);
    expect(getBucket(idx2, 'x', '2026-01-01').map((b) => b.id)).toEqual(['1', '3']);
    expect(idx2.y).toBe(idx.y); // непроменен ресурс -> същата референция
    const idx3 = removeFromIndex(idx2, r1);
    expect(getBucket(idx3, 'x', '2026-01-01').map((b) => b.id)).toEqual(['3']);
  });
});

describe('computeRow', () => {
  const biz = { ...businessById.clinic };
  const res = biz.resources[0];
  const periods = [[540, 780]];
  const cols = [540, 570, 600, 630, 660, 690, 720, 750];
  it('маркира заети, свободни и блокирани', () => {
    const bucket = [e('a', 600, 660)];
    const { cells, freeCount } = computeRow(biz, res, bucket, cols, periods, { duration: 60, partySize: 1 });
    expect(cells.map((c) => c.state)).toEqual(['free', 'blocked', 'booked', 'booked', 'free', 'free', 'free', 'blocked']);
    expect(freeCount).toBe(4);
  });
});

describe('best-fit маса', () => {
  it('за двама избира маса за 2, не за 10', () => {
    const biz = businessById.restaurant;
    const r = findBestResource(biz, {}, { date: '2030-01-07', start: 720, end: 780, partySize: 2, serviceId: 'lunch' });
    expect(r.capacity).toBe(2);
  });
  it('за 5 души избира маса за 6', () => {
    const biz = businessById.restaurant;
    const r = findBestResource(biz, {}, { date: '2030-01-07', start: 720, end: 780, partySize: 5, serviceId: 'lunch' });
    expect(r.capacity).toBe(6);
  });
});

describe('валидация', () => {
  const biz = businessById.clinic;
  const date = addDays(todayKey(), 30);
  const base = { customer: 'Иван Петров', phone: '+359 888123456', serviceId: 'checkup', resourceId: 'dr-ivanova', partySize: 1, date, start: 600 };
  it('валидна резервация няма грешки (ако денят е работен)', () => {
    const errs = validateReservation(biz, {}, base);
    if (Object.keys(errs).length) expect(errs.start).toMatch(/не се работи|извън/);
    else expect(errs).toEqual({});
  });
  it('отхвърля несъвместима услуга', () => {
    expect(validateReservation(biz, {}, { ...base, serviceId: 'blood' }).resourceId).toBeTruthy();
  });
  it('отхвърля невалиден телефон', () => {
    expect(validateReservation(biz, {}, { ...base, phone: 'abc' }).phone).toBeTruthy();
  });
});

describe('симулирани данни и reducer', () => {
  it('генерираните данни нямат припокривания', () => {
    for (const b of businesses) {
      const list = generateReservations(b).filter((r) => r.status === 'active');
      expect(list.length).toBeGreaterThan(0);
      const idx = buildIndex(list);
      for (const r of list) {
        const res = b.resources.find((x) => x.id === r.resourceId);
        if (res.mode !== 'exclusive') continue;
        const c = findExclusiveConflict(getBucket(idx, r.resourceId, r.date), r.start, r.end, b.bufferMinutes, r.id);
        expect(c).toBeNull();
      }
    }
  });
  it('reducer отхвърля припокриване и позволява отказ', () => {
    const b = businessById.clinic;
    const r = { id: 'n1', businessId: 'clinic', resourceId: 'dr-ivanova', serviceId: 'checkup', date: '2030-01-07', start: 600, end: 630, partySize: 1, status: 'active' };
    let s = { byBusiness: { clinic: makeBusinessSlice([]) } };
    s = reservationsReducer(s, { type: 'create', reservation: r });
    expect(s.byBusiness.clinic.ids).toHaveLength(1);
    const s2 = reservationsReducer(s, { type: 'create', reservation: { ...r, id: 'n2', start: 615, end: 645 } });
    expect(s2).toBe(s);
    const s3 = reservationsReducer(s, { type: 'cancel', businessId: 'clinic', id: 'n1' });
    expect(getBucket(s3.byBusiness.clinic.index, 'dr-ivanova', '2030-01-07')).toHaveLength(0);
    expect(checkResource(b, b.resources[0], [], { start: 600, end: 630, partySize: 1 }).ok).toBe(true);
  });
});

import { validateBusinessConfig } from '../config/validateConfig.js';

describe('проверка на конфигурацията', () => {
  it('всички включени бизнеси са валидни', () => {
    for (const b of businesses) expect(validateBusinessConfig(b).errors).toEqual([]);
  });
  it('открива непознат тип ресурс и грешен час', () => {
    const b = structuredClone(businessById.clinic);
    b.resources.push({ id: 'x', name: 'X', type: 'surgeon', capacity: 1, mode: 'exclusive' });
    b.workingHours[1] = [['9:00', '13:00']];
    expect(validateBusinessConfig(b).errors.length).toBe(2);
  });
});
