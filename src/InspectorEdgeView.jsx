/*
 * Route / edge Inspector view.
 *
 * This component renders evidence for directed routes or network edges,
 * including related records and route details.
 *
 * Important relationships:
 * - Edge selections are built from graph/route data in `App.jsx` and `interactionHelpers.js`.
 * - Related-record navigation should participate in shared Inspector history.
 *
 * Maintenance cautions:
 * - Directed route semantics matter. Avoid collapsing source→target and target→source evidence unless a pass explicitly changes route direction behavior.
 */

import React from 'react';

function detailLabelClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--detail-label-text)]';
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-[var(--section-border)]/80 py-1.5 last:border-b-0">
      <div className={detailLabelClassName()}>{label}</div>
      <div className="mt-0.5 break-words text-sm text-[var(--text-main)]">{value || '—'}</div>
    </div>
  );
}

function CompactRoutePrompt({ linkedRecordCount }) {
  return (
    <div className="rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] p-3 text-sm text-[var(--text-main)] shadow-sm">
      <div className="font-semibold uppercase tracking-[0.14em] text-[var(--detail-label-text)]">
        At a glance
      </div>
      <p className="mt-2 leading-relaxed text-[var(--text-muted)]">
        This compact Inspector shows the connection direction, represented weight, and related-record count.
        Expand the Inspector for the chronological record list.
      </p>
      <div className="mt-3 rounded-xl border border-[var(--section-border)]/70 bg-[var(--panel-card-bg)] px-3 py-2 text-xs">
        <div className="font-semibold text-[var(--text-strong)]">{linkedRecordCount || 0}</div>
        <div className="text-[var(--text-muted)]">related records</div>
      </div>
    </div>
  );
}

function RouteLead({ selectedProps, linkedRecordCount }) {
  const directionGlyph = selectedProps.direction === 'directed' ? '→' : '—';
  const routeLabel = `${selectedProps.sourceLabel} ${directionGlyph} ${selectedProps.targetLabel}`;
  const dateSpan = (selectedProps.dates || []).length
    ? `${selectedProps.dates[0]}${selectedProps.dates.length > 1 ? `–${selectedProps.dates[selectedProps.dates.length - 1]}` : ''}`
    : '';

  return (
    <section className="rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] p-3">
      <div className={detailLabelClassName()}>Connection</div>
      <h2 className="mt-1 break-words [font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-2xl font-semibold tracking-[-0.025em] text-[var(--heading-text)]">
        {routeLabel}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text-main)]">
        This connection has a represented weight of{' '}
        <span className="font-semibold text-[var(--text-strong)]">{selectedProps.count || 0}</span> and is associated
        with <span className="font-semibold text-[var(--text-strong)]">{linkedRecordCount || 0}</span> related
        record{linkedRecordCount === 1 ? '' : 's'}
        {dateSpan ? <> from <span className="font-semibold text-[var(--text-strong)]">{dateSpan}</span></> : null}.
      </p>
    </section>
  );
}

export function InspectorEdgeView({
  InspectorSummaryCardComponent,
  LinkedLettersPanelComponent,
  InspectorClearSelectionButtonComponent,

  selectedProps,
  clearSelection,
  linkedLettersToShow,
  selectedLetterMetadata,
  showAllLinkedLetters,
  setShowAllLinkedLetters,
  isLetterSectionExpanded,
  toggleLetterSection,
  onOpenLetterDetail,
  isCompact = false,
}) {
  const linkedRecordCount = (selectedProps.letterMetadata || []).length;

  if (isCompact) {
    return (
      <div className="space-y-3">
        <InspectorSummaryCardComponent>
          <DetailRow label="Connection" value={`${selectedProps.sourceLabel} ${selectedProps.direction === 'directed' ? '→' : '—'} ${selectedProps.targetLabel}`} />
          <DetailRow label="Relationship" value={selectedProps.relationshipType || selectedProps.relationshipLabel} />
          <DetailRow label="Direction" value={selectedProps.direction || 'undirected'} />
          <DetailRow label="Weight" value={selectedProps.count} />
          <DetailRow label="Dates represented" value={(selectedProps.dates || []).join('; ')} />
          <DetailRow label="Related records" value={linkedRecordCount} />
        </InspectorSummaryCardComponent>

        <CompactRoutePrompt linkedRecordCount={linkedRecordCount} />

        <InspectorClearSelectionButtonComponent onClear={clearSelection} />
      </div>
    );
  }

  return (
    <article className="space-y-3">
      <RouteLead selectedProps={selectedProps} linkedRecordCount={linkedRecordCount} />

      <div className="grid gap-3 md:grid-cols-2">
        <InspectorSummaryCardComponent>
          <DetailRow
            label={selectedProps.direction === 'directed' ? 'Source endpoint' : (selectedProps.sourceRole || 'Endpoint A')}
            value={selectedProps.sourceLabel}
          />
          <DetailRow
            label={selectedProps.direction === 'directed' ? 'Target endpoint' : (selectedProps.targetRole || 'Endpoint B')}
            value={selectedProps.targetLabel}
          />
          <DetailRow label="Sample pairs" value={(selectedProps.samplePairs || []).join('; ')} />
        </InspectorSummaryCardComponent>

        <InspectorSummaryCardComponent>
          <DetailRow label="Relationship" value={selectedProps.relationshipType || selectedProps.relationshipLabel} />
          <DetailRow label="Direction" value={selectedProps.direction || 'undirected'} />
          <DetailRow label="Related records" value={linkedRecordCount} />
        </InspectorSummaryCardComponent>
      </div>

      <LinkedLettersPanelComponent
        linkedLettersToShow={linkedLettersToShow}
        selectedLetterMetadata={selectedLetterMetadata}
        showAllLinkedLetters={showAllLinkedLetters}
        setShowAllLinkedLetters={setShowAllLinkedLetters}
        isLetterSectionExpanded={isLetterSectionExpanded}
        toggleLetterSection={toggleLetterSection}
        onOpenLetterDetail={onOpenLetterDetail}
      />

      <div className="flex justify-end">
        <InspectorClearSelectionButtonComponent onClear={clearSelection} />
      </div>
    </article>
  );
}
