/*
 * Phase 2.1 universal-upload prototype state helpers.
 *
 * This module is deliberately isolated from the active import pipeline. It lets
 * Peridot describe a complicated user-owned mapping with the Phase 1 universal
 * schema without changing correspondence/genealogy runtime behavior.
 */

import {
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_GENERATED_VARIABLE_SOURCES,
  PERIDOT_SHEET_PURPOSES,
  PERIDOT_TABLE_CONNECTION_TYPES,
  PERIDOT_VARIABLE_KINDS,
  makePeridotFieldAssignment,
  makePeridotRepeatedHeadingGroup,
  makePeridotSavedVariable,
  makePeridotSavedVariables,
  makePeridotSheetPurposeAssignment,
  makePeridotTableConnection,
  makePeridotUniversalMappingDefinition,
} from './peridotUniversalMappingModel.js';
import {
  findPeridotUniversalFieldSuggestion,
  recognizePeridotUniversalFields,
} from './peridotUniversalFieldRecognizers.js';
import {
  buildPeridotUniversalSheetPurposeReview,
  isPeridotUniversalSheetAvailableFor,
  listPeridotUniversalPrototypeTablesFor,
} from './peridotUniversalSheetPurposePolicy.js';
import {
  PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS,
  buildPeridotRepeatedStructurePreview,
} from './peridotUniversalRepeatedStructure.js';
import {
  PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS,
  buildPeridotTableConnectionMatchReport,
  buildPeridotTableConnectionReview,
} from './peridotUniversalTableConnections.js';

export const PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEPS = Object.freeze([
  'sources',
  'purposes',
  'variables',
  'repeated-headings',
  'connections',
  'review',
]);

export const PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEP_LABELS = Object.freeze({
  sources: 'Your data',
  purposes: 'What each sheet contains',
  variables: 'Variables',
  'repeated-headings': 'Repeated columns',
  connections: 'Connect sheets',
  review: 'Review',
});

export const PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_PURPOSE_OPTIONS = Object.freeze([
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS, label: 'Individual records' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, label: 'A list describing people, places, or other named things' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS, label: 'A summary or totals' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES, label: 'A list of allowed names or categories' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.NOTES_MAINTENANCE, label: 'Notes or workbook maintenance' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.IGNORE, label: 'Ignore this sheet' }),
  Object.freeze({ value: PERIDOT_SHEET_PURPOSES.UNSURE, label: 'Unsure' }),
]);

export const PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_VARIABLE_KIND_OPTIONS = Object.freeze([
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.ENTITY, label: 'Person, organization, or other named thing' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.PLACE, label: 'Place' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.TEMPORAL, label: 'Date or time' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.NUMBER, label: 'Number or measurement' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.CATEGORY, label: 'Category or label' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.RELATIONSHIP, label: 'Relationship' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.TEXT, label: 'Text or notes' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.EVIDENCE, label: 'Citation or evidence' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.IDENTIFIER, label: 'Identifier' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.LINK_MEDIA, label: 'Link or media' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.BOOLEAN, label: 'Yes / no' }),
  Object.freeze({ value: PERIDOT_VARIABLE_KINDS.OTHER, label: 'Other' }),
]);

function asText(value) {
  return String(value ?? '').trim();
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function sourceTables(sourceManifest) {
  return Array.isArray(sourceManifest?.sourceTables) ? sourceManifest.sourceTables : [];
}

function tableById(sourceManifest, tableId) {
  return sourceTables(sourceManifest).find((table) => table.id === tableId) || null;
}

function fieldById(sourceManifest, fieldId) {
  for (const table of sourceTables(sourceManifest)) {
    const field = (table.fields || []).find((item) => item.id === fieldId);
    if (field) return field;
  }
  return null;
}

function makeVariableId(label, existing = []) {
  const stem = asText(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'variable';
  const ids = new Set(existing.map((item) => item.id));
  let candidate = `variable:${stem}`;
  let index = 2;
  while (ids.has(candidate)) {
    candidate = `variable:${stem}-${index}`;
    index += 1;
  }
  return candidate;
}

export function makePeridotUniversalUploadPrototypeState({
  sourceManifest = {},
  sourceRowsByTableId = {},
  mapping = {},
  savedVariables = [],
  dismissedSuggestionIds = [],
} = {}) {
  const normalizedMapping = makePeridotUniversalMappingDefinition(mapping);
  return Object.freeze({
    sourceManifest,
    // Prototype-only source rows are kept outside the Phase 1 source manifest so
    // canonical structural metadata does not duplicate uploaded row content.
    sourceRowsByTableId,
    savedVariables: makePeridotSavedVariables(savedVariables),
    sheetPurposes: Object.freeze(cloneArray(normalizedMapping.sheetPurposes)),
    fieldAssignments: Object.freeze(cloneArray(normalizedMapping.fieldAssignments)),
    repeatedHeadingGroups: Object.freeze(cloneArray(normalizedMapping.repeatedHeadingGroups)),
    tableConnections: Object.freeze(cloneArray(normalizedMapping.tableConnections)),
    dismissedSuggestionIds: Object.freeze(Array.from(new Set(dismissedSuggestionIds.map(asText).filter(Boolean)))),
  });
}

function replaceState(state, changes) {
  return makePeridotUniversalUploadPrototypeState({
    sourceManifest: state.sourceManifest,
    sourceRowsByTableId: state.sourceRowsByTableId,
    savedVariables: changes.savedVariables ?? state.savedVariables,
    mapping: {
      id: 'universal-upload-prototype',
      label: 'Universal upload prototype',
      sheetPurposes: changes.sheetPurposes ?? state.sheetPurposes,
      fieldAssignments: changes.fieldAssignments ?? state.fieldAssignments,
      repeatedHeadingGroups: changes.repeatedHeadingGroups ?? state.repeatedHeadingGroups,
      tableConnections: changes.tableConnections ?? state.tableConnections,
    },
    dismissedSuggestionIds: changes.dismissedSuggestionIds ?? state.dismissedSuggestionIds,
  });
}

export function setPrototypeSheetPurpose(state, { sourceTableId, purpose, namedThingKind = '' } = {}) {
  const next = state.sheetPurposes.filter((item) => item.sourceTableId !== sourceTableId);
  next.push(makePeridotSheetPurposeAssignment({ sourceTableId, purpose, namedThingKind }));
  return replaceState(state, { sheetPurposes: next });
}

export function addPrototypeSavedVariable(state, { label, kind = PERIDOT_VARIABLE_KINDS.OTHER, semanticRole = '', unit = '' } = {}) {
  const variable = makePeridotSavedVariable({
    id: makeVariableId(label, state.savedVariables),
    label,
    kind,
    semanticRole,
    unit,
  });
  return replaceState(state, { savedVariables: [...state.savedVariables, variable] });
}

export function assignPrototypeField(state, { sourceTableId, sourceFieldId, variableId, status = PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE } = {}) {
  const field = fieldById(state.sourceManifest, sourceFieldId);
  const next = state.fieldAssignments.filter((item) => item.sourceFieldId !== sourceFieldId);
  next.push(makePeridotFieldAssignment({
    sourceTableId,
    sourceFieldId,
    sourceFieldName: field?.name || '',
    variableId,
    status,
  }));
  return replaceState(state, { fieldAssignments: next });
}

export function setPrototypeFieldIgnored(state, { sourceTableId, sourceFieldId } = {}) {
  return assignPrototypeField(state, {
    sourceTableId,
    sourceFieldId,
    variableId: '',
    status: PERIDOT_FIELD_ASSIGNMENT_STATUS.IGNORED,
  });
}

export function getPrototypeFieldSuggestions(state, { includeAssigned = false, includeDismissed = false } = {}) {
  const dismissed = new Set(state.dismissedSuggestionIds || []);
  const assigned = new Set((state.fieldAssignments || [])
    .filter((item) => item.status !== PERIDOT_FIELD_ASSIGNMENT_STATUS.UNASSIGNED)
    .map((item) => item.sourceFieldId));
  const eligibleTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'fields').map((table) => table.id));
  return recognizePeridotUniversalFields({
    sourceManifest: state.sourceManifest,
    sourceRowsByTableId: state.sourceRowsByTableId,
  }).filter((suggestion) => eligibleTableIds.has(suggestion.sourceTableId)
    && (includeDismissed || !dismissed.has(suggestion.id))
    && (includeAssigned || !assigned.has(suggestion.sourceFieldId)));
}

export function dismissPrototypeFieldSuggestion(state, suggestionId) {
  return replaceState(state, {
    dismissedSuggestionIds: [...state.dismissedSuggestionIds, asText(suggestionId)],
  });
}

export function restorePrototypeFieldSuggestion(state, suggestionId) {
  return replaceState(state, {
    dismissedSuggestionIds: state.dismissedSuggestionIds.filter((id) => id !== suggestionId),
  });
}

export function acceptPrototypeFieldSuggestion(state, {
  suggestionId,
  label,
  kind,
  semanticRole,
  temporalRole,
  variableId = '',
} = {}) {
  const suggestions = recognizePeridotUniversalFields({
    sourceManifest: state.sourceManifest,
    sourceRowsByTableId: state.sourceRowsByTableId,
  });
  const suggestion = findPeridotUniversalFieldSuggestion(suggestions, suggestionId);
  if (!suggestion) return state;

  let next = state;
  let chosenVariableId = asText(variableId);
  if (!chosenVariableId) {
    const variable = makePeridotSavedVariable({
      id: makeVariableId(label || suggestion.suggestedLabel, state.savedVariables),
      label: label || suggestion.suggestedLabel,
      kind: kind || suggestion.suggestedKind,
      semanticRole: semanticRole ?? suggestion.semanticRole,
      temporalRole: temporalRole ?? suggestion.temporalRole,
      sourceFieldIds: [suggestion.sourceFieldId],
      attributes: { recognizedFromSourceStructure: true },
    });
    chosenVariableId = variable.id;
    next = replaceState(next, { savedVariables: [...next.savedVariables, variable] });
  }

  next = assignPrototypeField(next, {
    sourceTableId: suggestion.sourceTableId,
    sourceFieldId: suggestion.sourceFieldId,
    variableId: chosenVariableId,
    status: PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE,
  });
  return restorePrototypeFieldSuggestion(next, suggestionId);
}

export function savePrototypeRepeatedHeadingGroup(state, {
  id = '',
  sourceTableId,
  sourceFieldIds = [],
  headingVariableId,
  cellVariableId,
  attachedFieldIds = [],
  orientationMode = PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE,
  rowLabelFieldId = '',
  rowLabelVariableId = '',
  blankHandling = 'preserve',
  textHandling = 'preserve',
} = {}) {
  const groupId = asText(id) || `repeated-heading:${state.repeatedHeadingGroups.length + 1}`;
  const group = makePeridotRepeatedHeadingGroup({
    id: groupId,
    sourceTableId,
    sourceFieldIds,
    headingVariableId,
    cellVariableId,
    attachedFieldIds,
    blankHandling,
    textHandling,
    generatedVariableSource: orientationMode === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS
      ? PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS
      : PERIDOT_GENERATED_VARIABLE_SOURCES.REPEATED_HEADINGS,
    attributes: {
      orientationMode,
      rowLabelFieldId: orientationMode === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS ? rowLabelFieldId : '',
      rowLabelVariableId: orientationMode === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS ? rowLabelVariableId : '',
    },
  });
  const nextGroups = state.repeatedHeadingGroups.filter((item) => item.id !== groupId);
  nextGroups.push(group);
  return replaceState(state, { repeatedHeadingGroups: nextGroups });
}

// Backward-compatible prototype helper retained for the earlier Phase 2 fixtures.
export function addPrototypeRepeatedHeadingGroup(state, options = {}) {
  return savePrototypeRepeatedHeadingGroup(state, {
    ...options,
    orientationMode: options.transposeFirst
      ? PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS
      : (options.orientationMode || PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE),
  });
}

export function removePrototypeRepeatedHeadingGroup(state, groupId) {
  return replaceState(state, {
    repeatedHeadingGroups: state.repeatedHeadingGroups.filter((group) => group.id !== groupId),
  });
}

export function savePrototypeTableConnection(state, {
  id = '',
  fromTableId,
  fromFieldId,
  toTableId,
  toFieldId,
  label = '',
  multipleMatchesExpectation = PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.UNANSWERED,
} = {}) {
  const connectionId = asText(id) || `table-connection:${state.tableConnections.length + 1}`;
  const connection = makePeridotTableConnection({
    id: connectionId,
    fromTableId,
    fromFieldId,
    toTableId,
    toFieldId,
    connectionType: PERIDOT_TABLE_CONNECTION_TYPES.MATCHING_FIELDS,
    label,
    attributes: { multipleMatchesExpectation },
  });
  const nextConnections = state.tableConnections.filter((item) => item.id !== connectionId);
  nextConnections.push(connection);
  return replaceState(state, { tableConnections: nextConnections });
}

// Backward-compatible helper retained for earlier prototype fixtures.
export function addPrototypeTableConnection(state, options = {}) {
  return savePrototypeTableConnection(state, options);
}

export function getPrototypeTableConnectionReport(state, connection, { maxRows = 12 } = {}) {
  return buildPeridotTableConnectionMatchReport({
    sourceManifest: state.sourceManifest,
    sourceRowsByTableId: state.sourceRowsByTableId,
    connection,
    maxRows,
  });
}

export function removePrototypeTableConnection(state, connectionId) {
  return replaceState(state, {
    tableConnections: state.tableConnections.filter((connection) => connection.id !== connectionId),
  });
}

export function buildPeridotUniversalUploadPrototypeResult(state) {
  const purposeReview = buildPeridotUniversalSheetPurposeReview(state);
  const fieldTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'fields').map((table) => table.id));
  const repeatedTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'repeated-headings').map((table) => table.id));
  const connectionTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'connections').map((table) => table.id));

  // Keep draft choices in prototype state, but only serialize mappings from sheets
  // whose user-declared purpose makes those choices operational. This means a
  // researcher can temporarily mark a sheet Ignore/Unsure and later restore it
  // without Peridot silently using its dormant mappings in the saved result.
  const operationalFieldAssignments = state.fieldAssignments.filter((item) => fieldTableIds.has(item.sourceTableId));
  const operationalRepeatedHeadingGroups = state.repeatedHeadingGroups.filter((item) => repeatedTableIds.has(item.sourceTableId));
  const operationalTableConnections = state.tableConnections.filter((item) => connectionTableIds.has(item.fromTableId) && connectionTableIds.has(item.toTableId));

  const universalMapping = makePeridotUniversalMappingDefinition({
    id: 'universal-upload-prototype',
    label: 'Universal upload prototype',
    sheetPurposes: state.sheetPurposes,
    fieldAssignments: operationalFieldAssignments,
    repeatedHeadingGroups: operationalRepeatedHeadingGroups,
    tableConnections: operationalTableConnections,
  });

  const tables = sourceTables(state.sourceManifest);
  const assignedFieldIds = new Set(operationalFieldAssignments.filter((item) => item.status === PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE).map((item) => item.sourceFieldId));
  const ignoredFieldIds = new Set(operationalFieldAssignments.filter((item) => item.status === PERIDOT_FIELD_ASSIGNMENT_STATUS.IGNORED).map((item) => item.sourceFieldId));
  const operationalFieldIds = tables.filter((table) => fieldTableIds.has(table.id)).flatMap((table) => (table.fields || []).map((field) => field.id));
  const allFieldIds = tables.flatMap((table) => (table.fields || []).map((field) => field.id));
  const repeatedStructurePreviews = operationalRepeatedHeadingGroups.map((group) => Object.freeze({
    groupId: group.id,
    ...buildPeridotRepeatedStructurePreview({
      sourceManifest: state.sourceManifest,
      sourceRowsByTableId: state.sourceRowsByTableId,
      savedVariables: state.savedVariables,
      fieldAssignments: operationalFieldAssignments,
      group,
      maxRows: 8,
    }),
  }));
  const tableConnectionReview = buildPeridotTableConnectionReview({
    sourceManifest: state.sourceManifest,
    sourceRowsByTableId: state.sourceRowsByTableId,
    connections: operationalTableConnections,
  });

  return Object.freeze({
    savedVariables: state.savedVariables,
    universalMapping,
    sheetPurposeReview: purposeReview,
    repeatedStructurePreviews: Object.freeze(repeatedStructurePreviews),
    tableConnectionReview,
    summary: Object.freeze({
      sourceTables: tables.length,
      sourceFields: allFieldIds.length,
      sheetPurposesAssigned: state.sheetPurposes.length,
      unresolvedSheetPurposes: purposeReview.unresolvedCount,
      namedThingKindsNeeded: purposeReview.namedThingKindNeededCount,
      mappingEligibleTables: purposeReview.dataTableCount,
      referenceTables: purposeReview.referenceTableCount,
      inactiveTables: purposeReview.inactiveTableCount,
      savedVariables: state.savedVariables.length,
      assignedFields: assignedFieldIds.size,
      ignoredFields: ignoredFieldIds.size,
      unassignedFields: operationalFieldIds.filter((id) => !assignedFieldIds.has(id) && !ignoredFieldIds.has(id)).length,
      withheldFields: allFieldIds.length - operationalFieldIds.length,
      repeatedHeadingGroups: operationalRepeatedHeadingGroups.length,
      tableConnections: operationalTableConnections.length,
      unresolvedConnectionQuestions: tableConnectionReview.unresolvedMultipleMatchQuestions,
      connectionExpectationConflicts: tableConnectionReview.expectationConflicts,
    }),
  });
}

export function getPrototypeTablesForStep(state, capability) {
  return listPeridotUniversalPrototypeTablesFor(state, capability);
}

export function isPrototypeSheetAvailableFor(state, sourceTableId, capability) {
  return isPeridotUniversalSheetAvailableFor(state, sourceTableId, capability);
}

export function describePrototypeTable(state, sourceTableId) {
  const table = tableById(state.sourceManifest, sourceTableId);
  const purpose = state.sheetPurposes.find((item) => item.sourceTableId === sourceTableId);
  return Object.freeze({
    id: sourceTableId,
    label: table?.label || table?.sheetName || sourceTableId,
    rowCount: table?.rowCount || 0,
    fields: Object.freeze([...(table?.fields || [])]),
    purpose: purpose?.purpose || PERIDOT_SHEET_PURPOSES.UNSURE,
  });
}
