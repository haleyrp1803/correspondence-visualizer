import React from 'react';
import { buildPeridotRecordStructure, peridotRecordStructureHasContent } from './peridotRecordStructure.js';

function Section({ title, entries, onOpenPersonDetail, onOpenPlaceDetail, kind }) {
  if (!entries?.length) return null;

  return (
    <section className="rounded-xl border border-[var(--section-border)]/70 bg-[var(--section-bg)]/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--detail-label-text)]">{title}</div>
      <div className="mt-2 divide-y divide-[var(--section-border)]/60">
        {entries.map((entry, index) => {
          const canOpenPerson = (kind === 'participants' || kind === 'relationships') && typeof onOpenPersonDetail === 'function';
          const canOpenPlace = kind === 'places' && typeof onOpenPlaceDetail === 'function';
          const onClick = canOpenPerson
            ? () => onOpenPersonDetail(
              entry.counterpart || entry.value,
              entry.counterpartId || entry.entityId || '',
            )
            : canOpenPlace
              ? () => onOpenPlaceDetail(entry.value)
              : undefined;
          return (
            <div key={`${title}:${entry.label}:${entry.value}:${index}`} className="py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs font-semibold text-[var(--panel-card-text)]">{entry.label}</span>
                {entry.subject ? (
                  <span className="text-[11px] text-[var(--panel-card-muted-text)]">for {entry.subject}</span>
                ) : null}
              </div>
              {onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className="mt-1 inline-flex max-w-full rounded-md border border-[var(--button-border)] bg-[var(--button-bg)] px-2 py-1 text-left text-sm text-[var(--button-text)] transition hover:border-[var(--button-hover-border)] hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-text)]"
                >
                  <span className="break-words">{entry.value}</span>
                </button>
              ) : (
                <div className="mt-1 break-words text-sm text-[var(--panel-card-text)]">{entry.value}</div>
              )}
              {entry.detail ? <div className="mt-1 text-xs text-[var(--panel-card-muted-text)]">{entry.detail}</div> : null}
              {entry.notes?.length ? (
                <div className="mt-1 space-y-0.5 text-xs text-[var(--panel-card-muted-text)]">
                  {entry.notes.map((note, noteIndex) => (
                    <div key={`${note.label}:${noteIndex}`}><span className="font-semibold">{note.label}:</span> {note.value}</div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PeridotRecordStructure({ row, structure: providedStructure = null, compact = false, title = 'Mapped information', onOpenPersonDetail, onOpenPlaceDetail }) {
  const structure = providedStructure || buildPeridotRecordStructure(row || {});
  if (!peridotRecordStructureHasContent(structure)) return null;

  const content = (
    <div className={`grid gap-2 ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2'}`}>
      <Section title="Dates and periods" entries={structure.temporal} kind="temporal" />
      <Section title="People / entities" entries={structure.participants} kind="participants" onOpenPersonDetail={onOpenPersonDetail} />
      <Section title="Places" entries={structure.places} kind="places" onOpenPlaceDetail={onOpenPlaceDetail} />
      <Section title="Relationships" entries={structure.relationships} kind="relationships" onOpenPersonDetail={onOpenPersonDetail} />
      <Section title="Evidence / other fields" entries={structure.evidence} kind="evidence" />
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-xl border border-[var(--section-border)]/70 bg-[var(--section-bg)]/55 px-3 py-2" style={{ gridColumn: '1 / -1' }}>
        <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--detail-label-text)]">
          {title}
        </summary>
        <div className="mt-2">{content}</div>
      </details>
    );
  }

  return (
    <section className="mt-3 rounded-2xl border border-[var(--section-border)]/80 bg-[var(--utility-panel-bg)] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-card-muted-text)]">
        {title}
      </div>
      {content}
    </section>
  );
}
