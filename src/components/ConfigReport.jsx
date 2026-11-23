import { useState } from 'react';

// Показва грешките/предупрежденията от проверката на businesses.js.
export default function ConfigReport({ report }) {
  const [open, setOpen] = useState(report.errors.length > 0);
  if (!report.errors.length && !report.warnings.length) return null;
  const isError = report.errors.length > 0;
  return (
    <section className={`config-report ${isError ? 'error' : 'warn'}`} role="alert">
      <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)}>
        {isError
          ? `⚠ Конфигурация: ${report.errors.length} грешки — бизнесите с грешки са скрити`
          : `ℹ Конфигурация: ${report.warnings.length} предупреждения`}
        {open ? ' ▲' : ' ▼'}
      </button>
      {open && (
        <ul>
          {report.errors.map((e) => (
            <li key={e} className="error">{e}</li>
          ))}
          {report.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <small className="muted">Поправете src/config/businesses.js и презаредете.</small>
    </section>
  );
}
