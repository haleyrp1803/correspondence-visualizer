/*
 * Dependency-free fixtures for Pass 3B.1 dataset-profile routing.
 */

import {
  DEFAULT_PERIDOT_DATASET_PROFILE_ID,
  getPeridotDatasetProfile,
  isPeridotCorrespondenceProfile,
  isPeridotDatasetProfileId,
  isPeridotGenealogyProfile,
  PERIDOT_DATASET_PROFILE_IDS,
  PERIDOT_DATASET_PROFILES,
  resolvePeridotDatasetProfileId,
} from './peridotDatasetProfiles.js';
import { buildInitialPeridotColumnMappingState } from './peridotColumnMapping.js';
import { buildInitialPeridotWorkbookMappingState } from './peridotWorkbookMapping.js';

export function runPeridotDatasetProfileRoutingSelfAudit() {
  const correspondenceState = buildInitialPeridotColumnMappingState(
    ['Date', 'Source', 'Target'],
    [],
  );
  const genealogyState = buildInitialPeridotColumnMappingState(
    ['ID', 'Full name', 'Mother ID'],
    [],
    { datasetProfileId: PERIDOT_DATASET_PROFILE_IDS.GENEALOGY },
  );

  const workbookModel = {
    fileType: 'excel',
    sheets: [{
      sheetName: 'People',
      headers: ['ID', 'Full name'],
      rows: [{ ID: 'P1', 'Full name': 'Person One' }],
      rowCount: 1,
      columnCount: 2,
    }],
  };
  const genealogyWorkbookState = buildInitialPeridotWorkbookMappingState(
    workbookModel,
    { datasetProfileId: PERIDOT_DATASET_PROFILE_IDS.GENEALOGY },
  );

  const checks = Object.freeze({
    twoProfilesRegistered: PERIDOT_DATASET_PROFILES.length === 2,
    correspondenceIsDefault:
      DEFAULT_PERIDOT_DATASET_PROFILE_ID === PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE,
    correspondenceProfileRecognized:
      isPeridotDatasetProfileId(PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE)
      && isPeridotCorrespondenceProfile(PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE),
    genealogyProfileRecognized:
      isPeridotDatasetProfileId(PERIDOT_DATASET_PROFILE_IDS.GENEALOGY)
      && isPeridotGenealogyProfile(PERIDOT_DATASET_PROFILE_IDS.GENEALOGY),
    unknownProfileFallsBack:
      resolvePeridotDatasetProfileId('not-a-profile') === DEFAULT_PERIDOT_DATASET_PROFILE_ID,
    correspondenceRemainsImportable:
      getPeridotDatasetProfile(PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE).canConfirmImport === true,
    genealogyIsRoutedButNotImportable:
      getPeridotDatasetProfile(PERIDOT_DATASET_PROFILE_IDS.GENEALOGY).canOpenMapping === true
      && getPeridotDatasetProfile(PERIDOT_DATASET_PROFILE_IDS.GENEALOGY).canConfirmImport === false,
    singleTableStateCarriesDefaultProfile:
      correspondenceState.datasetProfileId === PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE,
    singleTableStateCarriesGenealogyProfile:
      genealogyState.datasetProfileId === PERIDOT_DATASET_PROFILE_IDS.GENEALOGY,
    workbookStateCarriesGenealogyProfile:
      genealogyWorkbookState.datasetProfileId === PERIDOT_DATASET_PROFILE_IDS.GENEALOGY,
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
  });
}
