/*
 * Dependency-free fixtures for the Pass 2E active canonical runtime bridge.
 */

import { normalizePeridotTemplateRows } from './peridotCsvNormalizer.js';
import {
  PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
} from './peridotCorrespondenceProfileFixtures.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';

function canonicalizeForComparison(value) {
  if (typeof value === 'number' && Number.isNaN(value)) return '__NaN__';
  if (Array.isArray(value)) return value.map(canonicalizeForComparison);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeForComparison(value[key])])
    );
  }
  return value;
}

function matches(a, b) {
  return JSON.stringify(canonicalizeForComparison(a))
    === JSON.stringify(canonicalizeForComparison(b));
}

export function runPeridotCanonicalRuntimeSelfAudit() {
  const rows = [
    ...PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
    {},
  ];
  const direct = normalizePeridotTemplateRows(rows);
  const active = buildPeridotCanonicalRuntimeModel(rows, {
    fileLabel: 'Pass 2E fixture.csv',
    sourceKind: 'fixture',
    sourceSheet: 'Letters',
    importedAt: '2026-07-24T00:00:00.000Z',
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

  const sectionChecks = Object.fromEntries(
    sectionKeys.map((key) => [`${key}Matches`, matches(direct[key], active[key])])
  );

  const checks = Object.freeze({
    ...sectionChecks,
    canonicalDatasetAttached: Boolean(active.canonicalDataset),
    canonicalValidationPasses: active.canonicalDataset?.validation?.valid === true,
    canonicalCommitAllowed: active.canonicalDataset?.validation?.canCommit === true,
    canonicalRecordsCreated: active.canonicalDataset?.records?.length === 3,
    unsupportedRowPreserved: active.unsupportedRows.length === 1 && active.allRows.length === 4,
    completeRoundTrip: active.compatibility?.completeSourceRoundTrip === true,
    activeSourceMarkedCanonical:
      active.normalizationSource?.mode === 'canonical-through-legacy-adapter',
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    counts: Object.freeze({
      canonicalRecords: active.canonicalDataset.records.length,
      canonicalEntities: active.canonicalDataset.entities.length,
      canonicalPlaces: active.canonicalDataset.places.length,
      normalizedRows: active.normalizedRows.length,
      unsupportedRows: active.unsupportedRows.length,
      allRows: active.allRows.length,
    }),
    normalizationSource: active.normalizationSource,
    compatibility: active.compatibility,
    canonicalValidation: active.canonicalDataset.validation,
  });
}
