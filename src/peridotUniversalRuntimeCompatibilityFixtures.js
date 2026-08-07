/*
 * Phase 1.4 compatibility proof.
 *
 * These fixtures verify that the universal mapping/source/transformation layer
 * can coexist with both currently activated runtime paths without coercing
 * unrelated humanistic datasets into correspondence-shaped runtime rows.
 */

import { makePeridotNormalizedDataset } from './peridotNormalizedModel.js';
import {
  makePeridotUniversalMappingDefinition,
  makePeridotSavedVariables,
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_SHEET_PURPOSES,
  PERIDOT_VARIABLE_KINDS,
} from './peridotUniversalMappingModel.js';
import {
  makePeridotSourceFile,
  makePeridotSourceManifest,
  makePeridotSourceTable,
} from './peridotSourceModel.js';
import {
  describePeridotRuntimeCompatibility,
  PERIDOT_RUNTIME_COMPATIBILITY_MODES,
} from './peridotUniversalRuntimeCompatibility.js';
import { runPeridotCanonicalRuntimeSelfAudit } from './peridotCanonicalRuntimeFixtures.js';
import { runPeridotLegacyCompatibilitySelfAudit } from './peridotLegacyCompatibilityFixtures.js';
import { runPeridotGenealogyRuntimeSelfAudit } from './peridotGenealogyRuntimeFixtures.js';

const active = PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE;

function sourceManifest(fileName, tableSpecs) {
  const sourceFileId = `fixture-file:${fileName}`;
  const tables = tableSpecs.map((spec, index) => makePeridotSourceTable({
    id: spec.id,
    sourceFileId,
    label: spec.label,
    sheetName: spec.label,
    tableIndex: index,
    rowCount: spec.rowCount || 0,
    fields: (spec.fields || []).map((name, columnIndex) => ({ name, columnIndex })),
  }));
  return makePeridotSourceManifest({
    sourceFiles: [makePeridotSourceFile({
      id: sourceFileId,
      fileName,
      fileType: 'excel',
      tableIds: tables.map((table) => table.id),
    })],
    sourceTables: tables,
  });
}

const stockVariables = makePeridotSavedVariables([
  { id: 'stock-date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'record-date' },
  { id: 'stock-organization', label: 'Organization', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'organization', sourceType: 'generated' },
  { id: 'stock-price', label: 'Daily high stock price', kind: PERIDOT_VARIABLE_KINDS.NUMBER, sourceType: 'generated' },
]);

function buildWideStockDataset() {
  return makePeridotNormalizedDataset({
    datasetId: 'fixture-stock-wide',
    datasetLabel: 'Wide stock-price fixture',
    sourceManifest: sourceManifest('stock-wide.xlsx', [{
      id: 'stock-sheet',
      label: 'Sheet1',
      fields: ['Date', 'East India Company', 'Bank of England', 'South Sea Company'],
    }]),
    variableDefinitions: stockVariables,
    universalMapping: makePeridotUniversalMappingDefinition({
      id: 'stock-wide-mapping',
      sheetPurposes: [{ sourceTableId: 'stock-sheet', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }],
      fieldAssignments: [{ sourceTableId: 'stock-sheet', sourceFieldId: 'Date', variableId: 'stock-date', status: active }],
      repeatedHeadingGroups: [{
        id: 'company-columns',
        sourceTableId: 'stock-sheet',
        sourceFieldIds: ['East India Company', 'Bank of England', 'South Sea Company'],
        headingVariableId: 'stock-organization',
        cellVariableId: 'stock-price',
        attachedFieldIds: ['Date'],
        blankHandling: 'skip',
        textHandling: 'preserve',
      }],
    }),
  });
}

function buildTransposedStockDataset() {
  return makePeridotNormalizedDataset({
    datasetId: 'fixture-stock-transposed',
    datasetLabel: 'Transposed stock-price fixture',
    sourceManifest: sourceManifest('stock-transposed.xlsx', [{
      id: 'stock-sheet',
      label: 'Sheet1',
      fields: ['Company', '1714/03/24', '1714/03/26', '1714/03/27'],
    }]),
    variableDefinitions: stockVariables,
    universalMapping: makePeridotUniversalMappingDefinition({
      id: 'stock-transposed-mapping',
      sheetPurposes: [{ sourceTableId: 'stock-sheet', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }],
      fieldAssignments: [{ sourceTableId: 'stock-sheet', sourceFieldId: 'Company', variableId: 'stock-organization', status: active }],
      repeatedHeadingGroups: [{
        id: 'date-columns',
        sourceTableId: 'stock-sheet',
        sourceFieldIds: ['1714/03/24', '1714/03/26', '1714/03/27'],
        headingVariableId: 'stock-date',
        cellVariableId: 'stock-price',
        attachedFieldIds: ['Company'],
        blankHandling: 'skip',
        textHandling: 'preserve',
        generatedVariableSource: 'transposed-headings',
      }],
    }),
  });
}

function buildAlaskaDataset() {
  return makePeridotNormalizedDataset({
    datasetId: 'fixture-alaska',
    datasetLabel: 'Alaska airfields fixture',
    sourceManifest: sourceManifest('alaska-airfields.xlsx', [{
      id: 'airfields',
      label: 'Airfields',
      fields: ['Qid', 'coordinate location', 'Name of Site', 'population', 'inception', 'dissolved, abolished or demolished date'],
    }]),
    variableDefinitions: makePeridotSavedVariables([
      { id: 'site-id', label: 'Qid', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
      { id: 'site-name', label: 'Name of Site', kind: PERIDOT_VARIABLE_KINDS.ENTITY, semanticRole: 'site' },
      { id: 'site-coordinates', label: 'Coordinate location', kind: PERIDOT_VARIABLE_KINDS.PLACE },
      { id: 'site-population', label: 'Population', kind: PERIDOT_VARIABLE_KINDS.NUMBER },
      { id: 'site-inception', label: 'Inception', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'beginning-date' },
      { id: 'site-end', label: 'End date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'ending-date' },
    ]),
    universalMapping: makePeridotUniversalMappingDefinition({
      id: 'alaska-mapping',
      sheetPurposes: [{ sourceTableId: 'airfields', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'site' }],
      fieldAssignments: [
        ['Qid', 'site-id'],
        ['Name of Site', 'site-name'],
        ['coordinate location', 'site-coordinates'],
        ['population', 'site-population'],
        ['inception', 'site-inception'],
        ['dissolved, abolished or demolished date', 'site-end'],
      ].map(([sourceFieldId, variableId]) => ({ sourceTableId: 'airfields', sourceFieldId, variableId, status: active })),
    }),
  });
}

function buildMariaDataset() {
  const sheets = [
    ['raw-data', 'Raw Data', ['Unique ID', 'Date', 'Source', 'Target']],
    ['aggregated-edges', 'Aggregated Edges', ['Source', 'Target', 'Weight']],
    ['geographic-mapping', 'Geographic Mapping', ['Unique ID', 'Location', 'Coordinates']],
    ['place-profiles', 'Place Profiles', ['Source Location', 'Latitude', 'Longitude']],
    ['people-profiles', 'People Profiles', ['Person', 'Occupation']],
    ['drop-down-lists', 'Drop Down Lists', ['Relationship', 'Language', 'Occupation']],
  ];
  return makePeridotNormalizedDataset({
    datasetId: 'fixture-maria',
    datasetLabel: 'Maria Maddalena workbook fixture',
    sourceManifest: sourceManifest('maria-maddalena.xlsx', sheets.map(([id, label, fields]) => ({ id, label, fields }))),
    variableDefinitions: makePeridotSavedVariables([
      { id: 'record-id', label: 'Unique ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
      { id: 'record-date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'record-date' },
      { id: 'source-person', label: 'Source', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person', semanticRole: 'source' },
      { id: 'target-person', label: 'Target', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person', semanticRole: 'target' },
      { id: 'edge-weight', label: 'Weight', kind: PERIDOT_VARIABLE_KINDS.NUMBER, semanticRole: 'prepared-summary' },
      { id: 'person-name', label: 'Person', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person' },
      { id: 'place-name', label: 'Source Location', kind: PERIDOT_VARIABLE_KINDS.PLACE },
    ]),
    universalMapping: makePeridotUniversalMappingDefinition({
      id: 'maria-mapping',
      sheetPurposes: [
        { sourceTableId: 'raw-data', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS },
        { sourceTableId: 'aggregated-edges', purpose: PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS },
        { sourceTableId: 'geographic-mapping', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS, label: 'Related geographic records' },
        { sourceTableId: 'place-profiles', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'place' },
        { sourceTableId: 'people-profiles', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'person' },
        { sourceTableId: 'drop-down-lists', purpose: PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES },
      ],
      fieldAssignments: [
        { sourceTableId: 'raw-data', sourceFieldId: 'Unique ID', variableId: 'record-id', status: active },
        { sourceTableId: 'raw-data', sourceFieldId: 'Date', variableId: 'record-date', status: active },
        { sourceTableId: 'raw-data', sourceFieldId: 'Source', variableId: 'source-person', status: active },
        { sourceTableId: 'raw-data', sourceFieldId: 'Target', variableId: 'target-person', status: active },
        { sourceTableId: 'aggregated-edges', sourceFieldId: 'Weight', variableId: 'edge-weight', status: active },
        { sourceTableId: 'people-profiles', sourceFieldId: 'Person', variableId: 'person-name', status: active },
        { sourceTableId: 'place-profiles', sourceFieldId: 'Source Location', variableId: 'place-name', status: active },
      ],
      tableConnections: [{
        id: 'raw-to-geography',
        fromTableId: 'raw-data',
        fromFieldId: 'Unique ID',
        toTableId: 'geographic-mapping',
        toFieldId: 'Unique ID',
        label: 'Raw records to geographic records',
      }],
    }),
  });
}

export function runPeridotUniversalRuntimeCompatibilitySelfAudit() {
  const canonicalRuntimeAudit = runPeridotCanonicalRuntimeSelfAudit();
  const legacyCompatibilityAudit = runPeridotLegacyCompatibilitySelfAudit();
  const genealogyRuntimeAudit = runPeridotGenealogyRuntimeSelfAudit();

  const stockWide = buildWideStockDataset();
  const stockTransposed = buildTransposedStockDataset();
  const alaska = buildAlaskaDataset();
  const maria = buildMariaDataset();

  const reports = Object.freeze({
    stockWide: describePeridotRuntimeCompatibility(stockWide),
    stockTransposed: describePeridotRuntimeCompatibility(stockTransposed),
    alaska: describePeridotRuntimeCompatibility(alaska),
    maria: describePeridotRuntimeCompatibility(maria),
  });

  const checks = Object.freeze({
    currentCorrespondenceRuntimeStillPasses: canonicalRuntimeAudit.passed === true,
    currentLegacyAdapterParityStillPasses: legacyCompatibilityAudit.passed === true,
    currentGenealogyRuntimeStillPasses: genealogyRuntimeAudit.passed === true,
    universalDatasetsRemainCanonicalOnly:
      Object.values(reports).every((report) => report.mode === PERIDOT_RUNTIME_COMPATIBILITY_MODES.UNIVERSAL_CANONICAL_ONLY),
    universalDatasetsDoNotUseCorrespondenceAdapter:
      Object.values(reports).every((report) => report.correspondenceAdapterUsed === false),
    universalDatasetsDoNotUseGenealogyProjection:
      Object.values(reports).every((report) => report.genealogyProjectionUsed === false),
    stockOrientationsShareSameVariableVocabulary:
      JSON.stringify(stockWide.variableDefinitions.map((variable) => [variable.id, variable.kind]))
        === JSON.stringify(stockTransposed.variableDefinitions.map((variable) => [variable.id, variable.kind])),
    stockOrientationsRetainDifferentStructuralMappings:
      stockWide.universalMapping.repeatedHeadingGroups[0]?.headingVariableId === 'stock-organization'
      && stockTransposed.universalMapping.repeatedHeadingGroups[0]?.headingVariableId === 'stock-date',
    alaskaRemainsSimpleSingleTableDataset:
      alaska.sourceManifest.sourceTables.length === 1
      && alaska.universalMapping.repeatedHeadingGroups.length === 0
      && alaska.variableDefinitions.some((variable) => variable.temporalRole === 'beginning-date')
      && alaska.variableDefinitions.some((variable) => variable.temporalRole === 'ending-date'),
    mariaPreservesSixSeparateSourceTables:
      maria.sourceManifest.sourceTables.length === 6
      && maria.universalMapping.sheetPurposes.length === 6,
    mariaConnectionRemainsDefinitionNotFlattenedRows:
      maria.universalMapping.tableConnections.length === 1
      && maria.records.length === 0
      && maria.relationships.length === 0,
    compatibilityReportsAreFrozen:
      Object.values(reports).every((report) => Object.isFrozen(report)),
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    reports,
    currentRuntimeAudits: Object.freeze({
      correspondence: canonicalRuntimeAudit,
      legacyCompatibility: legacyCompatibilityAudit,
      genealogy: genealogyRuntimeAudit,
    }),
    universalFixtures: Object.freeze({
      stockWide,
      stockTransposed,
      alaska,
      maria,
    }),
  });
}
