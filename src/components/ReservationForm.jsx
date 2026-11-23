import { useEffect, useMemo, useRef, useState } from 'react';
import { computeRow, findBestResource, getColumns, getWorkingPeriods, isInPast, serviceFitsResource } from '../lib/availability.js';
import { getBucket } from '../lib/reservationIndex.js';
import { validateReservation } from '../lib/validation.js';
import { formatDateBg, formatMinutes } from '../lib/time.js';
import { useReservationActions } from '../state/ReservationsContext.jsx';
import { newId } from '../data/seed.js';

const AUTO = '__auto__';

export default function ReservationForm({ business, index, criteria, onCriteriaChange, draft, setDraft, editing, onDone, onCancelEdit, onError }) {
  const actions = useReservationActions();
  const [errors, setErrors] = useState({});
  const service = business.services.find((s) => s.id === criteria.serviceId) ?? business.services[0];
  const isEdit = Boolean(draft.id);

  // При начало на редакция (напр. от бутона „Промени“ в списъка долу) формата
  // се превърта в изгледа и курсорът отива в полето за име.
  const formRef = useRef(null);
  const nameRef = useRef(null);
  useEffect(() => {
    if (!draft.id) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameRef.current?.focus({ preventScroll: true });
  }, [draft.id]);

  const compatible = useMemo(
    () => business.resources.filter((r) => serviceFitsResource(service, r) && r.capacity >= criteria.partySize),
    [business, service, criteria.partySize],
  );

  // Свободни начални часове за избрания ресурс (или обединение за "автоматично").
  // Списъкът идва от същия алгоритъм като мрежата, затова формата не предлага заети часове.
  const startOptions = useMemo(() => {
    const periods = getWorkingPeriods(business, criteria.date);
    const columns = getColumns(business, periods);
    const targets = draft.resourceId && draft.resourceId !== AUTO ? compatible.filter((r) => r.id === draft.resourceId) : compatible;
    const free = new Set();
    for (const r of targets) {
      const { cells } = computeRow(business, r, getBucket(index, r.id, criteria.date), columns, periods, {
        duration: service.duration,
        partySize: criteria.partySize,
        excludeId: draft.id,
      });
      for (const c of cells) if (c.state === 'free' || (c.state === 'editing' && c.canStart)) free.add(c.start);
    }
    return [...free].sort((a, b) => a - b).filter((t) => isEdit || !isInPast(criteria.date, t));
  }, [business, index, criteria.date, criteria.partySize, service, draft.resourceId, draft.id, compatible, isEdit]);

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const submit = (ev) => {
    ev.preventDefault();
    let resourceId = draft.resourceId;
    const start = draft.start === '' ? '' : Number(draft.start);

    if ((!resourceId || resourceId === AUTO) && start !== '') {
      const best = findBestResource(business, index, {
        date: criteria.date,
        start,
        end: start + service.duration,
        partySize: criteria.partySize,
        serviceId: service.id,
        excludeId: draft.id,
      });
      if (!best) {
        setErrors({ start: 'Няма свободен подходящ ресурс в този час.' });
        return;
      }
      resourceId = best.id;
    }

    const candidate = {
      id: draft.id,
      businessId: business.id,
      resourceId,
      serviceId: service.id,
      date: criteria.date,
      start,
      partySize: criteria.partySize,
      customer: draft.customer.trim(),
      phone: draft.phone.trim(),
      note: draft.note.trim(),
    };
    const errs = validateReservation(business, index, candidate, { allowPast: isEdit && editing?.date === candidate.date && editing?.start === candidate.start });
    if (Object.keys(errs).length) {
      setErrors(errs);
      onError('Резервацията не е валидна — вижте маркираните полета.');
      return;
    }

    const resource = business.resources.find((r) => r.id === resourceId);
    const full = { ...editing, ...candidate, end: start + service.duration, status: 'active' };
    if (isEdit) {
      actions.update(full);
      onDone(`Промените са запазени (${resource.name}, ${formatMinutes(start)}).`);
    } else {
      actions.create({ ...full, id: newId(business.id), createdAt: Date.now() });
      onDone(`Създадена резервация: ${formatDateBg(criteria.date)}, ${formatMinutes(start)} — ${resource.name}.`);
    }
    setErrors({});
  };

  const err = (k) => errors[k] && <span className="error">{errors[k]}</span>;
  const selectedResource = business.resources.find((r) => r.id === draft.resourceId);

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={isEdit ? 'is-editing' : ''}>
      <h2>{isEdit ? 'Редакция на резервация' : 'Нова резервация'}</h2>
      {isEdit && (
        <p className="edit-hint">
          Променете което искате — име, телефон, дата, час, услуга, {business.labels.resource.toLowerCase()} — и натиснете
          „Запази промените“. Може и да щракнете свободна клетка в мрежата, за да преместите резервацията.
        </p>
      )}

      <div className="field">
        <label htmlFor="r-service">Услуга</label>
        <select id="r-service" value={service.id} onChange={(e) => onCriteriaChange({ serviceId: e.target.value })}>
          {business.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration} мин)
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="r-resource">{business.labels.resource}</label>
        <select id="r-resource" value={draft.resourceId || AUTO} onChange={(e) => set({ resourceId: e.target.value })}>
          <option value={AUTO}>Автоматично (най-подходящ)</option>
          {compatible.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.capacity > 1 ? ` (${r.capacity})` : ''}
            </option>
          ))}
          {selectedResource && !compatible.includes(selectedResource) && (
            <option value={selectedResource.id}>{selectedResource.name} — неподходящ</option>
          )}
        </select>
        {err('resourceId')}
      </div>

      <div className="row two">
        <div className="field">
          <label htmlFor="r-date">Дата</label>
          <input id="r-date" type="date" value={criteria.date} onChange={(e) => e.target.value && onCriteriaChange({ date: e.target.value })} />
          {err('date')}
        </div>
        <div className="field">
          <label htmlFor="r-start">Начален час</label>
          <select id="r-start" value={draft.start} onChange={(e) => set({ start: e.target.value === '' ? '' : Number(e.target.value) })}>
            <option value="">— изберете —</option>
            {draft.start !== '' && !startOptions.includes(Number(draft.start)) && (
              <option value={draft.start}>{formatMinutes(Number(draft.start))} (зает/невалиден)</option>
            )}
            {startOptions.map((t) => (
              <option key={t} value={t}>
                {formatMinutes(t)} – {formatMinutes(t + service.duration)}
              </option>
            ))}
          </select>
          <small className="muted">{startOptions.length} свободни начала</small>
          {err('start')}
        </div>
      </div>

      <div className="field">
        <label htmlFor="r-party">{business.labels.party}</label>
        <input
          id="r-party"
          type="number"
          min={1}
          max={business.maxPartySize}
          value={criteria.partySize}
          disabled={business.maxPartySize === 1}
          onChange={(e) => onCriteriaChange({ partySize: Math.max(1, Math.min(business.maxPartySize, Number(e.target.value) || 1)) })}
        />
        {err('partySize')}
      </div>

      <div className="field">
        <label htmlFor="r-name">{business.labels.customer}</label>
        <input id="r-name" ref={nameRef} value={draft.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="Име и фамилия" autoComplete="name" />
        {err('customer')}
      </div>

      <div className="field">
        <label htmlFor="r-phone">Телефон</label>
        <input id="r-phone" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+359 88 123 4567" inputMode="tel" autoComplete="tel" />
        {err('phone')}
      </div>

      <div className="field">
        <label htmlFor="r-note">Бележка</label>
        <textarea id="r-note" rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </div>

      <div className="row">
        <button type="submit" className="btn primary">
          {isEdit ? 'Запази промените' : 'Резервирай'}
        </button>
        {(isEdit || draft.start !== '' || draft.customer) && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setErrors({});
              onCancelEdit();
            }}
          >
            {isEdit ? 'Откажи редакцията' : 'Изчисти'}
          </button>
        )}
      </div>
    </form>
  );
}
