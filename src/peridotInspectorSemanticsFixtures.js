import { buildPeridotInspectorEntityProfile, collectPeridotInspectorEntityRows } from './peridotInspectorSemantics.js';
import { buildPeridotGeneralizedObservation } from './peridotGeneralizedMappingRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const familyRow = {
  id: 'family-row',
  generalizedObservation: {
    participants: [
      { index: 0, value: 'Child', entityId: 'child-1', role: 'Full name' },
      { index: 1, value: 'Mother', entityId: 'mother-1', role: 'Mother name' },
      { index: 2, value: 'Father', entityId: 'father-1', role: 'Father name' },
      { index: 3, value: 'Partner', entityId: 'partner-1', role: 'Partner name' },
    ],
    relationship: { type: 'Family', label: 'Relationship 1', direction: 'undirected' },
    places: [
      { label: 'Buda', role: 'Place of birth', subjectParticipantIndex: 0 },
      { label: 'Innsbruck', role: 'Residence', subjectParticipantIndex: 1 },
    ],
  },
};

const childProfile = buildPeridotInspectorEntityProfile([familyRow], {
  entityType: 'person',
  entityLabel: 'Child',
  entityId: 'child-1',
});
assert(childProfile.relatedPeopleCount === 3, 'Multipart Inspector profile should keep mother, father, and partner.');
assert(childProfile.relatedPeopleSections.flatMap((section) => section.items).some((item) => item.label === 'Father'), 'Father should survive Part C/D generalized relationship handling.');
assert(childProfile.relatedPlacesSections.flatMap((section) => section.items).some((item) => item.label === 'Buda'), 'Participant-attached birth place should appear on the child profile.');
assert(childProfile.routeCount === 0, 'Undirected genealogy place assertions must not manufacture directed routes.');

const budaProfile = buildPeridotInspectorEntityProfile([familyRow], {
  entityType: 'place',
  entityLabel: 'Buda',
});
assert(budaProfile.relatedPeopleCount === 1, 'Place profile should expose people connected through participant-place associations.');
assert(budaProfile.relatedPeopleSections[0].items[0].label === 'Child', 'Buda should connect to the actual participant whose place assertion names Buda.');
assert(budaProfile.relatedPeopleSections[0].title === 'Place of birth', 'Place-person association should preserve the mapped place role.');
assert(budaProfile.routeCount === 0, 'A participant place assertion alone must not become an Unknown route.');

const correspondenceRow = {
  id: 'letter-1',
  sourcePerson: 'Sender',
  sourceEntityId: 'sender-1',
  targetPerson: 'Recipient',
  targetEntityId: 'recipient-1',
  sourceLoc: 'Florence',
  targetLoc: 'Rome',
  relationshipDirection: 'directed',
  relationshipType: 'Correspondence',
  temporalAssertions: [{ display: '1620/01/01', sourceText: '1620/01/01', role: 'Letter date' }],
};
const senderProfile = buildPeridotInspectorEntityProfile([correspondenceRow], {
  entityType: 'person',
  entityLabel: 'Sender',
  entityId: 'sender-1',
});
assert(senderProfile.relatedPeopleCount === 1, 'Correspondence counterpart should remain visible.');
assert(senderProfile.relatedPlacesSections.flatMap((section) => section.items).some((item) => item.label === 'Florence'), 'Correspondence source place should remain associated with the sender.');
assert(senderProfile.routeCount === 1, 'A real source-to-target place pair should remain a directed route.');

const duplicateNameRows = [
  { id: 'a', person: 'Anne', personEntityId: 'anne-a', entityId: 'anne-a', sourcePerson: 'Anne', sourceEntityId: 'anne-a', recordType: 'genealogy-event', eventType: 'birth', sourceLoc: 'Place A' },
  { id: 'b', person: 'Anne', personEntityId: 'anne-b', entityId: 'anne-b', sourcePerson: 'Anne', sourceEntityId: 'anne-b', recordType: 'genealogy-event', eventType: 'birth', sourceLoc: 'Place B' },
];
const anneARows = collectPeridotInspectorEntityRows(duplicateNameRows, [], { entityType: 'person', entityLabel: 'Anne', entityId: 'anne-a' });
assert(anneARows.length === 1 && anneARows[0].id === 'a', 'Canonical ID should disambiguate same-label Inspector rows when present.');



// Participant attachment indexes refer to the original mapped Part A/B/C/D
// positions, even when an intermediate participant is blank in a particular row.
const sparseParticipantRow = {
  id: 'sparse-participants',
  generalizedObservation: {
    participants: [
      { index: 0, value: 'Catherine', entityId: 'catherine-1', role: 'Full name' },
      { index: 1, value: '', entityId: '', role: 'Father name' },
      { index: 2, value: 'Henry', entityId: 'henry-1', role: 'Partner name' },
    ],
    temporal: {
      assertions: [
        { role: 'Birthday', sourceText: '1519/03/31', subjectParticipantIndex: 2 },
      ],
    },
    places: [
      { label: 'Saint-Germain-en-Laye', role: 'Place of birth', subjectParticipantIndex: 2 },
    ],
    relationship: { type: 'Partner', label: 'Partner', direction: 'undirected' },
  },
};
const catherineSparseProfile = buildPeridotInspectorEntityProfile([sparseParticipantRow], {
  entityType: 'person', entityLabel: 'Catherine', entityId: 'catherine-1',
});
assert(catherineSparseProfile.structure.temporal.length === 0, 'A partner-attached birthday must not shift onto the selected person when an earlier participant slot is blank.');
assert(catherineSparseProfile.structure.places.length === 0, 'A partner-attached place must not shift onto the selected person when an earlier participant slot is blank.');
const henrySparseProfile = buildPeridotInspectorEntityProfile([sparseParticipantRow], {
  entityType: 'person', entityLabel: 'Henry', entityId: 'henry-1',
});
assert(henrySparseProfile.structure.temporal.some((entry) => entry.value === '1519/03/31'), 'Sparse participant indexes should still attach Henry birthday to Henry.');
assert(henrySparseProfile.structure.places.some((entry) => entry.value === 'Saint-Germain-en-Laye'), 'Sparse participant indexes should still attach Henry place to Henry.');

const namedPlaceObservation = buildPeridotGeneralizedObservation(
  { Person: 'Catherine', Child: 'Claude', 'place of birth': 'Fontainebleau' },
  {
    relationshipParts: [
      { participantColumn: 'Person', roleMode: 'heading', headingRole: 'Person' },
      { participantColumn: 'Child', roleMode: 'heading', headingRole: 'Child' },
    ],
    placeParts: [
      { placeColumn: 'place of birth', roleMode: 'heading', roleLabel: 'Place of childbirth', subjectParticipantIndex: 0 },
    ],
  },
  0,
);
assert(namedPlaceObservation.places[0]?.role === 'Place of childbirth', 'Researcher-declared fixed place role should override the source column heading while preserving the place value.');

console.log('Peridot Inspector semantic fixtures passed');
