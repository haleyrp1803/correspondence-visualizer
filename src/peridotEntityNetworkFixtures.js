import { derivePeridotEntityNetworkSemantics, getPeridotRowEntityParticipants, getPeridotRowEntityRelationshipLabels, rowHasPeridotEntityRelationship } from './peridotEntityNetwork.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function runPeridotEntityNetworkSelfAudit() {
  const multipart = derivePeridotEntityNetworkSemantics([
    {
      generalizedObservation: {
        participants: [
          { value: 'Person A', role: 'person' },
          { value: 'Father', role: 'father' },
          { value: 'Mother', role: 'mother' },
          { value: 'Partner', role: 'partner' },
        ],
        places: [],
        relationship: { type: 'family', label: '' },
      },
    },
  ]);

  assert(multipart.relationships.length === 3, 'Multipart mapping should create exactly three asserted Part-A relationships.');
  const pairs = new Set(multipart.relationships.map((edge) => `${edge.source}|${edge.target}`));
  assert(pairs.has('Person A|Father'), 'Person A should connect to Father.');
  assert(pairs.has('Person A|Mother'), 'Person A should connect to Mother.');
  assert(pairs.has('Person A|Partner'), 'Person A should connect to Partner.');
  assert(!pairs.has('Father|Mother'), 'Co-participants must not be connected merely by co-occurrence.');
  assert(multipart.relationships.every((edge) => edge.direction === 'undirected'), 'Generalized relationships without explicit direction must remain undirected.');

  const multipartRow = {
    generalizedObservation: {
      participants: [
        { value: 'Person A', role: 'person' },
        { value: 'Father', role: 'father' },
        { value: 'Mother', role: 'mother' },
        { value: 'Partner', role: 'partner' },
      ],
      places: [],
      relationship: { type: 'family', label: '' },
    },
  };
  assert(rowHasPeridotEntityRelationship(multipartRow), 'Multipart row should report network readiness through shared relationship semantics.');
  assert(getPeridotRowEntityParticipants(multipartRow).join('|') === 'Person A|Father|Mother|Partner', 'Shared participant helper should expose every mapped relationship participant.');
  assert(getPeridotRowEntityRelationshipLabels(multipartRow).join('|') === 'Person A — Father|Person A — Mother|Person A — Partner', 'Shared relationship labels should expose every mapped relationship pair and preserve undirected semantics.');

  const genealogy = derivePeridotEntityNetworkSemantics([
    {
      sourcePerson: 'Father',
      targetPerson: 'Child',
      originalCanonicalItem: {
        id: 'rel-parent',
        participantAId: 'father-id',
        participantBId: 'child-id',
        relationshipType: 'parent-child',
        direction: 'directed',
        participantARole: 'father',
        participantBRole: 'child',
      },
    },
    {
      sourcePerson: 'Person A',
      targetPerson: 'Partner',
      originalCanonicalItem: {
        id: 'rel-partner',
        participantAId: 'a-id',
        participantBId: 'partner-id',
        relationshipType: 'partner',
        direction: 'undirected',
        participantARole: 'partner',
        participantBRole: 'partner',
      },
    },
  ]);

  assert(genealogy.relationships.find((edge) => edge.relationshipType === 'parent-child')?.direction === 'directed', 'Canonical directed genealogy relationship should remain directed.');
  assert(genealogy.relationships.find((edge) => edge.relationshipType === 'partner')?.direction === 'undirected', 'Canonical partnership should remain undirected.');

  const distinct = derivePeridotEntityNetworkSemantics([
    { sourcePerson: 'A', targetPerson: 'B', relationshipType: 'letter', relationshipDirection: 'directed' },
    { sourcePerson: 'B', targetPerson: 'A', relationshipType: 'letter', relationshipDirection: 'directed' },
    { sourcePerson: 'A', targetPerson: 'B', relationshipType: 'patronage', relationshipDirection: 'directed' },
    { sourcePerson: 'A', targetPerson: 'B', relationshipType: 'letter', relationshipDirection: 'directed' },
  ]);

  assert(distinct.relationships.length === 3, 'Opposite directions and distinct relationship types must remain separate.');
  const abLetter = distinct.relationships.find((edge) => edge.source === 'A' && edge.target === 'B' && edge.relationshipType === 'letter');
  assert(abLetter?.count === 2, 'Repeated observations of the same directed relationship should aggregate as count.');

  const places = derivePeridotEntityNetworkSemantics([
    {
      generalizedObservation: {
        participants: [{ value: 'A', role: 'person' }, { value: 'B', role: 'relative' }],
        places: [
          { label: 'Florence', latitude: 43.77, longitude: 11.25, role: 'residence', subjectParticipantIndex: 0 },
          { label: 'Rome', latitude: 41.9, longitude: 12.5, role: 'court', subjectParticipantIndex: 1 },
        ],
        relationship: {},
      },
    },
  ]);
  assert(places.locations.length === 2, 'Explicit participant-place associations should survive into network anchors.');
  assert(places.locations.some((location) => location.person === 'A' && location.label === 'Florence'), 'Part A place association should remain attached to Part A.');
  assert(places.locations.some((location) => location.person === 'B' && location.label === 'Rome'), 'Part B place association should remain attached to Part B.');

  return {
    multipartEdgeCount: multipart.relationships.length,
    genealogyEdgeCount: genealogy.relationships.length,
    distinctRelationshipCount: distinct.relationships.length,
    locationAssertionCount: places.locations.length,
  };
}
