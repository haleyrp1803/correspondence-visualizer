/*
 * Dependency-free fixture audit for Pass 2D normalization shadow comparison.
 */

import {
  PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
} from './peridotCorrespondenceProfileFixtures.js';
import {
  runPeridotNormalizationShadowComparison,
} from './peridotNormalizationShadowAudit.js';

export function runPeridotNormalizationShadowSelfAudit() {
  const report = runPeridotNormalizationShadowComparison(
    PERIDOT_CORRESPONDENCE_PROFILE_FIXTURE_ROWS,
    {
      fileLabel: 'Pass 2D shadow fixture.csv',
      sourceKind: 'fixture',
      sourceSheet: 'Letters',
    }
  );

  const checks = Object.freeze({
    shadowParityPasses: report.passed === true,
    shadowDidNotFail: report.shadowComparisonFailed === false,
    sevenLegacySectionsCompared: report.sections?.length === 7,
    noMismatches: report.mismatches?.length === 0,
    sourceContextPreserved:
      report.context?.fileLabel === 'Pass 2D shadow fixture.csv'
      && report.context?.sourceKind === 'fixture'
      && report.context?.sourceSheet === 'Letters',
    threeRowsAudited: report.context?.rowCount === 3,
    threeCanonicalRecordsCreated: report.context?.canonicalRecordCount === 3,
    canonicalValidationPasses:
      report.context?.canonicalValidationValid === true
      && report.context?.canonicalCanCommit === true,
    completeSourceRoundTrip:
      report.compatibility?.completeSourceRoundTrip === true
      && report.compatibility?.usedSuppliedSourceRows === true,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    report,
  });
}
