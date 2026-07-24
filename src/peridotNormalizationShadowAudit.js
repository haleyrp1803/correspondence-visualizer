/*
 * Development-only shadow comparison for the normalized correspondence model.
 *
 * Pass 2D runs the canonical profile and legacy compatibility adapter beside
 * the current direct normalizer. It never returns replacement application data,
 * never mutates source rows, and never throws into the active upload workflow.
 */

import { normalizePeridotCorrespondenceRows } from './peridotCorrespondenceProfile.js';
import { auditPeridotLegacyCompatibilityParity } from './peridotLegacyCompatibilityAdapter.js';

function asText(value) {
  return String(value ?? '').trim();
}

function makeShadowDatasetId(fileLabel = '', sourceKind = '') {
  const seed = `${sourceKind}:${fileLabel}`.toLowerCase();
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `shadow-correspondence-${(hash >>> 0).toString(16)}`;
}

function makeFailedShadowReport(error, context = {}) {
  return Object.freeze({
    passed: false,
    shadowComparisonFailed: true,
    errorMessage: error instanceof Error ? error.message : String(error || 'Unknown shadow comparison error'),
    context: Object.freeze({ ...context }),
    sections: [],
    mismatches: [],
  });
}

/**
 * Run both normalization paths and compare every legacy section.
 *
 * The direct model supplied by App.jsx remains the active result. This helper
 * constructs a second direct model internally through the parity auditor only
 * for comparison and diagnostics.
 */
export function runPeridotNormalizationShadowComparison(rows = [], options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const fileLabel = asText(options.fileLabel) || 'Uploaded data';
  const sourceKind = asText(options.sourceKind) || 'unknown-import';
  const sourceSheet = asText(options.sourceSheet) || 'Uploaded table';

  try {
    const canonicalDataset = normalizePeridotCorrespondenceRows(sourceRows, {
      datasetId: makeShadowDatasetId(fileLabel, sourceKind),
      datasetLabel: `${fileLabel} shadow canonical dataset`,
      sourceFileId: makeShadowDatasetId(fileLabel, `${sourceKind}:file`),
      sourceFileName: fileLabel,
      sourceSheet,
    });

    const parity = auditPeridotLegacyCompatibilityParity(
      sourceRows,
      canonicalDataset,
      { supplySourceRows: true }
    );

    return Object.freeze({
      ...parity,
      shadowComparisonFailed: false,
      context: Object.freeze({
        fileLabel,
        sourceKind,
        sourceSheet,
        rowCount: sourceRows.length,
        canonicalRecordCount: canonicalDataset.records.length,
        canonicalEntityCount: canonicalDataset.entities.length,
        canonicalPlaceCount: canonicalDataset.places.length,
        canonicalValidationValid: canonicalDataset.validation?.valid === true,
        canonicalCanCommit: canonicalDataset.validation?.canCommit === true,
      }),
    });
  } catch (error) {
    return makeFailedShadowReport(error, {
      fileLabel,
      sourceKind,
      sourceSheet,
      rowCount: sourceRows.length,
    });
  }
}

/**
 * Development console reporter. Production builds do not call this helper.
 */
export function reportPeridotNormalizationShadowComparison(report = {}) {
  if (report.passed) return report;

  const label = report.context?.fileLabel || 'uploaded data';

  if (report.shadowComparisonFailed) {
    console.error(
      `[Peridot normalization shadow] Comparison failed for ${label}. Active legacy data was retained.`,
      report
    );
    return report;
  }

  console.error(
    `[Peridot normalization shadow] Legacy parity mismatch for ${label}. Active legacy data was retained.`,
    report
  );
  return report;
}

/**
 * Convenience boundary used by App.jsx. It is intentionally a no-op outside
 * Vite development mode.
 */
export function runAndReportPeridotNormalizationShadowComparison(rows = [], options = {}) {
  if (!import.meta.env.DEV) return null;

  const report = runPeridotNormalizationShadowComparison(rows, options);
  return reportPeridotNormalizationShadowComparison(report);
}
