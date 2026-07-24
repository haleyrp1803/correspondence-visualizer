/*
 * Legacy compatibility adapter for canonical correspondence datasets.
 *
 * Pass 2C keeps the current runtime contract available while the canonical
 * normalized model remains unmounted. The adapter intentionally delegates the
 * final legacy-row shaping to peridotCsvNormalizer.js so there is one current
 * authority for compatibility-sensitive field names and IDs.
 *
 * This is a transitional boundary, not the final consumer architecture.
 */

import { normalizePeridotTemplateRows } from './peridotCsvNormalizer.js';

function asText(value) {
  return String(value ?? '').trim();
}

function sourceRowNumberForRecord(record = {}) {
  const value = Number(record?.provenance?.source?.sourceRowNumber);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function cloneRow(row = {}) {
  return row && typeof row === 'object' ? { ...row } : {};
}

function getCanonicalRecordMappedRow(record = {}) {
  const mappedRow = record?.attributes?.originalMappedRow;
  return mappedRow && typeof mappedRow === 'object' ? cloneRow(mappedRow) : null;
}

/**
 * Extract accepted correspondence-compatible rows from canonical Records.
 *
 * Records are sorted by their preserved source-row number before legacy IDs are
 * regenerated. This maintains current row-order-based IDs for accepted-only
 * datasets.
 */
export function extractCorrespondenceRowsFromCanonicalDataset(dataset = {}) {
  return [...(dataset.records || [])]
    .filter((record) => record?.recordType === 'correspondence-or-directed-record')
    .sort((a, b) => sourceRowNumberForRecord(a) - sourceRowNumberForRecord(b))
    .map(getCanonicalRecordMappedRow)
    .filter(Boolean);
}

/**
 * Project a canonical correspondence dataset into the exact object contract
 * currently returned by normalizePeridotTemplateRows().
 *
 * For complete accepted/unsupported/allRows parity, callers must provide the
 * original full mapped sourceRows. Without sourceRows, the canonical dataset
 * can currently reconstruct accepted Records only because Pass 2B intentionally
 * does not retain unsupported row payloads.
 */
export function buildPeridotLegacyCompatibilityModel(dataset = {}, options = {}) {
  const suppliedSourceRows = Array.isArray(options.sourceRows)
    ? options.sourceRows.map(cloneRow)
    : null;

  const reconstructedAcceptedRows = extractCorrespondenceRowsFromCanonicalDataset(dataset);
  const rowsForLegacyNormalization = suppliedSourceRows || reconstructedAcceptedRows;
  const legacyModel = normalizePeridotTemplateRows(rowsForLegacyNormalization);

  const sourceManifest = dataset?.sourceManifest || {};
  const completeSourceRoundTrip = Boolean(suppliedSourceRows)
    || Number(sourceManifest.unsupportedRowCount || 0) === 0;

  return {
    ...legacyModel,
    compatibility: Object.freeze({
      adapterVersion: '1.0.0-draft',
      sourceDatasetId: asText(dataset?.datasetId),
      sourceMappingProfileId: asText(dataset?.mappingProfile?.id),
      sourceMappingProfileVersion: asText(dataset?.mappingProfile?.version),
      usedSuppliedSourceRows: Boolean(suppliedSourceRows),
      reconstructedAcceptedRowCount: reconstructedAcceptedRows.length,
      normalizedInputRowCount: rowsForLegacyNormalization.length,
      completeSourceRoundTrip,
      limitation: completeSourceRoundTrip
        ? ''
        : 'Unsupported source-row payloads are not retained in the Pass 2B canonical dataset. Supply the original mapped sourceRows for complete accepted/unsupported/allRows parity.',
    }),
  };
}

function canonicalizeForComparison(value) {
  if (typeof value === 'number' && Number.isNaN(value)) return '__NaN__';

  if (Array.isArray(value)) {
    return value.map(canonicalizeForComparison);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeForComparison(value[key])])
    );
  }

  return value;
}

function stableSerialize(value) {
  return JSON.stringify(canonicalizeForComparison(value));
}

function compareSection(directModel, adapterModel, key) {
  const directValue = directModel?.[key];
  const adapterValue = adapterModel?.[key];

  return Object.freeze({
    key,
    matches: stableSerialize(directValue) === stableSerialize(adapterValue),
    directCount: Array.isArray(directValue) ? directValue.length : null,
    adapterCount: Array.isArray(adapterValue) ? adapterValue.length : null,
  });
}

/**
 * Compare the current direct normalizer with the canonical compatibility path.
 */
export function auditPeridotLegacyCompatibilityParity(rows = [], dataset = {}, options = {}) {
  const directModel = normalizePeridotTemplateRows(rows);
  const adapterModel = buildPeridotLegacyCompatibilityModel(dataset, {
    sourceRows: options.supplySourceRows === false ? undefined : rows,
  });

  const sectionKeys = [
    'normalizedRows',
    'normalizedLetters',
    'normalizedPersonMetadata',
    'places',
    'acceptedRows',
    'unsupportedRows',
    'allRows',
  ];

  const sections = sectionKeys.map((key) => compareSection(directModel, adapterModel, key));
  const mismatches = sections.filter((section) => !section.matches);

  return Object.freeze({
    passed: mismatches.length === 0,
    sections,
    mismatches,
    compatibility: adapterModel.compatibility,
  });
}
