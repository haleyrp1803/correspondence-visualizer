/*
 * Dependency-free fixtures for Phase 1.3 deterministic transformations.
 *
 * These checks prove that the existing universal mapping definitions can drive
 * row preservation, repeated-heading expansion, transposition, and non-
 * flattening table connections without introducing dataset-specific logic.
 */

import {
  makePeridotUniversalMappingDefinition,
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_GENERATED_VARIABLE_SOURCES,
} from './peridotUniversalMappingModel.js';
import {
  compilePeridotUniversalTransformations,
  connectPeridotTables,
  preservePeridotAssignedFields,
  transformPeridotRepeatedHeadings,
  transposePeridotTable,
  PERIDOT_TRANSFORMATION_TYPES,
} from './peridotUniversalTransformations.js';

const active = PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE;

const stockWideTable = Object.freeze({
  id: 'stock-wide',
  sourceFileId: 'stock-file',
  sourceFileName: 'Daily High Stock Price for Five Companies in 1714.xlsx',
  sheetName: 'Sheet1',
  headers: Object.freeze(['Date', 'Day of the Week', 'East India Company', 'Bank of England', 'Source']),
  rows: Object.freeze([
    Object.freeze({ Date: '1714/03/24', 'Day of the Week': 'Saturday', 'East India Company': 118, 'Bank of England': 116, Source: 'Ledger A' }),
    Object.freeze({ Date: '1714/03/26', 'Day of the Week': 'Monday', 'East India Company': 'Holiday', 'Bank of England': 'Holiday', Source: 'Ledger A' }),
    Object.freeze({ Date: '1714/03/27', 'Day of the Week': 'Tuesday', 'East India Company': '', 'Bank of England': 117.5, Source: 'Ledger A' }),
  ]),
});

const stockWideMapping = makePeridotUniversalMappingDefinition({
  id: 'stock-wide-transform-fixture',
  fieldAssignments: [
    { sourceTableId: 'stock-wide', sourceFieldId: 'Date', variableId: 'stock-date', status: active },
    { sourceTableId: 'stock-wide', sourceFieldId: 'Source', variableId: 'stock-source', status: active },
  ],
  repeatedHeadingGroups: [{
    id: 'stock-companies',
    sourceTableId: 'stock-wide',
    sourceFieldIds: ['East India Company', 'Bank of England'],
    headingVariableId: 'stock-organization',
    cellVariableId: 'stock-price',
    attachedFieldIds: ['Date', 'Day of the Week', 'Source'],
    blankHandling: 'skip',
    textHandling: 'preserve',
  }],
});

const stockTransposedTable = Object.freeze({
  id: 'stock-transposed',
  sourceFileId: 'stock-file-transposed',
  sourceFileName: 'Daily High Stock Price for Five Companies in 1714 (2).xlsx',
  sheetName: 'Sheet1',
  headers: Object.freeze(['Company', '1714/03/24', '1714/03/26', '1714/03/27']),
  rows: Object.freeze([
    Object.freeze({ Company: 'East India Company', '1714/03/24': 118, '1714/03/26': 'Holiday', '1714/03/27': '' }),
    Object.freeze({ Company: 'Bank of England', '1714/03/24': 116, '1714/03/26': 'Holiday', '1714/03/27': 117.5 }),
  ]),
});

const stockTransposedMapping = makePeridotUniversalMappingDefinition({
  id: 'stock-transposed-transform-fixture',
  fieldAssignments: [
    { sourceTableId: 'stock-transposed', sourceFieldId: 'Company', variableId: 'stock-organization', status: active },
  ],
  repeatedHeadingGroups: [{
    id: 'stock-dates',
    sourceTableId: 'stock-transposed',
    sourceFieldIds: ['1714/03/24', '1714/03/26', '1714/03/27'],
    headingVariableId: 'stock-date',
    cellVariableId: 'stock-price',
    attachedFieldIds: ['Company'],
    blankHandling: 'skip',
    textHandling: 'preserve',
    generatedVariableSource: PERIDOT_GENERATED_VARIABLE_SOURCES.TRANSPOSED_HEADINGS,
  }],
});

const alaskaTable = Object.freeze({
  id: 'airfields',
  sourceFileName: 'Alaskan Airfields.csv',
  sheetName: 'Uploaded table',
  headers: Object.freeze(['Qid', 'Name of Site', 'coordinate location', 'population', 'inception']),
  rows: Object.freeze([
    Object.freeze({ Qid: 'Q1', 'Name of Site': 'Site A', 'coordinate location': '64.8,-147.7', population: 100, inception: '1941' }),
    Object.freeze({ Qid: 'Q2', 'Name of Site': 'Site B', 'coordinate location': '61.2,-149.9', population: 50, inception: '1942' }),
  ]),
});

const mariaRaw = Object.freeze({
  id: 'raw-data',
  sourceFileName: 'Maria Maddalena.xlsx',
  sheetName: 'Raw Data',
  headers: Object.freeze(['Unique ID', 'Date']),
  rows: Object.freeze([
    Object.freeze({ 'Unique ID': 'L1', Date: '1610-01-01' }),
    Object.freeze({ 'Unique ID': 'L2', Date: '1610-01-02' }),
    Object.freeze({ 'Unique ID': 'L3', Date: '1610-01-03' }),
  ]),
});

const mariaGeography = Object.freeze({
  id: 'geographic-mapping',
  sourceFileName: 'Maria Maddalena.xlsx',
  sheetName: 'Geographic Mapping',
  headers: Object.freeze(['Unique ID', 'Location']),
  rows: Object.freeze([
    Object.freeze({ 'Unique ID': 'L1', Location: 'Florence' }),
    Object.freeze({ 'Unique ID': 'L1', Location: 'Rome' }),
    Object.freeze({ 'Unique ID': 'L2', Location: 'Siena' }),
    Object.freeze({ 'Unique ID': 'L9', Location: 'Mantua' }),
  ]),
});

export function runPeridotUniversalTransformationSelfAudit() {
  const compiledWide = compilePeridotUniversalTransformations(stockWideMapping);
  const compiledTransposed = compilePeridotUniversalTransformations(stockTransposedMapping);
  const preservedAlaska = preservePeridotAssignedFields({
    sourceTable: alaskaTable,
    assignments: [
      { sourceTableId: 'airfields', sourceFieldId: 'Qid', variableId: 'site-id', status: active },
      { sourceTableId: 'airfields', sourceFieldId: 'Name of Site', variableId: 'site-name', status: active },
      { sourceTableId: 'airfields', sourceFieldId: 'population', variableId: 'site-population', status: active },
    ],
  });
  const wideRows = transformPeridotRepeatedHeadings({
    sourceTable: stockWideTable,
    group: stockWideMapping.repeatedHeadingGroups[0],
  });
  const transposedRows = transformPeridotRepeatedHeadings({
    sourceTable: stockTransposedTable,
    group: stockTransposedMapping.repeatedHeadingGroups[0],
  });
  const physicallyTransposed = transposePeridotTable(stockTransposedTable);
  const connection = connectPeridotTables({
    fromTable: mariaRaw,
    toTable: mariaGeography,
    connection: {
      id: 'raw-to-geography',
      fromFieldId: 'Unique ID',
      toFieldId: 'Unique ID',
    },
  });

  const checks = Object.freeze({
    compilerUsesExistingMappingDefinitions:
      compiledWide.some((operation) => operation.type === PERIDOT_TRANSFORMATION_TYPES.PRESERVE_ASSIGNED_FIELDS)
      && compiledWide.some((operation) => operation.type === PERIDOT_TRANSFORMATION_TYPES.REPEATED_HEADINGS)
      && compiledTransposed.some((operation) => operation.type === PERIDOT_TRANSFORMATION_TYPES.TRANSPOSE),
    ordinaryFieldPreservationKeepsValues:
      preservedAlaska.length === 2
      && preservedAlaska[0]?.values['site-name'] === 'Site A'
      && preservedAlaska[1]?.values['site-population'] === 50,
    ordinaryFieldPreservationKeepsSourceProvenance:
      preservedAlaska[0]?.provenance['site-name']?.source?.sourceRowNumber === 1
      && preservedAlaska[0]?.provenance['site-name']?.source?.sourceColumns?.[0] === 'Name of Site',
    repeatedHeadingsCreateHeaderAndCellVariables:
      wideRows.some((row) => row.values['stock-organization'] === 'East India Company' && row.values['stock-price'] === 118)
      && wideRows.some((row) => row.values['stock-organization'] === 'Bank of England' && row.values['stock-price'] === 117.5),
    repeatedHeadingsSkipOnlyConfiguredBlanks:
      wideRows.length === 5
      && wideRows.some((row) => row.values['stock-price'] === 'Holiday'),
    repeatedHeadingsRetainSourceCellProvenance:
      wideRows[0]?.provenance['stock-price']?.source?.sourceSheet === 'Sheet1'
      && wideRows[0]?.provenance['stock-price']?.source?.sourceColumns?.[0] === 'East India Company',
    transposedOrientationProducesEquivalentCorePairs:
      new Set(wideRows.map((row) => `${row.values['stock-organization']}|${row.values['stock-price']}`)).size
        === new Set(transposedRows.map((row) => `${row.values.Company}|${row.values['stock-price']}`)).size
      && transposedRows.some((row) => row.values.Company === 'Bank of England' && row.values['stock-price'] === 117.5),
    physicalTransposeIsDeterministicAndNonMutating:
      physicallyTransposed.rows.length === 3
      && physicallyTransposed.rows[0]?.Company === '1714/03/24'
      && stockTransposedTable.rows[0]?.Company === 'East India Company',
    tableConnectionsPreserveEveryMatch:
      connection.links[0]?.matchCount === 2
      && connection.links[0]?.matches.length === 2
      && connection.links[0]?.matches[0]?.row?.Location === 'Florence'
      && connection.links[0]?.matches[1]?.row?.Location === 'Rome',
    tableConnectionsReportUnmatchedAndMultipleRows:
      connection.summary.multipleMatchRows === 1
      && connection.summary.singleMatchRows === 1
      && connection.summary.unmatchedRows === 1,
    outputsAreFrozen:
      Object.isFrozen(wideRows)
      && Object.isFrozen(wideRows[0])
      && Object.isFrozen(connection)
      && Object.isFrozen(connection.links),
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    fixtures: Object.freeze({
      compiledWide,
      compiledTransposed,
      preservedAlaska,
      wideRows,
      transposedRows,
      physicallyTransposed,
      connection,
    }),
  });
}
