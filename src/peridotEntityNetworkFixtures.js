import { derivePeridotEntityNetworkSemantics, derivePeridotGeographicEntityNetworkSemantics, getPeridotRowEntityParticipantEntries, getPeridotRowEntityParticipants, getPeridotRowEntityRelationshipLabels, rowHasPeridotEntityRelationship } from './peridotEntityNetwork.js';

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


  const duplicateLabelCanonicalRows = [
    {
      sourcePerson: 'Anne von Habsburg',
      targetPerson: 'Child A',
      sourceEntityId: 'anne-1549',
      targetEntityId: 'child-a',
      originalCanonicalItem: {
        id: 'rel-anne-1549-child-a',
        participantAId: 'anne-1549',
        participantBId: 'child-a',
        relationshipType: 'parent-child',
        direction: 'directed',
        participantARole: 'mother',
        participantBRole: 'child',
      },
    },
    {
      sourcePerson: 'Anne von Habsburg',
      targetPerson: 'Child B',
      sourceEntityId: 'anne-1573',
      targetEntityId: 'child-b',
      originalCanonicalItem: {
        id: 'rel-anne-1573-child-b',
        participantAId: 'anne-1573',
        participantBId: 'child-b',
        relationshipType: 'parent-child',
        direction: 'directed',
        participantARole: 'mother',
        participantBRole: 'child',
      },
    },
  ];
  const duplicateLabelSemantics = derivePeridotEntityNetworkSemantics(duplicateLabelCanonicalRows);
  assert(
    duplicateLabelSemantics.relationships.some((edge) => edge.source === 'Anne von Habsburg' && edge.sourceId === 'anne-1549'),
    'Canonical network semantics should preserve the first same-label entity ID.',
  );
  assert(
    duplicateLabelSemantics.relationships.some((edge) => edge.source === 'Anne von Habsburg' && edge.sourceId === 'anne-1573'),
    'Canonical network semantics should preserve the second same-label entity ID.',
  );
  const duplicateParticipantEntries = getPeridotRowEntityParticipantEntries(duplicateLabelCanonicalRows[0]);
  assert(
    duplicateParticipantEntries.some((participant) => participant.id === 'anne-1549' && participant.label === 'Anne von Habsburg'),
    'Structured participant helper should keep canonical identity separate from display label.',
  );

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

  // Geographic People Map regression: canonical genealogy relationships may be
  // undated structural rows while birth/death events carry the explicit places.
  // Timeline filtering of event rows must not erase the family relationship itself.
  const splitScopeGeography = derivePeridotGeographicEntityNetworkSemantics(
    [
      {
        sourcePerson: 'Mother',
        targetPerson: 'Person A',
        originalCanonicalItem: {
          id: 'rel-mother-child',
          participantAId: 'mother-id',
          participantBId: 'person-a-id',
          relationshipType: 'parent-child',
          direction: 'directed',
          participantARole: 'mother',
          participantBRole: 'child',
        },
      },
    ],
    [
      { recordType: 'genealogy-event', sourcePerson: 'Mother', sourceLoc: 'Florence', sourceLat: 43.77, sourceLon: 11.25, eventType: 'childbirth' },
      { recordType: 'genealogy-event', sourcePerson: 'Person A', sourceLoc: 'Florence', sourceLat: 43.77, sourceLon: 11.25, eventType: 'birth' },
    ],
  );
  assert(splitScopeGeography.relationships.length === 1, 'Undated genealogy relationship should survive in the geographic structural scope.');
  assert(splitScopeGeography.locations.length === 2, 'Timeline-visible genealogy events should provide geographic anchors independently of relationship rows.');
  assert(splitScopeGeography.relationships[0]?.source === 'Mother' && splitScopeGeography.relationships[0]?.target === 'Person A', 'Geographic relationship endpoints should preserve canonical genealogy direction.');
  assert(splitScopeGeography.locations.some((location) => location.person === 'Mother' && location.role === 'childbirth'), 'Mother childbirth place should remain attached to Mother.');
  assert(splitScopeGeography.locations.some((location) => location.person === 'Person A' && location.role === 'birth'), 'Person A birth place should remain attached to Person A.');

  return {
    multipartEdgeCount: multipart.relationships.length,
    genealogyEdgeCount: genealogy.relationships.length,
    distinctRelationshipCount: distinct.relationships.length,
    locationAssertionCount: places.locations.length,
    splitScopeGeographicRelationshipCount: splitScopeGeography.relationships.length,
    splitScopeGeographicLocationCount: splitScopeGeography.locations.length,
  };
}
