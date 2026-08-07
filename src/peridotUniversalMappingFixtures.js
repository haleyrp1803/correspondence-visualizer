/*
 * Dependency-free fixtures for Phase 1.1 universal mapping vocabulary.
 *
 * These fixtures prove that the schema can describe current correspondence and
 * genealogy mappings plus the stock-price, Alaska, and Maria Maddalena design
 * probes without adding dataset-specific fields to the universal constructors.
 */

import { makePeridotNormalizedDataset } from './peridotNormalizedModel.js';
import {
  makePeridotSavedVariable,
  makePeridotSavedVariables,
  makePeridotUniversalMappingDefinition,
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_SHEET_PURPOSES,
  PERIDOT_VARIABLE_KINDS,
} from './peridotUniversalMappingModel.js';

const active = PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE;

const correspondenceVariables = makePeridotSavedVariables([
  { id: 'record-id', label: 'Unique ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
  { id: 'date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'record-date' },
  { id: 'source-person', label: 'Source', kind: PERIDOT_VARIABLE_KINDS.ENTITY, semanticRole: 'source', entitySubtype: 'person' },
  { id: 'target-person', label: 'Target', kind: PERIDOT_VARIABLE_KINDS.ENTITY, semanticRole: 'target', entitySubtype: 'person' },
]);

const correspondenceMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-correspondence-mapping',
  sheetPurposes: [{ sourceTableId: 'letters', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }],
  fieldAssignments: [
    { sourceTableId: 'letters', sourceFieldId: 'Unique ID', variableId: 'record-id', status: active },
    { sourceTableId: 'letters', sourceFieldId: 'Date', variableId: 'date', status: active },
    { sourceTableId: 'letters', sourceFieldId: 'Source', variableId: 'source-person', status: active },
    { sourceTableId: 'letters', sourceFieldId: 'Target', variableId: 'target-person', status: active },
  ],
});

const genealogyVariables = makePeridotSavedVariables([
  { id: 'person-id', label: 'ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
  { id: 'person-name', label: 'Full name', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person' },
  { id: 'mother-id', label: 'Mother ID', kind: PERIDOT_VARIABLE_KINDS.RELATIONSHIP, semanticRole: 'mother' },
  { id: 'birth-date', label: 'Birth date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'beginning-date' },
]);

const genealogyMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-genealogy-mapping',
  sheetPurposes: [{ sourceTableId: 'people', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'person' }],
  fieldAssignments: [
    { sourceTableId: 'people', sourceFieldId: 'ID', variableId: 'person-id', status: active },
    { sourceTableId: 'people', sourceFieldId: 'Full name', variableId: 'person-name', status: active },
    { sourceTableId: 'people', sourceFieldId: 'Mother ID', variableId: 'mother-id', status: active },
    { sourceTableId: 'people', sourceFieldId: 'Birth date', variableId: 'birth-date', status: active },
  ],
});

const stockVariables = makePeridotSavedVariables([
  { id: 'stock-date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'record-date' },
  { id: 'stock-organization', label: 'Organization', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'organization', sourceType: 'generated' },
  { id: 'stock-price', label: 'Daily high stock price', kind: PERIDOT_VARIABLE_KINDS.NUMBER, sourceType: 'generated' },
  { id: 'stock-source', label: 'Source', kind: PERIDOT_VARIABLE_KINDS.SOURCE },
]);

const stockMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-stock-wide-mapping',
  sheetPurposes: [{ sourceTableId: 'sheet1', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }],
  fieldAssignments: [
    { sourceTableId: 'sheet1', sourceFieldId: 'Date', variableId: 'stock-date', status: active },
    { sourceTableId: 'sheet1', sourceFieldId: 'Source', variableId: 'stock-source', status: active },
  ],
  repeatedHeadingGroups: [{
    id: 'company-price-columns',
    sourceTableId: 'sheet1',
    sourceFieldIds: ['East India Company', 'Bank of England', 'South Sea Company', 'Million Bank', 'Royal African Company'],
    headingVariableId: 'stock-organization',
    cellVariableId: 'stock-price',
    attachedFieldIds: ['Date', 'Day of the Week', 'Source'],
    blankHandling: 'skip',
    textHandling: 'preserve',
  }],
});

const stockTransposedMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-stock-transposed-mapping',
  sheetPurposes: [{ sourceTableId: 'sheet1', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS }],
  fieldAssignments: [
    { sourceTableId: 'sheet1', sourceFieldId: 'Company', variableId: 'stock-organization', status: active },
  ],
  repeatedHeadingGroups: [{
    id: 'date-price-columns',
    sourceTableId: 'sheet1',
    sourceFieldIds: ['1714/03/24', '1714/03/26', '1714/03/27'],
    headingVariableId: 'stock-date',
    cellVariableId: 'stock-price',
    attachedFieldIds: ['Company'],
    blankHandling: 'skip',
    textHandling: 'preserve',
    generatedVariableSource: 'transposed-headings',
  }],
});

const alaskaVariables = makePeridotSavedVariables([
  { id: 'site-id', label: 'Qid', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
  { id: 'site-name', label: 'Name of Site', kind: PERIDOT_VARIABLE_KINDS.ENTITY, semanticRole: 'site' },
  { id: 'site-coordinates', label: 'Coordinate location', kind: PERIDOT_VARIABLE_KINDS.PLACE },
  { id: 'site-population', label: 'Population', kind: PERIDOT_VARIABLE_KINDS.NUMBER },
  { id: 'site-inception', label: 'Inception', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'beginning-date' },
  { id: 'site-end', label: 'Dissolved, abolished or demolished date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'ending-date' },
]);

const alaskaMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-alaska-mapping',
  sheetPurposes: [{ sourceTableId: 'airfields', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'site' }],
  fieldAssignments: [
    { sourceTableId: 'airfields', sourceFieldId: 'Qid', variableId: 'site-id', status: active },
    { sourceTableId: 'airfields', sourceFieldId: 'Name of Site', variableId: 'site-name', status: active },
    { sourceTableId: 'airfields', sourceFieldId: 'coordinate location', variableId: 'site-coordinates', status: active },
    { sourceTableId: 'airfields', sourceFieldId: 'population', variableId: 'site-population', status: active },
    { sourceTableId: 'airfields', sourceFieldId: 'inception', variableId: 'site-inception', status: active },
    { sourceTableId: 'airfields', sourceFieldId: 'dissolved, abolished or demolished date', variableId: 'site-end', status: active },
  ],
});

const mariaVariables = makePeridotSavedVariables([
  { id: 'maria-record-id', label: 'Unique ID', kind: PERIDOT_VARIABLE_KINDS.IDENTIFIER },
  { id: 'maria-date', label: 'Date', kind: PERIDOT_VARIABLE_KINDS.TEMPORAL, temporalRole: 'record-date' },
  { id: 'maria-source-person', label: 'Source', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person', semanticRole: 'source' },
  { id: 'maria-target-person', label: 'Target', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person', semanticRole: 'target' },
  { id: 'maria-edge-weight', label: 'Weight', kind: PERIDOT_VARIABLE_KINDS.NUMBER, semanticRole: 'prepared-summary' },
  { id: 'maria-person-name', label: 'Person', kind: PERIDOT_VARIABLE_KINDS.ENTITY, entitySubtype: 'person' },
  { id: 'maria-place-name', label: 'Source Location', kind: PERIDOT_VARIABLE_KINDS.PLACE },
]);

const mariaMapping = makePeridotUniversalMappingDefinition({
  id: 'fixture-maria-mapping',
  sheetPurposes: [
    { sourceTableId: 'raw-data', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS },
    { sourceTableId: 'aggregated-edges', purpose: PERIDOT_SHEET_PURPOSES.SUMMARY_TOTALS },
    { sourceTableId: 'geographic-mapping', purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS, label: 'Related geographic records' },
    { sourceTableId: 'people-profiles', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'person' },
    { sourceTableId: 'place-profiles', purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'place' },
    { sourceTableId: 'drop-down-lists', purpose: PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES },
  ],
  fieldAssignments: [
    { sourceTableId: 'raw-data', sourceFieldId: 'Unique ID', variableId: 'maria-record-id', status: active },
    { sourceTableId: 'raw-data', sourceFieldId: 'Date', variableId: 'maria-date', status: active },
    { sourceTableId: 'raw-data', sourceFieldId: 'Source', variableId: 'maria-source-person', status: active },
    { sourceTableId: 'raw-data', sourceFieldId: 'Target', variableId: 'maria-target-person', status: active },
    { sourceTableId: 'aggregated-edges', sourceFieldId: 'Weight', variableId: 'maria-edge-weight', status: active },
    { sourceTableId: 'people-profiles', sourceFieldId: 'Person', variableId: 'maria-person-name', status: active },
    { sourceTableId: 'place-profiles', sourceFieldId: 'Source Location', variableId: 'maria-place-name', status: active },
  ],
  tableConnections: [
    {
      id: 'raw-to-geography',
      fromTableId: 'raw-data',
      fromFieldId: 'Unique ID',
      toTableId: 'geographic-mapping',
      toFieldId: 'Unique ID',
      label: 'Connect documentary records to geographic records',
    },
  ],
});

function datasetWithMapping(datasetId, variables, mapping) {
  return makePeridotNormalizedDataset({
    datasetId,
    datasetLabel: datasetId,
    variableDefinitions: variables,
    universalMapping: mapping,
  });
}

export function runPeridotUniversalMappingSelfAudit() {
  const datasets = Object.freeze({
    correspondence: datasetWithMapping('fixture-correspondence', correspondenceVariables, correspondenceMapping),
    genealogy: datasetWithMapping('fixture-genealogy', genealogyVariables, genealogyMapping),
    stockWide: datasetWithMapping('fixture-stock-wide', stockVariables, stockMapping),
    stockTransposed: datasetWithMapping('fixture-stock-transposed', stockVariables, stockTransposedMapping),
    alaska: datasetWithMapping('fixture-alaska', alaskaVariables, alaskaMapping),
    mariaMaddalena: datasetWithMapping('fixture-maria-maddalena', mariaVariables, mariaMapping),
  });

  const checks = Object.freeze({
    correspondenceRepresented:
      datasets.correspondence.variableDefinitions.length === 4
      && datasets.correspondence.universalMapping.fieldAssignments.length === 4,
    genealogyRepresented:
      datasets.genealogy.universalMapping.sheetPurposes[0]?.purpose === PERIDOT_SHEET_PURPOSES.NAMED_THINGS
      && datasets.genealogy.variableDefinitions.some((variable) => variable.kind === PERIDOT_VARIABLE_KINDS.RELATIONSHIP),
    stockWideRepeatedHeadingsRepresented:
      datasets.stockWide.universalMapping.repeatedHeadingGroups[0]?.sourceFieldIds.length === 5
      && datasets.stockWide.universalMapping.repeatedHeadingGroups[0]?.headingVariableId === 'stock-organization',
    stockOrientationsShareCanonicalVariables:
      datasets.stockWide.variableDefinitions.map((variable) => variable.id).join('|')
      === datasets.stockTransposed.variableDefinitions.map((variable) => variable.id).join('|')
      && datasets.stockTransposed.universalMapping.repeatedHeadingGroups[0]?.generatedVariableSource === 'transposed-headings',
    alaskaUsesOrdinaryFieldAssignments:
      datasets.alaska.universalMapping.repeatedHeadingGroups.length === 0
      && datasets.alaska.variableDefinitions.some((variable) => variable.temporalRole === 'ending-date'),
    mariaMultipleSheetPurposesRepresented:
      new Set(datasets.mariaMaddalena.universalMapping.sheetPurposes.map((item) => item.purpose)).size >= 4,
    mariaConnectionRepresentedWithoutFlattening:
      datasets.mariaMaddalena.universalMapping.tableConnections.length === 1
      && datasets.mariaMaddalena.universalMapping.tableConnections[0]?.fromTableId === 'raw-data'
      && datasets.mariaMaddalena.universalMapping.tableConnections[0]?.toTableId === 'geographic-mapping',
    normalizedDatasetCarriesUniversalMapping:
      datasets.stockWide.universalMapping.schemaVersion === '1.0.0-draft'
      && datasets.stockWide.variableDefinitions.length === stockVariables.length,
    structuresAreFrozen:
      Object.isFrozen(datasets.stockWide.variableDefinitions)
      && Object.isFrozen(datasets.stockWide.universalMapping)
      && Object.isFrozen(datasets.stockWide.universalMapping.repeatedHeadingGroups[0]),
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    datasets,
  });
}
