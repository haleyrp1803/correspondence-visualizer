/*
 * First-class Peridot sample datasets.
 *
 * Each sample is an ordinary source file in /public/sample_data paired with the
 * same generalized mapping structure used for researcher uploads. There is no
 * sample-only parser or semantic shortcut. App.jsx fetches the source file,
 * parses it through peridotWorkbookParsing, and applies the mapping below.
 *
 * Public product contract:
 * - no sample is active until the researcher explicitly selects one;
 * - sample source files are directly downloadable;
 * - the saved mapping can be edited for the active sample while the canonical mapping remains restorable;
 * - downloaded samples can be re-uploaded and mapped like any other file.
 */

const ref = (sheetName, columnName) => ({ sheetName, columnName });

const included = (sourceColumn, label = sourceColumn, analyticsEligible = true) => ({
  sourceColumn,
  label,
  action: 'include',
  analyticsEligible,
});

const workbookIncluded = (sheetName, sourceColumn, label = sourceColumn, analyticsEligible = true) => ({
  sourceColumn,
  label,
  action: 'include',
  analyticsEligible,
  sheetName,
  sourceRef: ref(sheetName, sourceColumn),
});

const correspondenceMapping = {
  mode: 'multi_sheet_letter_id',
  primarySheetName: 'Raw Data',
  primaryLetterIdColumn: 'Unique ID',
  letterLevelJoins: [{
    id: 'sample-correspondence-geography-join',
    type: 'letter_id',
    from: ref('Raw Data', 'Unique ID'),
    to: ref('Geographic Mapping', 'Unique ID'),
  }],
  lookupJoins: [],
  relationshipParts: [
    { participantRef: ref('Raw Data', 'Source'), roleLabel: 'Source', roleMode: 'heading' },
    { participantRef: ref('Raw Data', 'Target'), roleLabel: 'Target', roleMode: 'heading' },
  ],
  identityMapping: {
    record: { strategy: 'workbook-key', refs: [ref('Raw Data', 'Unique ID')] },
    entityGroupsInitialized: true,
    entityGroups: [{
      id: 'people',
      label: 'People',
      appearanceIds: ['relationship:0', 'relationship:1'],
      strategy: 'composite',
      keys: ['Name', 'Title'],
      mappings: {
        'relationship:0': [
          { key: 'Name', ref: ref('Raw Data', 'Source') },
          { key: 'Title', ref: ref('Raw Data', 'Source Title') },
        ],
        'relationship:1': [
          { key: 'Name', ref: ref('Raw Data', 'Target') },
          { key: 'Title', ref: ref('Raw Data', 'Target Title') },
        ],
      },
    }],
  },
  placeParts: [
    {
      placeRef: ref('Geographic Mapping', 'Source Location'),
      roleLabel: 'Letter sent from',
      roleMode: 'heading',
      subjectParticipantIndex: 0,
      latitudeRef: ref('Geographic Mapping', 'Source Latitude'),
      longitudeRef: ref('Geographic Mapping', 'Source Longitude'),
    },
    {
      placeRef: ref('Geographic Mapping', 'Target Location (Inferred)'),
      roleLabel: 'Letter sent to',
      roleMode: 'heading',
      subjectParticipantIndex: 1,
      latitudeRef: ref('Geographic Mapping', 'Target Latitude'),
      longitudeRef: ref('Geographic Mapping', 'Target Longitude'),
    },
  ],
  temporalAssertionMappings: [
    {
      id: 'letter-date',
      role: 'Letter date',
      kind: 'date',
      sourceMode: 'single',
      column: ref('Raw Data', 'Date*'),
      noteColumns: [],
    },
  ],
  temporalMappings: {},
  temporalNoteMappings: {},
  relationshipMetadataMappings: {
    Relationship_Type: ref('Raw Data', 'Relationship'),
  },
  customFieldSelections: [
    workbookIncluded('Raw Data', 'Archival Collection', 'Archival Collection', false),
    workbookIncluded('Raw Data', 'Archival Page (r/v)', 'Archival Page (r/v)', false),
    workbookIncluded('Raw Data', 'PDF Page', 'PDF Page', false),
    workbookIncluded('Raw Data', 'Source Title', 'Source Title'),
    workbookIncluded('Raw Data', 'Target Title', 'Target Title'),
    workbookIncluded('Raw Data', 'Cipher', 'Cipher'),
    workbookIncluded('Raw Data', 'Topic', 'Topic'),
    workbookIncluded('Raw Data', 'Language', 'Language'),
    workbookIncluded('Raw Data', 'Transcription', 'Transcription', false),
    workbookIncluded('Raw Data', 'Rough Translation', 'Rough Translation', false),
    workbookIncluded('Raw Data', 'Notes', 'Notes', false),
  ],
  coreMappings: {},
  pointMappings: {},
  routeCoordinatePairMappings: {},
};

const familyTreeMapping = {
  sourceSheet: 'Uploaded table',
  tableOrientation: 'columns',
  relationshipParts: [
    { participantColumn: 'Individual', roleLabel: 'person', roleMode: 'heading' },
    { participantColumn: 'Mother name', roleLabel: 'mother', roleMode: 'heading' },
    { participantColumn: 'Father name', roleLabel: 'father', roleMode: 'heading' },
    { participantColumn: 'Partner name', roleLabel: 'partner / spouse', roleMode: 'heading' },
  ],
  identityMapping: {
    record: { strategy: 'row', columns: [] },
    entityGroupsInitialized: true,
    entityGroups: [{
      id: 'people',
      label: 'People',
      appearanceIds: ['relationship:0', 'relationship:1', 'relationship:2', 'relationship:3'],
      strategy: 'field',
      keys: ['Person ID'],
      mappings: {
        'relationship:0': [{ key: 'Person ID', column: 'ID' }],
        'relationship:1': [{ key: 'Person ID', column: 'Mother ID' }],
        'relationship:2': [{ key: 'Person ID', column: 'Father ID' }],
        'relationship:3': [{ key: 'Person ID', column: 'Partner ID' }],
      },
    }],
  },
  temporalAssertionMappings: [
    {
      id: 'birth-date',
      role: 'Birth date',
      kind: 'date',
      sourceMode: 'parts',
      yearColumn: 'Birth year',
      monthColumn: 'Birth month',
      dayColumn: 'Birth day',
      noteColumns: ['Birth date type'],
      subjectParticipantIndex: 0,
    },
    {
      id: 'death-date',
      role: 'Death date',
      kind: 'date',
      sourceMode: 'parts',
      yearColumn: 'Death year',
      monthColumn: 'Death month',
      dayColumn: 'Death day',
      noteColumns: ['Death date type'],
      subjectParticipantIndex: 0,
    },
    {
      id: 'lifespan',
      role: 'Lifespan',
      kind: 'period',
      sourceMode: 'endpoints',
      startMode: 'parts',
      startYearColumn: 'Birth year',
      startMonthColumn: 'Birth month',
      startDayColumn: 'Birth day',
      endMode: 'parts',
      endYearColumn: 'Death year',
      endMonthColumn: 'Death month',
      endDayColumn: 'Death day',
      noteColumns: [],
      subjectParticipantIndex: 0,
    },
  ],
  placeParts: [
    {
      placeColumn: 'place of birth',
      roleLabel: 'Place of birth',
      roleMode: 'heading',
      subjectParticipantIndex: 0,
      coordinatePairColumn: 'coordinate location birth',
      latitudeColumn: '',
      longitudeColumn: '',
    },
    {
      placeColumn: 'place of death',
      roleLabel: 'Place of death',
      roleMode: 'heading',
      subjectParticipantIndex: 0,
      coordinatePairColumn: 'coordinate location death',
      latitudeColumn: '',
      longitudeColumn: '',
    },
  ],
  relationshipMetadataMapping: {},
  customFieldSelections: [
    included('Sex', 'Sex'),
    included('Partner title', 'Partner title'),
    included('Partnership type', 'Partnership type'),
    included('Partnership date type', 'Partnership date type'),
    included('Partnership year', 'Partnership year'),
    included('Ex-partner IDs', 'Ex-partner IDs', false),
    included('Profession', 'Profession'),
  ],
  coreMapping: {},
  temporalMapping: {},
  temporalNoteMappings: {},
  pointMapping: {},
  routeCoordinatePairMapping: {},
};

const cardinalsMapping = {
  mode: 'single_sheet',
  primarySheetName: 'Cardinal Index',
  primaryLetterIdColumn: '',
  letterLevelJoins: [],
  lookupJoins: [],
  relationshipParts: [
    { participantRef: ref('Cardinal Index', 'Cardinal'), roleLabel: 'Cardinal', roleMode: 'heading' },
    { participantRef: ref('Cardinal Index', 'Created by'), roleLabel: 'Created by', roleMode: 'heading' },
  ],
  identityMapping: {
    record: { strategy: 'row', refs: [] },
    entityGroupsInitialized: true,
    entityGroups: [{
      id: 'people',
      label: 'People',
      appearanceIds: ['relationship:0', 'relationship:1'],
      strategy: 'label',
      keys: ['Name'],
      mappings: {
        'relationship:0': [{ key: 'Name', ref: ref('Cardinal Index', 'Cardinal') }],
        'relationship:1': [{ key: 'Name', ref: ref('Cardinal Index', 'Created by') }],
      },
    }],
  },
  placeParts: [],
  temporalAssertionMappings: [
    {
      id: 'creation-date',
      role: 'Creation date',
      kind: 'date',
      sourceMode: 'single',
      column: ref('Cardinal Index', 'Creation date'),
      noteColumns: [],
    },
    {
      id: 'lifespan',
      role: 'Lifespan',
      kind: 'period',
      sourceMode: 'single',
      column: ref('Cardinal Index', 'Lifespan'),
      noteColumns: [],
      subjectParticipantIndex: 0,
    },
  ],
  temporalMappings: {},
  temporalNoteMappings: {},
  relationshipMetadataMappings: {},
  customFieldSelections: [
    workbookIncluded('Cardinal Index', 'Conclaves present', 'Conclaves present'),
    workbookIncluded('Cardinal Index', 'Nationality / political origin', 'Nationality / political origin'),
  ],
  coreMappings: {},
  pointMappings: {},
  routeCoordinatePairMappings: {},
};

export const PERIDOT_SAMPLE_DATASETS = Object.freeze([
  Object.freeze({
    id: 'correspondence-network',
    title: 'Correspondence Network',
    fileName: 'correspondence_network_sample.xlsx',
    filePath: 'sample_data/correspondence_network_sample.xlsx',
    format: 'Excel workbook',
    description: '500 correspondence records with Source/Target roles, composite Name + Title identity, dates, places, coordinates, and archival evidence.',
    teachingNote: 'Demonstrates directed correspondence, cross-role identity, workbook joins, and participant-attached origin/destination places.',
    mappingMode: 'workbook',
    mappingState: correspondenceMapping,
  }),
  Object.freeze({
    id: 'family-tree',
    title: 'Family Tree',
    fileName: 'family_tree_sample.csv',
    filePath: 'sample_data/family_tree_sample.csv',
    format: 'CSV',
    description: 'A family-tree table with stable IDs, parents, partners, life dates, places, coordinates, and professions.',
    teachingNote: 'Demonstrates recurring people, relationship roles, participant-attached dates and places, and identity by source ID.',
    mappingMode: 'single-table',
    mappingState: familyTreeMapping,
  }),
  Object.freeze({
    id: 'cardinals-1600-1640',
    title: 'Cardinals Active from 1600–1640',
    fileName: 'cardinals_1600_1640_sample.xlsx',
    filePath: 'sample_data/cardinals_1600_1640_sample.xlsx',
    format: 'Excel workbook',
    description: '176 cardinals with creator relationships, creation dates, lifespans, conclave participation, and political/national context.',
    teachingNote: 'Demonstrates a non-correspondence, non-genealogy relationship dataset and provides a future multi-value cardinality example.',
    mappingMode: 'workbook',
    mappingState: cardinalsMapping,
  }),
]);

export function getPeridotSampleDataset(sampleId = '') {
  return PERIDOT_SAMPLE_DATASETS.find((sample) => sample.id === sampleId) || null;
}

export function getPeridotSampleDatasetUrl(sample) {
  if (!sample?.filePath) return '';
  const base = String(import.meta.env.BASE_URL || '/');
  return `${base.endsWith('/') ? base : `${base}/`}${sample.filePath}`;
}
