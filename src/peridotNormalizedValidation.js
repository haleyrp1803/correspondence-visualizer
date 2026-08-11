/*
 * Structural validation for the canonical Peridot normalized model.
 *
 * Validation is pure and non-mutating. It reports structural integrity and
 * referential problems without silently repairing source-derived assertions.
 */

import {
  PERIDOT_NORMALIZED_COLLECTIONS,
  PERIDOT_RELATIONSHIP_DIRECTIONS,
  PERIDOT_TARGET_TYPES,
} from './peridotNormalizedModel.js';
import { hasPeridotSourceReference } from './peridotNormalizationProvenance.js';

export const PERIDOT_VALIDATION_SEVERITY = Object.freeze({
  BLOCKING: 'blocking',
  ERROR: 'error',
  WARNING: 'warning',
  INFORMATION: 'information',
});

function asText(value) {
  return String(value ?? '').trim();
}

function issue({ severity, code, message, collection = '', itemId = '', relatedIds = [] }) {
  return Object.freeze({
    severity,
    code: asText(code),
    message: asText(message),
    collection: asText(collection),
    itemId: asText(itemId),
    relatedIds: Object.freeze((Array.isArray(relatedIds) ? relatedIds : []).map(asText).filter(Boolean)),
  });
}

function collectIds(dataset) {
  const byCollection = {};
  const all = new Map();
  PERIDOT_NORMALIZED_COLLECTIONS.forEach((collection) => {
    byCollection[collection] = new Map();
    (dataset?.[collection] || []).forEach((item, index) => {
      const id = asText(item?.id);
      if (!id) return;
      if (!byCollection[collection].has(id)) byCollection[collection].set(id, []);
      byCollection[collection].get(id).push(index);
      if (!all.has(id)) all.set(id, []);
      all.get(id).push({ collection, index });
    });
  });
  return { byCollection, all };
}

function validateItemBasics(dataset, ids, issues) {
  PERIDOT_NORMALIZED_COLLECTIONS.forEach((collection) => {
    (dataset?.[collection] || []).forEach((item, index) => {
      const id = asText(item?.id);
      if (!id) {
        issues.push(issue({
          severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING,
          code: 'missing_id',
          collection,
          message: `${collection}[${index}] is missing a stable ID.`,
        }));
      }
      if (id && ids.byCollection[collection].get(id)?.length > 1) {
        issues.push(issue({
          severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING,
          code: 'duplicate_id',
          collection,
          itemId: id,
          message: `ID “${id}” appears more than once in ${collection}.`,
        }));
      }
      if (!hasPeridotSourceReference(item?.provenance)) {
        issues.push(issue({
          severity: PERIDOT_VALIDATION_SEVERITY.WARNING,
          code: 'missing_provenance',
          collection,
          itemId: id,
          message: `Normalized item “${id || `${collection}[${index}]`}” has no source reference.`,
        }));
      }
    });
  });

  ids.all.forEach((locations, id) => {
    const collections = new Set(locations.map((location) => location.collection));
    if (collections.size > 1) {
      issues.push(issue({
        severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING,
        code: 'cross_collection_id_collision',
        itemId: id,
        relatedIds: Array.from(collections),
        message: `ID “${id}” is reused across multiple normalized collections.`,
      }));
    }
  });
}

function exists(ids, collection, id) {
  return Boolean(asText(id) && ids.byCollection[collection]?.has(asText(id)));
}

function validateCoordinates(dataset, issues) {
  (dataset?.places || []).forEach((place) => {
    const hasLat = place.latitude !== null && place.latitude !== undefined;
    const hasLon = place.longitude !== null && place.longitude !== undefined;
    if (hasLat !== hasLon) {
      issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'incomplete_coordinates', collection: 'places', itemId: place.id, message: `Place “${place.id}” has only one coordinate value.` }));
    }
    if (hasLat && (Number(place.latitude) < -90 || Number(place.latitude) > 90)) {
      issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'invalid_latitude', collection: 'places', itemId: place.id, message: `Place “${place.id}” has latitude outside -90 to 90.` }));
    }
    if (hasLon && (Number(place.longitude) < -180 || Number(place.longitude) > 180)) {
      issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'invalid_longitude', collection: 'places', itemId: place.id, message: `Place “${place.id}” has longitude outside -180 to 180.` }));
    }
  });
}

function validateReferences(dataset, ids, issues) {
  const entityExists = (id) => exists(ids, 'entities', id);
  const placeExists = (id) => exists(ids, 'places', id);
  const evidenceExists = (id) => exists(ids, 'evidenceSources', id);

  for (const record of dataset?.records || []) {
    record.participantIds?.forEach((id) => {
      if (!entityExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_record_participant', collection: 'records', itemId: record.id, relatedIds: [id], message: `Record “${record.id}” references missing entity “${id}”.` }));
    });
    record.placeReferenceIds?.forEach((id) => {
      if (!placeExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_record_place', collection: 'records', itemId: record.id, relatedIds: [id], message: `Record “${record.id}” references missing place “${id}”.` }));
    });
    record.evidenceSourceIds?.forEach((id) => {
      if (!evidenceExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_record_evidence', collection: 'records', itemId: record.id, relatedIds: [id], message: `Record “${record.id}” references missing evidence source “${id}”.` }));
    });
  }

  for (const event of dataset?.events || []) {
    if (!asText(event.eventType)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'missing_event_type', collection: 'events', itemId: event.id, message: `Event “${event.id}” has no event type.` }));
    event.participantIds?.forEach((id) => {
      if (!entityExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_event_participant', collection: 'events', itemId: event.id, relatedIds: [id], message: `Event “${event.id}” references missing entity “${id}”.` }));
    });
    event.placeReferenceIds?.forEach((id) => {
      if (!placeExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_event_place', collection: 'events', itemId: event.id, relatedIds: [id], message: `Event “${event.id}” references missing place “${id}”.` }));
    });
  }

  for (const relationship of dataset?.relationships || []) {
    if (!asText(relationship.relationshipType)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'missing_relationship_type', collection: 'relationships', itemId: relationship.id, message: `Relationship “${relationship.id}” has no type.` }));
    if (!Object.values(PERIDOT_RELATIONSHIP_DIRECTIONS).includes(relationship.direction)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'invalid_relationship_direction', collection: 'relationships', itemId: relationship.id, message: `Relationship “${relationship.id}” has an unsupported direction.` }));
    if (!entityExists(relationship.participantAId) || !entityExists(relationship.participantBId)) {
      issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_relationship_participant', collection: 'relationships', itemId: relationship.id, relatedIds: [relationship.participantAId, relationship.participantBId], message: `Relationship “${relationship.id}” references one or more missing entities.` }));
    }
    if (asText(relationship.participantAId) && relationship.participantAId === relationship.participantBId) {
      issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.WARNING, code: 'self_relationship', collection: 'relationships', itemId: relationship.id, message: `Relationship “${relationship.id}” connects an entity to itself.` }));
    }
  }

  for (const participation of dataset?.participations || []) {
    if (!entityExists(participation.subjectId)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_participation_subject', collection: 'participations', itemId: participation.id, relatedIds: [participation.subjectId], message: `Participation “${participation.id}” references missing entity “${participation.subjectId}”.` }));
    const targetCollection = participation.targetType === PERIDOT_TARGET_TYPES.EVENT ? 'events' : participation.targetType === PERIDOT_TARGET_TYPES.RECORD ? 'records' : '';
    if (!targetCollection || !exists(ids, targetCollection, participation.targetId)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_participation_target', collection: 'participations', itemId: participation.id, relatedIds: [participation.targetId], message: `Participation “${participation.id}” has an unsupported or unresolved target.` }));
    if (!asText(participation.role)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.WARNING, code: 'missing_participation_role', collection: 'participations', itemId: participation.id, message: `Participation “${participation.id}” has no typed role.` }));
  }

  for (const assertion of dataset?.assertions || []) {
    if (!ids.all.has(asText(assertion.subjectId))) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_assertion_subject', collection: 'assertions', itemId: assertion.id, relatedIds: [assertion.subjectId], message: `Assertion “${assertion.id}” references missing subject “${assertion.subjectId}”.` }));
    if (assertion.objectId && !ids.all.has(asText(assertion.objectId))) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_assertion_object', collection: 'assertions', itemId: assertion.id, relatedIds: [assertion.objectId], message: `Assertion “${assertion.id}” references missing object “${assertion.objectId}”.` }));
    assertion.evidenceSourceIds?.forEach((id) => {
      if (!evidenceExists(id)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.ERROR, code: 'unresolved_assertion_evidence', collection: 'assertions', itemId: assertion.id, relatedIds: [id], message: `Assertion “${assertion.id}” references missing evidence source “${id}”.` }));
    });
  }
}

function validateTemporalAssertions(dataset, issues) {
  const collections = ['records', 'events', 'relationships', 'participations', 'assertions'];
  collections.forEach((collection) => {
    (dataset?.[collection] || []).forEach((item) => {
      const temporals = Array.isArray(item.temporalAssertions) && item.temporalAssertions.length
        ? item.temporalAssertions
        : (item.temporalAssertion ? [item.temporalAssertion] : []);
      temporals.forEach((temporal, temporalIndex) => {
        if (!temporal) return;
        if (temporal.consistency === 'backwards') {
          issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.WARNING, code: 'reversed_temporal_range', collection, itemId: item.id, message: `Item “${item.id}” has a temporal assertion whose source start occurs after its end. Peridot preserved the source order and marked the interval unsafe for ordinary interval visualization.` }));
        }
        temporal.parseWarnings?.forEach((warning) => issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.WARNING, code: 'temporal_parse_warning', collection, itemId: item.id, message: temporal.role ? `${temporal.role}: ${warning}` : warning })));
        if (temporal.parsingStatus === 'unrecognized') {
          issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.WARNING, code: 'temporal_unrecognized', collection, itemId: item.id, message: `${temporal.role || `Temporal value ${temporalIndex + 1}`} was preserved but could not be positioned on a calendar safely.` }));
        }
      });
    });
  });
}

export function validatePeridotNormalizedDataset(dataset = {}) {
  const issues = [];
  if (!asText(dataset.datasetId)) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING, code: 'missing_dataset_id', message: 'Normalized dataset is missing datasetId.' }));
  PERIDOT_NORMALIZED_COLLECTIONS.forEach((collection) => {
    if (!Array.isArray(dataset?.[collection])) issues.push(issue({ severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING, code: 'missing_collection', collection, message: `Normalized dataset collection “${collection}” is missing or is not an array.` }));
  });

  const ids = collectIds(dataset);
  validateItemBasics(dataset, ids, issues);
  validateCoordinates(dataset, issues);
  validateReferences(dataset, ids, issues);
  validateTemporalAssertions(dataset, issues);

  const counts = Object.fromEntries(Object.values(PERIDOT_VALIDATION_SEVERITY).map((severity) => [severity, issues.filter((item) => item.severity === severity).length]));
  return Object.freeze({
    valid: counts.blocking === 0 && counts.error === 0,
    canCommit: counts.blocking === 0,
    counts: Object.freeze(counts),
    issues: Object.freeze(issues),
  });
}
