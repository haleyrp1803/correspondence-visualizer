import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';
import { buildPeridotEntityAttributedStructure } from './peridotRecordStructure.js';

function assert(name, condition, details = '') {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
  return { name, passed: true };
}

const identityMapping = {
  record: { strategy: 'row', columns: [] },
  entityGroupsInitialized: true,
  entityGroups: [{
    id: 'people',
    label: 'People',
    appearanceIds: ['relationship:0', 'relationship:1'],
    strategy: 'field',
    keys: ['Person ID'],
    mappings: {
      'relationship:0': [{ key: 'Person ID', column: 'ID' }],
      'relationship:1': [{ key: 'Person ID', column: 'Mother ID' }],
    },
  }],
};

const mapping = {
  relationshipParts: [
    { participantColumn: 'Full name', roleLabel: 'person' },
    { participantColumn: 'Mother name', roleLabel: 'mother' },
  ],
  identityMapping,
  placeParts: [
    { placeColumn: 'place of birth', roleLabel: 'Birthplace', roleMode: 'heading', subjectParticipantIndex: 0 },
    { placeColumn: 'place of birth', roleLabel: 'Place of childbirth', roleMode: 'heading', subjectParticipantIndex: 1 },
  ],
  temporalAssertionMappings: [
    { id: 'birth', role: 'Birth year', kind: 'date', sourceMode: 'single', column: 'Birthyear', subjectParticipantIndex: 0 },
    { id: 'childbirth', role: 'Childbirth year', kind: 'date', sourceMode: 'single', column: 'Birthyear', subjectParticipantIndex: 1 },
  ],
  coreMapping: {},
  pointMapping: {},
  routeCoordinatePairMapping: {},
  relationshipMetadataMapping: {},
  customFieldSelections: [],
};

export function runPeridotPlaceSubjectMappingFixtures() {
  const rows = [
    { ID: 'ANNE-1573', 'Full name': 'Anne von Habsburg', 'Mother ID': 'MARIA-ANNA', 'Mother name': 'Maria Anna von Bayern', Birthyear: '1573', 'place of birth': 'Graz' },
    { ID: 'WLADYSLAW', 'Full name': 'Władysław IV Vasa', 'Mother ID': 'ANNE-1573', 'Mother name': 'Anne von Habsburg', Birthyear: '1595', 'place of birth': 'Łobzów' },
  ];

  const mappedRows = applyPeridotGeneralizedColumnMapping(rows, mapping);
  const runtime = buildPeridotCanonicalRuntimeModel(mappedRows, {
    fileLabel: 'Place subject fixture.csv',
    sourceKind: 'mapped-single-table',
    sourceSheet: 'People',
  });
  const anneId = mappedRows[0].generalizedObservation.participants[0].entityId;
  const anne = buildPeridotEntityAttributedStructure(runtime.normalizedLetters, {
    entityType: 'person',
    entityLabel: 'Anne von Habsburg',
    entityId: anneId,
  });
  const graz = buildPeridotEntityAttributedStructure(runtime.normalizedLetters, {
    entityType: 'place',
    entityLabel: 'Graz',
  });

  const rowLevelOnly = applyPeridotGeneralizedColumnMapping([
    { ID: 'A', 'Full name': 'Person A', 'place of birth': 'Florence' },
  ], {
    ...mapping,
    relationshipParts: [{ participantColumn: 'Full name', roleLabel: 'person' }],
    identityMapping: {
      entityGroups: [{
        id: 'people', label: 'People', appearanceIds: ['relationship:0'], strategy: 'field', keys: ['Person ID'],
        mappings: { 'relationship:0': [{ key: 'Person ID', column: 'ID' }] },
      }],
    },
    placeParts: [{ placeColumn: 'place of birth', roleLabel: 'Unattached place', roleMode: 'heading', subjectParticipantIndex: null }],
    temporalAssertionMappings: [],
  });
  const rowLevelRuntime = buildPeridotCanonicalRuntimeModel(rowLevelOnly, {
    fileLabel: 'Row-level place fixture.csv', sourceKind: 'mapped-single-table', sourceSheet: 'People',
  });
  const personAId = rowLevelOnly[0].generalizedObservation.participants[0].entityId;
  const personA = buildPeridotEntityAttributedStructure(rowLevelRuntime.normalizedLetters, {
    entityType: 'person', entityLabel: 'Person A', entityId: personAId,
  });

  return [
    assert('mapped place subject survives generalized runtime', mappedRows[0].generalizedObservation.places[0].subjectParticipantIndex === 0),
    assert('mapped place subject survives canonical record attributes', runtime.canonicalDataset.records[0].attributes.placeRoles[0].subjectParticipantIndex === 0),
    assert('own birthplace is attributed to selected participant', anne.places.some((entry) => entry.label === 'Birthplace' && entry.value === 'Graz')),
    assert('child birthplace can be independently attributed to mother as childbirth place', anne.places.some((entry) => entry.label === 'Place of childbirth' && entry.value === 'Łobzów')),
    assert('place dossier resolves connected participant from mapped place subject', graz.participants.some((entry) => entry.value === 'Anne von Habsburg')),
    assert('row-level place remains unattached rather than inferred onto participant', personA.places.length === 0),
  ];
}
