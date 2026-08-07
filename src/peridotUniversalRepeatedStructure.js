/*
 * Pure helpers for user-declared repeated-heading/orientation structures.
 *
 * Phase 2.4 keeps this logic isolated from the production mapper. It turns a
 * saved repeated-heading rule into previewable long-form observations so the
 * same scholarly variables can be proven across wide and transposed sources.
 */

import {
  PERIDOT_GENERATED_VARIABLE_SOURCES,
} from './peridotUniversalMappingModel.js';

export const PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS = Object.freeze({
  HEADINGS_REPEAT_ONE_VARIABLE: 'headings-repeat-one-variable',
  ROW_LABELS_AND_HEADINGS: 'row-labels-and-headings',
});

export const PERIDOT_REPEATED_STRUCTURE_ORIENTATION_OPTIONS = Object.freeze([
  Object.freeze({
    value: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE,
    label: 'Several column headings are values of one variable',
    description: 'Example: company names are column headings; each cell beneath them is a stock price.',
  }),
  Object.freeze({
    value: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS,
    label: 'Row labels and column headings are both variables',
    description: 'Example: company names run down one column while dates run across the remaining headings.',
  }),
]);

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function fieldById(sourceManifest, fieldId) {
  for (const table of asArray(sourceManifest?.sourceTables)) {
    const field = asArray(table?.fields).find((item) => item?.id === fieldId);
    if (field) return field;
  }
  return null;
}

function tableById(sourceManifest, tableId) {
  return asArray(sourceManifest?.sourceTables).find((table) => table?.id === tableId) || null;
}

function variableById(savedVariables, variableId) {
  return asArray(savedVariables).find((variable) => variable?.id === variableId) || null;
}

function assignmentByFieldId(fieldAssignments, sourceFieldId) {
  return asArray(fieldAssignments).find((assignment) => assignment?.sourceFieldId === sourceFieldId && assignment?.status === 'active') || null;
}

function getOrientation(group = {}) {
  const explicit = asText(group?.attributes?.orientationMode);
  if (Object.values(PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS).includes(explicit)) return explicit;
  if (group?.generatedVariableSource === PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS) {
    return PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS;
  }
  return PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE;
}

export function validatePeridotRepeatedStructure({ sourceManifest = {}, savedVariables = [], group = {} } = {}) {
  const orientation = getOrientation(group);
  const table = tableById(sourceManifest, group.sourceTableId);
  const repeatedFields = asArray(group.sourceFieldIds).map((id) => fieldById(sourceManifest, id)).filter(Boolean);
  const rowLabelFieldId = asText(group?.attributes?.rowLabelFieldId);
  const rowLabelVariableId = asText(group?.attributes?.rowLabelVariableId);
  const rowLabelField = rowLabelFieldId ? fieldById(sourceManifest, rowLabelFieldId) : null;
  const problems = [];

  if (!table) problems.push('Choose a source table.');
  if (repeatedFields.length < 2) problems.push('Choose at least two repeated columns.');
  if (!variableById(savedVariables, group.headingVariableId)) problems.push('Choose what the selected headings represent.');
  if (!variableById(savedVariables, group.cellVariableId)) problems.push('Choose what the cells contain.');

  if (orientation === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS) {
    if (!rowLabelField) problems.push('Choose the column whose row values identify the repeated things.');
    if (!variableById(savedVariables, rowLabelVariableId)) problems.push('Choose what those row labels represent.');
    if (rowLabelFieldId && asArray(group.sourceFieldIds).includes(rowLabelFieldId)) {
      problems.push('The row-label column cannot also be one of the repeated heading columns.');
    }
  }

  return Object.freeze({
    valid: problems.length === 0,
    orientation,
    problems: Object.freeze(problems),
  });
}

export function buildPeridotRepeatedStructurePreview({
  sourceManifest = {},
  sourceRowsByTableId = {},
  savedVariables = [],
  fieldAssignments = [],
  group = {},
  maxRows = 12,
} = {}) {
  const validation = validatePeridotRepeatedStructure({ sourceManifest, savedVariables, group });
  const table = tableById(sourceManifest, group.sourceTableId);
  if (!validation.valid || !table) {
    return Object.freeze({ validation, rows: Object.freeze([]), totalRows: 0, variableIds: Object.freeze([]) });
  }

  const sourceRows = asArray(sourceRowsByTableId?.[table.id]);
  const repeatedFields = asArray(group.sourceFieldIds).map((id) => fieldById(sourceManifest, id)).filter(Boolean);
  const attachedFields = asArray(group.attachedFieldIds).map((id) => fieldById(sourceManifest, id)).filter(Boolean);
  const orientation = validation.orientation;
  const rowLabelField = fieldById(sourceManifest, group?.attributes?.rowLabelFieldId);
  const rowLabelVariableId = asText(group?.attributes?.rowLabelVariableId);
  const output = [];

  sourceRows.forEach((sourceRow, sourceRowIndex) => {
    repeatedFields.forEach((repeatedField) => {
      const values = {};

      if (orientation === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS) {
        values[rowLabelVariableId] = sourceRow?.[rowLabelField?.name];
      }

      attachedFields.forEach((attachedField) => {
        const assignment = assignmentByFieldId(fieldAssignments, attachedField.id);
        if (assignment?.variableId) values[assignment.variableId] = sourceRow?.[attachedField.name];
      });

      values[group.headingVariableId] = repeatedField.name;
      values[group.cellVariableId] = sourceRow?.[repeatedField.name];

      output.push(Object.freeze({
        sourceTableId: table.id,
        sourceRowNumber: sourceRowIndex + 1,
        sourceHeading: repeatedField.name,
        values: Object.freeze(values),
      }));
    });
  });

  const variableIds = new Set();
  output.forEach((row) => Object.keys(row.values).forEach((id) => variableIds.add(id)));

  return Object.freeze({
    validation,
    rows: Object.freeze(output.slice(0, Math.max(0, Number(maxRows) || 0))),
    totalRows: output.length,
    variableIds: Object.freeze([...variableIds]),
  });
}

export function describePeridotRepeatedStructure({ sourceManifest = {}, savedVariables = [], group = {} } = {}) {
  const table = tableById(sourceManifest, group.sourceTableId);
  const orientation = getOrientation(group);
  const headingVariable = variableById(savedVariables, group.headingVariableId);
  const cellVariable = variableById(savedVariables, group.cellVariableId);
  const rowLabelVariable = variableById(savedVariables, group?.attributes?.rowLabelVariableId);
  const rowLabelField = fieldById(sourceManifest, group?.attributes?.rowLabelFieldId);
  const repeatedFields = asArray(group.sourceFieldIds).map((id) => fieldById(sourceManifest, id)).filter(Boolean);

  return Object.freeze({
    tableLabel: table?.label || table?.sheetName || group.sourceTableId,
    orientation,
    repeatedFieldNames: Object.freeze(repeatedFields.map((field) => field.name)),
    headingVariableLabel: headingVariable?.label || group.headingVariableId,
    cellVariableLabel: cellVariable?.label || group.cellVariableId,
    rowLabelVariableLabel: rowLabelVariable?.label || group?.attributes?.rowLabelVariableId || '',
    rowLabelFieldName: rowLabelField?.name || '',
  });
}
