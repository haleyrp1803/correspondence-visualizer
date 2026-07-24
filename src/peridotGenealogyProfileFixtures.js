/*
 * Dependency-free fixtures for the Pass 3A genealogy profile.
 */

import { normalizePeridotGenealogyRows } from './peridotGenealogyProfile.js';

export const PERIDOT_GENEALOGY_FIXTURE_ROWS = Object.freeze([
  Object.freeze({
    ID: 'P1',
    WikiData: 'Q1',
    'Full name': 'Parent One',
    Gender: 'female',
    'Birth date type': 'Known',
    'Birth year': '1600',
    'place of birth': 'Florence',
    'coordinate location birth': '43.7696,11.2558',
    'Partner ID': 'P2',
    'Partner name': 'Parent Two',
    'Partnership type': 'Married',
    'Partnership date type': 'Range',
    'Partnership year': '1620',
    'Partnership range end': '1640-00-00',
    Profession: 'Ruler',
  }),
  Object.freeze({
    ID: 'P2',
    'Full name': 'Parent Two',
    Gender: 'male',
    'Partner ID': 'P1',
    'Partner name': 'Parent One',
    'Partnership type': 'Married',
    'Partnership date type': 'Range',
    'Partnership year': '1620',
    'Partnership range end': '1640-00-00',
    'Death date type': 'Known',
    'Death year': '1650',
    'place of death': 'Rome',
    'coordinate location death': '41.9028,12.4964',
  }),
  Object.freeze({
    ID: 'C1',
    'Full name': 'Child One',
    'Mother ID': 'P1',
    'Mother name': 'Parent One',
    'Father ID': 'P2',
    'Father name': 'Parent Two',
    'Birth date type': 'Approximate',
    'Birth year': '1630',
    'Ex-partner IDs': 'MISSING P2',
    Interests: 'Books',
  }),
  Object.freeze({}),
]);

export function runPeridotGenealogyProfileSelfAudit() {
  const dataset = normalizePeridotGenealogyRows(
    PERIDOT_GENEALOGY_FIXTURE_ROWS,
    {
      datasetId: 'fixture-genealogy',
      datasetLabel: 'Pass 3A genealogy fixture',
      sourceFileId: 'fixture-genealogy-file',
      sourceFileName: 'fixture-genealogy.csv',
      sourceSheet: 'People',
      importedAt: '2026-07-24T00:00:00.000Z',
    }
  );

  const married = dataset.relationships.filter((item) => item.relationshipType === 'married');
  const parentChild = dataset.relationships.filter((item) => item.relationshipType === 'parent-child');
  const formerPartners = dataset.relationships.filter((item) => item.relationshipType === 'former-partner');

  const duplicateDataset = normalizePeridotGenealogyRows([
    { ID: 'DUP', 'Full name': 'First' },
    { ID: 'DUP', 'Full name': 'Second' },
  ], {
    datasetId: 'fixture-genealogy-duplicate',
    sourceFileId: 'fixture-duplicate-file',
    sourceFileName: 'fixture-duplicate.csv',
    sourceSheet: 'People',
  });

  const checks = Object.freeze({
    threeEntitiesCreated: dataset.entities.length === 3,
    blankSeparatorIgnored: dataset.sourceManifest.blankRowCount === 1,
    birthAndDeathEventsCreated: dataset.events.some((item) => item.eventType === 'birth')
      && dataset.events.some((item) => item.eventType === 'death'),
    eventPlacesCreated: dataset.places.length === 2,
    noMovementRelationshipInvented: !dataset.relationships.some(
      (item) => item.relationshipType === 'movement'
    ),
    reciprocalMarriageDeduplicated: married.length === 1,
    partnershipRangeNormalized: married[0]?.temporalAssertion?.sortBounds?.end === 16401231,
    twoParentRelationshipsCreated: parentChild.length === 2,
    formerPartnerCreatedForResolvedId: formerPartners.length === 1,
    unresolvedReferenceReported: dataset.sourceManifest.unresolvedReferences.length === 1
      && dataset.sourceManifest.unresolvedReferences[0].referencedSourceId === 'MISSING',
    unresolvedReferenceDoesNotInvalidateStructure: dataset.validation?.valid === true,
    attributeAssertionsCreated: dataset.assertions.some(
      (item) => item.predicate === 'profession' && item.value === 'Ruler'
    ),
    duplicateSourceIdBlocksCommit: duplicateDataset.validation?.canCommit === false,
    duplicateSourceIdReported: duplicateDataset.validation?.issues?.some(
      (item) => item.code === 'genealogy_duplicate_source_id'
    ),
    genealogyCapabilitiesDetected: dataset.capabilities?.genealogyReady === true
      && dataset.capabilities?.eventTimelineReady === true
      && dataset.capabilities?.eventMapReady === true,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    counts: Object.freeze({
      entities: dataset.entities.length,
      places: dataset.places.length,
      events: dataset.events.length,
      relationships: dataset.relationships.length,
      assertions: dataset.assertions.length,
      unresolvedReferences: dataset.sourceManifest.unresolvedReferences.length,
    }),
    validation: dataset.validation,
    duplicateValidation: duplicateDataset.validation,
  });
}
