// Провайдър на състоянието. Две отделни контекстни стойности:
//   - StateContext   — данните (променят се)
//   - ActionsContext — функциите (СТАБИЛНИ, създават се веднъж)
// Компоненти, които само извършват действия (бутони), не се пререндерират при промяна на данните.

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { businesses, businessById } from '../config/businesses.js';
import { generateReservations } from '../data/seed.js';
import { makeBusinessSlice, reservationsReducer } from './reservationsReducer.js';

const STORAGE_KEY = 'universal-booking:v2';

// "Отпечатък" на структурата на бизнеса. Ако промените ресурси, услуги или работно време
// в businesses.js, отпечатъкът се сменя и запазените стари данни за този бизнес се
// заменят с нови демо данни — така няма резервации към несъществуващи ресурси.
// (Смяна само на name/icon/description/labels НЕ изтрива данните.)
function configHash(b) {
  const s = JSON.stringify([b.slotMinutes, b.bufferMinutes, b.maxPartySize, b.workingHours, b.closedDates, b.resources, b.services]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Защитно: пропуска записи, които сочат към ресурс/услуга, които вече ги няма. */
function keepValid(b, list) {
  const res = new Set(b.resources.map((r) => r.id));
  const srv = new Set(b.services.map((s) => s.id));
  return list.filter((r) => res.has(r.resourceId) && srv.has(r.serviceId));
}

const StateContext = createContext(null);
const ActionsContext = createContext(null);

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initState() {
  const stored = loadStored();
  const byBusiness = {};
  for (const b of businesses) {
    const saved = stored?.[b.id];
    const list = saved && saved.hash === configHash(b) ? keepValid(b, saved.reservations) : generateReservations(b);
    byBusiness[b.id] = makeBusinessSlice(list);
  }
  return { byBusiness };
}

export function ReservationsProvider({ children }) {
  const [state, dispatch] = useReducer(reservationsReducer, undefined, initState);

  // Запис в localStorage с debounce — не блокира интерфейса при серия от промени.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const out = {};
        for (const [id, slice] of Object.entries(state.byBusiness)) {
          out[id] = { hash: configHash(businessById[id]), reservations: slice.ids.map((x) => slice.byId[x]) };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch {
        /* storage може да е недостъпен (private mode) — приложението работи и без него */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const actions = useMemo(
    () => ({
      create: (reservation) => dispatch({ type: 'create', reservation }),
      update: (reservation) => dispatch({ type: 'update', reservation }),
      cancel: (businessId, id) => dispatch({ type: 'cancel', businessId, id }),
      restore: (businessId, id) => dispatch({ type: 'restore', businessId, id }),
      // Връща стандартните демо данни (фиксиран seed -> винаги едни и същи резервации)
      resetDemo: (business) =>
        dispatch({ type: 'reset', businessId: business.id, reservations: generateReservations(business) }),
      regenerate: (business, seed) =>
        dispatch({ type: 'reset', businessId: business.id, reservations: generateReservations(business, { seed }) }),
    }),
    [],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useBusinessSlice(businessId) {
  return useContext(StateContext).byBusiness[businessId];
}

export function useReservationActions() {
  return useContext(ActionsContext);
}
