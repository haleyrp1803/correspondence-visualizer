/*
 * Phase 2.3 sheet-purpose policy for the isolated universal-upload prototype.
 *
 * A sheet purpose is a user declaration, not an inferred ontology. These pure
 * helpers decide which prototype steps should expose a sheet after that user
 * declaration. They do not classify sheets automatically and do not alter the
 * production import pipeline.
 */

import { PERIDOT_SHEET_PURPOSES } from './peridotUniversalMappingModel.js';

export const PERIDOT_UNIVERSAL_NAMED_THING_KIND_OPTIONS = Object.freeze([
  Object.freeze({ value: 'person', label: 'People' }),
  Object.freeze({ value: 'place', label: 'Places or sites' }),
  Object.freeze({ value: 'organization', label: 'Organizations or institutions' }),
  Object.freeze({ value: 'object', label: 'Objects, works, or material things' }),
  Object.freeze({ value: 'other', label: 'Another kind of named thing' }),
]);

export const PERIDOT_UNIVERSAL_SHEET_PURPOSE_POLICY = Object.freeze({
  [PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS]: Object.freeze({
    label: 'Individual records',
    explanation: 'Treat rows as individual records or observations that can contribute variables.',
    mappingMode: 'data',
    exposesFields: true,
    allowsRepeatedHeadings: true,
    allowsConnections: true,
    requiresNamedThingKind: false,
  }),
  [PERIDOT_SHEET_PURPOSES.NAMED_THINGS]: Object.freeze({
    label: 'Named things',
    explanation: 'Treat rows as descriptions of people, places, organizations, objects, or another named thing.',
    mappingMode: 'data',
    exposesFields: true,
    allowsRepeatedHeadings: true,
    allowsConnections: true,
    requiresNamedThingKind: true,
  }),
  [PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS]: Object.freeze({
    label: 'Summary or totals',
    explanation: 'Keep this as already-summarized data. Its fields may still be mapped, but Peridot should not mistake each row for a source record.',
    mappingMode: 'data',
    exposesFields: true,
    allowsRepeatedHeadings: true,
    allowsConnections: true,
    requiresNamedThingKind: false,
  }),
  [PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES]: Object.freeze({
    label: 'Allowed names or categories',
    explanation: 'Retain this as reference vocabulary. It is not treated as research observations in later mapping steps.',
    mappingMode: 'reference',
    exposesFields: false,
    allowsRepeatedHeadings: false,
    allowsConnections: false,
    requiresNamedThingKind: false,
  }),
  [PERIDOT_SHEET_PURPOSES.NOTES_MAINTENANCE]: Object.freeze({
    label: 'Notes or workbook maintenance',
    explanation: 'Retain the sheet in the source manifest but withhold it from research-variable mapping.',
    mappingMode: 'inactive',
    exposesFields: false,
    allowsRepeatedHeadings: false,
    allowsConnections: false,
    requiresNamedThingKind: false,
  }),
  [PERIDOT_SHEET_PURPOSES.IGNORE]: Object.freeze({
    label: 'Ignored',
    explanation: 'Preserve source metadata but do not use this sheet in the universal mapping result.',
    mappingMode: 'inactive',
    exposesFields: false,
    allowsRepeatedHeadings: false,
    allowsConnections: false,
    requiresNamedThingKind: false,
  }),
  [PERIDOT_SHEET_PURPOSES.UNSURE]: Object.freeze({
    label: 'Unsure',
    explanation: 'Choose a purpose before Peridot exposes this sheet to later mapping steps.',
    mappingMode: 'unresolved',
    exposesFields: false,
    allowsRepeatedHeadings: false,
    allowsConnections: false,
    requiresNamedThingKind: false,
  }),
});

function cleanText(value) {
  return String(value ?? '').trim();
}

export function getPeridotUniversalSheetPurposePolicy(purpose) {
  return PERIDOT_UNIVERSAL_SHEET_PURPOSE_POLICY[purpose]
    || PERIDOT_UNIVERSAL_SHEET_PURPOSE_POLICY[PERIDOT_SHEET_PURPOSES.UNSURE];
}

export function inspectPeridotUniversalSheetPurposeAssignment(assignment = {}) {
  const purpose = assignment?.purpose || PERIDOT_SHEET_PURPOSES.UNSURE;
  const policy = getPeridotUniversalSheetPurposePolicy(purpose);
  const missingNamedThingKind = policy.requiresNamedThingKind && !cleanText(assignment?.namedThingKind);
  const unresolvedPurpose = purpose === PERIDOT_SHEET_PURPOSES.UNSURE;
  return Object.freeze({
    sourceTableId: cleanText(assignment?.sourceTableId),
    purpose,
    namedThingKind: cleanText(assignment?.namedThingKind),
    policy,
    ready: !unresolvedPurpose && !missingNamedThingKind,
    unresolvedPurpose,
    missingNamedThingKind,
  });
}

export function isPeridotUniversalSheetAvailableFor(state, sourceTableId, capability) {
  const assignment = (state?.sheetPurposes || []).find((item) => item.sourceTableId === sourceTableId) || {
    sourceTableId,
    purpose: PERIDOT_SHEET_PURPOSES.UNSURE,
  };
  const inspection = inspectPeridotUniversalSheetPurposeAssignment(assignment);
  if (!inspection.ready) return false;
  if (capability === 'fields') return inspection.policy.exposesFields;
  if (capability === 'repeated-headings') return inspection.policy.allowsRepeatedHeadings;
  if (capability === 'connections') return inspection.policy.allowsConnections;
  return false;
}

export function listPeridotUniversalPrototypeTablesFor(state, capability) {
  const tables = Array.isArray(state?.sourceManifest?.sourceTables) ? state.sourceManifest.sourceTables : [];
  return Object.freeze(tables.filter((table) => isPeridotUniversalSheetAvailableFor(state, table.id, capability)));
}

export function buildPeridotUniversalSheetPurposeReview(state) {
  const tables = Array.isArray(state?.sourceManifest?.sourceTables) ? state.sourceManifest.sourceTables : [];
  const rows = tables.map((table) => {
    const assignment = (state?.sheetPurposes || []).find((item) => item.sourceTableId === table.id) || {
      sourceTableId: table.id,
      purpose: PERIDOT_SHEET_PURPOSES.UNSURE,
    };
    const inspection = inspectPeridotUniversalSheetPurposeAssignment(assignment);
    return Object.freeze({
      sourceTableId: table.id,
      label: table.label || table.sheetName || table.id,
      purpose: inspection.purpose,
      purposeLabel: inspection.policy.label,
      namedThingKind: inspection.namedThingKind,
      mappingMode: inspection.policy.mappingMode,
      ready: inspection.ready,
      unresolvedPurpose: inspection.unresolvedPurpose,
      missingNamedThingKind: inspection.missingNamedThingKind,
      explanation: inspection.policy.explanation,
    });
  });
  return Object.freeze({
    rows: Object.freeze(rows),
    ready: rows.every((row) => row.ready),
    unresolvedCount: rows.filter((row) => row.unresolvedPurpose).length,
    namedThingKindNeededCount: rows.filter((row) => row.missingNamedThingKind).length,
    dataTableCount: rows.filter((row) => row.mappingMode === 'data' && row.ready).length,
    referenceTableCount: rows.filter((row) => row.mappingMode === 'reference' && row.ready).length,
    inactiveTableCount: rows.filter((row) => row.mappingMode === 'inactive' && row.ready).length,
  });
}
