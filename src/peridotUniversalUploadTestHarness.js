/*
 * Pure Phase 2.7 bridge from the existing parsed workbook model to the
 * universal-upload prototype input contract.
 *
 * This does not import data or mutate production mapping state. It only gives
 * the experimental UI the same stable source IDs and source rows used by the
 * Phase 1/2 universal model helpers.
 */

import { makePeridotSourceManifestFromWorkbookModel } from './peridotSourceModel.js';

function buildSourceRowsByTableId(sourceManifest, workbookModel) {
  const sheetsByName = new Map((workbookModel?.sheets || []).map((sheet) => [sheet.sheetName, sheet]));
  return Object.freeze(Object.fromEntries((sourceManifest?.sourceTables || []).map((table) => {
    const sheet = sheetsByName.get(table.sheetName);
    return [table.id, Array.isArray(sheet?.rows) ? sheet.rows : []];
  })));
}

export function buildPeridotUniversalPrototypeInput(workbookModel = {}) {
  const sourceManifest = makePeridotSourceManifestFromWorkbookModel(workbookModel);
  return Object.freeze({
    sourceManifest,
    sourceRowsByTableId: buildSourceRowsByTableId(sourceManifest, workbookModel),
  });
}
