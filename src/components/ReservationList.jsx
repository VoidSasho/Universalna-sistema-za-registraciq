import { memo, useDeferredValue, useMemo, useState } from 'react';
import { formatDateBg, formatMinutes } from '../lib/time.js';
import { useReservationActions } from '../state/ReservationsContext.jsx';
import { checkResource } from '../lib/availability.js';
import { getBucket } from '../lib/reservationIndex.js';

function ReservationList({ business, slice, date, onEdit, notify }) {
  const actions = useReservationActions();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [confirmId, setConfirmId] = useState(null);
  // useDeferredValue: писането в търсачката остава плавно дори при много записи
  const deferredQuery = useDeferredValue(query);

  const resourceName = useMemo(() => Object.fromEntries(business.resources.map((r) => [r.id, r.name])), [business]);
  const serviceName = useMemo(() => Object.fromEntries(business.services.map((s) => [s.id, s.name])), [business]);

  const list = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return slice.ids
      .map((id) => slice.byId[id])
      .filter((r) => r.date === date)
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !q || r.customer.toLowerCase().includes(q) || r.phone.includes(q) || resourceName[r.resourceId]?.toLowerCase().includes(q))
      .sort((a, b) => a.start - b.start || (resourceName[a.resourceId] ?? '').localeCompare(resourceName[b.resourceId] ?? ''));
  }, [slice, date, status, deferredQuery, resourceName]);

  const cancel = (r) => {
    if (confirmId !== r.id) return setConfirmId(r.id);
    actions.cancel(business.id, r.id);
    setConfirmId(null);
    notify(`Резервацията на ${r.customer} е отказана.`);
  };

  // Възстановяване: слотът може междувременно да е зает — проверяваме със същия алгоритъм.
  const restore = (r) => {
    const resource = business.resources.find((x) => x.id === r.resourceId);
    const check = checkResource(business, resource, getBucket(slice.index, r.resourceId, r.date), {
      start: r.start,
      end: r.end,
      partySize: r.partySize,
      excludeId: r.id,
    });
    if (!check.ok) return notify('Не може да се възстанови — часът вече е зает.', 'error');
    actions.restore(business.id, r.id);
    notify(`Резервацията на ${r.customer} е възстановена.`);
  };

  return (
    <div>
      <div className="list-head">
        <h2>
          Резервации за {formatDateBg(date)} <span className="badge">{list.length}</span>
        </h2>
        <div className="row">
          <input type="search" placeholder="Търсене по име, телефон, ресурс…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Търсене" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус">
            <option value="all">Всички</option>
            <option value="active">Активни</option>
            <option value="cancelled">Отказани</option>
          </select>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="muted">Няма резервации по тези критерии.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Час</th>
                <th>{business.labels.resource}</th>
                <th>Услуга</th>
                <th>{business.labels.customer}</th>
                <th>Телефон</th>
                <th>Бр.</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.status === 'cancelled' ? 'cancelled' : ''}>
                  <td className="nowrap">
                    {formatMinutes(r.start)}–{formatMinutes(r.end)}
                  </td>
                  <td>{resourceName[r.resourceId] ?? '—'}</td>
                  <td>{serviceName[r.serviceId] ?? '—'}</td>
                  <td>{r.customer}</td>
                  <td className="nowrap">{r.phone}</td>
                  <td>{r.partySize}</td>
                  <td>
                    <span className={`status ${r.status}`}>{r.status === 'active' ? 'Активна' : 'Отказана'}</span>
                  </td>
                  <td className="actions">
                    {r.status === 'active' ? (
                      <>
                        <button type="button" className="btn small" onClick={() => onEdit(r.id)}>
                          Промени
                        </button>
                        <button type="button" className={confirmId === r.id ? 'btn small danger' : 'btn small ghost'} onClick={() => cancel(r)} onBlur={() => setConfirmId(null)}>
                          {confirmId === r.id ? 'Потвърди отказ' : 'Откажи'}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn small ghost" onClick={() => restore(r)}>
                        Възстанови
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default memo(ReservationList);
