/*
 * Active canonical-to-legacy runtime bridge.
 *
 * Pass 2E makes the canonical correspondence dataset the normalization source
 * for uploaded and mapped data. Existing application consumers continue to
 * receive the established legacy runtime arrays through the compatibility
 * adapter, so this module is the single controlled migration boundary.
 */

import { normalizePeridotCorrespondenceRows, normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';
import { buildPeridotLegacyCompatibilityModel } from './peridotLegacyCompatibilityAdapter.js';

function asText(value) {
  return String(value ?? '').trim();
}

function makeCanonicalDatasetId(fileLabel = '', sourceKind = '') {
  const seed = `${sourceKind}:${fileLabel}`.toLowerCase();
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `correspondence-${(hash >>> 0).toString(16)}`;
}

/**
 * Normalize source rows through the canonical model, then adapt that canonical
 * dataset into the current App.jsx runtime contract.
 *
 * The original complete source-row array is supplied to the adapter so
 * unsupportedRows and allRows remain lossless during this transition.
 */
export function buildPeridotCanonicalRuntimeModel(rows = [], options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const fileLabel = asText(options.fileLabel) || 'Uploaded data';
  const sourceKind = asText(options.sourceKind) || 'unknown-import';
  const sourceSheet = asText(options.sourceSheet) || 'Uploaded table';
  const datasetId = asText(options.datasetId) || makeCanonicalDatasetId(fileLabel, sourceKind);

  const hasGeneralizedMapping = sourceRows.some((row) => row?.generalizedObservation);
  const normalizeCanonicalRows = hasGeneralizedMapping
    ? normalizePeridotGeneralizedMappedRows
    : normalizePeridotCorrespondenceRows;

  const canonicalDataset = normalizeCanonicalRows(sourceRows, {
    datasetId,
    datasetLabel: `${fileLabel} canonical dataset`,
    sourceFileId: asText(options.sourceFileId) || makeCanonicalDatasetId(fileLabel, `${sourceKind}:file`),
    sourceFileName: fileLabel,
    sourceSheet,
    importedAt: asText(options.importedAt),
  });

  if (canonicalDataset.validation?.canCommit !== true) {
    const blockingCount = Number(canonicalDataset.validation?.counts?.blocking || 0);
    const errorCount = Number(canonicalDataset.validation?.counts?.error || 0);
    throw new Error(
      `Canonical normalization could not commit ${fileLabel}: ${blockingCount} blocking issue(s) and ${errorCount} error(s).`
    );
  }

  const legacyRuntime = buildPeridotLegacyCompatibilityModel(canonicalDataset, {
    sourceRows,
  });

  if (legacyRuntime.compatibility?.completeSourceRoundTrip !== true) {
    throw new Error(
      `Canonical normalization could not preserve the complete source-row round trip for ${fileLabel}.`
    );
  }

  return Object.freeze({
    ...legacyRuntime,
    canonicalDataset,
    normalizationSource: Object.freeze({
      mode: hasGeneralizedMapping
        ? 'canonical-generalized-mapping-through-legacy-adapter'
        : 'canonical-through-legacy-adapter',
      datasetId: canonicalDataset.datasetId,
      mappingProfileId: canonicalDataset.mappingProfile?.id || '',
      mappingProfileVersion: canonicalDataset.mappingProfile?.version || '',
      validationValid: canonicalDataset.validation?.valid === true,
      canCommit: canonicalDataset.validation?.canCommit === true,
    }),
  });
}
