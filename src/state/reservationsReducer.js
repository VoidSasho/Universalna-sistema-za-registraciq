// Нормализирано състояние на резервациите + индекс за бърза наличност.
//
// state.byBusiness[businessId] = {
//   byId:  { [id]: reservation },  // O(1) достъп по id
//   ids:   [id, ...],              // ред на създаване
//   index: { [resourceId]: { [date]: sortedEntries[] } }
// }
//
// Индексът се обновява ИНКРЕМЕНТАЛНО при всяко действие (а не се изгражда наново),
// със structural sharing — непроменените части запазват референциите си.

import { businessById } from '../config/businesses.js';
import { addToIndex, buildIndex, getBucket, removeFromIndex } from '../lib/reservationIndex.js';
import { checkResource } from '../lib/availability.js';

export function makeBusinessSlice(reservations) {
  const byId = {};
  const ids = [];
  for (const r of reservations) {
    byId[r.id] = r;
    ids.push(r.id);
  }
  return { byId, ids, index: buildIndex(reservations) };
}

/** Защитна проверка в reducer-а: дори при грешка в UI в индекса не влиза припокриване. */
function canPlace(slice, r) {
  const business = businessById[r.businessId];
  const resource = business?.resources.find((x) => x.id === r.resourceId);
  if (!resource) return false;
  return checkResource(business, resource, getBucket(slice.index, r.resourceId, r.date), {
    start: r.start,
    end: r.end,
    partySize: r.partySize,
    excludeId: r.id,
  }).ok;
}

export function reservationsReducer(state, action) {
  switch (action.type) {
    case 'create': {
      const r = action.reservation;
      const slice = state.byBusiness[r.businessId];
      if (!canPlace(slice, r)) return state;
      return withSlice(state, r.businessId, {
        byId: { ...slice.byId, [r.id]: r },
        ids: [...slice.ids, r.id],
        index: addToIndex(slice.index, r),
      });
    }
    case 'update': {
      const r = action.reservation;
      const slice = state.byBusiness[r.businessId];
      const prev = slice.byId[r.id];
      if (!prev) return state;
      const without = removeFromIndex(slice.index, prev);
      if (!canPlace({ ...slice, index: without }, r)) return state;
      return withSlice(state, r.businessId, {
        ...slice,
        byId: { ...slice.byId, [r.id]: r },
        index: addToIndex(without, r),
      });
    }
    case 'cancel': {
      const slice = state.byBusiness[action.businessId];
      const prev = slice.byId[action.id];
      if (!prev || prev.status !== 'active') return state;
      return withSlice(state, action.businessId, {
        ...slice,
        byId: { ...slice.byId, [prev.id]: { ...prev, status: 'cancelled', cancelledAt: Date.now() } },
        index: removeFromIndex(slice.index, prev),
      });
    }
    case 'restore': {
      const slice = state.byBusiness[action.businessId];
      const prev = slice.byId[action.id];
      if (!prev || prev.status !== 'cancelled') return state;
      const restored = { ...prev, status: 'active', cancelledAt: undefined };
      if (!canPlace(slice, restored)) return state;
      return withSlice(state, action.businessId, {
        ...slice,
        byId: { ...slice.byId, [prev.id]: restored },
        index: addToIndex(slice.index, restored),
      });
    }
    case 'reset':
      return withSlice(state, action.businessId, makeBusinessSlice(action.reservations));
    default:
      return state;
  }
}

function withSlice(state, businessId, slice) {
  return { ...state, byBusiness: { ...state.byBusiness, [businessId]: slice } };
}
