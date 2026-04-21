import React from 'react';

export function InspectorConnectedCorrespondents({ names, onOpenPerson }) {
  if (!names?.length) return null;

  const extractName = (value) => value.replace(/\s*\(\d+\)\s*$/, '');

  return (
    <div className="rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] p-4 shadow-sm">
      <div className="font-semibold text-[var(--text-strong)] tracking-[0.14em] uppercase text-[11px]">
        Correspondents by letter count
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onOpenPerson(extractName(name))}
            className="rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
