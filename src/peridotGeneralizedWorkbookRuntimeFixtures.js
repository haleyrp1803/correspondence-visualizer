/*
 * Dependency-free fixtures for the generalized workbook runtime authority
 * boundary. These checks verify that Sheet + Column semantic mappings remain
 * authoritative across joined workbook rows while legacy correspondence fields
 * are derived compatibility projections only.
 */

import {
  buildPeridotRowsFromWorkbookMapping,
  makeLetterIdJoin,
  makeWorkbookColumnRef,
} from './peridotWorkbookMapping.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';

export function runPeridotGeneralizedWorkbookRuntimeSelfAudit() {
  const workbookModel = {
    fileName: 'Generalized workbook fixture.xlsx',
    sheets: [
      {
        sheetName: 'Letters',
        headers: ['Letter_ID', 'Writer', 'Date', 'Subject', 'OldSource', 'OldTarget'],
        rows: [
          { Letter_ID: 'L1', Writer: 'Maria', Date: '1614-05-03', Subject: 'Marriage', OldSource: 'Wrong A', OldTarget: 'Wrong B' },
          { Letter_ID: 'L2', Writer: 'Maria', Date: '1614-05-11', Subject: 'Court', OldSource: 'Wrong C', OldTarget: 'Wrong D' },
        ],
        rowCount: 2,
        columnCount: 6,
      },
      {
        sheetName: 'Details',
        headers: ['Letter_ID', 'Recipient', 'WrittenAt', 'WriterPlace', 'WriterCoordinates', 'RecipientPlace', 'RecipientCoordinates', 'RelationType'],
        rows: [
          { Letter_ID: 'L1', Recipient: 'Cosimo', WrittenAt: 'Florence', WriterPlace: 'Florence', WriterCoordinates: '43.7696, 11.2558', RecipientPlace: 'Pisa', RecipientCoordinates: '43.7228, 10.4017', RelationType: 'letter' },
          { Letter_ID: 'L2', Recipient: 'Virginia', WrittenAt: 'Rome', WriterPlace: 'Rome', WriterCoordinates: '41.9028, 12.4964', RecipientPlace: 'Florence', RecipientCoordinates: '43.7696, 11.2558', RelationType: 'letter' },
        ],
        rowCount: 2,
        columnCount: 8,
      },
    ],
  };

  const ref = makeWorkbookColumnRef;
  const mapping = {
    datasetProfileId: 'peridot.correspondence-directed-record',
    mode: 'multi_sheet_letter_id',
    primarySheetName: 'Letters',
    primaryLetterIdColumn: 'Letter_ID',
    letterLevelJoins: [makeLetterIdJoin({
      fromSheetName: 'Letters',
      fromColumnName: 'Letter_ID',
      toSheetName: 'Details',
      toColumnName: 'Letter_ID',
    })],
    lookupJoins: [],
    relationshipParts: [
      { participantRef: ref('Letters', 'Writer'), roleMode: 'heading', roleRef: ref('', '') },
      { participantRef: ref('Details', 'Recipient'), roleMode: 'heading', roleRef: ref('', '') },
    ],
    placeParts: [
      {
        placeRef: ref('Details', 'WriterPlace'),
        roleMode: 'heading',
        roleRef: ref('', ''),
        subjectParticipantIndex: 0,
        coordinatePairRef: ref('Details', 'WriterCoordinates'),
        latitudeRef: ref('', ''),
        longitudeRef: ref('', ''),
      },
      {
        placeRef: ref('Details', 'RecipientPlace'),
        roleMode: 'heading',
        roleRef: ref('', ''),
        subjectParticipantIndex: 1,
        coordinatePairRef: ref('Details', 'RecipientCoordinates'),
        latitudeRef: ref('', ''),
        longitudeRef: ref('', ''),
      },
    ],
    temporalMappings: { Date: ref('Letters', 'Date'), Date_Start: ref('', ''), Date_End: ref('', ''), Date_Display: ref('', '') },
    relationshipMetadataMappings: { Relationship_Type: ref('Details', 'RelationType'), Relationship_Label: ref('', '') },
    customFieldSelections: [
      { sourceRef: ref('Letters', 'Subject'), sourceColumn: 'Subject', sheetName: 'Letters', label: 'Subject', action: 'include', analyticsEligible: true },
    ],
    // Stale legacy participant mappings intentionally disagree with the new
    // relationship parts. They must not determine canonical semantics.
    coreMappings: {
      Source_Name: ref('Letters', 'OldSource'),
      Target_Name: ref('Letters', 'OldTarget'),
    },
    pointMappings: {},
    routeCoordinatePairMappings: {},
  };

  const mappedRows = buildPeridotRowsFromWorkbookMapping(workbookModel, mapping);
  const runtime = buildPeridotCanonicalRuntimeModel(mappedRows, {
    fileLabel: 'Generalized workbook fixture.xlsx (mapped workbook)',
    sourceKind: 'mapped-workbook',
    sourceSheet: 'Letters',
    importedAt: '2026-08-08T00:00:00.000Z',
  });
  const canonical = runtime.canonicalDataset;
  const firstRecord = canonical.records[0];
  const mariaId = canonical.entities.find((entity) => entity.label === 'Maria')?.id;
  const cosimoId = canonical.entities.find((entity) => entity.label === 'Cosimo')?.id;
  const florenceId = canonical.places.find((place) => place.label === 'Florence')?.id;
  const pisaId = canonical.places.find((place) => place.label === 'Pisa')?.id;

  const checks = Object.freeze({
    generalizedCanonicalPath:
      runtime.normalizationSource?.mode === 'canonical-generalized-mapping-through-legacy-adapter',
    canonicalSourceShape:
      canonical.sourceManifest?.sourceShape === 'generalized-user-mapped-observations',
    joinedParticipantPreserved:
      canonical.entities.some((entity) => entity.label === 'Maria')
      && canonical.entities.some((entity) => entity.label === 'Cosimo'),
    humanReadableParticipantRolesPreserved:
      firstRecord?.attributes?.participantRoles?.[0]?.role === 'Writer'
      && firstRecord?.attributes?.participantRoles?.[1]?.role === 'Recipient',
    joinedPlacesPreserved:
      canonical.places?.some((place) => place.label === 'Florence')
      && canonical.places?.some((place) => place.label === 'Pisa'),
    joinedCoordinatesPreserved:
      canonical.places?.some((place) => place.latitude === 43.7696 && place.longitude === 11.2558)
      && canonical.places?.some((place) => place.latitude === 43.7228 && place.longitude === 10.4017),
    placeSubjectsPreserved:
      Boolean(mariaId && cosimoId && florenceId && pisaId)
      && canonical.assertions?.some((assertion) => assertion.objectId === florenceId && assertion.subjectId === mariaId)
      && canonical.assertions?.some((assertion) => assertion.objectId === pisaId && assertion.subjectId === cosimoId),
    legacyRouteDerivedFromExplicitAssociations:
      mappedRows[0]?.Source_Location === 'Florence'
      && mappedRows[0]?.Target_Location === 'Pisa'
      && mappedRows[0]?.Source_Latitude === 43.7696
      && mappedRows[0]?.Target_Latitude === 43.7228,
    relationshipMetadataPreserved:
      firstRecord?.attributes?.relationshipType === 'letter',
    evidencePreserved:
      firstRecord?.attributes?.customFields?.Subject === 'Marriage',
    temporalValuePreserved:
      Boolean(firstRecord?.temporalAssertion),
    staleLegacyParticipantMappingsIgnored:
      mappedRows[0]?.Source_Name === 'Maria'
      && mappedRows[0]?.Target_Name === 'Cosimo',
    workbookProvenancePreserved:
      mappedRows[0]?.originalUploadedRow?.sheetRows?.Letters?.Letter_ID === 'L1'
      && mappedRows[0]?.originalUploadedRow?.sheetRows?.Details?.Letter_ID === 'L1',
    legacyConsumerStillReceivesRows:
      runtime.normalizedLetters?.length === 2,
    canonicalValidationPasses:
      canonical.validation?.valid === true && canonical.validation?.canCommit === true,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    counts: Object.freeze({
      records: canonical.records.length,
      entities: canonical.entities.length,
      places: canonical.places.length,
      participations: canonical.participations.length,
      legacyLetters: runtime.normalizedLetters.length,
    }),
  });
}
