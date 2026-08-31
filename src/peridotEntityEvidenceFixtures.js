import {
  buildPeridotCanonicalEntityEvidenceMap,
  getPeridotCanonicalEntityEvidence,
  filterPeridotCanonicalEntityEvidenceToRows,
} from './peridotEntityEvidence.js';
import { buildPeridotInspectorEntityProfile } from './peridotInspectorSemantics.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function runPeridotEntityEvidenceFixtures() {
  const canonicalDataset = {
    entities: [
      { id: 'entity:a', label: 'Person A' },
      { id: 'entity:b', label: 'Person B' },
    ],
    records: [{ id: 'record:1', label: 'Record 1' }],
    assertions: [
      {
        id: 'assertion:entity-a:occupation',
        subjectId: 'entity:a',
        predicate: 'mapped-evidence:occupation',
        value: 'Diplomat',
        evidenceSourceIds: ['evidence:1'],
        attributes: { mappedLabel: 'Occupation', sourceColumn: 'Profession' },
        provenance: { source: { sourceRowNumber: 2, sourceSheet: 'Data' } },
      },
      {
        id: 'assertion:entity-a:office',
        subjectId: 'entity:a',
        predicate: 'mapped-evidence:office',
        value: 'Ambassador',
        evidenceSourceIds: ['evidence:2'],
        attributes: { mappedLabel: 'Office', sourceColumn: 'Office' },
        provenance: { source: { sourceRowNumber: 5, sourceSheet: 'Data' } },
      },
      {
        id: 'assertion:record:occupation',
        subjectId: 'record:1',
        predicate: 'mapped-evidence:occupation',
        value: 'Courtier',
        evidenceSourceIds: ['evidence:1'],
        attributes: { mappedLabel: 'Occupation', sourceColumn: 'Profession' },
      },
      {
        id: 'assertion:entity-b:other',
        subjectId: 'entity:b',
        predicate: 'mapped-evidence:status',
        value: 'Clerical',
        evidenceSourceIds: ['evidence:1'],
        attributes: { mappedLabel: 'Status', sourceColumn: 'Status' },
      },
      {
        id: 'assertion:non-evidence',
        subjectId: 'entity:a',
        predicate: 'mapped-place:birthplace',
        objectId: 'place:1',
      },
    ],
  };

  const map = buildPeridotCanonicalEntityEvidenceMap(canonicalDataset);
  const entityA = getPeridotCanonicalEntityEvidence(map, 'entity:a');
  const entityB = getPeridotCanonicalEntityEvidence(map, 'entity:b');

  assert(entityA.length === 2, 'Entity A should receive its participant-attributed mapped Evidence assertions.');
  assert(entityA.some((field) => field.label === 'Occupation' && field.value === 'Diplomat'), 'Entity A should expose the canonical mapped Evidence label/value.');
  assert(entityB.length === 1 && entityB[0].value === 'Clerical', 'Entity B should receive only its own mapped Evidence assertion.');
  assert(!entityA.some((field) => field.value === 'Courtier'), 'Record-level Evidence must not leak onto a connected entity.');
  assert(getPeridotCanonicalEntityEvidence(map, 'record:1').length === 0, 'Record ids are not entity Evidence subjects.');

  const visibleEntityA = filterPeridotCanonicalEntityEvidenceToRows(entityA, [{ generalizedObservation: { rowIndex: 0 } }]);
  assert(visibleEntityA.length === 1 && visibleEntityA[0].value === 'Diplomat', 'Entity Evidence projection should respect the currently visible linked-record scope by source row.');

  const profile = buildPeridotInspectorEntityProfile([
    {
      generalizedObservation: {
        rowIndex: 0,
        participants: [{ index: 0, value: 'Person A', entityId: 'entity:a', role: 'Person' }],
        evidenceFields: [{ label: 'Record note', value: 'Keep on record' }],
      },
    },
  ], {
    entityType: 'person',
    entityLabel: 'Person A',
    entityId: 'entity:a',
    entityEvidence: visibleEntityA,
  });
  assert(profile.structure.evidence.some((field) => field.label === 'Occupation' && field.value === 'Diplomat'), 'Inspector semantic projection should expose canonical participant-attributed Evidence on the selected entity.');
  assert(!profile.structure.evidence.some((field) => field.value === 'Courtier'), 'Inspector semantic projection must not inherit record-level Evidence from the canonical assertion map.');
  assert(!profile.structure.evidence.some((field) => field.value === 'Keep on record'), 'Entity Inspector must not scrape generic Evidence from linked record rows.');

  return true;
}
