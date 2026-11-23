import { memo } from 'react';
import { addDays, formatDateBg, todayKey } from '../lib/time.js';

function Filters({ business, criteria, onChange, onFindNext, onRegenerate, onResetDemo }) {
  const { date, serviceId, partySize, resourceType, onlyFree } = criteria;
  return (
    <section className="panel filters" aria-label="Филтри">
      <div className="field">
        <label htmlFor="f-date">Дата</label>
        <div className="row">
          <button type="button" className="icon-btn" onClick={() => onChange({ date: addDays(date, -1) })} aria-label="Предишен ден">
            ‹
          </button>
          <input id="f-date" type="date" value={date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
          <button type="button" className="icon-btn" onClick={() => onChange({ date: addDays(date, 1) })} aria-label="Следващ ден">
            ›
          </button>
          <button type="button" className="link-btn" onClick={() => onChange({ date: todayKey() })}>
            Днес
          </button>
        </div>
        <small className="muted">{formatDateBg(date)}</small>
      </div>

      <div className="field">
        <label htmlFor="f-service">Услуга</label>
        <select id="f-service" value={serviceId} onChange={(e) => onChange({ serviceId: e.target.value })}>
          {business.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration} мин{s.price ? ` · ${s.price} лв.` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field narrow">
        <label htmlFor="f-party">{business.labels.party}</label>
        <input
          id="f-party"
          type="number"
          min={1}
          max={business.maxPartySize}
          value={partySize}
          disabled={business.maxPartySize === 1}
          onChange={(e) => {
            const v = Math.max(1, Math.min(business.maxPartySize, Number(e.target.value) || 1));
            onChange({ partySize: v });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="f-type">Тип {business.labels.resource.toLowerCase()}</label>
        <select id="f-type" value={resourceType} onChange={(e) => onChange({ resourceType: e.target.value })}>
          <option value="">Всички</option>
          {Object.entries(business.resourceTypes).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <label className="check">
        <input type="checkbox" checked={onlyFree} onChange={(e) => onChange({ onlyFree: e.target.checked })} />
        Само със свободни часове
      </label>

      <div className="filters-actions">
        <button type="button" className="btn primary" onClick={onFindNext}>
          Най-ранен свободен час
        </button>
        <button type="button" className="btn ghost" onClick={onResetDemo} title="Стандартните демо данни (винаги едни и същи)">
          Демо данни
        </button>
        <button type="button" className="btn ghost" onClick={onRegenerate} title="Нови симулирани данни за текущия бизнес">
          ↻ Нови данни
        </button>
      </div>
    </section>
  );
}

export default memo(Filters);
