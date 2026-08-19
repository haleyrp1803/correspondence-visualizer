/*
 * Canonical/generalized entity-network derivation.
 *
 * Network semantics contract:
 * - edges are created only from relationships explicitly asserted by mapped data;
 * - generalized multipart mappings connect Part A to each additional mapped part;
 * - mere co-occurrence never creates an edge;
 * - direction is preserved only when the source data/model explicitly provides it;
 * - distinct relationship semantics remain distinct even when endpoints match;
 * - repeated observations of the same semantic relationship may aggregate as count.
 *
 * Layout is deliberately out of scope. App.jsx feeds this semantic graph into
 * geographic or force-directed layout after derivation.
 */

import { getRowPrimaryTemporalDisplay } from './timelinePlaybackHelpers.js';

const DIRECTED = 'directed';
const UNDIRECTED = 'undirected';
const TYPED_INVERSE = 'typed-inverse';

function asText(value) {
  return String(value ?? '').trim();
}

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validCoordinatePair(latitude, longitude) {
  const lat = asFiniteNumber(latitude);
  const lon = asFiniteNumber(longitude);
  return lat !== null && lon !== null && !(lat === 0 && lon === 0);
}

function normalizeDirection(value, fallback = UNDIRECTED) {
  const normalized = asText(value).toLowerCase();
  if (normalized === DIRECTED || normalized === TYPED_INVERSE) return DIRECTED;
  if (normalized === UNDIRECTED) return UNDIRECTED;
  return fallback;
}

function semanticRelationshipKey({
  source,
  target,
  sourceId,
  targetId,
  direction,
  relationshipType,
  relationshipLabel,
  sourceRole,
  targetRole,
  relationshipIdentity = '',
}) {
  if (relationshipIdentity) return `relationship:${relationshipIdentity}`;
  return [
    asText(sourceId) || asText(source),
    asText(targetId) || asText(target),
    normalizeDirection(direction),
    asText(relationshipType),
    asText(relationshipLabel),
    asText(sourceRole),
    asText(targetRole),
  ].join('::');
}

function addLocation(locations, person, label, latitude, longitude, role = '', sourceRow = null, personId = '') {
  const personLabel = asText(person);
  const placeLabel = asText(label);
  if (!personLabel || !validCoordinatePair(latitude, longitude)) return;
  locations.push({
    person: personLabel,
    personId: asText(personId),
    label: placeLabel,
    latitude: Number(latitude),
    longitude: Number(longitude),
    role: asText(role),
    sourceRow,
  });
}

function generalizedRelationshipsFromRow(row, rowIndex) {
  const observation = row?.generalizedObservation;
  const participants = Array.isArray(observation?.participants)
    ? observation.participants.filter((participant) => asText(participant?.value))
    : [];
  if (participants.length < 2) return [];

  const relationship = observation?.relationship || {};
  const direction = normalizeDirection(relationship.direction, UNDIRECTED);
  const relationshipType = asText(relationship.type);
  const relationshipLabel = asText(relationship.label);
  const focal = participants[0];

  return participants.slice(1).map((participant, index) => ({
    source: asText(focal.value),
    target: asText(participant.value),
    sourceId: asText(focal.entityId || focal.canonicalEntityId || focal.id),
    targetId: asText(participant.entityId || participant.canonicalEntityId || participant.id),
    direction,
    relationshipType,
    relationshipLabel,
    sourceRole: asText(focal.role),
    targetRole: asText(participant.role),
    relationshipIdentity: '',
    sourceRow: row,
    rowIndex,
    participantPair: [0, index + 1],
    semanticSource: 'generalized-mapped-relationship',
  }));
}

function canonicalRelationshipFromRow(row, rowIndex) {
  const canonical = row?.originalCanonicalItem;
  if (!canonical?.participantAId || !canonical?.participantBId) return null;
  const source = asText(row.sourcePerson || row.source || canonical.participantAId);
  const target = asText(row.targetPerson || row.target || canonical.participantBId);
  if (!source || !target) return null;

  return {
    source,
    target,
    sourceId: asText(row.sourceEntityId || canonical.participantAId),
    targetId: asText(row.targetEntityId || canonical.participantBId),
    direction: normalizeDirection(canonical.direction || row.relationshipDirection, UNDIRECTED),
    relationshipType: asText(canonical.relationshipType || row.relationshipType || row.relationship),
    relationshipLabel: asText(canonical.label),
    sourceRole: asText(canonical.participantARole || row.sourceRole),
    targetRole: asText(canonical.participantBRole || row.targetRole),
    relationshipIdentity: asText(canonical.id || row.id),
    sourceRow: row,
    rowIndex,
    semanticSource: 'canonical-relationship',
  };
}

function legacyRelationshipFromRow(row, rowIndex) {
  const source = asText(row?.sourcePerson);
  const target = asText(row?.targetPerson);
  if (!source || !target) return null;
  return {
    source,
    target,
    sourceId: asText(row.sourceEntityId),
    targetId: asText(row.targetEntityId),
    direction: normalizeDirection(row.relationshipDirection, DIRECTED),
    relationshipType: asText(row.relationshipType || row.relationship),
    relationshipLabel: '',
    sourceRole: asText(row.sourceRole || 'source'),
    targetRole: asText(row.targetRole || 'target'),
    relationshipIdentity: '',
    sourceRow: row,
    rowIndex,
    semanticSource: 'legacy-directed-record',
  };
}

function locationsFromRow(row) {
  const locations = [];
  const observation = row?.generalizedObservation;

  if (observation) {
    const participants = Array.isArray(observation.participants) ? observation.participants : [];
    (observation.places || []).forEach((place) => {
      if (!Number.isInteger(place?.subjectParticipantIndex)) return;
      const participant = participants[place.subjectParticipantIndex];
      if (!participant) return;
      addLocation(
        locations,
        participant.value,
        place.label,
        place.latitude,
        place.longitude,
        place.role,
        row,
        participant.entityId || participant.canonicalEntityId || participant.id || '',
      );
    });
    return locations;
  }

  // Genealogy event projections carry a single person and place without an edge.
  if (asText(row?.recordType) === 'genealogy-event') {
    addLocation(
      locations,
      row.sourcePerson || row.person || row.entity,
      row.sourceLoc || row.location,
      row.sourceLat,
      row.sourceLon,
      row.eventType,
      row,
      row.entityId || row.personEntityId || row.sourceEntityId || '',
    );
    return locations;
  }

  addLocation(locations, row?.sourcePerson, row?.sourceLoc, row?.sourceLat, row?.sourceLon, row?.sourceRole, row, row?.sourceEntityId);
  addLocation(locations, row?.targetPerson, row?.targetLoc, row?.targetLat, row?.targetLon, row?.targetRole, row, row?.targetEntityId);
  return locations;
}

/**
 * Convert the currently visible row scope into layout-neutral entity-network
 * semantics. This function intentionally does not infer relationships from
 * arbitrary row co-occurrence.
 */
export function derivePeridotEntityNetworkSemantics(rows = [], options = {}) {
  const relationshipMap = new Map();
  const locations = [];
  const defaultRows = Array.isArray(rows) ? rows : [];
  const relationshipRows = Array.isArray(options.relationshipRows) ? options.relationshipRows : defaultRows;
  const locationRows = Array.isArray(options.locationRows) ? options.locationRows : defaultRows;

  // Geographic person/entity views sometimes need two related scopes:
  // structural relationship rows may be undated (for example genealogy parent/partner
  // assertions), while participant place/event rows are date-bearing and should follow
  // the active Timeline/playback scope. Keeping the inputs separate preserves explicit
  // relationship semantics without inventing dates for structural relationships.
  locationRows.forEach((row = {}) => {
    locations.push(...locationsFromRow(row));
  });

  relationshipRows.forEach((row = {}, rowIndex) => {
    let relationshipDrafts = [];
    if (row?.generalizedObservation) {
      relationshipDrafts = generalizedRelationshipsFromRow(row, rowIndex);
    } else {
      const canonical = canonicalRelationshipFromRow(row, rowIndex);
      const legacy = canonical || legacyRelationshipFromRow(row, rowIndex);
      relationshipDrafts = legacy ? [legacy] : [];
    }

    relationshipDrafts.forEach((draft) => {
      if (!draft.source || !draft.target) return;
      const key = semanticRelationshipKey(draft);
      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, {
          id: `entity-edge:${key}`,
          source: draft.source,
          target: draft.target,
          sourceId: draft.sourceId || '',
          targetId: draft.targetId || '',
          direction: draft.direction,
          relationshipType: draft.relationshipType,
          relationshipLabel: draft.relationshipLabel,
          sourceRole: draft.sourceRole,
          targetRole: draft.targetRole,
          semanticSource: draft.semanticSource,
          count: 0,
          dates: new Set(),
          rows: [],
        });
      }
      const edge = relationshipMap.get(key);
      edge.count += 1;
      edge.rows.push(draft.sourceRow);
      const date = asText(getRowPrimaryTemporalDisplay(draft.sourceRow));
      if (date) edge.dates.add(date);
    });
  });

  return {
    relationships: Array.from(relationshipMap.values()).map((relationship) => ({
      ...relationship,
      dates: Array.from(relationship.dates),
    })),
    locations,
  };
}

/**
 * Geographic entity networks intentionally separate relationship structure
 * from currently visible participant-place assertions. This is especially
 * important for genealogy, where canonical family relationships are structural
 * rows while birth/death event rows carry the geographic anchors.
 */
export function derivePeridotGeographicEntityNetworkSemantics(relationshipRows = [], locationRows = []) {
  return derivePeridotEntityNetworkSemantics(relationshipRows, {
    relationshipRows,
    locationRows,
  });
}

/**
 * Resolve one runtime row through the same relationship semantics used by the
 * People and Force-Directed network builders. Search, Inspector, playback, and
 * other consumers should use this boundary instead of reinterpreting
 * sourcePerson/targetPerson independently.
 */
export function getPeridotRowEntityRelationships(row = {}) {
  if (row?.generalizedObservation) {
    return generalizedRelationshipsFromRow(row, 0);
  }
  const canonical = canonicalRelationshipFromRow(row, 0);
  const legacy = canonical || legacyRelationshipFromRow(row, 0);
  return legacy ? [legacy] : [];
}

export function getPeridotRowEntityParticipantEntries(row = {}) {
  const participants = new Map();
  const addParticipant = (label, id = '', role = '') => {
    const normalizedLabel = asText(label);
    const normalizedId = asText(id);
    if (!normalizedLabel && !normalizedId) return;
    const key = normalizedId ? `id:${normalizedId}` : `label:${normalizedLabel}`;
    if (!participants.has(key)) {
      participants.set(key, {
        id: normalizedId,
        label: normalizedLabel || normalizedId,
        role: asText(role),
      });
    }
  };

  getPeridotRowEntityRelationships(row).forEach((relationship) => {
    addParticipant(relationship.source, relationship.sourceId, relationship.sourceRole);
    addParticipant(relationship.target, relationship.targetId, relationship.targetRole);
  });

  // A row may carry a person/entity without asserting an edge (for example a
  // genealogy event). Preserve its canonical identity when available without
  // inventing a relationship.
  if (!participants.size) {
    addParticipant(
      row?.person || row?.entity || row?.sourcePerson,
      row?.personEntityId || row?.entityId || row?.sourceEntityId,
      row?.eventType || row?.sourceRole,
    );
    addParticipant(row?.targetPerson, row?.targetEntityId, row?.targetRole);
  }

  return Array.from(participants.values());
}

export function getPeridotRowEntityParticipants(row = {}) {
  return getPeridotRowEntityParticipantEntries(row).map((participant) => participant.label);
}

export function formatPeridotEntityRelationshipLabel(relationship = {}) {
  const source = asText(relationship.source);
  const target = asText(relationship.target);
  if (!source && !target) return '';
  if (!target) return source;
  const connector = normalizeDirection(relationship.direction) === DIRECTED ? '→' : '—';
  return `${source} ${connector} ${target}`;
}

export function getPeridotRowEntityRelationshipLabels(row = {}) {
  return getPeridotRowEntityRelationships(row)
    .map(formatPeridotEntityRelationshipLabel)
    .filter(Boolean);
}

export function rowHasPeridotEntityRelationship(row = {}) {
  return getPeridotRowEntityRelationships(row).length > 0;
}

export const PERIDOT_ENTITY_NETWORK_DIRECTIONS = Object.freeze({
  DIRECTED,
  UNDIRECTED,
});
