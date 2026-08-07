/*
 * Universal mapping vocabulary for Peridot canonical datasets.
 *
 * Phase 1.1 defines pure serializable constructors only. These structures
 * describe user-owned interpretations of source fields without changing the
 * source workbook, performing transformations, or replacing existing dataset
 * profiles. Runtime wiring and upload UI are intentionally out of scope.
 */

export const PERIDOT_UNIVERSAL_MAPPING_SCHEMA_VERSION = '1.0.0-draft';

export const PERIDOT_VARIABLE_KINDS = Object.freeze({
  ENTITY: 'entity',
  PLACE: 'place',
  TEMPORAL: 'temporal',
  NUMBER: 'number',
  CATEGORY: 'category',
  RELATIONSHIP: 'relationship',
  TEXT: 'text',
  EVIDENCE: 'evidence',
  SOURCE: 'source',
  IDENTIFIER: 'identifier',
  LINK_MEDIA: 'link-media',
  BOOLEAN: 'boolean',
  OTHER: 'other',
});

export const PERIDOT_FIELD_ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  IGNORED: 'ignored',
  UNASSIGNED: 'unassigned',
});

export const PERIDOT_SHEET_PURPOSES = Object.freeze({
  INDIVIDUAL_RECORDS: 'individual-records',
  NAMED_THINGS: 'named-things',
  SUMMARY_TOTALS: 'summary-totals',
  CONTROLLED_VALUES: 'controlled-values',
  NOTES_MAINTENANCE: 'notes-maintenance',
  IGNORE: 'ignore',
  UNSURE: 'unsure',
});

export const PERIDOT_GENERATED_VARIABLE_SOURCES = Object.freeze({
  REPEATED_HEADINGS: 'repeated-headings',
  TRANSPOSED_HEADINGS: 'transposed-headings',
  CONNECTED_TABLE: 'connected-table',
  OTHER: 'other',
});

export const PERIDOT_TABLE_CONNECTION_TYPES = Object.freeze({
  MATCHING_FIELDS: 'matching-fields',
  OTHER: 'other',
});

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Object.freeze((Array.isArray(value) ? value : []).filter((item) => item !== undefined && item !== null));
}

function asTextArray(value) {
  return Object.freeze((Array.isArray(value) ? value : []).map(asText).filter(Boolean));
}

function asObject(value) {
  return Object.freeze(value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {});
}

function enumOrFallback(value, allowed, fallback) {
  return Object.values(allowed).includes(value) ? value : fallback;
}

export function makePeridotSavedVariable({
  id,
  label = '',
  kind = PERIDOT_VARIABLE_KINDS.OTHER,
  semanticRole = '',
  entitySubtype = '',
  temporalRole = '',
  unit = '',
  sourceType = 'source-field',
  sourceFieldIds = [],
  attributes = {},
} = {}) {
  return Object.freeze({
    id: asText(id),
    label: asText(label),
    kind: enumOrFallback(kind, PERIDOT_VARIABLE_KINDS, PERIDOT_VARIABLE_KINDS.OTHER),
    semanticRole: asText(semanticRole),
    entitySubtype: asText(entitySubtype),
    temporalRole: asText(temporalRole),
    unit: asText(unit),
    sourceType: asText(sourceType) || 'source-field',
    sourceFieldIds: asTextArray(sourceFieldIds),
    attributes: asObject(attributes),
  });
}

export function makePeridotFieldAssignment({
  sourceTableId,
  sourceFieldId,
  sourceFieldName = '',
  variableId = '',
  status = PERIDOT_FIELD_ASSIGNMENT_STATUS.UNASSIGNED,
  attributes = {},
} = {}) {
  return Object.freeze({
    sourceTableId: asText(sourceTableId),
    sourceFieldId: asText(sourceFieldId),
    sourceFieldName: asText(sourceFieldName),
    variableId: asText(variableId),
    status: enumOrFallback(status, PERIDOT_FIELD_ASSIGNMENT_STATUS, PERIDOT_FIELD_ASSIGNMENT_STATUS.UNASSIGNED),
    attributes: asObject(attributes),
  });
}

export function makePeridotSheetPurposeAssignment({
  sourceTableId,
  purpose = PERIDOT_SHEET_PURPOSES.UNSURE,
  namedThingKind = '',
  label = '',
  active = true,
  attributes = {},
} = {}) {
  return Object.freeze({
    sourceTableId: asText(sourceTableId),
    purpose: enumOrFallback(purpose, PERIDOT_SHEET_PURPOSES, PERIDOT_SHEET_PURPOSES.UNSURE),
    namedThingKind: asText(namedThingKind),
    label: asText(label),
    active: Boolean(active),
    attributes: asObject(attributes),
  });
}

export function makePeridotRepeatedHeadingGroup({
  id,
  sourceTableId,
  sourceFieldIds = [],
  headingVariableId,
  cellVariableId,
  attachedFieldIds = [],
  blankHandling = '',
  textHandling = '',
  generatedVariableSource = PERIDOT_GENERATED_VARIABLE_SOURCES.REPEATED_HEADINGS,
  attributes = {},
} = {}) {
  return Object.freeze({
    id: asText(id),
    sourceTableId: asText(sourceTableId),
    sourceFieldIds: asTextArray(sourceFieldIds),
    headingVariableId: asText(headingVariableId),
    cellVariableId: asText(cellVariableId),
    attachedFieldIds: asTextArray(attachedFieldIds),
    blankHandling: asText(blankHandling),
    textHandling: asText(textHandling),
    generatedVariableSource: enumOrFallback(
      generatedVariableSource,
      PERIDOT_GENERATED_VARIABLE_SOURCES,
      PERIDOT_GENERATED_VARIABLE_SOURCES.REPEATED_HEADINGS,
    ),
    attributes: asObject(attributes),
  });
}

export function makePeridotTableConnection({
  id,
  fromTableId,
  fromFieldId,
  toTableId,
  toFieldId,
  connectionType = PERIDOT_TABLE_CONNECTION_TYPES.MATCHING_FIELDS,
  label = '',
  attributes = {},
} = {}) {
  return Object.freeze({
    id: asText(id),
    fromTableId: asText(fromTableId),
    fromFieldId: asText(fromFieldId),
    toTableId: asText(toTableId),
    toFieldId: asText(toFieldId),
    connectionType: enumOrFallback(
      connectionType,
      PERIDOT_TABLE_CONNECTION_TYPES,
      PERIDOT_TABLE_CONNECTION_TYPES.MATCHING_FIELDS,
    ),
    label: asText(label),
    attributes: asObject(attributes),
  });
}

export function makePeridotUniversalMappingDefinition({
  id = 'universal-mapping',
  label = '',
  sheetPurposes = [],
  fieldAssignments = [],
  repeatedHeadingGroups = [],
  tableConnections = [],
  attributes = {},
} = {}) {
  return Object.freeze({
    schemaVersion: PERIDOT_UNIVERSAL_MAPPING_SCHEMA_VERSION,
    id: asText(id) || 'universal-mapping',
    label: asText(label),
    sheetPurposes: asArray(sheetPurposes).map((item) => makePeridotSheetPurposeAssignment(item)),
    fieldAssignments: asArray(fieldAssignments).map((item) => makePeridotFieldAssignment(item)),
    repeatedHeadingGroups: asArray(repeatedHeadingGroups).map((item) => makePeridotRepeatedHeadingGroup(item)),
    tableConnections: asArray(tableConnections).map((item) => makePeridotTableConnection(item)),
    attributes: asObject(attributes),
  });
}

export function makePeridotSavedVariables(variables = []) {
  return Object.freeze(asArray(variables).map((item) => makePeridotSavedVariable(item)));
}
