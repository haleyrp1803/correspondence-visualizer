/*
 * Dependency-free fixtures for Phase 1.2 canonical source metadata.
 *
 * These checks prove that workbook sheets and fields receive stable source IDs,
 * that universal sheet-purpose mappings can reference those IDs, and that the
 * normalized dataset still preserves legacy profile-specific manifest metadata.
 */

import { makePeridotNormalizedDataset } from './peridotNormalizedModel.js';
import {
  makePeridotSourceManifest,
  makePeridotSourceManifestFromWorkbookModel,
  PERIDOT_SOURCE_MODEL_SCHEMA_VERSION,
} from './peridotSourceModel.js';
import {
  makePeridotUniversalMappingDefinition,
  PERIDOT_SHEET_PURPOSES,
} from './peridotUniversalMappingModel.js';

const mariaWorkbookModel = Object.freeze({
  fileType: 'excel',
  fileName: 'Maria Maddalena.xlsx',
  workbookName: 'Maria Maddalena.xlsx',
  warnings: [{ code: 'excel_saved_values_only', message: 'Use saved values.' }],
  sheets: Object.freeze([
    Object.freeze({
      sheetName: 'Raw Data',
      headers: Object.freeze(['Unique ID', 'Date', 'Source', 'Target']),
      rowCount: 2994,
      columnCount: 4,
      headerRowIndex: 0,
      warnings: Object.freeze([]),
    }),
    Object.freeze({
      sheetName: 'People Profiles',
      headers: Object.freeze(['Person', 'Occupation', 'Image']),
      rowCount: 250,
      columnCount: 3,
      headerRowIndex: 0,
      warnings: Object.freeze([]),
    }),
    Object.freeze({
      sheetName: 'Drop Down Lists',
      headers: Object.freeze(['Relationship', 'Topic', 'Language']),
      rowCount: 40,
      columnCount: 3,
      headerRowIndex: 0,
      warnings: Object.freeze([]),
    }),
  ]),
});

const stockWorkbookModel = Object.freeze({
  fileType: 'excel',
  fileName: 'Daily High Stock Price for Five Companies in 1714.xlsx',
  workbookName: 'Daily High Stock Price for Five Companies in 1714.xlsx',
  warnings: Object.freeze([]),
  sheets: Object.freeze([
    Object.freeze({
      sheetName: 'Sheet1',
      headers: Object.freeze(['Date', 'Day of the Week', 'East India Company', 'Bank of England', 'Source']),
      rowCount: 365,
      columnCount: 5,
      headerRowIndex: 0,
      warnings: Object.freeze([]),
    }),
  ]),
});

export function runPeridotSourceModelSelfAudit() {
  const mariaManifest = makePeridotSourceManifestFromWorkbookModel(mariaWorkbookModel);
  const stockManifest = makePeridotSourceManifestFromWorkbookModel(stockWorkbookModel);

  const rawDataTable = mariaManifest.sourceTables.find((table) => table.sheetName === 'Raw Data');
  const peopleTable = mariaManifest.sourceTables.find((table) => table.sheetName === 'People Profiles');
  const dropdownTable = mariaManifest.sourceTables.find((table) => table.sheetName === 'Drop Down Lists');

  const mariaMapping = makePeridotUniversalMappingDefinition({
    id: 'fixture-maria-source-purpose-mapping',
    sheetPurposes: [
      { sourceTableId: rawDataTable?.id, purpose: PERIDOT_SHEET_PURPOSES.INDIVIDUAL_RECORDS },
      { sourceTableId: peopleTable?.id, purpose: PERIDOT_SHEET_PURPOSES.NAMED_THINGS, namedThingKind: 'person' },
      { sourceTableId: dropdownTable?.id, purpose: PERIDOT_SHEET_PURPOSES.CONTROLLED_VALUES },
    ],
  });

  const canonicalDataset = makePeridotNormalizedDataset({
    datasetId: 'fixture-source-model',
    sourceManifest: mariaManifest,
    universalMapping: mariaMapping,
  });

  const legacyManifestDataset = makePeridotNormalizedDataset({
    datasetId: 'fixture-legacy-source-manifest',
    sourceManifest: {
      sourceFileId: 'legacy-file',
      sourceFileName: 'fixture.csv',
      sourceSheet: 'Uploaded table',
      totalRowCount: 3,
      acceptedRowCount: 3,
      sourceShape: 'correspondence-compatible-rows',
    },
  });

  const stockTable = stockManifest.sourceTables[0];
  const checks = Object.freeze({
    workbookSheetsBecomeDistinctSourceTables:
      mariaManifest.sourceTables.length === 3
      && new Set(mariaManifest.sourceTables.map((table) => table.id)).size === 3,
    sourceFieldsAreStableAndTableScoped:
      rawDataTable?.fields.length === 4
      && rawDataTable.fields.every((field) => field.sourceTableId === rawDataTable.id)
      && rawDataTable.fields[0]?.name === 'Unique ID',
    workbookMetadataIsPreservedWithoutRows:
      mariaManifest.sourceFiles[0]?.fileName === 'Maria Maddalena.xlsx'
      && mariaManifest.sourceFiles[0]?.tableIds.length === 3
      && !Object.prototype.hasOwnProperty.call(rawDataTable || {}, 'rows'),
    sheetPurposesReferenceCanonicalSourceTableIds:
      canonicalDataset.universalMapping.sheetPurposes.length === 3
      && canonicalDataset.universalMapping.sheetPurposes.every((assignment) =>
        canonicalDataset.sourceManifest.sourceTables.some((table) => table.id === assignment.sourceTableId)),
    stockSourceStructureRepresentedWithoutDomainInference:
      stockTable?.rowCount === 365
      && stockTable?.fields.some((field) => field.name === 'East India Company')
      && stockTable?.fields.some((field) => field.name === 'Date'),
    legacyManifestMetadataRemainsAvailable:
      legacyManifestDataset.sourceManifest.sourceFileId === 'legacy-file'
      && legacyManifestDataset.sourceManifest.totalRowCount === 3
      && legacyManifestDataset.sourceManifest.sourceShape === 'correspondence-compatible-rows'
      && Array.isArray(legacyManifestDataset.sourceManifest.sourceTables),
    normalizedDatasetCarriesSourceSchema:
      canonicalDataset.sourceManifest.schemaVersion === PERIDOT_SOURCE_MODEL_SCHEMA_VERSION,
    sourceStructuresAreFrozen:
      Object.isFrozen(canonicalDataset.sourceManifest)
      && Object.isFrozen(canonicalDataset.sourceManifest.sourceTables)
      && Object.isFrozen(canonicalDataset.sourceManifest.sourceTables[0])
      && Object.isFrozen(canonicalDataset.sourceManifest.sourceTables[0]?.fields),
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    fixtures: Object.freeze({
      mariaManifest,
      stockManifest,
      canonicalDataset,
      legacyManifestDataset,
    }),
  });
}
