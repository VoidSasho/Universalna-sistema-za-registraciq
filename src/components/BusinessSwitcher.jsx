import { memo } from 'react';

function BusinessSwitcher({ businesses, activeId, onChange }) {
  return (
    <nav className="switcher" aria-label="Избор на бизнес">
      {businesses.map((b) => (
        <button
          key={b.id}
          type="button"
          className={b.id === activeId ? 'chip active' : 'chip'}
          aria-pressed={b.id === activeId}
          onClick={() => onChange(b.id)}
          title={b.description}
        >
          <span aria-hidden>{b.icon}</span> {b.name.split(' „')[0]}
        </button>
      ))}
    </nav>
  );
}

export default memo(BusinessSwitcher);
