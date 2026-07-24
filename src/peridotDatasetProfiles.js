/*
 * Dataset-profile registry for Peridot import routing.
 *
 * Pass 3B.1 introduces an explicit vocabulary for selecting and carrying a
 * normalization profile through upload staging and mapping state. It does not
 * define genealogy field mappings or activate genealogy imports.
 */

import {
  PERIDOT_CORRESPONDENCE_PROFILE_ID,
  PERIDOT_CORRESPONDENCE_PROFILE_VERSION,
} from './peridotCorrespondenceProfile.js';
import {
  PERIDOT_GENEALOGY_PROFILE_ID,
  PERIDOT_GENEALOGY_PROFILE_VERSION,
} from './peridotGenealogyProfile.js';

export const PERIDOT_DATASET_PROFILE_IDS = Object.freeze({
  CORRESPONDENCE: PERIDOT_CORRESPONDENCE_PROFILE_ID,
  GENEALOGY: PERIDOT_GENEALOGY_PROFILE_ID,
});

export const DEFAULT_PERIDOT_DATASET_PROFILE_ID = PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE;

export const PERIDOT_DATASET_PROFILES = Object.freeze([
  Object.freeze({
    id: PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE,
    version: PERIDOT_CORRESPONDENCE_PROFILE_VERSION,
    shortLabel: 'Correspondence',
    label: 'Correspondence / Directed Record',
    primaryRowType: 'document-or-record',
    description: 'Each row represents a letter, document, observation, site, or other directed or evidence record.',
    mappingStatus: 'active',
    canOpenMapping: true,
    canConfirmImport: true,
  }),
  Object.freeze({
    id: PERIDOT_DATASET_PROFILE_IDS.GENEALOGY,
    version: PERIDOT_GENEALOGY_PROFILE_VERSION,
    shortLabel: 'Genealogy',
    label: 'Genealogy / Person-Centered',
    primaryRowType: 'person',
    description: 'Each row represents one person, with family relationships and life events linked by stable source IDs.',
    mappingStatus: 'ui-ready',
    canOpenMapping: true,
    canConfirmImport: false,
    mappingSchemaReady: true,
    mappingUiReady: true,
  }),
]);

const PROFILE_BY_ID = new Map(PERIDOT_DATASET_PROFILES.map((profile) => [profile.id, profile]));

export function isPeridotDatasetProfileId(value) {
  return PROFILE_BY_ID.has(String(value || '').trim());
}

export function resolvePeridotDatasetProfileId(
  value,
  fallback = DEFAULT_PERIDOT_DATASET_PROFILE_ID,
) {
  const candidate = String(value || '').trim();
  return isPeridotDatasetProfileId(candidate) ? candidate : fallback;
}

export function getPeridotDatasetProfile(value) {
  return PROFILE_BY_ID.get(resolvePeridotDatasetProfileId(value))
    || PROFILE_BY_ID.get(DEFAULT_PERIDOT_DATASET_PROFILE_ID);
}

export function isPeridotCorrespondenceProfile(value) {
  return resolvePeridotDatasetProfileId(value) === PERIDOT_DATASET_PROFILE_IDS.CORRESPONDENCE;
}

export function isPeridotGenealogyProfile(value) {
  return resolvePeridotDatasetProfileId(value) === PERIDOT_DATASET_PROFILE_IDS.GENEALOGY;
}
