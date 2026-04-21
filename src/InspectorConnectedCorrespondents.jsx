import React from 'react';

export function InspectorConnectedCorrespondents({ names, onOpenPerson }) {
  if (!names?.length) return null;

  return (
    <div className="rounded-[24px] border border-[var(--section-border)] bg-[var(--section-bg)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="font-semibold text-[var(--text-strong)] tracking-[0.14em] uppercase text-[11px]">
        Connected correspondents
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onOpenPerson?.(name)}
            className="rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
