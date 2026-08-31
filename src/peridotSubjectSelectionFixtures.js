import {
  expandPeridotSubjectSelection,
  normalizePeridotSubjectSelection,
  normalizePeridotSubjectSelectionFromMapping,
} from './peridotSubjectSelection.js';

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function runPeridotSubjectSelectionFixtureAudit() {
  const checks = [];
  const push = (id, ok, detail = '') => checks.push({ id, ok: Boolean(ok), detail });

  push(
    'legacy-record-default',
    same(normalizePeridotSubjectSelectionFromMapping({ subjectParticipantIndex: null }), { includeRecord: true, participantIndices: [] }),
    'Old blank/null subject mappings remain record-level.'
  );
  push(
    'legacy-single-participant',
    same(normalizePeridotSubjectSelectionFromMapping({ subjectParticipantIndex: 1 }), { includeRecord: false, participantIndices: [1] }),
    'Old singular participant mappings migrate to one selected participant.'
  );
  push(
    'record-plus-participants',
    same(
      normalizePeridotSubjectSelection({ includeRecord: true, participantIndices: [2, 0, 2] }),
      { includeRecord: true, participantIndices: [0, 2] }
    ),
    'Explicit selections preserve record + multiple participant subjects and deduplicate indices.'
  );
  push(
    'atomic-subject-expansion',
    same(
      expandPeridotSubjectSelection({ subjectSelection: { includeRecord: true, participantIndices: [0, 2] } }),
      [null, 0, 2]
    ),
    'One mapping-level subject selection expands to atomic record/participant subject markers.'
  );
  push(
    'empty-selection-fallback',
    same(normalizePeridotSubjectSelection({ includeRecord: false, participantIndices: [] }), { includeRecord: true, participantIndices: [] }),
    'An invalid empty selection falls back conservatively to the row/record.'
  );

  return {
    passed: checks.every((check) => check.ok),
    checks,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPeridotSubjectSelectionFixtureAudit();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
