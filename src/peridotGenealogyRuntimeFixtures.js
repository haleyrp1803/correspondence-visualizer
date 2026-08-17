/*
 * Dependency-free integration audit for Pass 3B.4 genealogy activation.
 */

import { buildPeridotGenealogyRuntimeModel } from './peridotGenealogyRuntimeModel.js';

export const PERIDOT_GENEALOGY_RUNTIME_FIXTURE_ROWS = Object.freeze([
  Object.freeze({
    ID: 'P1',
    'Full name': 'Parent One',
    'Partner ID': 'P2',
    'Partnership type': 'Married',
    'Partnership date type': 'Known',
    'Partnership year': '1620',
    'Birth year': '1600',
    'place of birth': 'Florence',
    'coordinate location birth': '43.7696,11.2558',
    Profession: 'Ruler',
  }),
  Object.freeze({
    ID: 'P2',
    'Full name': 'Parent Two',
    'Partner ID': 'P1',
    'Partnership type': 'Married',
    'Death year': '1650',
    'place of death': 'Rome',
    'coordinate location death': '41.9028,12.4964',
  }),
  Object.freeze({
    ID: 'C1',
    'Full name': 'Child One',
    'Mother ID': 'P1',
    'Father ID': 'P2',
    'Birth date type': 'Approximate',
    'Birth year': '1630',
  }),
]);

const IDENTITY_MAPPING = Object.freeze({
  Person_ID: 'ID',
  Full_Name: 'Full name',
  Partner_ID: 'Partner ID',
  Partnership_Type: 'Partnership type',
  Partnership_Date_Type: 'Partnership date type',
  Partnership_Year: 'Partnership year',
  Mother_ID: 'Mother ID',
  Father_ID: 'Father ID',
  Birth_Date_Type: 'Birth date type',
  Birth_Year: 'Birth year',
  Birth_Place: 'place of birth',
  Birth_Coordinates: 'coordinate location birth',
  Death_Year: 'Death year',
  Death_Place: 'place of death',
  Death_Coordinates: 'coordinate location death',
  Profession: 'Profession',
});

export function runPeridotGenealogyRuntimeSelfAudit() {
  const runtime = buildPeridotGenealogyRuntimeModel(
    PERIDOT_GENEALOGY_RUNTIME_FIXTURE_ROWS,
    IDENTITY_MAPPING,
    {
      fileLabel: 'Genealogy runtime fixture',
      sourceKind: 'fixture',
      sourceSheet: 'People',
      importedAt: '2026-07-24T00:00:00.000Z',
      supplementalResolution: {
        excludedRowIndexes: [4],
        attachedRowIndexes: [3],
      },
    }
  );

  const relationshipRows = runtime.normalizedRows.filter(
    (row) => row.recordType === 'genealogy-relationship'
  );
  const eventRows = runtime.normalizedRows.filter(
    (row) => row.recordType === 'genealogy-event'
  );

  const checks = Object.freeze({
    canonicalDatasetActivated: runtime.canonicalDataset?.mappingProfile?.id === 'peridot.genealogy-person-centered',
    canonicalValidationPassed: runtime.canonicalDataset?.validation?.valid === true
      && runtime.canonicalDataset?.validation?.canCommit === true,
    correspondenceAdapterNotUsed: runtime.runtimeProjection?.correspondenceAdapterUsed === false,
    noGeographicRoutesInvented: runtime.runtimeProjection?.geographicRoutesInvented === false
      && runtime.normalizedRows.every((row) => row.mappable === false),
    reciprocalPartnerDeduplicated: relationshipRows.filter(
      (row) => row.relationshipType === 'married'
    ).length === 1,
    parentRelationshipsProjected: relationshipRows.filter(
      (row) => row.relationshipType === 'parent-child'
    ).length === 2,
    lifeEventsProjected: eventRows.some((row) => row.eventType === 'birth')
      && eventRows.some((row) => row.eventType === 'death'),
    eventPlacesPreserved: runtime.places.some((place) => place.label === 'Florence')
      && runtime.places.some((place) => place.label === 'Rome'),
    timelineProjectionAvailable: runtime.normalizedRows.some(
      (row) => (row.temporalAssertions || []).some((assertion) => assertion?.visualizationUsability?.timelinePositionable)
    ),
    personMetadataProjected: runtime.normalizedPersonMetadata.some(
      (person) => person.person === 'Parent One'
    ),
    summaryPreservesSupplementalDecisions:
      runtime.validationSummary?.excludedSupplementalRowCount === 1
      && runtime.validationSummary?.attachedSupplementalRowCount === 1,
    routeCapabilityUnavailable:
      runtime.validationSummary?.capabilityCounts?.routeMapReady === 0,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    counts: Object.freeze({
      entities: runtime.canonicalDataset.entities.length,
      places: runtime.canonicalDataset.places.length,
      events: runtime.canonicalDataset.events.length,
      relationships: runtime.canonicalDataset.relationships.length,
      projectedRows: runtime.normalizedRows.length,
    }),
    runtimeProjection: runtime.runtimeProjection,
    validationSummary: runtime.validationSummary,
  });
}
