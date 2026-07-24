/*
 * Dependency-free audit for Pass 3B.3 supplemental-row decisions.
 */
import {
  applyPeridotGenealogySupplementalRowActions,
  buildInitialPeridotGenealogyMappingState,
  getPeridotGenealogySupplementalRows,
  PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS,
  validatePeridotGenealogyMappingWithRowActions,
} from './peridotGenealogyMapping.js';

const rows = Object.freeze([
  Object.freeze({ ID: 'P1', 'Full name': 'Person One', image: '' }),
  Object.freeze({ ID: '', 'Full name': '', image: 'second-portrait.jpg' }),
  Object.freeze({ ID: 'P2', 'Full name': 'Person Two', image: 'existing.jpg' }),
  Object.freeze({ ID: '', 'Full name': '', image: 'conflicting.jpg' }),
]);

export function runPeridotGenealogyMappingUiSelfAudit() {
  const headers = ['ID', 'Full name', 'image'];
  const state = buildInitialPeridotGenealogyMappingState(headers, rows);
  const supplemental = getPeridotGenealogySupplementalRows(rows, state.fieldMapping);
  const unresolvedValidation = validatePeridotGenealogyMappingWithRowActions(
    headers, rows, state.fieldMapping, {}
  );
  const resolvedActions = {
    1: PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.attachPrevious,
    3: PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.exclude,
  };
  const resolved = applyPeridotGenealogySupplementalRowActions(
    rows, state.fieldMapping, resolvedActions
  );
  const resolvedValidation = validatePeridotGenealogyMappingWithRowActions(
    headers, rows, state.fieldMapping, resolvedActions
  );
  const conflict = applyPeridotGenealogySupplementalRowActions(
    rows,
    state.fieldMapping,
    {
      1: PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.exclude,
      3: PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.attachPrevious,
    }
  );

  const checks = Object.freeze({
    twoSupplementalRowsDetected: supplemental.length === 2,
    unresolvedRowsBlockReadiness: unresolvedValidation.isValid === false
      && unresolvedValidation.issues.some((item) => item.code === 'unresolved_genealogy_supplemental_row'),
    attachmentFillsBlankField: resolved.rows[0]?.image === 'second-portrait.jpg',
    exclusionRemovesSupplementalRow: resolved.rows.length === 2,
    explicitActionsResolveRows: resolved.isResolved === true && resolvedValidation.isValid === true,
    attachmentNeverOverwrites: conflict.rows.find((row) => row.ID === 'P2')?.image === 'existing.jpg',
    attachmentConflictReported: conflict.conflicts.length === 1,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    supplementalRows: supplemental,
    resolvedValidation,
    conflictCount: conflict.conflicts.length,
  });
}
