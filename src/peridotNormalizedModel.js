/*
 * Canonical normalized research model for Peridot.
 *
 * Pass 2A provides pure serializable constructors and stable ID helpers only.
 * It is intentionally not wired into App.jsx or the current import pipeline.
 */

import { makePeridotProvenance } from './peridotNormalizationProvenance.js';
import { makePeridotTemporalAssertion } from './peridotTemporalAssertions.js';
import { makePeridotSavedVariables, makePeridotUniversalMappingDefinition } from './peridotUniversalMappingModel.js';
import { makePeridotSourceManifest } from './peridotSourceModel.js';

export const PERIDOT_NORMALIZED_SCHEMA_VERSION = '1.3.0-draft';

export const PERIDOT_NORMALIZED_COLLECTIONS = Object.freeze([
  'entities',
  'places',
  'records',
  'events',
  'relationships',
  'participations',
  'evidenceSources',
  'assertions',
]);

export const PERIDOT_ENTITY_TYPES = Object.freeze({
  AGENT: 'agent',
  OBJECT: 'object',
  CUSTOM: 'custom',
});

export const PERIDOT_TARGET_TYPES = Object.freeze({
  RECORD: 'record',
  EVENT: 'event',
});

export const PERIDOT_RELATIONSHIP_DIRECTIONS = Object.freeze({
  DIRECTED: 'directed',
  UNDIRECTED: 'undirected',
  TYPED_INVERSE: 'typed-inverse',
});

function asText(value) {
  return String(value ?? '').trim();
}

function asArray(value) {
  return Object.freeze((Array.isArray(value) ? value : []).filter((item) => item !== undefined && item !== null));
}

function asTextArray(value) {
  return Object.freeze((Array.isArray(value) ? value : []).map(asText).filter(Boolean));
}

function asObject(value) {
  return Object.freeze(value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {});
}

function makeTemporalAssertionArray(values = [], fallback = null) {
  const source = Array.isArray(values) && values.length ? values : (fallback ? [fallback] : []);
  return Object.freeze(source.filter(Boolean).map((value) => makePeridotTemporalAssertion(value)));
}

function makeBaseItem({ id, label = '', attributes = {}, provenance = {} } = {}) {
  return {
    id: asText(id),
    label: asText(label),
    attributes: asObject(attributes),
    provenance: makePeridotProvenance(provenance),
  };
}

export function slugifyPeridotIdPart(value) {
  return asText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function makePeridotCanonicalId({ itemType, datasetId, sourceId = '', sourceSheet = '', sourceRowNumber = null, role = '' } = {}) {
  const type = slugifyPeridotIdPart(itemType);
  const dataset = slugifyPeridotIdPart(datasetId);
  if (asText(sourceId)) return `${type}:${dataset}:${asText(sourceId)}`;
  const sheet = slugifyPeridotIdPart(sourceSheet || 'table');
  const row = Number.isInteger(Number(sourceRowNumber)) && Number(sourceRowNumber) > 0 ? `row-${Number(sourceRowNumber)}` : 'row-unknown';
  const rolePart = role ? `:${slugifyPeridotIdPart(role)}` : '';
  return `${type}:${dataset}:${sheet}:${row}${rolePart}`;
}

export function makePeridotEntity({
  id,
  entityType = PERIDOT_ENTITY_TYPES.CUSTOM,
  subtype = '',
  label = '',
  alternateLabels = [],
  attributes = {},
  externalIdentifiers = {},
  image = null,
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label, attributes, provenance }),
    entityType: Object.values(PERIDOT_ENTITY_TYPES).includes(entityType) ? entityType : PERIDOT_ENTITY_TYPES.CUSTOM,
    subtype: asText(subtype),
    alternateLabels: asTextArray(alternateLabels),
    externalIdentifiers: asObject(externalIdentifiers),
    image: image ? Object.freeze({ ...image }) : null,
  });
}

export function makePeridotPlace({
  id,
  label = '',
  alternateLabels = [],
  placeType = '',
  latitude = null,
  longitude = null,
  geometry = null,
  parentPlaceId = '',
  jurisdictionIds = [],
  attributes = {},
  provenance = {},
} = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Object.freeze({
    ...makeBaseItem({ id, label, attributes, provenance }),
    alternateLabels: asTextArray(alternateLabels),
    placeType: asText(placeType),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    geometry: geometry && typeof geometry === 'object' ? Object.freeze({ ...geometry }) : null,
    parentPlaceId: asText(parentPlaceId),
    jurisdictionIds: asTextArray(jurisdictionIds),
  });
}

export function makePeridotRecord({
  id,
  recordType = 'record',
  label = '',
  temporalAssertion = null,
  temporalAssertions = [],
  participantIds = [],
  placeReferenceIds = [],
  attributes = {},
  evidenceSourceIds = [],
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label, attributes, provenance }),
    recordType: asText(recordType) || 'record',
    temporalAssertion: temporalAssertion ? makePeridotTemporalAssertion(temporalAssertion) : (temporalAssertions?.[0] ? makePeridotTemporalAssertion(temporalAssertions[0]) : null),
    temporalAssertions: makeTemporalAssertionArray(temporalAssertions, temporalAssertion),
    participantIds: asTextArray(participantIds),
    placeReferenceIds: asTextArray(placeReferenceIds),
    evidenceSourceIds: asTextArray(evidenceSourceIds),
  });
}

export function makePeridotEvent({
  id,
  eventType,
  label = '',
  temporalAssertion = null,
  temporalAssertions = [],
  participantIds = [],
  placeReferenceIds = [],
  attributes = {},
  evidenceSourceIds = [],
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label, attributes, provenance }),
    eventType: asText(eventType),
    temporalAssertion: temporalAssertion ? makePeridotTemporalAssertion(temporalAssertion) : (temporalAssertions?.[0] ? makePeridotTemporalAssertion(temporalAssertions[0]) : null),
    temporalAssertions: makeTemporalAssertionArray(temporalAssertions, temporalAssertion),
    participantIds: asTextArray(participantIds),
    placeReferenceIds: asTextArray(placeReferenceIds),
    evidenceSourceIds: asTextArray(evidenceSourceIds),
  });
}

export function makePeridotRelationship({
  id,
  relationshipType,
  direction = PERIDOT_RELATIONSHIP_DIRECTIONS.UNDIRECTED,
  participantAId,
  participantBId,
  participantARole = '',
  participantBRole = '',
  temporalAssertion = null,
  temporalAssertions = [],
  attributes = {},
  evidenceSourceIds = [],
  provenance = {},
  derivation = null,
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label: relationshipType, attributes, provenance }),
    relationshipType: asText(relationshipType),
    direction: Object.values(PERIDOT_RELATIONSHIP_DIRECTIONS).includes(direction) ? direction : PERIDOT_RELATIONSHIP_DIRECTIONS.UNDIRECTED,
    participantAId: asText(participantAId),
    participantBId: asText(participantBId),
    participantARole: asText(participantARole),
    participantBRole: asText(participantBRole),
    temporalAssertion: temporalAssertion ? makePeridotTemporalAssertion(temporalAssertion) : (temporalAssertions?.[0] ? makePeridotTemporalAssertion(temporalAssertions[0]) : null),
    temporalAssertions: makeTemporalAssertionArray(temporalAssertions, temporalAssertion),
    evidenceSourceIds: asTextArray(evidenceSourceIds),
    derivation: derivation && typeof derivation === 'object' ? Object.freeze({ ...derivation }) : null,
  });
}

export function makePeridotParticipation({
  id,
  subjectId,
  targetType,
  targetId,
  role,
  temporalAssertion = null,
  temporalAssertions = [],
  attributes = {},
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label: role, attributes, provenance }),
    subjectId: asText(subjectId),
    targetType: Object.values(PERIDOT_TARGET_TYPES).includes(targetType) ? targetType : asText(targetType),
    targetId: asText(targetId),
    role: asText(role),
    temporalAssertion: temporalAssertion ? makePeridotTemporalAssertion(temporalAssertion) : (temporalAssertions?.[0] ? makePeridotTemporalAssertion(temporalAssertions[0]) : null),
    temporalAssertions: makeTemporalAssertionArray(temporalAssertions, temporalAssertion),
  });
}

export function makePeridotEvidenceSource({
  id,
  sourceType = 'source',
  citation = '',
  archive = '',
  collection = '',
  shelfmark = '',
  pages = '',
  url = '',
  notes = '',
  attributes = {},
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label: citation || shelfmark || sourceType, attributes, provenance }),
    sourceType: asText(sourceType) || 'source',
    citation: asText(citation),
    archive: asText(archive),
    collection: asText(collection),
    shelfmark: asText(shelfmark),
    pages: asText(pages),
    url: asText(url),
    notes: asText(notes),
  });
}

export function makePeridotAssertion({
  id,
  subjectId,
  predicate,
  value = null,
  objectId = '',
  evidenceSourceIds = [],
  temporalAssertion = null,
  temporalAssertions = [],
  attributes = {},
  provenance = {},
} = {}) {
  return Object.freeze({
    ...makeBaseItem({ id, label: predicate, attributes, provenance }),
    subjectId: asText(subjectId),
    predicate: asText(predicate),
    value,
    objectId: asText(objectId),
    evidenceSourceIds: asTextArray(evidenceSourceIds),
    temporalAssertion: temporalAssertion ? makePeridotTemporalAssertion(temporalAssertion) : (temporalAssertions?.[0] ? makePeridotTemporalAssertion(temporalAssertions[0]) : null),
    temporalAssertions: makeTemporalAssertionArray(temporalAssertions, temporalAssertion),
  });
}

export function makePeridotNormalizedDataset({
  datasetId,
  datasetLabel = '',
  importedAt = '',
  sourceManifest = {},
  mappingProfile = {},
  variableDefinitions = [],
  universalMapping = {},
  entities = [],
  places = [],
  records = [],
  events = [],
  relationships = [],
  participations = [],
  evidenceSources = [],
  assertions = [],
  validation = {},
  capabilities = {},
} = {}) {
  const collections = { entities, places, records, events, relationships, participations, evidenceSources, assertions };
  return Object.freeze({
    schemaVersion: PERIDOT_NORMALIZED_SCHEMA_VERSION,
    datasetId: asText(datasetId),
    datasetLabel: asText(datasetLabel),
    importedAt: asText(importedAt),
    sourceManifest: makePeridotSourceManifest(sourceManifest),
    mappingProfile: asObject(mappingProfile),
    variableDefinitions: makePeridotSavedVariables(variableDefinitions),
    universalMapping: makePeridotUniversalMappingDefinition(universalMapping),
    ...Object.fromEntries(PERIDOT_NORMALIZED_COLLECTIONS.map((name) => [name, asArray(collections[name])])),
    validation: asObject(validation),
    capabilities: asObject(capabilities),
  });
}
