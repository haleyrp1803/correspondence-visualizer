/* Phase 2.5 fixture definitions for the isolated universal-upload prototype. */

import {
  PERIDOT_GENERATED_VARIABLE_SOURCES,
  PERIDOT_SHEET_PURPOSES,
  PERIDOT_VARIABLE_KINDS,
  makePeridotFieldAssignment,
  makePeridotRepeatedHeadingGroup,
  makePeridotSavedVariable,
  makePeridotSheetPurposeAssignment,
  makePeridotTableConnection,
  makePeridotUniversalMappingDefinition,
} from './peridotUniversalMappingModel.js';
import {
  makePeridotSourceFieldId,
  makePeridotSourceFile,
  makePeridotSourceFileId,
  makePeridotSourceManifest,
  makePeridotSourceTable,
  makePeridotSourceTableId,
} from './peridotSourceModel.js';
import {
  acceptPrototypeFieldSuggestion,
  assignPrototypeField,
  buildPeridotUniversalUploadPrototypeResult,
  dismissPrototypeFieldSuggestion,
  getPrototypeFieldSuggestions,
  getPrototypeTablesForStep,
  makePeridotUniversalUploadPrototypeState,
  savePrototypeRepeatedHeadingGroup,
  savePrototypeTableConnection,
  getPrototypeTableConnectionReport,
  setPrototypeSheetPurpose,
} from './peridotUniversalUploadPrototype.js';
import { recognizePeridotUniversalFields } from './peridotUniversalFieldRecognizers.js';
import { buildPeridotUniversalSheetPurposeReview } from './peridotUniversalSheetPurposePolicy.js';
import {
  PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS,
  buildPeridotRepeatedStructurePreview,
} from './peridotUniversalRepeatedStructure.js';
import {
  PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS,
  buildPeridotTableConnectionMatchReport,
} from './peridotUniversalTableConnections.js';

function makeManifest(fileName, sheets) {
  const fileId = makePeridotSourceFileId({ fileName });
  const sourceTables = sheets.map((sheet, tableIndex) => {
    const tableId = makePeridotSourceTableId({ sourceFileId: fileId, sheetName: sheet.name, index: tableIndex });
    return makePeridotSourceTable({
      id: tableId,
      sourceFileId: fileId,
      label: sheet.name,
      sheetName: sheet.name,
      tableIndex,
      rowCount: sheet.rowCount,
      fields: sheet.headers.map((name, columnIndex) => ({
        id: makePeridotSourceFieldId({ sourceTableId: tableId, fieldName: name || `Column ${columnIndex + 1}`, index: columnIndex }),
        name: name || `Column ${columnIndex + 1}`,
        columnIndex,
      })),
    });
  });
  return makePeridotSourceManifest({
    sourceFiles: [makePeridotSourceFile({ id: fileId, fileName, fileType: fileName.endsWith('.csv') ? 'csv' : 'excel', tableIds: sourceTables.map((table) => table.id) })],
    sourceTables,
  });
}

function field(table, name) {
  return table.fields.find((item) => item.name === name)?.id || '';
}

const stockCompanies = ['East India Company', 'Bank of England', 'South Sea Company', 'Million Bank', 'Royal African Company'];

export const stockWidePrototypeFixture = (() => {
  const sourceManifest = makeManifest('Daily High Stock Price for Five Companies in 1714.xlsx', [{
    name: 'Sheet1', rowCount: 365,
    headers: ['Date', 'Day of the Week', ...stockCompanies, 'Source'],
  }]);
  const table = sourceManifest.sourceTables[0];
  const sourceRowsByTableId = {
    [table.id]: [
      { Date: '1714/03/24', 'Day of the Week': 'Wednesday', 'East India Company': 118, 'Bank of England': 118, 'South Sea Company': 84.75, 'Million Bank': 79.5, 'Royal African Company': 40.5, Source: 'Course of the Exchange' },
      { Date: '1714/03/25', 'Day of the Week': 'Thursday', 'East India Company': 118, 'Bank of England': 118, 'South Sea Company': 84.75, 'Million Bank': 79.5, 'Royal African Company': 40.5, Source: 'Course of the Exchange' },
      { Date: '1714/03/26', 'Day of the Week': 'Friday', 'East India Company': 'Holiday', 'Bank of England': 'Holiday', 'South Sea Company': 'Holiday', 'Million Bank': 'Holiday', 'Royal African Company': 'Holiday', Source: 'Course of the Exchange' },
      { Date: '1714/03/28', 'Day of the Week': 'Sunday', 'East India Company': 'No Market ', 'Bank of England': 'No Market ', 'South Sea Company': 'No Market ', 'Million Bank': 'No Market ', 'Royal African Company': 'No Market ', Source: 'Course of the Exchange' },
    ],
  };
  const variables = [
    makePeridotSavedVariable({ id: 'variable:date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL }),
    makePeridotSavedVariable({ id: 'variable:organization', label: 'Organization', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:daily-high-stock-price', label: 'Daily high stock price', kind: PERIDOT_VARIABLE_KINDS.NUMBER }),
  ];
  const mapping = makePeridotUniversalMappingDefinition({
    sheetPurposes: [makePeridotSheetPurposeAssignment({ sourceTableId: table.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS })],
    fieldAssignments: [
      makePeridotFieldAssignment({ sourceTableId: table.id, sourceFieldId: field(table, 'Date'), sourceFieldName: 'Date', variableId: 'variable:date', status: 'active' }),
    ],
    repeatedHeadingGroups: [makePeridotRepeatedHeadingGroup({
      id: 'repeated-heading:companies', sourceTableId: table.id,
      sourceFieldIds: stockCompanies.map((name) => field(table, name)),
      headingVariableId: 'variable:organization', cellVariableId: 'variable:daily-high-stock-price',
      attachedFieldIds: [field(table, 'Date')],
      blankHandling: 'preserve', textHandling: 'preserve',
      attributes: { orientationMode: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE },
    })],
  });
  return Object.freeze({ label: 'Wide stock-price table', sourceManifest, sourceRowsByTableId, savedVariables: variables, mapping });
})();

export const stockTransposedPrototypeFixture = (() => {
  const dateHeaders = ['1714/03/24', '1714/03/25', '1714/03/26', '1714/03/27', '1714/03/28', '1714/03/29', '1714/03/30', '1714/03/31', '1714/04/01', '1714/04/02', '1714/04/03', '1714/04/04', '1714/04/05', '1714/04/06', '1714/04/07', '1714/04/08', '1714/04/09'];
  const sourceManifest = makeManifest('Daily High Stock Price for Five Companies in 1714 (2).xlsx', [{ name: 'Sheet1', rowCount: 5, headers: ['Date', ...dateHeaders] }]);
  const table = sourceManifest.sourceTables[0];
  const sourceRowsByTableId = {
    [table.id]: stockCompanies.map((company, index) => ({
      Date: company,
      '1714/03/24': [118,118,84.75,79.5,40.5][index],
      '1714/03/25': [118,118,84.75,79.5,40.5][index],
      '1714/03/26': 'Holiday',
      '1714/03/27': [118.5,118.5,84.25,79.5,40.5][index],
      '1714/03/28': 'No Market ',
    })),
  };
  const variables = [
    makePeridotSavedVariable({ id: 'variable:date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL }),
    makePeridotSavedVariable({ id: 'variable:organization', label: 'Organization', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:daily-high-stock-price', label: 'Daily high stock price', kind: PERIDOT_VARIABLE_KINDS.NUMBER }),
  ];
  const mapping = makePeridotUniversalMappingDefinition({
    sheetPurposes: [makePeridotSheetPurposeAssignment({ sourceTableId: table.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS })],
    repeatedHeadingGroups: [makePeridotRepeatedHeadingGroup({
      id: 'repeated-heading:dates-after-transpose', sourceTableId: table.id,
      sourceFieldIds: dateHeaders.map((name) => field(table, name)),
      headingVariableId: 'variable:date', cellVariableId: 'variable:daily-high-stock-price',
      attachedFieldIds: [],
      generatedVariableSource: PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS,
      blankHandling: 'preserve', textHandling: 'preserve',
      attributes: {
        orientationMode: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS,
        rowLabelFieldId: field(table, 'Date'),
        rowLabelVariableId: 'variable:organization',
      },
    })],
  });
  return Object.freeze({ label: 'Transposed stock-price table', sourceManifest, sourceRowsByTableId, savedVariables: variables, mapping });
})();

export const alaskaPrototypeFixture = (() => {
  const sourceManifest = makeManifest('Alaskan Airfields.csv', [{ name: 'Alaskan Airfields', rowCount: 25, headers: ['Qid', 'coordinate location', 'Name of Site', 'occupant', 'population', 'image', 'inception', 'dissolved, abolished or demolished date'] }]);
  const table = sourceManifest.sourceTables[0];
  const sourceRowsByTableId = {
    [table.id]: [
      { Qid: 'Q123', 'coordinate location': 'POINT(61.2181 -149.9003)', 'Name of Site': 'Anchorage Airfield', occupant: 'United States Army', population: 1200, image: 'https://example.org/airfield.jpg', inception: '1941', 'dissolved, abolished or demolished date': '1946' },
      { Qid: 'Q124', 'coordinate location': '64.8378, -147.7164', 'Name of Site': 'Fairbanks Airfield', occupant: 'United States Army', population: 800, image: 'https://example.org/fairbanks.jpg', inception: '1942-06', 'dissolved, abolished or demolished date': '1947' },
      { Qid: 'Q125', 'coordinate location': '57.7900, -152.4072', 'Name of Site': 'Kodiak Airfield', occupant: 'United States Navy', population: 500, image: '', inception: '1941-09-15', 'dissolved, abolished or demolished date': '' },
    ],
  };
  const variables = [
    makePeridotSavedVariable({ id: 'variable:site-id', label: 'Site ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER }),
    makePeridotSavedVariable({ id: 'variable:site', label: 'Site', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:coordinates', label: 'Coordinates', kind: PERIDOT_VARIABLE_KINDS.PLACE }),
    makePeridotSavedVariable({ id: 'variable:occupant', label: 'Occupant', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:population', label: 'Population', kind: PERIDOT_VARIABLE_KINDS.NUMBER }),
    makePeridotSavedVariable({ id: 'variable:beginning-date', label: 'Beginning date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL }),
    makePeridotSavedVariable({ id: 'variable:ending-date', label: 'Ending date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL }),
  ];
  const assignments = [
    ['Qid','variable:site-id'], ['coordinate location','variable:coordinates'], ['Name of Site','variable:site'], ['occupant','variable:occupant'], ['population','variable:population'], ['inception','variable:beginning-date'], ['dissolved, abolished or demolished date','variable:ending-date'],
  ].map(([name, variableId]) => makePeridotFieldAssignment({ sourceTableId: table.id, sourceFieldId: field(table, name), sourceFieldName: name, variableId, status: 'active' }));
  const mapping = makePeridotUniversalMappingDefinition({ sheetPurposes: [makePeridotSheetPurposeAssignment({ sourceTableId: table.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS })], fieldAssignments: assignments });
  return Object.freeze({ label: 'Alaska airfields', sourceManifest, sourceRowsByTableId, savedVariables: variables, mapping });
})();

export const mariaPrototypeFixture = (() => {
  const sourceManifest = makeManifest("Maria Maddalena's Letters as Data.xlsx", [
    { name: 'Raw Data', rowCount: 2994, headers: ['Unique ID','Archival Collection','Archival Page (r/v)','PDF Page','Date*','Source Location','Source','Source Title','Target','Target Title','Relationship','Topic','Language','Cipher','Notes','Link','Transcription'] },
    { name: 'Aggregated Edges', rowCount: 471, headers: ['Source','Source Title','Type','Weight'] },
    { name: 'Geographic Mapping', rowCount: 4999, headers: ['Unique ID','Date*','Source Location','Source Latitude','Source Longitude','Source','Target','Target Location (Inferred)','Target Latitude','Target Longitude'] },
    { name: 'Place Profiles', rowCount: 180, headers: ['Source Location','Latitude','Longitude','Column 4','Column 5','Column 6','All Locations (Updating)','In A or not?','Column 9','Column 10'] },
    { name: 'People Profiles', rowCount: 1100, headers: ['Person','Occupation','Title (Based On Letters)','Title (Based On Wikidata)','Wikipedia Page EN','Wikipedia Page IT','Treccani Page','Creative Commons Image','Column 9','Person (Updating)','Column 11'] },
    { name: 'Drop Down Lists', rowCount: 29, headers: ['Column 1','Relationships','Column 3','Cipher','Column 5','Topics','Column 7','Language','Column 9','Occupation'] },
  ]);
  const [raw, edges, geo, places, people, lists] = sourceManifest.sourceTables;
  const sourceRowsByTableId = {
    [raw.id]: [
      { 'Unique ID': 'MM0001', 'Archival Collection': 'MAP', 'Archival Page (r/v)': '12r', 'PDF Page': 14, 'Date*': '1615-04-12', 'Source Location': 'Firenze', Source: 'Maria Maddalena de Medici', 'Source Title': 'Archduchess', Target: 'Carlo de Medici', 'Target Title': 'Cardinal', Relationship: 'kinship', Topic: 'court', Language: 'Italian', Cipher: 'No', Notes: 'Brief note', Link: 'https://example.org/mm0001', Transcription: 'A longer transcription text intended to be recognized as evidence text rather than a short category.' },
      { 'Unique ID': 'MM0002', 'Archival Collection': 'MAP', 'Archival Page (r/v)': '13v', 'PDF Page': 15, 'Date*': '1615-04-15', 'Source Location': 'Firenze', Source: 'Maria Maddalena de Medici', 'Source Title': 'Archduchess', Target: 'Paolo Giordano Orsini', 'Target Title': 'Duke', Relationship: 'political', Topic: 'patronage', Language: 'Italian', Cipher: 'Yes', Notes: 'Another note', Link: 'https://example.org/mm0002', Transcription: 'Another longer transcription text intended to give the recognizer several textual observations.' },
      { 'Unique ID': 'MM0003', 'Archival Collection': 'MAP', 'Archival Page (r/v)': '14r', 'PDF Page': 16, 'Date*': '1615-04-17', 'Source Location': 'Firenze', Source: 'Carlo de Medici', 'Source Title': 'Cardinal', Target: 'Maria Maddalena de Medici', 'Target Title': 'Archduchess', Relationship: 'kinship', Topic: 'court', Language: 'Italian', Cipher: 'No', Notes: 'Third note', Link: 'https://example.org/mm0003', Transcription: 'A third transcription row used to exercise a no-match connection case.' },
    ],
    [edges.id]: [{ Source: 'Maria Maddalena de Medici', 'Source Title': 'Archduchess', Type: 'political', Weight: 12 }, { Source: 'Carlo de Medici', 'Source Title': 'Cardinal', Type: 'kinship', Weight: 8 }],
    [geo.id]: [
      { 'Unique ID': 'MM0001', 'Date*': '1615-04-12', 'Source Location': 'Firenze', 'Source Latitude': 43.7696, 'Source Longitude': 11.2558, Source: 'Maria Maddalena de Medici', Target: 'Carlo de Medici', 'Target Location (Inferred)': 'Roma', 'Target Latitude': 41.9028, 'Target Longitude': 12.4964 },
      { 'Unique ID': 'MM0001', 'Date*': '1615-04-12', 'Source Location': 'Firenze', 'Source Latitude': 43.7696, 'Source Longitude': 11.2558, Source: 'Maria Maddalena de Medici', Target: 'Carlo de Medici', 'Target Location (Inferred)': 'Venezia', 'Target Latitude': 45.4408, 'Target Longitude': 12.3155 },
      { 'Unique ID': 'MM0002', 'Date*': '1615-04-15', 'Source Location': 'Firenze', 'Source Latitude': 43.7696, 'Source Longitude': 11.2558, Source: 'Maria Maddalena de Medici', Target: 'Paolo Giordano Orsini', 'Target Location (Inferred)': 'Roma', 'Target Latitude': 41.9028, 'Target Longitude': 12.4964 },
    ],
    [places.id]: [{ 'Source Location': 'Firenze', Latitude: 43.7696, Longitude: 11.2558 }, { 'Source Location': 'Roma', Latitude: 41.9028, Longitude: 12.4964 }],
    [people.id]: [{ Person: 'Maria Maddalena de Medici', Occupation: 'regent', 'Title (Based On Letters)': 'Archduchess', 'Wikipedia Page EN': 'https://en.wikipedia.org/example' }, { Person: 'Carlo de Medici', Occupation: 'cardinal', 'Title (Based On Letters)': 'Cardinal', 'Wikipedia Page EN': 'https://en.wikipedia.org/example2' }],
    [lists.id]: [{ Relationships: 'kinship', Cipher: 'Yes', Topics: 'court', Language: 'Italian', Occupation: 'cardinal' }, { Relationships: 'political', Cipher: 'No', Topics: 'patronage', Language: 'Latin', Occupation: 'regent' }],
  };
  const variables = [
    makePeridotSavedVariable({ id: 'variable:record-id', label: 'Record ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER }),
    makePeridotSavedVariable({ id: 'variable:date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL }),
    makePeridotSavedVariable({ id: 'variable:source-person', label: 'Source person', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:target-person', label: 'Target person', kind: PERIDOT_VARIABLE_KINDS.ENTITY }),
    makePeridotSavedVariable({ id: 'variable:place', label: 'Place', kind: PERIDOT_VARIABLE_KINDS.PLACE }),
  ];
  const mapping = makePeridotUniversalMappingDefinition({
    sheetPurposes: [
      makePeridotSheetPurposeAssignment({ sourceTableId: raw.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }),
      makePeridotSheetPurposeAssignment({ sourceTableId: edges.id, purpose: PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS }),
      makePeridotSheetPurposeAssignment({ sourceTableId: geo.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }),
      makePeridotSheetPurposeAssignment({ sourceTableId: places.id, purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'place' }),
      makePeridotSheetPurposeAssignment({ sourceTableId: people.id, purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'person' }),
      makePeridotSheetPurposeAssignment({ sourceTableId: lists.id, purpose: PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES }),
    ],
    fieldAssignments: [
      makePeridotFieldAssignment({ sourceTableId: raw.id, sourceFieldId: field(raw, 'Unique ID'), sourceFieldName: 'Unique ID', variableId: 'variable:record-id', status: 'active' }),
      makePeridotFieldAssignment({ sourceTableId: raw.id, sourceFieldId: field(raw, 'Date*'), sourceFieldName: 'Date*', variableId: 'variable:date', status: 'active' }),
      makePeridotFieldAssignment({ sourceTableId: raw.id, sourceFieldId: field(raw, 'Source'), sourceFieldName: 'Source', variableId: 'variable:source-person', status: 'active' }),
      makePeridotFieldAssignment({ sourceTableId: raw.id, sourceFieldId: field(raw, 'Target'), sourceFieldName: 'Target', variableId: 'variable:target-person', status: 'active' }),
    ],
    tableConnections: [
      makePeridotTableConnection({ id: 'connection:raw-to-geography', fromTableId: raw.id, fromFieldId: field(raw, 'Unique ID'), toTableId: geo.id, toFieldId: field(geo, 'Unique ID'), label: 'Raw Data ↔ Geographic Mapping', attributes: { multipleMatchesExpectation: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.ALLOW_SEVERAL } }),
      makePeridotTableConnection({ id: 'connection:raw-source-to-people', fromTableId: raw.id, fromFieldId: field(raw, 'Source'), toTableId: people.id, toFieldId: field(people, 'Person'), label: 'Source people ↔ People Profiles' }),
      makePeridotTableConnection({ id: 'connection:raw-place-to-places', fromTableId: raw.id, fromFieldId: field(raw, 'Source Location'), toTableId: places.id, toFieldId: field(places, 'Source Location'), label: 'Source places ↔ Place Profiles' }),
    ],
  });
  return Object.freeze({ label: 'Maria Maddalena workbook', sourceManifest, sourceRowsByTableId, savedVariables: variables, mapping });
})();

export const PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_FIXTURES = Object.freeze([
  stockWidePrototypeFixture,
  stockTransposedPrototypeFixture,
  alaskaPrototypeFixture,
  mariaPrototypeFixture,
]);

export function runPeridotUniversalUploadPrototypeSelfAudit() {
  const results = PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_FIXTURES.map((fixture) => {
    const state = makePeridotUniversalUploadPrototypeState({ sourceManifest: fixture.sourceManifest, sourceRowsByTableId: fixture.sourceRowsByTableId, mapping: fixture.mapping, savedVariables: fixture.savedVariables });
    return { fixture: fixture.label, result: buildPeridotUniversalUploadPrototypeResult(state) };
  });
  const byName = new Map(results.map((item) => [item.fixture, item.result]));
  const wide = byName.get('Wide stock-price table');
  const transposed = byName.get('Transposed stock-price table');
  const alaska = byName.get('Alaska airfields');
  const maria = byName.get('Maria Maddalena workbook');
  const wideState = makePeridotUniversalUploadPrototypeState({
    sourceManifest: stockWidePrototypeFixture.sourceManifest,
    sourceRowsByTableId: stockWidePrototypeFixture.sourceRowsByTableId,
    mapping: stockWidePrototypeFixture.mapping,
    savedVariables: stockWidePrototypeFixture.savedVariables,
  });
  const transposedState = makePeridotUniversalUploadPrototypeState({
    sourceManifest: stockTransposedPrototypeFixture.sourceManifest,
    sourceRowsByTableId: stockTransposedPrototypeFixture.sourceRowsByTableId,
    mapping: stockTransposedPrototypeFixture.mapping,
    savedVariables: stockTransposedPrototypeFixture.savedVariables,
  });
  const wideGroup = wideState.repeatedHeadingGroups[0];
  const transposedGroup = transposedState.repeatedHeadingGroups[0];
  const widePreview = buildPeridotRepeatedStructurePreview({
    sourceManifest: wideState.sourceManifest, sourceRowsByTableId: wideState.sourceRowsByTableId,
    savedVariables: wideState.savedVariables, fieldAssignments: wideState.fieldAssignments, group: wideGroup, maxRows: 200,
  });
  const transposedPreview = buildPeridotRepeatedStructurePreview({
    sourceManifest: transposedState.sourceManifest, sourceRowsByTableId: transposedState.sourceRowsByTableId,
    savedVariables: transposedState.savedVariables, fieldAssignments: transposedState.fieldAssignments, group: transposedGroup, maxRows: 200,
  });
  const firstWideObservation = widePreview.rows.find((row) => row.values['variable:date'] === '1714/03/24' && row.values['variable:organization'] === 'East India Company');
  const firstTransposedObservation = transposedPreview.rows.find((row) => row.values['variable:date'] === '1714/03/24' && row.values['variable:organization'] === 'East India Company');
  const incompleteTransposedRule = { ...transposedGroup, attributes: { ...transposedGroup.attributes, rowLabelFieldId: '', rowLabelVariableId: '' } };
  const incompleteTransposedPreview = buildPeridotRepeatedStructurePreview({
    sourceManifest: transposedState.sourceManifest, sourceRowsByTableId: transposedState.sourceRowsByTableId,
    savedVariables: transposedState.savedVariables, fieldAssignments: transposedState.fieldAssignments, group: incompleteTransposedRule, maxRows: 10,
  });
  const editedWide = savePrototypeRepeatedHeadingGroup(wideState, {
    id: wideGroup.id,
    sourceTableId: wideGroup.sourceTableId,
    sourceFieldIds: wideGroup.sourceFieldIds.slice(0, 2),
    headingVariableId: wideGroup.headingVariableId,
    cellVariableId: wideGroup.cellVariableId,
    attachedFieldIds: wideGroup.attachedFieldIds,
    orientationMode: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE,
  });
  const restoredWide = savePrototypeRepeatedHeadingGroup(editedWide, {
    id: wideGroup.id,
    sourceTableId: wideGroup.sourceTableId,
    sourceFieldIds: wideGroup.sourceFieldIds,
    headingVariableId: wideGroup.headingVariableId,
    cellVariableId: wideGroup.cellVariableId,
    attachedFieldIds: wideGroup.attachedFieldIds,
    orientationMode: PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE,
  });

  const checks = Object.freeze({
    allFixturesBuild: results.length === 4 && results.every((item) => item.result?.universalMapping),
    stockOrientationsShareVariables: JSON.stringify(wide.savedVariables.map((item) => item.id).sort()) === JSON.stringify(transposed.savedVariables.map((item) => item.id).sort()),
    stockOrientationsProduceSameVariableColumns: JSON.stringify([...widePreview.variableIds].sort()) === JSON.stringify([...transposedPreview.variableIds].sort())
      && widePreview.variableIds.length === 3,
    stockOrientationsAgreeOnEquivalentObservation: firstWideObservation?.values['variable:daily-high-stock-price'] === 118
      && firstTransposedObservation?.values['variable:daily-high-stock-price'] === 118,
    wideStockUsesRepeatedHeadings: wide.summary.repeatedHeadingGroups === 1
      && wideGroup.attributes?.orientationMode === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.HEADINGS_REPEAT_ONE_VARIABLE,
    transposedStockUsesRowLabelsAndHeadings: transposed.universalMapping.repeatedHeadingGroups[0]?.generatedVariableSource === PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS
      && transposedGroup.attributes?.orientationMode === PERIDOT_REPEATED_STRUCTURE_ORIENTATIONS.ROW_LABELS_AND_HEADINGS
      && Boolean(transposedGroup.attributes?.rowLabelFieldId),
    transposedRuleRequiresExplicitRowMeaning: incompleteTransposedPreview.validation.valid === false
      && incompleteTransposedPreview.validation.problems.length >= 2,
    stockTextStatusesRemainLiteral: widePreview.rows.some((row) => row.values['variable:daily-high-stock-price'] === 'Holiday')
      && transposedPreview.rows.some((row) => row.values['variable:daily-high-stock-price'] === 'Holiday')
      && transposedPreview.rows.some((row) => row.values['variable:daily-high-stock-price'] === 'No Market '),
    repeatedRuleCanBeEditedWithoutDuplication: editedWide.repeatedHeadingGroups.length === 1
      && editedWide.repeatedHeadingGroups[0].sourceFieldIds.length === 2
      && restoredWide.repeatedHeadingGroups.length === 1
      && restoredWide.repeatedHeadingGroups[0].sourceFieldIds.length === stockCompanies.length,
    recognizersDoNotCreateRepeatedStructure: makePeridotUniversalUploadPrototypeState({
      sourceManifest: stockWidePrototypeFixture.sourceManifest, sourceRowsByTableId: stockWidePrototypeFixture.sourceRowsByTableId,
      mapping: { sheetPurposes: stockWidePrototypeFixture.mapping.sheetPurposes }, savedVariables: stockWidePrototypeFixture.savedVariables,
    }).repeatedHeadingGroups.length === 0,
    alaskaNeedsNoRepeatedHeadingsOrConnections: alaska.summary.repeatedHeadingGroups === 0 && alaska.summary.tableConnections === 0,
    mariaPreservesSixTables: maria.summary.sourceTables === 6,
    mariaPreservesMultipleConnections: maria.summary.tableConnections === 3,
    mariaKeepsSummaryAndControlledSheetsDistinct: maria.universalMapping.sheetPurposes.some((item) => item.purpose === PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS) && maria.universalMapping.sheetPurposes.some((item) => item.purpose === PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES),
  });

  const alaskaTableForSuggestions = alaskaPrototypeFixture.sourceManifest.sourceTables[0];
  const alaskaState = makePeridotUniversalUploadPrototypeState({
    sourceManifest: alaskaPrototypeFixture.sourceManifest,
    sourceRowsByTableId: alaskaPrototypeFixture.sourceRowsByTableId,
    mapping: makePeridotUniversalMappingDefinition({
      sheetPurposes: [makePeridotSheetPurposeAssignment({
        sourceTableId: alaskaTableForSuggestions.id,
        purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS,
      })],
    }),
    savedVariables: [],
  });
  const alaskaSuggestions = recognizePeridotUniversalFields({
    sourceManifest: alaskaState.sourceManifest,
    sourceRowsByTableId: alaskaState.sourceRowsByTableId,
  });
  const alaskaTable = alaskaState.sourceManifest.sourceTables[0];
  const byFieldName = new Map(alaskaSuggestions.map((suggestion) => [suggestion.sourceFieldName, suggestion]));
  const dateSuggestion = byFieldName.get('inception');
  const coordinateSuggestion = byFieldName.get('coordinate location');
  const populationSuggestion = byFieldName.get('population');
  const suggestionChecks = {
    recognizerSuggestsDate: dateSuggestion?.suggestedKind === PERIDOT_VARIABLE_KINDS.TEMPORAL,
    recognizerSuggestsCoordinates: coordinateSuggestion?.suggestedKind === PERIDOT_VARIABLE_KINDS.PLACE,
    recognizerSuggestsNumber: populationSuggestion?.suggestedKind === PERIDOT_VARIABLE_KINDS.NUMBER,
    recognizerDoesNotAutoAssign: alaskaState.fieldAssignments.length === 0 && getPrototypeFieldSuggestions(alaskaState).length > 0,
  };

  const accepted = acceptPrototypeFieldSuggestion(alaskaState, {
    suggestionId: dateSuggestion?.id,
    label: 'Airfield beginning',
    kind: PERIDOT_VARIABLE_KINDS.TEMPORAL,
  });
  const acceptedAssignment = accepted.fieldAssignments.find((item) => item.sourceFieldId === field(alaskaTable, 'inception'));
  const acceptedVariable = accepted.savedVariables.find((item) => item.id === acceptedAssignment?.variableId);
  suggestionChecks.acceptedSuggestionIsEditable = acceptedVariable?.label === 'Airfield beginning';

  const dismissed = dismissPrototypeFieldSuggestion(alaskaState, coordinateSuggestion?.id);
  suggestionChecks.dismissedSuggestionStaysUnassigned = !getPrototypeFieldSuggestions(dismissed).some((item) => item.id === coordinateSuggestion?.id)
    && dismissed.fieldAssignments.length === 0;

  const blankMariaState = makePeridotUniversalUploadPrototypeState({
    sourceManifest: mariaPrototypeFixture.sourceManifest,
    sourceRowsByTableId: mariaPrototypeFixture.sourceRowsByTableId,
    mapping: {},
    savedVariables: mariaPrototypeFixture.savedVariables,
  });
  const mariaTables = mariaPrototypeFixture.sourceManifest.sourceTables;
  const [rawTable, summaryTable, geographicTable, placeTable, peopleTable, controlledTable] = mariaTables;
  const blankPurposeReview = buildPeridotUniversalSheetPurposeReview(blankMariaState);
  const namedWithoutKind = setPrototypeSheetPurpose(blankMariaState, {
    sourceTableId: placeTable.id,
    purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS,
  });
  const namedWithKind = setPrototypeSheetPurpose(namedWithoutKind, {
    sourceTableId: placeTable.id,
    purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS,
    namedThingKind: 'place',
  });

  const mariaState = makePeridotUniversalUploadPrototypeState({
    sourceManifest: mariaPrototypeFixture.sourceManifest,
    sourceRowsByTableId: mariaPrototypeFixture.sourceRowsByTableId,
    mapping: mariaPrototypeFixture.mapping,
    savedVariables: mariaPrototypeFixture.savedVariables,
  });
  const mariaEligibleFields = new Set(getPrototypeTablesForStep(mariaState, 'fields').map((table) => table.id));
  const withDormantControlledAssignment = assignPrototypeField(mariaState, {
    sourceTableId: controlledTable.id,
    sourceFieldId: field(controlledTable, 'Relationships'),
    variableId: 'variable:record-id',
    status: 'active',
  });
  const controlledResult = buildPeridotUniversalUploadPrototypeResult(withDormantControlledAssignment);
  const rawIgnored = setPrototypeSheetPurpose(mariaState, { sourceTableId: rawTable.id, purpose: PERIDOT_SHEET_PURPOSES.IGNORE });
  const rawIgnoredResult = buildPeridotUniversalUploadPrototypeResult(rawIgnored);
  const rawRestored = setPrototypeSheetPurpose(rawIgnored, { sourceTableId: rawTable.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS });
  const rawRestoredResult = buildPeridotUniversalUploadPrototypeResult(rawRestored);

  const purposeChecks = {
    unclassifiedSheetsStayOutOfLaterMapping: blankPurposeReview.unresolvedCount === mariaTables.length
      && getPrototypeTablesForStep(blankMariaState, 'fields').length === 0,
    namedThingSheetRequiresKind: buildPeridotUniversalSheetPurposeReview(namedWithoutKind).namedThingKindNeededCount === 1
      && !getPrototypeTablesForStep(namedWithoutKind, 'fields').some((table) => table.id === placeTable.id),
    namedThingKindEnablesLaterMapping: getPrototypeTablesForStep(namedWithKind, 'fields').some((table) => table.id === placeTable.id),
    controlledVocabularySheetIsWithheld: !mariaEligibleFields.has(controlledTable.id),
    summarySheetRemainsAvailableAsSummarizedData: mariaEligibleFields.has(summaryTable.id),
    recordAndProfileSheetsRemainAvailable: mariaEligibleFields.has(rawTable.id)
      && mariaEligibleFields.has(geographicTable.id)
      && mariaEligibleFields.has(placeTable.id)
      && mariaEligibleFields.has(peopleTable.id),
    dormantControlledAssignmentIsNotSerialized: withDormantControlledAssignment.fieldAssignments.some((item) => item.sourceTableId === controlledTable.id)
      && !controlledResult.universalMapping.fieldAssignments.some((item) => item.sourceTableId === controlledTable.id),
    changingPurposePreservesButDeactivatesDraftMapping: rawIgnored.fieldAssignments.some((item) => item.sourceTableId === rawTable.id)
      && !rawIgnoredResult.universalMapping.fieldAssignments.some((item) => item.sourceTableId === rawTable.id)
      && rawRestoredResult.universalMapping.fieldAssignments.some((item) => item.sourceTableId === rawTable.id),
  };

  const rawToGeographyConnection = mariaState.tableConnections.find((item) => item.id === 'connection:raw-to-geography');
  const rawToGeographyReport = getPrototypeTableConnectionReport(mariaState, rawToGeographyConnection, { maxRows: 10 });
  const unansweredConnection = {
    ...rawToGeographyConnection,
    attributes: { multipleMatchesExpectation: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.UNANSWERED },
  };
  const unansweredReport = buildPeridotTableConnectionMatchReport({
    sourceManifest: mariaState.sourceManifest,
    sourceRowsByTableId: mariaState.sourceRowsByTableId,
    connection: unansweredConnection,
  });
  const expectOneConnection = {
    ...rawToGeographyConnection,
    attributes: { multipleMatchesExpectation: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.EXPECT_ONE },
  };
  const expectOneReport = buildPeridotTableConnectionMatchReport({
    sourceManifest: mariaState.sourceManifest,
    sourceRowsByTableId: mariaState.sourceRowsByTableId,
    connection: expectOneConnection,
  });
  const editedConnectionState = savePrototypeTableConnection(mariaState, {
    ...rawToGeographyConnection,
    multipleMatchesExpectation: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.EXPECT_ONE,
  });
  const editedConnection = editedConnectionState.tableConnections.find((item) => item.id === rawToGeographyConnection.id);
  const connectionChecks = {
    relatedSheetReportShowsZeroOneSeveral: rawToGeographyReport.summary.noMatchRows === 1
      && rawToGeographyReport.summary.oneMatchRows === 1
      && rawToGeographyReport.summary.severalMatchRows === 1,
    severalMatchesRequireAnswerOnlyWhenObserved: unansweredReport.needsMultipleMatchAnswer === true
      && rawToGeographyReport.needsMultipleMatchAnswer === false,
    expectingOneFlagsButPreservesSeveralMatches: expectOneReport.expectationConflict === true
      && expectOneReport.summary.severalMatchRows === 1
      && expectOneReport.rows.some((row) => row.matchCount === 2),
    savedConnectionCanBeEditedWithoutDuplication: editedConnectionState.tableConnections.length === mariaState.tableConnections.length
      && editedConnection?.attributes?.multipleMatchesExpectation === PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.EXPECT_ONE,
    connectionReportDoesNotFlattenRelatedRows: rawToGeographyReport.rows.find((row) => row.sourceValue === 'MM0001')?.matchedRowNumbers.length === 2,
  };

  const allChecks = Object.freeze({ ...checks, ...suggestionChecks, ...purposeChecks, ...connectionChecks });
  return Object.freeze({ passed: Object.values(allChecks).every(Boolean), checks: allChecks, results: Object.freeze(results), recognizerSuggestions: alaskaSuggestions });
}
