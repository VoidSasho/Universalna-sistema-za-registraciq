import { memo, useEffect, useMemo, useRef } from 'react';
import { computeRow, getColumns, getWorkingPeriods, notBeforeFor, serviceFitsResource } from '../lib/availability.js';
import { getBucket } from '../lib/reservationIndex.js';
import { formatMinutes } from '../lib/time.js';
import ResourceRow from './ResourceRow.jsx';

/**
 * Мрежа ресурси × слотове за избрания ден.
 *
 * Оптимизации:
 *  1. Кеш по ресурс (rowCache): ред се преизчислява САМО ако кофата му (референция)
 *     или параметрите (дата, продължителност, брой хора, редактирана резервация) са се сменили.
 *     След създаване на резервация се преизчислява 1 ред, а не всички.
 *  2. ResourceRow е React.memo -> редове с непроменен резултат не се рендерират.
 *  3. Callback-ите (onPick/onOpen) са стабилни (useCallback в App).
 */
function AvailabilityGrid({ business, index, date, service, partySize, resourceType, onlyFree, excludeId, selected, onPick, onOpen }) {
  const periods = getWorkingPeriods(business, date);
  const columns = useMemo(() => getColumns(business, periods), [business, periods]);

  const rowCache = useRef(new Map());
  // резултатите от последния commit — само се ЧЕТАТ в useMemo (идемпотентно и в StrictMode)
  const committed = useRef(new Map());
  const cacheBusiness = useRef(business.id);
  if (cacheBusiness.current !== business.id) {
    rowCache.current = new Map();
    cacheBusiness.current = business.id;
  }

  const visibleResources = useMemo(
    () => business.resources.filter((r) => serviceFitsResource(service, r) && (!resourceType || r.type === resourceType)),
    [business, service, resourceType],
  );

  const { rows, stats } = useMemo(() => {
    const t0 = performance.now();
    // минутите "до сега" се закръглят до слот, за да не се инвалидира кешът всяка минута
    const nb = notBeforeFor(date);
    const notBefore = Number.isFinite(nb) && nb > 0 ? Math.ceil(nb / business.slotMinutes) * business.slotMinutes : nb;
    const paramsKey = `${date}|${service.id}|${partySize}|${excludeId ?? ''}|${notBefore}`;
    let recomputed = 0;
    let cells = 0;
    const out = [];
    for (const resource of visibleResources) {
      const bucket = getBucket(index, resource.id, date);
      const cached = rowCache.current.get(resource.id);
      let result;
      if (cached && cached.bucket === bucket && cached.paramsKey === paramsKey) {
        result = cached.result;
      } else {
        result = computeRow(business, resource, bucket, columns, periods, {
          duration: service.duration,
          partySize,
          excludeId,
          notBefore,
        });
        rowCache.current.set(resource.id, { bucket, paramsKey, result });
      }
      if (committed.current.get(resource.id) !== result) recomputed++;
      cells += columns.length;
      out.push({ resource, result });
    }
    return { rows: out, stats: { ms: performance.now() - t0, recomputed, cells, total: visibleResources.length } };
  }, [business, index, date, service, partySize, excludeId, visibleResources, columns, periods]);

  useEffect(() => {
    committed.current = new Map(rows.map((r) => [r.resource.id, r.result]));
  }, [rows]);

  const shown = onlyFree ? rows.filter((r) => r.result.freeCount > 0) : rows;

  if (columns.length === 0) {
    return (
      <div className="empty">
        <strong>Почивен ден.</strong> В този ден {business.name} не работи — изберете друга дата или „Най-ранен свободен час“.
      </div>
    );
  }

  const gridStyle = { '--cols': columns.length };

  return (
    <div className="grid-wrap">
      <div className="grid-meta">
        <span>
          {shown.length} от {rows.length} ресурса · {service.name} ({service.duration} мин)
        </span>
        <span className="perf" title="Колко реда са преизчислени при последната промяна и за колко време">
          ⚡ {stats.recomputed}/{stats.total} реда преизчислени · {stats.cells} клетки · {stats.ms.toFixed(2)} ms
        </span>
      </div>
      <div className="legend">
        <span className="lg free">свободно</span>
        <span className="lg booked">заето</span>
        <span className="lg blocked">не се побира</span>
        <span className="lg too-small">малък капацитет</span>
        <span className="lg past">минало</span>
        <span className="lg closed">затворено</span>
      </div>
      <div className="grid-scroll">
        <div className="grid" style={gridStyle} role="grid" aria-label="Наличност">
          <div className="grid-head" role="row">
            <div className="cell head sticky">{business.labels.resource}</div>
            {columns.map((c) => (
              <div key={c} className={c % 60 === 0 ? 'cell head hour' : 'cell head'} role="columnheader">
                {c % 60 === 0 || business.slotMinutes >= 60 ? formatMinutes(c) : ''}
              </div>
            ))}
          </div>
          {shown.map(({ resource, result }) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              typeLabel={business.resourceTypes[resource.type]}
              result={result}
              selectedStart={selected && selected.resourceId === resource.id ? selected.start : null}
              onPick={onPick}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
      {shown.length === 0 && <div className="empty">Няма ресурси със свободни часове за тези критерии.</div>}
    </div>
  );
}

export default memo(AvailabilityGrid);
