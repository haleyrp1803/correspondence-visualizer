import React from 'react';

export function InspectorBackButton({ canGoBack, onBack }) {
  if (!canGoBack) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
      >
        Back
      </button>
    </div>
  );
}
