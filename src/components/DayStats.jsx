import { memo, useMemo } from 'react';
import { getWorkingPeriods } from '../lib/availability.js';
import { getBucket } from '../lib/reservationIndex.js';

// Статистика за деня, изчислена директно от индекса: O(ресурси + резервации за деня).
function DayStats({ business, slice, date }) {
  const stats = useMemo(() => {
    const periods = getWorkingPeriods(business, date);
    const openMinutes = periods.reduce((s, [a, b]) => s + (b - a), 0);
    let used = 0;
    let capacityMinutes = 0;
    let count = 0;
    let people = 0;
    for (const r of business.resources) {
      const weight = r.mode === 'shared' ? r.capacity : 1;
      capacityMinutes += openMinutes * weight;
      for (const b of getBucket(slice.index, r.id, date)) {
        used += (b.end - b.start) * (r.mode === 'shared' ? b.size : 1);
        count++;
        people += b.size;
      }
    }
    let revenue = 0;
    const priceOf = Object.fromEntries(business.services.map((s) => [s.id, s.price ?? 0]));
    let cancelled = 0;
    for (const id of slice.ids) {
      const r = slice.byId[id];
      if (r.date !== date) continue;
      if (r.status === 'active') revenue += priceOf[r.serviceId];
      else cancelled++;
    }
    return {
      occupancy: capacityMinutes ? Math.round((used / capacityMinutes) * 100) : 0,
      count,
      people,
      cancelled,
      revenue,
      total: slice.ids.length,
    };
  }, [business, slice, date]);

  return (
    <section className="stats" aria-label="Статистика за деня">
      <div className="stat">
        <span className="stat-value">{stats.occupancy}%</span>
        <span className="stat-label">заетост</span>
        <span className="bar">
          <span style={{ width: `${stats.occupancy}%` }} />
        </span>
      </div>
      <div className="stat">
        <span className="stat-value">{stats.count}</span>
        <span className="stat-label">активни резервации</span>
      </div>
      <div className="stat">
        <span className="stat-value">{stats.people}</span>
        <span className="stat-label">{business.labels.party.toLowerCase()}</span>
      </div>
      <div className="stat">
        <span className="stat-value">{stats.cancelled}</span>
        <span className="stat-label">отказани</span>
      </div>
      {stats.revenue > 0 && (
        <div className="stat">
          <span className="stat-value">{stats.revenue} лв.</span>
          <span className="stat-label">очакван приход</span>
        </div>
      )}
      <div className="stat">
        <span className="stat-value">{stats.total}</span>
        <span className="stat-label">общо в системата</span>
      </div>
    </section>
  );
}

export default memo(DayStats);
