import React from 'react';
import { normalizePeridotSubjectSelection } from './peridotSubjectSelection.js';

function checkboxDisabled(selection, target) {
  const totalSelected = (selection.includeRecord ? 1 : 0) + selection.participantIndices.length;
  if (totalSelected > 1) return false;
  if (target === 'record') return selection.includeRecord;
  return selection.participantIndices.includes(target);
}

export default function PeridotSubjectSelectionControl({
  value,
  legacySubjectParticipantIndex = null,
  participants = [],
  onChange,
  noun = 'information',
  showTitle = true,
}) {
  const selection = normalizePeridotSubjectSelection(value, legacySubjectParticipantIndex);
  const setRecord = (checked) => onChange?.({ ...selection, includeRecord: checked });
  const setParticipant = (participantIndex, checked) => {
    const nextIndices = checked
      ? Array.from(new Set([...selection.participantIndices, participantIndex])).sort((a, b) => a - b)
      : selection.participantIndices.filter((valueIndex) => valueIndex !== participantIndex);
    onChange?.({ ...selection, participantIndices: nextIndices });
  };

  return (
    <div className="space-y-2">
      {showTitle ? <div className="text-xs font-semibold text-[var(--muted-text)]">Who or what does this {noun} describe?</div> : null}
      <div className="space-y-2">
        <label className="flex items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
          <input
            type="checkbox"
            checked={selection.includeRecord}
            disabled={checkboxDisabled(selection, 'record')}
            onChange={(event) => setRecord(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">This row / record itself</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--panel-card-muted-text)]">This does not automatically include the participants in the row. Select any participants separately below.</span>
          </span>
        </label>
        {participants.map((participant) => (
          <label key={`subject-participant-${participant.index}`} className="flex items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="checkbox"
              checked={selection.participantIndices.includes(participant.index)}
              disabled={checkboxDisabled(selection, participant.index)}
              onChange={(event) => setParticipant(participant.index, event.target.checked)}
              className="mt-0.5"
            />
            <span className="font-semibold">{participant.label}</span>
          </label>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--panel-card-muted-text)]">
        Select every subject this mapped {noun} actually describes. Peridot preserves each selection as a separate, traceable assertion rather than combining several subjects into one assertion.
      </p>
    </div>
  );
}
