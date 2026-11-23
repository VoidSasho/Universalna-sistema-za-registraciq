import { memo } from 'react';
import { formatMinutes } from '../lib/time.js';

const STATE_TITLE = {
  free: 'Свободно — щракнете, за да изберете',
  blocked: 'Услугата не се побира от този час',
  'too-small': 'Капацитетът е недостатъчен',
  full: 'Няма достатъчно места',
  closed: 'Извън работно време',
  past: 'Часът е минал',
};

/**
 * Един ред от мрежата. memo: рендерира се само ако `result` (кеширан в мрежата)
 * или selectedStart за ТОЗИ ред са се променили.
 */
function ResourceRow({ resource, typeLabel, result, selectedStart, onPick, onOpen }) {
  return (
    <div className="grid-row" role="row">
      <div className="cell sticky res-name" title={`${typeLabel} · капацитет ${resource.capacity}`}>
        <span>{resource.name}</span>
        <small>
          {typeLabel}
          {resource.capacity > 1 ? ` · ${resource.capacity}` : ''}
          {resource.mode === 'shared' ? ' · споделен' : ''}
        </small>
      </div>
      {result.cells.map((cell) => {
        const isSelected = selectedStart === cell.start;
        const cls = `cell slot ${cell.state}${isSelected ? ' selected' : ''}${cell.isHead ? ' head-of' : ''}`;
        const time = formatMinutes(cell.start);

        if (cell.state === 'booked' || cell.state === 'editing') {
          return (
            <button
              key={cell.start}
              type="button"
              className={cls}
              onClick={() => (cell.state === 'editing' && cell.canStart ? onPick(resource.id, cell.start) : onOpen(cell.bookingId))}
              title={cell.state === 'editing' ? 'Редактирана резервация' : `${time} — заето, щракнете за редакция`}
            >
              {cell.label && <span className="booking-label">{cell.label}</span>}
            </button>
          );
        }
        if (cell.load !== undefined) {
          // споделен ресурс: показваме натоварването
          const pct = Math.round((cell.load / cell.capacity) * 100);
          return (
            <button
              key={cell.start}
              type="button"
              className={cls}
              disabled={cell.state !== 'free'}
              onClick={() => onPick(resource.id, cell.start)}
              style={{ '--load': `${pct}%` }}
              title={`${time} — ${cell.load}/${cell.capacity} заети места. ${STATE_TITLE[cell.state] ?? ''}`}
            >
              <span className="load-text">{cell.load}</span>
            </button>
          );
        }
        return (
          <button
            key={cell.start}
            type="button"
            className={cls}
            disabled={cell.state !== 'free'}
            onClick={() => onPick(resource.id, cell.start)}
            title={`${time} — ${STATE_TITLE[cell.state]}`}
          />
        );
      })}
    </div>
  );
}

export default memo(ResourceRow);
