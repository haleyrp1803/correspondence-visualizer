import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import {
  buildPeridotRowsFromWorkbookMapping,
  makeWorkbookColumnRef,
} from './peridotWorkbookMapping.js';

function subjectIndexes(fields = []) {
  return fields.map((field) => Number.isInteger(field?.subjectParticipantIndex) ? field.subjectParticipantIndex : null);
}

export function runPeridotEvidenceAttributionFixtureAudit() {
  const singleRows = [{ PersonA: 'Anna', PersonB: 'Maria', Roles: 'clerical / diplomatic' }];
  const singleMapping = {
    relationshipParts: [
      { participantColumn: 'PersonA', roleLabel: 'person A', roleMode: 'heading' },
      { participantColumn: 'PersonB', roleLabel: 'person B', roleMode: 'heading' },
    ],
    customFieldSelections: [{
      sourceColumn: 'Roles',
      label: 'Roles',
      action: 'include',
      analyticsEligible: true,
      valueHandling: { cardinality: 'multiple', delimiter: '/' },
      subjectSelection: { includeRecord: true, participantIndices: [0, 1] },
    }],
  };

  const singleMapped = applyPeridotGeneralizedColumnMapping(singleRows, singleMapping);
  const singleEvidence = singleMapped[0]?.generalizedObservation?.evidenceFields || [];

  const workbookModel = {
    fileName: 'Evidence attribution fixture.xlsx',
    sheets: [{
      sheetName: 'Data',
      headers: ['ID', 'PersonA', 'PersonB', 'Role'],
      rows: [{ ID: 'R1', PersonA: 'Anna', PersonB: 'Maria', Role: 'diplomat' }],
      rowCount: 1,
      columnCount: 4,
    }],
  };
  const ref = makeWorkbookColumnRef;
  const workbookMapping = {
    datasetProfileId: 'peridot.correspondence-directed-record',
    mode: 'single_sheet',
    primarySheetName: 'Data',
    primaryLetterIdColumn: 'ID',
    letterLevelJoins: [],
    lookupJoins: [],
    relationshipParts: [
      { participantRef: ref('Data', 'PersonA'), roleMode: 'heading', roleRef: ref('', '') },
      { participantRef: ref('Data', 'PersonB'), roleMode: 'heading', roleRef: ref('', '') },
    ],
    placeParts: [],
    temporalMappings: {},
    temporalNoteMappings: {},
    temporalAssertionMappings: [],
    relationshipMetadataMappings: {},
    customFieldSelections: [{
      sourceRef: ref('Data', 'Role'),
      sourceColumn: 'Role',
      sheetName: 'Data',
      label: 'Role',
      action: 'include',
      analyticsEligible: true,
      subjectSelection: { includeRecord: false, participantIndices: [1] },
    }],
    coreMappings: {},
    pointMappings: {},
    routeCoordinatePairMappings: {},
  };

  const workbookRows = buildPeridotRowsFromWorkbookMapping(workbookModel, workbookMapping);
  const workbookEvidence = workbookRows[0]?.generalizedObservation?.evidenceFields || [];

  const legacyMapped = applyPeridotGeneralizedColumnMapping(
    [{ Person: 'Anna', Note: 'record note' }],
    {
      relationshipParts: [{ participantColumn: 'Person', roleMode: 'heading' }],
      customFieldSelections: [{ sourceColumn: 'Note', label: 'Note', action: 'include' }],
    }
  );
  const legacyEvidence = legacyMapped[0]?.generalizedObservation?.evidenceFields || [];

  const checks = Object.freeze({
    cardinalitySplitsBeforeSubjectFanout:
      singleEvidence.length === 6
      && singleEvidence.map((field) => field.value).join('|') === 'clerical|clerical|clerical|diplomatic|diplomatic|diplomatic',
    recordAndParticipantsFanOutAtomically:
      JSON.stringify(subjectIndexes(singleEvidence)) === JSON.stringify([null, 0, 1, null, 0, 1]),
    rawEvidenceCellPreserved:
      singleEvidence.every((field) => field.rawValue === 'clerical / diplomatic'),
    workbookSubjectSelectionPreserved:
      workbookEvidence.length === 1
      && workbookEvidence[0]?.value === 'diplomat'
      && workbookEvidence[0]?.subjectParticipantIndex === 1,
    legacyEvidenceDefaultsToRecord:
      legacyEvidence.length === 1
      && legacyEvidence[0]?.subjectParticipantIndex === null,
    compatibilityCustomFieldsStillPresent:
      singleMapped[0]?.customInspectorFields?.length === 2
      && workbookRows[0]?.customInspectorFields?.length === 1,
  });

  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks });
}
