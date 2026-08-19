import { buildPeridotEntityAttributedStructure, buildPeridotRecordStructure } from './peridotRecordStructure.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const multipartRow = {
  generalizedObservation: {
    participants: [
      { index: 0, value: 'Person A', role: 'Child' },
      { index: 1, value: 'Person B', role: 'Mother' },
      { index: 2, value: 'Person C', role: 'Partner' },
    ],
    places: [
      { label: 'Firenze', role: 'Place of birth', subjectParticipantIndex: 0 },
      { label: 'Firenze', role: 'Childbirth place', subjectParticipantIndex: 1 },
    ],
    relationship: { type: 'Family', label: 'Recorded family relationship' },
    evidenceFields: [{ label: 'Archive note', value: 'Example evidence' }],
  },
  temporalAssertions: [
    { role: 'Birthday', sourceText: '1608/12/17', display: '1608/12/17', subjectParticipantIndex: 0 },
    { role: 'Childbirth', sourceText: '1608/12/17', display: '1608/12/17', subjectParticipantIndex: 1 },
  ],
};

const structure = buildPeridotRecordStructure(multipartRow);
assert(structure.participants.length === 3, 'All mapped participants should remain visible.');
assert(structure.temporal.length === 2, 'All temporal assertions should remain visible.');
assert(structure.temporal[1].subject === 'Person B', 'Participant-attached time should identify its subject.');
assert(structure.places.length === 2, 'Repeated uses of the same place should remain distinct by association.');
assert(structure.places[0].subject === 'Person A' && structure.places[1].subject === 'Person B', 'Place subjects should remain explicit.');
assert(structure.relationships.length === 2, 'Multipart relationship should expose focal-to-related pairs.');
assert(structure.evidence.some((entry) => entry.label === 'Archive note'), 'Mapped evidence should remain visible.');

console.log('Peridot record structure fixtures passed');


const personAStructure = buildPeridotEntityAttributedStructure([multipartRow], {
  entityLabel: 'Person A',
  entityType: 'person',
  entityEvidence: [{ label: 'Profession', value: 'Example profession' }],
});
assert(personAStructure.temporal.length === 1 && personAStructure.temporal[0].label === 'Birthday', 'Person A should receive only Person A temporal assertions.');
assert(personAStructure.places.length === 1 && personAStructure.places[0].label === 'Place of birth', 'Person A should receive only Person A place associations.');
assert(personAStructure.relationships.length === 2, 'Person A should retain all resolved relationships that actually include Person A.');
assert(personAStructure.participants.length === 0, 'Entity profiles should not repeat the selected entity under every participant/source column role.');
assert(personAStructure.evidence.length === 1 && personAStructure.evidence[0].label === 'Profession', 'Entity-owned metadata should remain on the entity profile.');
assert(!personAStructure.evidence.some((entry) => entry.label === 'Archive note'), 'Record-level evidence should not leak onto the entity profile.');

const personBStructure = buildPeridotEntityAttributedStructure([multipartRow], {
  entityLabel: 'Person B',
  entityType: 'person',
});
assert(personBStructure.temporal.length === 1 && personBStructure.temporal[0].label === 'Childbirth', 'Person B should receive the childbirth assertion explicitly attached to Person B.');
assert(personBStructure.places.length === 1 && personBStructure.places[0].label === 'Childbirth place', 'Person B should receive the childbirth place explicitly attached to Person B.');
assert(personBStructure.relationships.length === 1, 'Person B should receive only relationships that actually include Person B.');
assert(personBStructure.relationships[0].value === 'Person A', 'Entity relationship display should show the counterpart rather than repeat the selected entity.');
assert(!personBStructure.temporal.some((entry) => entry.label === 'Birthday'), 'Person B should not inherit Person A birthday.');

console.log('Peridot entity-attributed structure fixtures passed');


const reciprocalPartnerRows = [
  {
    generalizedObservation: {
      participants: [
        { index: 0, value: 'Lorenzo', role: 'Full name' },
        { index: 1, value: 'Madeleine', role: 'Partner name' },
      ],
      relationship: { label: 'Relationship 3', type: 'Married' },
    },
  },
  {
    generalizedObservation: {
      participants: [
        { index: 0, value: 'Madeleine', role: 'Full name' },
        { index: 1, value: 'Lorenzo', role: 'Partner name' },
      ],
      relationship: { label: 'Relationship 1', type: 'Married' },
    },
  },
];

const lorenzoStructure = buildPeridotEntityAttributedStructure(reciprocalPartnerRows, {
  entityLabel: 'Lorenzo',
  entityType: 'person',
});
assert(lorenzoStructure.relationships.length === 1, 'Reciprocal observations of the same partnership should resolve to one entity relationship.');
assert(lorenzoStructure.relationships[0].label === 'Partner / spouse of', 'Generic Full name + Partner name columns should resolve to a meaningful partnership role.');
assert(lorenzoStructure.relationships[0].value === 'Madeleine', 'Resolved relationship should display the counterpart entity.');
assert(!/^Relationship\s+\d+$/i.test(lorenzoStructure.relationships[0].label), 'Internal repeated-mapping labels should not headline entity relationships.');

const childRow = {
  generalizedObservation: {
    participants: [
      { index: 0, value: 'Child A', role: 'Full name' },
      { index: 1, value: 'Constance', role: 'Mother name' },
    ],
    relationship: { label: 'Relationship 1', type: 'parent-child' },
  },
};
const constanceStructure = buildPeridotEntityAttributedStructure([childRow], {
  entityLabel: 'Constance',
  entityType: 'person',
});
assert(constanceStructure.relationships.length === 1, 'Mother should receive the parent-child relationship.');
assert(constanceStructure.relationships[0].label === 'Mother of', 'Mother-name participation should resolve to Mother of.');
assert(constanceStructure.relationships[0].value === 'Child A', 'Mother relationship should point to the child counterpart.');
assert(constanceStructure.participants.length === 0, 'Mother name should not appear as a self-valued People / Entities field.');

const childStructure = buildPeridotEntityAttributedStructure([childRow], {
  entityLabel: 'Child A',
  entityType: 'person',
});
assert(childStructure.relationships[0].label === 'Child of', 'Generic identity role opposite Mother name should resolve to Child of.');
assert(childStructure.relationships[0].value === 'Constance', 'Child relationship should point to the mother counterpart.');

console.log('Peridot entity relationship semantic-resolution fixtures passed');

const reciprocalParentRows = [
  childRow,
  {
    generalizedObservation: {
      participants: [
        { index: 0, value: 'Constance', role: 'Full name' },
        { index: 1, value: 'Child A', role: 'Child name' },
      ],
      relationship: { label: 'Relationship 2', type: 'Family' },
    },
  },
];

const dedupedConstanceStructure = buildPeridotEntityAttributedStructure(reciprocalParentRows, {
  entityLabel: 'Constance',
  entityType: 'person',
});
assert(dedupedConstanceStructure.relationships.length === 1, 'Reciprocal parent observations with different role/type specificity should resolve to one semantic relationship.');
assert(dedupedConstanceStructure.relationships[0].label === 'Mother of', 'Equivalent reciprocal parent observations should preserve the more specific selected-entity role.');
assert(dedupedConstanceStructure.relationships[0].value === 'Child A', 'Deduplicated parent relationship should preserve the actual counterpart.');

const selfRelationshipRow = {
  generalizedObservation: {
    participants: [
      { index: 0, value: 'Anne Jagiellon', role: 'Full name' },
      { index: 1, value: 'Anne Jagiellon', role: 'Mother name' },
    ],
    relationship: { label: 'Relationship 1', type: 'parent-child' },
  },
};

const anneSelfGuardStructure = buildPeridotEntityAttributedStructure([selfRelationshipRow], {
  entityLabel: 'Anne Jagiellon',
  entityType: 'person',
});
assert(anneSelfGuardStructure.relationships.length === 0, 'An entity profile must reject relationships whose resolved counterpart is the selected entity itself.');

const distinctRelationshipKinds = [
  {
    generalizedObservation: {
      participants: [
        { index: 0, value: 'Person X', role: 'Full name' },
        { index: 1, value: 'Person Y', role: 'Patron' },
      ],
      relationship: { type: 'Patronage' },
    },
  },
  {
    generalizedObservation: {
      participants: [
        { index: 0, value: 'Person X', role: 'Full name' },
        { index: 1, value: 'Person Y', role: 'Correspondent' },
      ],
      relationship: { type: 'Correspondence' },
    },
  },
];

const personYDistinctStructure = buildPeridotEntityAttributedStructure(distinctRelationshipKinds, {
  entityLabel: 'Person Y',
  entityType: 'person',
});
assert(personYDistinctStructure.relationships.length === 2, 'Distinct custom relationship roles to the same counterpart must not be collapsed during reciprocal/repeated-observation deduplication.');

console.log('Peridot entity relationship self-guard and semantic-deduplication fixtures passed');


const duplicateNameCanonicalRows = [
  {
    id: 'event-anne-1549',
    recordType: 'genealogy-event',
    sourcePerson: 'Anne von Habsburg',
    sourceEntityId: 'anne-1549',
    entityId: 'anne-1549',
    personEntityId: 'anne-1549',
    person: 'Anne von Habsburg',
    eventType: 'birth',
    sourceLoc: 'Cigales',
    temporalAssertions: [
      { role: 'Birthday', sourceText: '1549/11/02', display: '1549/11/02' },
    ],
    originalCanonicalItem: {
      id: 'event-anne-1549',
      participantIds: ['anne-1549'],
    },
  },
  {
    id: 'event-anne-1573',
    recordType: 'genealogy-event',
    sourcePerson: 'Anne von Habsburg',
    sourceEntityId: 'anne-1573',
    entityId: 'anne-1573',
    personEntityId: 'anne-1573',
    person: 'Anne von Habsburg',
    eventType: 'birth',
    sourceLoc: 'Graz',
    temporalAssertions: [
      { role: 'Birthday', sourceText: '1573/08/16', display: '1573/08/16' },
    ],
    originalCanonicalItem: {
      id: 'event-anne-1573',
      participantIds: ['anne-1573'],
    },
  },
  {
    id: 'rel-anne-1549-child',
    recordType: 'genealogy-relationship',
    sourcePerson: 'Anne von Habsburg',
    targetPerson: 'Philip III von Habsburg',
    sourceEntityId: 'anne-1549',
    targetEntityId: 'philip-iii',
    sourceRole: 'mother',
    targetRole: 'child',
    relationshipType: 'parent-child',
    relationshipDirection: 'directed',
    originalCanonicalItem: {
      id: 'rel-anne-1549-child',
      participantAId: 'anne-1549',
      participantBId: 'philip-iii',
      participantARole: 'mother',
      participantBRole: 'child',
      relationshipType: 'parent-child',
      direction: 'directed',
    },
  },
  {
    id: 'rel-anne-1573-child',
    recordType: 'genealogy-relationship',
    sourcePerson: 'Anne von Habsburg',
    targetPerson: 'Władysław IV Vasa',
    sourceEntityId: 'anne-1573',
    targetEntityId: 'wladyslaw-iv',
    sourceRole: 'mother',
    targetRole: 'child',
    relationshipType: 'parent-child',
    relationshipDirection: 'directed',
    originalCanonicalItem: {
      id: 'rel-anne-1573-child',
      participantAId: 'anne-1573',
      participantBId: 'wladyslaw-iv',
      participantARole: 'mother',
      participantBRole: 'child',
      relationshipType: 'parent-child',
      direction: 'directed',
    },
  },
];

const anne1549Structure = buildPeridotEntityAttributedStructure(duplicateNameCanonicalRows, {
  entityId: 'anne-1549',
  entityLabel: 'Anne von Habsburg',
  entityType: 'person',
});
assert(
  anne1549Structure.temporal.length === 1 && anne1549Structure.temporal[0].value === '1549/11/02',
  'Canonical entity ID should keep same-label genealogy birthdays scoped to the selected person.',
);
assert(
  anne1549Structure.places.length === 1 && anne1549Structure.places[0].value === 'Cigales',
  'Canonical entity ID should keep same-label genealogy places scoped to the selected person.',
);
assert(
  anne1549Structure.relationships.length === 1 && anne1549Structure.relationships[0].value === 'Philip III von Habsburg',
  'Canonical entity ID should keep same-label genealogy relationships scoped to the selected person.',
);
assert(
  anne1549Structure.relationships[0].counterpartId === 'philip-iii',
  'Resolved relationship should retain canonical counterpart identity for Inspector navigation.',
);

const anne1573Structure = buildPeridotEntityAttributedStructure(duplicateNameCanonicalRows, {
  entityId: 'anne-1573',
  entityLabel: 'Anne von Habsburg',
  entityType: 'person',
});
assert(
  anne1573Structure.temporal.length === 1 && anne1573Structure.temporal[0].value === '1573/08/16',
  'A second canonical entity with the same display label should retain its own birthday.',
);
assert(
  anne1573Structure.relationships.length === 1 && anne1573Structure.relationships[0].value === 'Władysław IV Vasa',
  'A second canonical entity with the same display label should retain its own relationships.',
);

console.log('Peridot canonical entity-identity scoping fixtures passed');
