import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';

function assert(name, condition, details = '') {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
  return { name, passed: true };
}

const rows = [
  {
    ID: 'NEGXD',
    'Full name': 'Anne von Habsburg',
    'Mother ID': 'MOTHER-A',
    'Mother name': 'Margaret von Habsburg',
    'Father ID': 'FATHER-A',
    'Father name': 'Philip III von Habsburg',
    'Partner ID': 'PARTNER-A',
    'Partner name': 'Louis XIII Bourbon',
  },
  {
    ID: 'B7FN2',
    'Full name': 'Anne von Habsburg',
    'Mother ID': 'MOTHER-B',
    'Mother name': 'Maria von Habsburg',
    'Father ID': 'FATHER-B',
    'Father name': 'Maximilian II von Habsburg',
    'Partner ID': 'PARTNER-B',
    'Partner name': 'Philip II von Habsburg',
  },
];

const mapping = {
  relationshipParts: [
    { participantColumn: 'Full name', roleLabel: 'person' },
    { participantColumn: 'Mother name', roleLabel: 'mother' },
    { participantColumn: 'Father name', roleLabel: 'father' },
    { participantColumn: 'Partner name', roleLabel: 'partner / spouse' },
  ],
  identityMapping: {
    record: { strategy: 'row', columns: [] },
    entityGroupsInitialized: true,
    entityGroups: [{
      id: 'people',
      label: 'People',
      appearanceIds: ['relationship:0', 'relationship:1', 'relationship:2', 'relationship:3'],
      strategy: 'field',
      keys: ['Person ID'],
      mappings: {
        'relationship:0': [{ key: 'Person ID', column: 'ID' }],
        'relationship:1': [{ key: 'Person ID', column: 'Mother ID' }],
        'relationship:2': [{ key: 'Person ID', column: 'Father ID' }],
        'relationship:3': [{ key: 'Person ID', column: 'Partner ID' }],
      },
    }],
  },
};

export function runPeridotIdentityRuntimeFixtures() {
  const mapped = applyPeridotGeneralizedColumnMapping(rows, mapping);
  const anneA = mapped[0].generalizedObservation.participants[0];
  const anneB = mapped[1].generalizedObservation.participants[0];
  const motherA = mapped[0].generalizedObservation.participants[1];
  const canonical = normalizePeridotGeneralizedMappedRows(mapped, {
    datasetId: 'identity-fixture',
    sourceFileId: 'identity-fixture-file',
    sourceFileName: 'identity-fixture.csv',
  });

  const missingIdRows = applyPeridotGeneralizedColumnMapping([
    { ID: '', 'Full name': 'Same Label' },
    { ID: '', 'Full name': 'Same Label' },
  ], {
    relationshipParts: [{ participantColumn: 'Full name', roleLabel: 'person' }],
    identityMapping: {
      entityGroups: [{
        id: 'people', label: 'People', appearanceIds: ['relationship:0'], strategy: 'field', keys: ['ID'],
        mappings: { 'relationship:0': [{ key: 'ID', column: 'ID' }] },
      }],
    },
  });

  return [
    assert('same label with different mapped IDs stays distinct at generalized runtime', anneA.entityId && anneB.entityId && anneA.entityId !== anneB.entityId),
    assert('equivalent identity concept maps across relationship roles', motherA.entityId.includes(encodeURIComponent('MOTHER-A'))),
    assert('identity source columns are not reported as ignored', !mapped[0].ignoredUploadedColumns.includes('ID') && !mapped[0].ignoredUploadedColumns.includes('Mother ID')),
    assert('canonical generalized normalization preserves declared entity separation', canonical.entities.filter((entity) => entity.label === 'Anne von Habsburg').length === 2),
    assert('missing researcher-declared IDs do not fall back to label merging', missingIdRows[0].generalizedObservation.participants[0].entityId !== missingIdRows[1].generalizedObservation.participants[0].entityId),
    assert('legacy compatibility projection exposes participant entity IDs', mapped[0].sourceEntityId === anneA.entityId && mapped[0].targetEntityId === motherA.entityId),
  ];
}
