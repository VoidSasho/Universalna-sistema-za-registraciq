import { useCallback, useMemo, useRef, useState } from 'react';
import { businessById, businesses, configReport } from './config/businesses.js';
import ConfigReport from './components/ConfigReport.jsx';
import { useBusinessSlice, useReservationActions } from './state/ReservationsContext.jsx';
import { findNextAvailable } from './lib/availability.js';
import { formatDateBg, formatMinutes, todayKey } from './lib/time.js';
import BusinessSwitcher from './components/BusinessSwitcher.jsx';
import Filters from './components/Filters.jsx';
import AvailabilityGrid from './components/AvailabilityGrid.jsx';
import ReservationForm from './components/ReservationForm.jsx';
import ReservationList from './components/ReservationList.jsx';
import DayStats from './components/DayStats.jsx';
import Toast from './components/Toast.jsx';

// Критерии (дата, услуга, брой хора, тип ресурс) са общи за мрежата и формата —
// така мрежата винаги показва наличност точно за това, което се резервира.
function defaultCriteria(business) {
  return {
    date: todayKey(),
    serviceId: business.services[0].id,
    partySize: business.maxPartySize > 1 ? 2 : 1,
    resourceType: '',
    onlyFree: false,
  };
}

const emptyDraft = { id: undefined, resourceId: '', start: '', customer: '', phone: '', note: '' };

export default function App() {
  const [businessId, setBusinessId] = useState(businesses[0].id);
  const business = businessById[businessId];
  const slice = useBusinessSlice(businessId);
  const actions = useReservationActions();
  // "latest ref": позволява стабилни callback-и, които четат актуалните данни,
  // без да се създават наново при всяка промяна (иначе всички редове в мрежата биха се пререндерирали).
  const sliceRef = useRef(slice);
  sliceRef.current = slice;

  const [criteria, setCriteria] = useState(() => defaultCriteria(business));
  const [draft, setDraft] = useState(emptyDraft);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, at: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const switchBusiness = useCallback((id) => {
    setBusinessId(id);
    setCriteria(defaultCriteria(businessById[id]));
    setDraft(emptyDraft);
  }, []);

  const updateCriteria = useCallback((patch) => setCriteria((c) => ({ ...c, ...patch })), []);

  // Клик върху свободна клетка: попълва ресурс и час (при редакция — премества резервацията).
  const pickSlot = useCallback((resourceId, start) => {
    setDraft((d) => ({ ...d, resourceId, start }));
  }, []);

  const openReservation = useCallback(
    (id) => {
      const r = sliceRef.current.byId[id];
      if (!r) return;
      setCriteria((c) => ({ ...c, date: r.date, serviceId: r.serviceId, partySize: r.partySize }));
      setDraft({ id: r.id, resourceId: r.resourceId, start: r.start, customer: r.customer, phone: r.phone, note: r.note ?? '' });
    },
    [],
  );

  const findNext = useCallback(() => {
    const found = findNextAvailable(business, slice.index, {
      fromDate: criteria.date < todayKey() ? todayKey() : criteria.date,
      serviceId: criteria.serviceId,
      partySize: criteria.partySize,
      resourceType: criteria.resourceType,
    });
    if (!found) return notify('Няма свободен час в следващите 14 дни.', 'error');
    setCriteria((c) => ({ ...c, date: found.date }));
    setDraft((d) => ({ ...d, resourceId: found.resourceId, start: found.start }));
    const res = business.resources.find((r) => r.id === found.resourceId);
    notify(`Най-ранен свободен: ${formatDateBg(found.date)}, ${formatMinutes(found.start)} — ${res.name}`);
  }, [business, slice.index, criteria, notify]);

  const regenerate = useCallback(() => {
    actions.regenerate(business, Math.floor(Math.random() * 1e9));
    setDraft(emptyDraft);
    notify('Генерирани са нови симулирани данни.');
  }, [actions, business, notify]);

  const resetDemo = useCallback(() => {
    actions.resetDemo(business);
    setDraft(emptyDraft);
    notify('Възстановени са стандартните демо данни.');
  }, [actions, business, notify]);

  const editing = draft.id ? slice.byId[draft.id] : null;
  const service = useMemo(
    () => business.services.find((s) => s.id === criteria.serviceId) ?? business.services[0],
    [business, criteria.serviceId],
  );

  return (
    <div className="app">
      <ConfigReport report={configReport} />
      <header className="app-header">
        <div>
          <h1>Универсална система за резервации</h1>
          <p className="muted">
            {business.icon} {business.name} — {business.description}
          </p>
        </div>
        <BusinessSwitcher businesses={businesses} activeId={businessId} onChange={switchBusiness} />
      </header>

      <Filters business={business} criteria={criteria} onChange={updateCriteria} onFindNext={findNext} onRegenerate={regenerate} onResetDemo={resetDemo} />

      <DayStats business={business} slice={slice} date={criteria.date} />

      <main className="layout">
        <section className="panel grid-panel">
          <AvailabilityGrid
            business={business}
            index={slice.index}
            date={criteria.date}
            service={service}
            partySize={criteria.partySize}
            resourceType={criteria.resourceType}
            onlyFree={criteria.onlyFree}
            excludeId={draft.id}
            selected={draft.resourceId && draft.start !== '' ? { resourceId: draft.resourceId, start: Number(draft.start) } : null}
            onPick={pickSlot}
            onOpen={openReservation}
          />
        </section>

        <aside className="panel form-panel">
          <ReservationForm
            key={`${businessId}`}
            business={business}
            index={slice.index}
            criteria={criteria}
            onCriteriaChange={updateCriteria}
            draft={draft}
            setDraft={setDraft}
            editing={editing}
            onDone={(msg) => {
              setDraft(emptyDraft);
              notify(msg);
            }}
            onCancelEdit={() => setDraft(emptyDraft)}
            onError={(msg) => notify(msg, 'error')}
          />
        </aside>
      </main>

      <section className="panel">
        <ReservationList business={business} slice={slice} date={criteria.date} onEdit={openReservation} notify={notify} />
      </section>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
