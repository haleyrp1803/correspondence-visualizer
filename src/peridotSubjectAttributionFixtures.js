import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';

function subjectIndexes(values = []) {
  return values.map((value) => Number.isInteger(value?.subjectParticipantIndex) ? value.subjectParticipantIndex : null);
}

export function runPeridotSubjectAttributionFixtureAudit() {
  const rows = [{
    PersonA: 'Anna',
    PersonB: 'Maria',
    Place: 'Vienna',
    RecordDate: '1600',
    ParticipantDate: '1601',
  }];

  const mapping = {
    relationshipParts: [
      { participantColumn: 'PersonA', roleLabel: 'person A', roleMode: 'heading' },
      { participantColumn: 'PersonB', roleLabel: 'person B', roleMode: 'heading' },
    ],
    placeParts: [{
      placeColumn: 'Place',
      roleLabel: 'Court',
      roleMode: 'heading',
      subjectSelection: { includeRecord: true, participantIndices: [0, 1] },
    }],
    temporalAssertionMappings: [
      {
        id: 'record-date', role: 'Record date', kind: 'date', sourceMode: 'single', column: 'RecordDate', noteColumns: [],
        subjectSelection: { includeRecord: true, participantIndices: [] },
      },
      {
        id: 'participant-date', role: 'Participant date', kind: 'date', sourceMode: 'single', column: 'ParticipantDate', noteColumns: [],
        subjectSelection: { includeRecord: false, participantIndices: [0, 1] },
      },
    ],
  };

  const mappedRows = applyPeridotGeneralizedColumnMapping(rows, mapping);
  const observation = mappedRows[0]?.generalizedObservation || {};
  const canonical = normalizePeridotGeneralizedMappedRows(mappedRows, {
    datasetId: 'subject-attribution-fixture',
    datasetLabel: 'Subject attribution fixture',
    sourceFileId: 'fixture',
    sourceFileName: 'fixture.csv',
    sourceSheet: 'Data',
    importedAt: '2026-08-31T00:00:00.000Z',
  });

  const record = canonical.records?.[0] || null;
  const placeAssertions = (canonical.assertions || []).filter((assertion) => String(assertion?.predicate || '').startsWith('mapped-place:'));
  const recordId = record?.id || '';
  const participantIds = record?.participantIds || [];
  const placeSubjects = new Set(placeAssertions.map((assertion) => assertion?.subjectId));
  const participantTemporalCounts = (canonical.participations || [])
    .filter((participation) => participation?.targetId === recordId)
    .map((participation) => (participation?.temporalAssertions || []).length)
    .sort((a, b) => a - b);

  const checks = Object.freeze({
    placeMappingFansOutAtomically:
      observation.places?.length === 3
      && JSON.stringify(subjectIndexes(observation.places)) === JSON.stringify([null, 0, 1]),
    temporalMappingFansOutAtomically:
      observation.temporal?.assertions?.length === 3
      && JSON.stringify(subjectIndexes(observation.temporal.assertions)) === JSON.stringify([null, 0, 1]),
    canonicalPlaceAssertionsKeepSingleSubjects:
      placeAssertions.length === 3
      && placeSubjects.has(recordId)
      && participantIds.every((entityId) => placeSubjects.has(entityId)),
    canonicalRecordDeduplicatesPlaceReferences:
      Array.isArray(record?.placeReferenceIds)
      && record.placeReferenceIds.length === 1,
    participantTemporalScopeIsTightened:
      participantTemporalCounts.length === 2
      && participantTemporalCounts.every((count) => count === 2),
  });

  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks });
}
