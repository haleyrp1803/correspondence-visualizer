/*
 * Dependency-free parity fixtures for the Pass 2C legacy compatibility adapter.
 */

import {
  PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
  buildPeridotCorrespondenceProfileFixtureDataset,
} from './peridotCorrespondenceProfileFixtures.js';
import {
  auditPeridotLegacyCompatibilityParity,
  buildPeridotLegacyCompatibilityModel,
  extractCorrespondenceRowsFromCanonicalDataset,
} from './peridotLegacyCompatibilityAdapter.js';
import { normalizePeridotCorrespondenceRows } from './peridotCorrespondenceProfile.js';

export const PERIDOT_LEGACY_COMPATIBILITY_UNSUPPORTED_FIXTURE_ROW = Object.freeze({});

export function runPeridotLegacyCompatibilitySelfAudit() {
  const dataset = buildPeridotCorrespondenceProfileFixtureDataset();
  const reconstructedRows = extractCorrespondenceRowsFromCanonicalDataset(dataset);
  const completeAudit = auditPeridotLegacyCompatibilityParity(
    PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
    dataset,
    { supplySourceRows: true }
  );

  const rowsWithUnsupported = [
    ...PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
    PERIDOT_LEGACY_COMPATIBILITY_UNSUPPORTED_FIXTURE_ROW,
  ];

  const datasetWithUnsupported = normalizePeridotCorrespondenceRows(
    rowsWithUnsupported,
    {
      datasetId: 'fixture-correspondence-with-unsupported',
      datasetLabel: 'Pass 2C unsupported-row fixture',
      sourceFileId: 'fixture-file-with-unsupported',
      sourceFileName: 'fixture-correspondence-with-unsupported.csv',
      sourceSheet: 'Letters',
      importedAt: '2026-07-24T00:00:00.000Z',
    }
  );

  const acceptedOnlyModel = buildPeridotLegacyCompatibilityModel(
    datasetWithUnsupported
  );

  const fullSourceModel = buildPeridotLegacyCompatibilityModel(
    datasetWithUnsupported,
    { sourceRows: rowsWithUnsupported }
  );

  const fullSourceAudit = auditPeridotLegacyCompatibilityParity(
    rowsWithUnsupported,
    datasetWithUnsupported,
    { supplySourceRows: true }
  );

  const checks = Object.freeze({
    completeFixtureParityPasses: completeAudit.passed === true,
    everyLegacySectionCompared: completeAudit.sections.length === 7,
    threeAcceptedRowsReconstructed: reconstructedRows.length === 3,
    sourceOrderPreserved:
      reconstructedRows[0]?.Source_Name === 'de’ Medici, Cosimo II'
      && reconstructedRows[1]?.Target_Name === 'von Habsburg, Maria Magdalena'
      && reconstructedRows[2]?.Notes === 'Evidence-only accepted row',
    adapterProducesCurrentTopLevelContract:
      Array.isArray(fullSourceModel.normalizedRows)
      && Array.isArray(fullSourceModel.normalizedLetters)
      && Array.isArray(fullSourceModel.normalizedPersonMetadata)
      && Array.isArray(fullSourceModel.places)
      && Array.isArray(fullSourceModel.acceptedRows)
      && Array.isArray(fullSourceModel.unsupportedRows)
      && Array.isArray(fullSourceModel.allRows),
    acceptedOnlyRoundTripMarkedIncomplete:
      acceptedOnlyModel.compatibility?.completeSourceRoundTrip === false,
    unsupportedPayloadLimitationExplained:
      Boolean(acceptedOnlyModel.compatibility?.limitation),
    suppliedSourceRowsRestoreCompleteRoundTrip:
      fullSourceModel.compatibility?.completeSourceRoundTrip === true,
    unsupportedRowPreservedWithSuppliedSource:
      fullSourceModel.unsupportedRows.length === 1
      && fullSourceModel.allRows.length === 4,
    fullSourceUnsupportedFixtureParityPasses:
      fullSourceAudit.passed === true,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    completeFixtureAudit: completeAudit,
    unsupportedFixtureAudit: fullSourceAudit,
    compatibilityWithoutSourceRows: acceptedOnlyModel.compatibility,
    compatibilityWithSourceRows: fullSourceModel.compatibility,
  });
}
