/*
 * Dependency-free fixtures for the generalized single-table runtime authority
 * boundary. These checks verify that canonical semantics come from the new
 * user mapping while legacy Source/Target/Point fields remain projections.
 */

import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';

export function runPeridotGeneralizedMappingRuntimeSelfAudit() {
  const sourceRows = [
    {
      Writer: 'Maria',
      Recipient: 'Cosimo',
      WriterRole: 'sender',
      RecipientRole: 'recipient',
      WrittenAt: 'Florence',
      PlaceRole: 'origin',
      Coordinates: '43.7696, 11.2558',
      Date: '1614-05-03',
      Lifespan: '1589–1631',
      RelationType: 'letter',
      Subject: 'Marriage',
    },
    {
      Writer: 'Maria',
      Recipient: 'Virginia',
      WriterRole: 'sender',
      RecipientRole: 'recipient',
      WrittenAt: 'Rome',
      PlaceRole: 'origin',
      Coordinates: '41.9028, 12.4964',
      Date: '1614-05-11',
      Lifespan: '1568–1615',
      RelationType: 'letter',
      Subject: 'Court',
    },
  ];

  const mapping = {
    relationshipParts: [
      { participantColumn: 'Writer', roleMode: 'column', roleColumn: 'WriterRole' },
      { participantColumn: 'Recipient', roleMode: 'column', roleColumn: 'RecipientRole' },
    ],
    placeParts: [
      {
        placeColumn: 'WrittenAt',
        roleMode: 'column',
        roleColumn: 'PlaceRole',
        coordinatePairColumn: 'Coordinates',
        latitudeColumn: '',
        longitudeColumn: '',
      },
    ],
    temporalMapping: { Date: 'Date', Date_Range: 'Lifespan', Date_Start: '', Date_End: '' },
    relationshipMetadataMapping: { Relationship_Type: 'RelationType', Relationship_Label: '' },
    customFieldSelections: [
      { sourceColumn: 'Subject', label: 'Subject', action: 'include', analyticsEligible: true },
    ],
    // These intentionally stale legacy mappings must not determine canonical
    // participant semantics. They exist only to exercise conservative legacy
    // place projection behavior.
    coreMapping: { Source_Name: 'OldSource', Target_Name: 'OldTarget' },
    pointMapping: {},
    routeCoordinatePairMapping: {},
  };

  const mappedRows = applyPeridotGeneralizedColumnMapping(sourceRows, mapping);
  const runtime = buildPeridotCanonicalRuntimeModel(mappedRows, {
    fileLabel: 'Generalized runtime fixture.csv',
    sourceKind: 'mapped-single-table',
    sourceSheet: 'Letters',
    importedAt: '2026-08-08T00:00:00.000Z',
  });
  const canonical = runtime.canonicalDataset;
  const firstRecord = canonical.records[0];

  const componentRows = [{ Name:'Example', EventYear:'1618', EventMonth:'5', EventDay:'3', BirthYear:'1589', BirthMonth:'7', BirthDay:'8', DeathYear:'1631', DeathMonth:'8', DeathDay:'10', Certainty:'Y' }];
  const componentMapping = {
    relationshipParts: [{ participantColumn:'Name', roleMode:'heading', headingRole:'Person' }],
    placeParts: [], coreMapping:{}, temporalMapping:{}, temporalNoteMappings:{}, pointMapping:{}, routeCoordinatePairMapping:{}, relationshipMetadataMapping:{}, customFieldSelections:[],
    temporalAssertionMappings: [
      { id:'event-date', role:'Event date', kind:'date', sourceMode:'parts', yearColumn:'EventYear', monthColumn:'EventMonth', dayColumn:'EventDay', noteColumns:['Certainty'] },
      { id:'birth-date', role:'Birth date', kind:'date', sourceMode:'parts', yearColumn:'BirthYear', monthColumn:'BirthMonth', dayColumn:'BirthDay', noteColumns:[], subjectParticipantIndex:0 },
      { id:'lifespan', role:'Life span', kind:'period', sourceMode:'endpoints', startMode:'parts', startYearColumn:'BirthYear', startMonthColumn:'BirthMonth', startDayColumn:'BirthDay', endMode:'parts', endYearColumn:'DeathYear', endMonthColumn:'DeathMonth', endDayColumn:'DeathDay', noteColumns:[], subjectParticipantIndex:0 },
    ],
  };
  const componentMappedRows = applyPeridotGeneralizedColumnMapping(componentRows, componentMapping);
  const componentRuntime = buildPeridotCanonicalRuntimeModel(componentMappedRows, { fileLabel:'Temporal components fixture.csv', sourceKind:'mapped-single-table', sourceSheet:'People', importedAt:'2026-08-11T00:00:00.000Z' });
  const componentRecord = componentRuntime.canonicalDataset.records[0];

  const checks = Object.freeze({
    generalizedCanonicalPath:
      runtime.normalizationSource?.mode === 'canonical-generalized-mapping-through-legacy-adapter',
    canonicalSourceShape:
      canonical.sourceManifest?.sourceShape === 'generalized-user-mapped-observations',
    generalizedRecordCreated:
      firstRecord?.recordType === 'generalized-mapped-observation',
    participantValuesPreserved:
      canonical.entities.some((entity) => entity.label === 'Maria')
      && canonical.entities.some((entity) => entity.label === 'Cosimo'),
    participantRolesPreserved:
      firstRecord?.attributes?.participantRoles?.[0]?.role === 'sender'
      && firstRecord?.attributes?.participantRoles?.[1]?.role === 'recipient',
    placeRolePreserved:
      firstRecord?.attributes?.placeRoles?.[0]?.role === 'origin',
    coordinatesPreserved:
      canonical.places?.[0]?.latitude === 43.7696
      && canonical.places?.[0]?.longitude === 11.2558,
    relationshipMetadataPreserved:
      firstRecord?.attributes?.relationshipType === 'letter',
    evidencePreserved:
      firstRecord?.attributes?.customFields?.Subject === 'Marriage',
    temporalValuePreserved:
      Boolean(firstRecord?.temporalAssertion),
    multipleTemporalAssertionsPreservedCanonically:
      firstRecord?.temporalAssertions?.length === 2
      && firstRecord.temporalAssertions[0]?.role === 'Date'
      && firstRecord.temporalAssertions[1]?.role === 'Lifespan',
    multipleTemporalAssertionsReachRuntimeRows:
      runtime.normalizedRows?.[0]?.temporalAssertions?.length === 2
      && runtime.normalizedLetters?.[0]?.temporalAssertions?.length === 2,
    staleLegacyParticipantMappingsIgnored:
      mappedRows[0]?.Source_Name === 'Maria'
      && mappedRows[0]?.Target_Name === 'Cosimo',
    conservativePlaceCompatibilityProjection:
      mappedRows[0]?.Point_Place === 'Florence',
    legacyConsumerStillReceivesRows:
      runtime.normalizedLetters?.length === 2,
    canonicalValidationPasses:
      canonical.validation?.valid === true && canonical.validation?.canCommit === true,
    componentDatePartsComposeCanonically:
      componentRecord?.temporalAssertions?.[0]?.role === 'Event date'
      && componentRecord.temporalAssertions[0]?.start?.year === 1618
      && componentRecord.temporalAssertions[0]?.start?.month === 5
      && componentRecord.temporalAssertions[0]?.start?.day === 3,
    sixColumnPeriodComposesCanonically:
      componentRecord?.temporalAssertions?.[2]?.role === 'Life span'
      && componentRecord.temporalAssertions[2]?.start?.year === 1589
      && componentRecord.temporalAssertions[2]?.start?.month === 7
      && componentRecord.temporalAssertions[2]?.start?.day === 8
      && componentRecord.temporalAssertions[2]?.end?.year === 1631
      && componentRecord.temporalAssertions[2]?.end?.month === 8
      && componentRecord.temporalAssertions[2]?.end?.day === 10,
    temporalNotesRemainAssertionScoped:
      componentRecord?.temporalAssertions?.[0]?.temporalNotes?.[0]?.value === 'Y',
    temporalSourceColumnsCanBeReused:
      componentRecord?.temporalAssertions?.[1]?.role === 'Birth date'
      && componentRecord.temporalAssertions[1]?.start?.year === componentRecord.temporalAssertions[2]?.start?.year,
    temporalRoleSpacesPreserved:
      componentRecord?.temporalAssertions?.[2]?.role === 'Life span',
    temporalSubjectParticipantPreserved:
      componentRecord?.temporalAssertions?.[1]?.subjectParticipantIndex === 0
      && componentRecord?.temporalAssertions?.[2]?.subjectParticipantIndex === 0,
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
