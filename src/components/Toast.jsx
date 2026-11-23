import { useEffect } from 'react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast || !toast.text) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
      {toast.text}
      <button type="button" onClick={onClose} aria-label="Затвори">
        ×
      </button>
    </div>
  );
}
