/*
 * Canonical source-file and source-table descriptors for Peridot datasets.
 *
 * Phase 1.2 preserves stable structural metadata about uploaded files, sheets,
 * and fields without duplicating the full uploaded row payload inside the
 * canonical dataset. Existing import rows remain the source-content baseline;
 * these descriptors give universal mappings stable source IDs to reference.
 */

export const PERIDOT_SOURCE_MODEL_SCHEMA_VERSION = '1.0.0-draft';

export const PERIDOT_SOURCE_FILE_TYPES = Object.freeze({
  CSV: 'csv',
  TSV: 'tsv',
  EXCEL: 'excel',
  OTHER: 'other',
});

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Object.freeze((Array.isArray(value) ? value : []).filter((item) => item !== undefined && item !== null));
}

function asObject(value) {
  return Object.freeze(value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {});
}

function asCount(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function slugify(value) {
  return asText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'source';
}

function normalizeSourceFileType(value) {
  const normalized = asText(value).toLowerCase();
  return Object.values(PERIDOT_SOURCE_FILE_TYPES).includes(normalized)
    ? normalized
    : PERIDOT_SOURCE_FILE_TYPES.OTHER;
}

export function makePeridotSourceFileId({ fileName = '', index = 0 } = {}) {
  return `source-file:${slugify(fileName || `file-${Number(index) + 1}`)}`;
}

export function makePeridotSourceTableId({ sourceFileId = '', sheetName = '', index = 0 } = {}) {
  return `source-table:${slugify(sourceFileId || 'source-file')}:${slugify(sheetName || `table-${Number(index) + 1}`)}`;
}

export function makePeridotSourceFieldId({ sourceTableId = '', fieldName = '', index = 0 } = {}) {
  return `source-field:${slugify(sourceTableId || 'source-table')}:${slugify(fieldName || `field-${Number(index) + 1}`)}`;
}

export function makePeridotSourceField({
  id,
  sourceTableId,
  name = '',
  columnIndex = null,
  attributes = {},
} = {}) {
  const numericIndex = Number(columnIndex);
  return Object.freeze({
    id: asText(id) || makePeridotSourceFieldId({ sourceTableId, fieldName: name, index: numericIndex }),
    sourceTableId: asText(sourceTableId),
    name: asText(name),
    columnIndex: Number.isInteger(numericIndex) && numericIndex >= 0 ? numericIndex : null,
    attributes: asObject(attributes),
  });
}

export function makePeridotSourceTable({
  id,
  sourceFileId,
  label = '',
  sheetName = '',
  tableIndex = null,
  rowCount = 0,
  columnCount = 0,
  headerRowIndex = null,
  fields = [],
  warnings = [],
  attributes = {},
} = {}) {
  const numericTableIndex = Number(tableIndex);
  const resolvedSheetName = asText(sheetName || label);
  const resolvedId = asText(id) || makePeridotSourceTableId({
    sourceFileId,
    sheetName: resolvedSheetName,
    index: Number.isInteger(numericTableIndex) ? numericTableIndex : 0,
  });
  const normalizedFields = asArray(fields).map((field, index) => makePeridotSourceField({
    ...field,
    id: field?.id || makePeridotSourceFieldId({ sourceTableId: resolvedId, fieldName: field?.name, index }),
    sourceTableId: resolvedId,
    columnIndex: field?.columnIndex ?? index,
  }));

  return Object.freeze({
    id: resolvedId,
    sourceFileId: asText(sourceFileId),
    label: asText(label || resolvedSheetName),
    sheetName: resolvedSheetName,
    tableIndex: Number.isInteger(numericTableIndex) && numericTableIndex >= 0 ? numericTableIndex : null,
    rowCount: asCount(rowCount),
    columnCount: asCount(columnCount || normalizedFields.length),
    headerRowIndex: Number.isInteger(Number(headerRowIndex)) && Number(headerRowIndex) >= 0 ? Number(headerRowIndex) : null,
    fields: Object.freeze(normalizedFields),
    warnings: Object.freeze(asArray(warnings).map((warning) => asObject(warning))),
    attributes: asObject(attributes),
  });
}

export function makePeridotSourceFile({
  id,
  fileName = '',
  workbookName = '',
  fileType = PERIDOT_SOURCE_FILE_TYPES.OTHER,
  tableIds = [],
  warnings = [],
  attributes = {},
} = {}) {
  return Object.freeze({
    id: asText(id) || makePeridotSourceFileId({ fileName }),
    fileName: asText(fileName),
    workbookName: asText(workbookName || fileName),
    fileType: normalizeSourceFileType(fileType),
    tableIds: Object.freeze(asArray(tableIds).map(asText).filter(Boolean)),
    warnings: Object.freeze(asArray(warnings).map((warning) => asObject(warning))),
    attributes: asObject(attributes),
  });
}

export function makePeridotSourceManifest({
  sourceFiles = [],
  sourceTables = [],
  ...legacyMetadata
} = {}) {
  return Object.freeze({
    ...legacyMetadata,
    schemaVersion: PERIDOT_SOURCE_MODEL_SCHEMA_VERSION,
    sourceFiles: Object.freeze(asArray(sourceFiles).map((item) => makePeridotSourceFile(item))),
    sourceTables: Object.freeze(asArray(sourceTables).map((item) => makePeridotSourceTable(item))),
  });
}

/**
 * Convert the existing workbook parser model into canonical source metadata.
 * Full source rows are intentionally not copied here; they remain preserved by
 * the upload/import layer that produced workbookModel.
 */
export function makePeridotSourceManifestFromWorkbookModel(workbookModel = {}, { sourceFileId = '' } = {}) {
  const resolvedFileId = asText(sourceFileId) || makePeridotSourceFileId({ fileName: workbookModel?.fileName });
  const sourceTables = (workbookModel?.sheets || []).map((sheet, tableIndex) => {
    const tableId = makePeridotSourceTableId({
      sourceFileId: resolvedFileId,
      sheetName: sheet?.sheetName,
      index: tableIndex,
    });

    return makePeridotSourceTable({
      id: tableId,
      sourceFileId: resolvedFileId,
      label: sheet?.sheetName,
      sheetName: sheet?.sheetName,
      tableIndex,
      rowCount: sheet?.rowCount,
      columnCount: sheet?.columnCount,
      headerRowIndex: sheet?.headerRowIndex,
      fields: (sheet?.headers || []).map((header, columnIndex) => ({
        id: makePeridotSourceFieldId({ sourceTableId: tableId, fieldName: header, index: columnIndex }),
        name: header,
        columnIndex,
      })),
      warnings: sheet?.warnings || [],
    });
  });

  const sourceFile = makePeridotSourceFile({
    id: resolvedFileId,
    fileName: workbookModel?.fileName,
    workbookName: workbookModel?.workbookName,
    fileType: workbookModel?.fileType,
    tableIds: sourceTables.map((table) => table.id),
    warnings: workbookModel?.warnings || [],
  });

  return makePeridotSourceManifest({
    sourceFiles: [sourceFile],
    sourceTables,
  });
}
