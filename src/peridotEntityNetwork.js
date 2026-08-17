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
  direction,
  relationshipType,
  relationshipLabel,
  sourceRole,
  targetRole,
  relationshipIdentity = '',
}) {
  if (relationshipIdentity) return `relationship:${relationshipIdentity}`;
  return [
    asText(source),
    asText(target),
    normalizeDirection(direction),
    asText(relationshipType),
    asText(relationshipLabel),
    asText(sourceRole),
    asText(targetRole),
  ].join('::');
}

function addLocation(locations, person, label, latitude, longitude, role = '', sourceRow = null) {
  const personLabel = asText(person);
  const placeLabel = asText(label);
  if (!personLabel || !validCoordinatePair(latitude, longitude)) return;
  locations.push({
    person: personLabel,
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
    );
    return locations;
  }

  addLocation(locations, row?.sourcePerson, row?.sourceLoc, row?.sourceLat, row?.sourceLon, row?.sourceRole, row);
  addLocation(locations, row?.targetPerson, row?.targetLoc, row?.targetLat, row?.targetLon, row?.targetRole, row);
  return locations;
}

/**
 * Convert the currently visible row scope into layout-neutral entity-network
 * semantics. This function intentionally does not infer relationships from
 * arbitrary row co-occurrence.
 */
export function derivePeridotEntityNetworkSemantics(rows = []) {
  const relationshipMap = new Map();
  const locations = [];

  (Array.isArray(rows) ? rows : []).forEach((row = {}, rowIndex) => {
    locations.push(...locationsFromRow(row));

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
      const date = asText(draft.sourceRow?.date || draft.sourceRow?.Date || draft.sourceRow?.parsedDate?.raw);
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

export const PERIDOT_ENTITY_NETWORK_DIRECTIONS = Object.freeze({
  DIRECTED,
  UNDIRECTED,
});
