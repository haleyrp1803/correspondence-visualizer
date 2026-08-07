/*
 * Deterministic transformation helpers for Peridot universal mappings.
 *
 * Phase 1.3 executes only structural instructions already present in a user-
 * owned universal mapping. It does not infer domain meaning, mutate source
 * rows, or wire transformed output into App.jsx/runtime consumers.
 */

import {
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_GENERATED_VARIABLE_SOURCES,
} from './peridotUniversalMappingModel.js';
import {
  makePeridotSourceReference,
  makePeridotProvenance,
  PERIDOT_PROVENANCE_STATUS,
} from './peridotNormalizationProvenance.js';

export const PERIDOT_TRANSFORMATION_TYPES = Object.freeze({
  PRESERVE_ASSIGNED_FIELDS: 'preserve-assigned-fields',
  REPEATED_HEADINGS: 'repeated-headings',
  TRANSPOSE: 'transpose',
  CONNECT_TABLES: 'connect-tables',
});

export const PERIDOT_BLANK_HANDLING = Object.freeze({
  SKIP: 'skip',
  PRESERVE: 'preserve',
});

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function freezeObject(value) {
  return Object.freeze(value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {});
}

function resolveSourceFile(sourceTable = {}) {
  return {
    sourceFileId: asText(sourceTable.sourceFileId),
    sourceFileName: asText(sourceTable.sourceFileName || sourceTable.fileName),
    sourceSheet: asText(sourceTable.sheetName || sourceTable.label || sourceTable.id),
  };
}

function resolveHeaders(sourceTable = {}) {
  if (Array.isArray(sourceTable.headers)) return sourceTable.headers.map(asText);
  if (Array.isArray(sourceTable.fields)) return sourceTable.fields.map((field) => asText(field?.name));
  const firstRow = asArray(sourceTable.rows)[0];
  return firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow) ? Object.keys(firstRow) : [];
}

function resolveFieldName(sourceTable, fieldIdOrName) {
  const key = asText(fieldIdOrName);
  const field = asArray(sourceTable?.fields).find((item) => item?.id === key || item?.name === key);
  return asText(field?.name || key);
}

function rowValue(row, fieldName) {
  if (!row || typeof row !== 'object') return undefined;
  return row[fieldName];
}

function makeCellProvenance(sourceTable, rowNumber, fieldNames, sourceValues, transformation) {
  return makePeridotProvenance({
    source: makePeridotSourceReference({
      ...resolveSourceFile(sourceTable),
      sourceRowNumber: rowNumber,
      sourceColumns: fieldNames,
      sourceValues,
    }),
    transformation,
    status: PERIDOT_PROVENANCE_STATUS.TRANSFORMED,
    userConfirmed: true,
  });
}

function makePreservedProvenance(sourceTable, rowNumber, fieldNames, sourceValues) {
  return makePeridotProvenance({
    source: makePeridotSourceReference({
      ...resolveSourceFile(sourceTable),
      sourceRowNumber: rowNumber,
      sourceColumns: fieldNames,
      sourceValues,
    }),
    transformation: 'Preserved user-assigned source fields without changing their values.',
    status: PERIDOT_PROVENANCE_STATUS.IMPORTED_DIRECTLY,
    userConfirmed: true,
  });
}

export function compilePeridotUniversalTransformations(mapping = {}) {
  const operations = [];
  const activeAssignments = asArray(mapping.fieldAssignments).filter(
    (assignment) => assignment?.status === PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE,
  );

  const assignmentsByTable = new Map();
  activeAssignments.forEach((assignment) => {
    const tableId = asText(assignment?.sourceTableId);
    if (!tableId) return;
    const list = assignmentsByTable.get(tableId) || [];
    list.push(assignment);
    assignmentsByTable.set(tableId, list);
  });

  assignmentsByTable.forEach((assignments, sourceTableId) => {
    operations.push(Object.freeze({
      type: PERIDOT_TRANSFORMATION_TYPES.PRESERVE_ASSIGNED_FIELDS,
      sourceTableId,
      assignments: Object.freeze(assignments.map((assignment) => Object.freeze({ ...assignment }))),
    }));
  });

  asArray(mapping.repeatedHeadingGroups).forEach((group) => {
    if (group?.generatedVariableSource === PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS) {
      operations.push(Object.freeze({
        type: PERIDOT_TRANSFORMATION_TYPES.TRANSPOSE,
        sourceTableId: asText(group.sourceTableId),
        groupId: asText(group.id),
      }));
    }
    operations.push(Object.freeze({
      type: PERIDOT_TRANSFORMATION_TYPES.REPEATED_HEADINGS,
      sourceTableId: asText(group?.sourceTableId),
      group: Object.freeze({ ...group }),
    }));
  });

  asArray(mapping.tableConnections).forEach((connection) => {
    operations.push(Object.freeze({
      type: PERIDOT_TRANSFORMATION_TYPES.CONNECT_TABLES,
      connection: Object.freeze({ ...connection }),
    }));
  });

  return Object.freeze(operations);
}

export function preservePeridotAssignedFields({ sourceTable = {}, assignments = [] } = {}) {
  const rows = asArray(sourceTable.rows);
  const normalizedAssignments = asArray(assignments).filter(
    (assignment) => assignment?.status === PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE && asText(assignment?.variableId),
  );

  return Object.freeze(rows.map((row, rowIndex) => {
    const values = {};
    const provenance = {};
    normalizedAssignments.forEach((assignment) => {
      const fieldName = resolveFieldName(sourceTable, assignment.sourceFieldId || assignment.sourceFieldName);
      const value = rowValue(row, fieldName);
      values[assignment.variableId] = value;
      provenance[assignment.variableId] = makePreservedProvenance(
        sourceTable,
        rowIndex + 1,
        [fieldName],
        { [fieldName]: value },
      );
    });

    return Object.freeze({
      sourceTableId: asText(sourceTable.id),
      sourceRowNumber: rowIndex + 1,
      values: freezeObject(values),
      provenance: freezeObject(provenance),
    });
  }));
}

export function transformPeridotRepeatedHeadings({ sourceTable = {}, group = {} } = {}) {
  const rows = asArray(sourceTable.rows);
  const repeatedFieldNames = asArray(group.sourceFieldIds).map((fieldId) => resolveFieldName(sourceTable, fieldId));
  const attachedFieldNames = asArray(group.attachedFieldIds).map((fieldId) => resolveFieldName(sourceTable, fieldId));
  const blankHandling = asText(group.blankHandling) || PERIDOT_BLANK_HANDLING.PRESERVE;
  const headingVariableId = asText(group.headingVariableId);
  const cellVariableId = asText(group.cellVariableId);
  const output = [];

  rows.forEach((row, rowIndex) => {
    repeatedFieldNames.forEach((fieldName) => {
      const cellValue = rowValue(row, fieldName);
      if (blankHandling === PERIDOT_BLANK_HANDLING.SKIP && isBlank(cellValue)) return;

      const values = {};
      const provenance = {};
      attachedFieldNames.forEach((attachedFieldName) => {
        const attachedValue = rowValue(row, attachedFieldName);
        values[attachedFieldName] = attachedValue;
        provenance[attachedFieldName] = makePreservedProvenance(
          sourceTable,
          rowIndex + 1,
          [attachedFieldName],
          { [attachedFieldName]: attachedValue },
        );
      });

      values[headingVariableId] = fieldName;
      values[cellVariableId] = cellValue;
      const transformedProvenance = makeCellProvenance(
        sourceTable,
        rowIndex + 1,
        [fieldName],
        { [fieldName]: cellValue },
        `Converted the selected source heading “${fieldName}” into variable “${headingVariableId}” and its cell value into variable “${cellVariableId}”.`,
      );
      provenance[headingVariableId] = transformedProvenance;
      provenance[cellVariableId] = transformedProvenance;

      output.push(Object.freeze({
        sourceTableId: asText(sourceTable.id),
        sourceRowNumber: rowIndex + 1,
        sourceFieldName: fieldName,
        values: freezeObject(values),
        provenance: freezeObject(provenance),
      }));
    });
  });

  return Object.freeze(output);
}

export function transposePeridotTable(sourceTable = {}) {
  const headers = resolveHeaders(sourceTable);
  const rows = asArray(sourceTable.rows);
  if (!headers.length) {
    return Object.freeze({
      ...sourceTable,
      headers: Object.freeze([]),
      rows: Object.freeze([]),
      transformation: PERIDOT_TRANSFORMATION_TYPES.TRANSPOSE,
    });
  }

  const firstHeader = headers[0];
  const rowLabels = rows.map((row, rowIndex) => asText(rowValue(row, firstHeader)) || `Row ${rowIndex + 1}`);
  const transposedHeaders = Object.freeze([firstHeader, ...rowLabels]);
  const transposedRows = headers.slice(1).map((header) => {
    const nextRow = { [firstHeader]: header };
    rows.forEach((row, rowIndex) => {
      nextRow[rowLabels[rowIndex]] = rowValue(row, header);
    });
    return freezeObject(nextRow);
  });

  return Object.freeze({
    ...sourceTable,
    headers: transposedHeaders,
    rows: Object.freeze(transposedRows),
    transformation: PERIDOT_TRANSFORMATION_TYPES.TRANSPOSE,
    sourceOrientation: Object.freeze({
      originalHeaders: Object.freeze(headers),
      originalRowCount: rows.length,
    }),
  });
}

export function connectPeridotTables({ fromTable = {}, toTable = {}, connection = {} } = {}) {
  const fromFieldName = resolveFieldName(fromTable, connection.fromFieldId);
  const toFieldName = resolveFieldName(toTable, connection.toFieldId);
  const targetIndex = new Map();

  asArray(toTable.rows).forEach((row, rowIndex) => {
    const key = asText(rowValue(row, toFieldName));
    if (!key) return;
    const matches = targetIndex.get(key) || [];
    matches.push(Object.freeze({
      sourceTableId: asText(toTable.id),
      sourceRowNumber: rowIndex + 1,
      row,
      provenance: makePreservedProvenance(
        toTable,
        rowIndex + 1,
        [toFieldName],
        { [toFieldName]: rowValue(row, toFieldName) },
      ),
    }));
    targetIndex.set(key, matches);
  });

  const links = asArray(fromTable.rows).map((row, rowIndex) => {
    const rawKey = rowValue(row, fromFieldName);
    const key = asText(rawKey);
    const matches = key ? (targetIndex.get(key) || []) : [];
    return Object.freeze({
      connectionId: asText(connection.id),
      fromTableId: asText(fromTable.id),
      fromRowNumber: rowIndex + 1,
      matchValue: rawKey,
      matchCount: matches.length,
      matches: Object.freeze([...matches]),
      provenance: makePreservedProvenance(
        fromTable,
        rowIndex + 1,
        [fromFieldName],
        { [fromFieldName]: rawKey },
      ),
    });
  });

  return Object.freeze({
    connectionId: asText(connection.id),
    fromTableId: asText(fromTable.id),
    toTableId: asText(toTable.id),
    fromFieldName,
    toFieldName,
    links: Object.freeze(links),
    summary: Object.freeze({
      sourceRows: links.length,
      unmatchedRows: links.filter((link) => link.matchCount === 0).length,
      singleMatchRows: links.filter((link) => link.matchCount === 1).length,
      multipleMatchRows: links.filter((link) => link.matchCount > 1).length,
    }),
  });
}
