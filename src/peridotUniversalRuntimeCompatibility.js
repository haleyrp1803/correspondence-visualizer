/*
 * Runtime-compatibility boundary for universal canonical datasets.
 *
 * Phase 1.4 makes the coexistence rule explicit without changing App.jsx:
 * currently activated correspondence and genealogy profiles keep their
 * established runtime projections, while universally mapped datasets that do
 * not use those profiles remain canonical-only until a downstream consumer is
 * deliberately taught to consume them.
 */

import {
  PERIDOT_CORRESPONDENCE_PROFILE_ID,
} from './peridotCorrespondenceProfile.js';
import {
  PERIDOT_GENEALOGY_PROFILE_ID,
} from './peridotGenealogyProfile.js';

export const PERIDOT_RUNTIME_COMPATIBILITY_MODES = Object.freeze({
  CORRESPONDENCE_LEGACY_ADAPTER: 'correspondence-legacy-adapter',
  GENEALOGY_CANONICAL_PROJECTION: 'genealogy-canonical-projection',
  UNIVERSAL_CANONICAL_ONLY: 'universal-canonical-only',
  UNRECOGNIZED_PROFILE: 'unrecognized-profile',
  EMPTY_DATASET: 'empty-dataset',
});

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasUniversalDefinition(dataset = {}) {
  const mapping = dataset?.universalMapping || {};
  return asArray(dataset?.variableDefinitions).length > 0
    || asArray(mapping?.sheetPurposes).length > 0
    || asArray(mapping?.fieldAssignments).length > 0
    || asArray(mapping?.repeatedHeadingGroups).length > 0
    || asArray(mapping?.tableConnections).length > 0;
}

function hasCanonicalContent(dataset = {}) {
  const collectionNames = [
    'entities',
    'places',
    'records',
    'events',
    'relationships',
    'participations',
    'evidenceSources',
    'assertions',
  ];
  return collectionNames.some((name) => asArray(dataset?.[name]).length > 0);
}

/**
 * Describe how a canonical dataset relates to Peridot's current runtime.
 *
 * This helper intentionally does not execute a projection. It protects the
 * Phase 1 boundary by making explicit that universal datasets should not be
 * forced through correspondence-shaped rows merely because today's App.jsx
 * still consumes legacy runtime structures.
 */
export function describePeridotRuntimeCompatibility(dataset = {}) {
  const datasetId = asText(dataset?.datasetId);
  const mappingProfileId = asText(dataset?.mappingProfile?.id);
  const universalDefinitionPresent = hasUniversalDefinition(dataset);
  const canonicalContentPresent = hasCanonicalContent(dataset);

  if (mappingProfileId === PERIDOT_CORRESPONDENCE_PROFILE_ID) {
    return Object.freeze({
      datasetId,
      mappingProfileId,
      mode: PERIDOT_RUNTIME_COMPATIBILITY_MODES.CORRESPONDENCE_LEGACY_ADAPTER,
      currentRuntimeProjectionAvailable: true,
      correspondenceAdapterUsed: true,
      genealogyProjectionUsed: false,
      universalDefinitionPresent,
      canonicalContentPresent,
      canonicalOnlyUntilConsumerAdoption: false,
    });
  }

  if (mappingProfileId === PERIDOT_GENEALOGY_PROFILE_ID) {
    return Object.freeze({
      datasetId,
      mappingProfileId,
      mode: PERIDOT_RUNTIME_COMPATIBILITY_MODES.GENEALOGY_CANONICAL_PROJECTION,
      currentRuntimeProjectionAvailable: true,
      correspondenceAdapterUsed: false,
      genealogyProjectionUsed: true,
      universalDefinitionPresent,
      canonicalContentPresent,
      canonicalOnlyUntilConsumerAdoption: false,
    });
  }

  if (!mappingProfileId && universalDefinitionPresent) {
    return Object.freeze({
      datasetId,
      mappingProfileId: '',
      mode: PERIDOT_RUNTIME_COMPATIBILITY_MODES.UNIVERSAL_CANONICAL_ONLY,
      currentRuntimeProjectionAvailable: false,
      correspondenceAdapterUsed: false,
      genealogyProjectionUsed: false,
      universalDefinitionPresent: true,
      canonicalContentPresent,
      canonicalOnlyUntilConsumerAdoption: true,
    });
  }

  if (mappingProfileId) {
    return Object.freeze({
      datasetId,
      mappingProfileId,
      mode: PERIDOT_RUNTIME_COMPATIBILITY_MODES.UNRECOGNIZED_PROFILE,
      currentRuntimeProjectionAvailable: false,
      correspondenceAdapterUsed: false,
      genealogyProjectionUsed: false,
      universalDefinitionPresent,
      canonicalContentPresent,
      canonicalOnlyUntilConsumerAdoption: true,
    });
  }

  return Object.freeze({
    datasetId,
    mappingProfileId: '',
    mode: PERIDOT_RUNTIME_COMPATIBILITY_MODES.EMPTY_DATASET,
    currentRuntimeProjectionAvailable: false,
    correspondenceAdapterUsed: false,
    genealogyProjectionUsed: false,
    universalDefinitionPresent,
    canonicalContentPresent,
    canonicalOnlyUntilConsumerAdoption: true,
  });
}
