import React from 'react';

function getDisplayLabel(item) {
  if (typeof item === 'string') return item;
  if (!item?.label) return '';
  return Number.isFinite(item.count) ? `${item.label} (${item.count})` : item.label;
}

function getPersonName(item) {
  if (typeof item !== 'string') return item?.label || '';
  const match = item.match(/^(.*) \((\d+)\)$/);
  return match ? match[1] : item;
}

export function InspectorConnectedCorrespondents({ names, onOpenPerson }) {
  if (!names?.length) return null;

  return (
    <div className="rounded-[24px] border border-[var(--section-border)] bg-[var(--section-bg)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="font-semibold text-[var(--text-strong)] tracking-[0.14em] uppercase text-[11px]">
        Connected correspondents
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {names.map((item) => {
          const displayLabel = getDisplayLabel(item);
          const personName = getPersonName(item);

          return (
            <button
              key={displayLabel}
              type="button"
              onClick={() => onOpenPerson?.(personName)}
              className="rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-hover)]"
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
