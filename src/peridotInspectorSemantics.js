/*
 * Generalized semantic model for Inspector person/place dossiers.
 *
 * This module sits on top of the shared record-structure reader. It does not
 * infer identity or relationships from display labels when canonical IDs are
 * available, and it does not reinterpret Source/Target compatibility fields as
 * the primary semantic model.
 */

import { buildPeridotEntityAttributedStructure, buildPeridotRecordStructure } from './peridotRecordStructure.js';
import { getRowPrimaryTemporalDisplay, getRowTemporalSortBounds } from './timelinePlaybackHelpers.js';

function asText(value) {
  return String(value ?? '').trim();
}

function comparable(value) {
  return asText(value).toLowerCase();
}

function sameEntity(entryLabel, entryId, entityLabel, entityId) {
  const selectedId = asText(entityId);
  const candidateId = asText(entryId);
  if (selectedId && candidateId) return selectedId === candidateId;
  return comparable(entryLabel) === comparable(entityLabel);
}

export function rowMatchesPeridotInspectorEntity(row = {}, options = {}) {
  const entityType = options.entityType === 'place' ? 'place' : 'person';
  const entityLabel = asText(options.entityLabel);
  const entityId = asText(options.entityId);
  if (!entityLabel && !entityId) return false;

  if (entityType === 'person') {
    const participants = buildPeridotRecordStructure(row).participants;
    const rowHasCanonicalIds = participants.some((participant) => asText(participant?.entityId));
    if (entityId && rowHasCanonicalIds) {
      return participants.some((participant) => asText(participant?.entityId) === entityId);
    }
    return participants.some((participant) => comparable(participant?.value) === comparable(entityLabel));
  }

  return buildPeridotRecordStructure(row).places
    .some((place) => comparable(place?.value) === comparable(entityLabel));
}

function rowIdentity(row, index) {
  return asText(row?.id || row?.recordId || row?.sourceRowId)
    || `row:${JSON.stringify(row?.generalizedObservation || row?.originalCanonicalItem || row || index)}`;
}

export function collectPeridotInspectorEntityRows(primaryRows = [], supplementalRows = [], options = {}) {
  const rows = [];
  const seen = new Set();
  [...(primaryRows || []), ...(supplementalRows || [])].forEach((row, index) => {
    if (!row || !rowMatchesPeridotInspectorEntity(row, options)) return;
    const key = rowIdentity(row, index);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  });
  return rows;
}

function addCount(groupMap, sectionTitle, itemLabel, entityId = '') {
  const title = asText(sectionTitle) || 'Related';
  const label = asText(itemLabel);
  if (!label) return;
  if (!groupMap.has(title)) groupMap.set(title, new Map());
  const itemMap = groupMap.get(title);
  const key = asText(entityId) || comparable(label);
  const existing = itemMap.get(key) || { label, entityId: asText(entityId), count: 0 };
  existing.count += 1;
  itemMap.set(key, existing);
}

function sectionsFromMap(groupMap) {
  return Array.from(groupMap.entries())
    .map(([title, itemMap]) => ({
      title,
      items: Array.from(itemMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }))
    .filter((section) => section.items.length)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function sectionItemCount(sections = []) {
  return sections.reduce((sum, section) => sum + (section.items?.length || 0), 0);
}

function getDateSpan(records = []) {
  let earliest = null;
  let latest = null;
  records.forEach((record) => {
    const bounds = getRowTemporalSortBounds(record);
    const label = asText(getRowPrimaryTemporalDisplay(record));
    if (Number.isFinite(bounds.start) && (!earliest || bounds.start < earliest.key)) earliest = { key: bounds.start, label };
    const latestKey = Number.isFinite(bounds.end) ? bounds.end : bounds.start;
    if (Number.isFinite(latestKey) && (!latest || latestKey > latest.key)) latest = { key: latestKey, label };
  });
  if (!earliest && !latest) return '';
  const first = earliest?.label || latest?.label || '';
  const last = latest?.label || earliest?.label || '';
  return first === last ? first : `${first}–${last}`;
}

function getDateCount(records = []) {
  return new Set(records.map((row) => asText(getRowPrimaryTemporalDisplay(row))).filter(Boolean)).size;
}

function directionToken(role) {
  const token = comparable(role).replace(/[_-]+/g, ' ');
  if (!token) return '';
  if (/\b(source|origin|originating|from|sent from|departure)\b/.test(token)) return 'source';
  if (/\b(target|destination|to|sent to|received at|arrival)\b/.test(token)) return 'target';
  return '';
}

function buildExplicitDirectedPlacePair(row) {
  const places = buildPeridotRecordStructure(row).places || [];
  const source = places.find((entry) => directionToken(entry?.label) === 'source');
  const target = places.find((entry) => directionToken(entry?.label) === 'target');
  if (!source || !target) return null;
  const sourceValue = asText(source.value);
  const targetValue = asText(target.value);
  if (!sourceValue || !targetValue || comparable(sourceValue) === 'unknown' || comparable(targetValue) === 'unknown') return null;
  return { source, target, label: `${sourceValue} → ${targetValue}` };
}

function entityOwnsPlaceAssociation(entry, entityLabel, entityId) {
  return sameEntity(entry?.subject, entry?.subjectId, entityLabel, entityId);
}

function buildRouteSections(rows, options) {
  const entityType = options.entityType === 'place' ? 'place' : 'person';
  const outgoing = new Map();
  const incoming = new Map();
  const connected = new Map();

  rows.forEach((row) => {
    const pair = buildExplicitDirectedPlacePair(row);
    if (!pair) return;

    if (entityType === 'place') {
      if (comparable(pair.source.value) === comparable(options.entityLabel)) addCount(outgoing, 'Outgoing directed pairs', pair.label);
      if (comparable(pair.target.value) === comparable(options.entityLabel)) addCount(incoming, 'Incoming directed pairs', pair.label);
      return;
    }

    if (entityOwnsPlaceAssociation(pair.source, options.entityLabel, options.entityId)
      || entityOwnsPlaceAssociation(pair.target, options.entityLabel, options.entityId)) {
      addCount(connected, 'Directed place pairs', pair.label);
    }
  });

  return entityType === 'place'
    ? [...sectionsFromMap(outgoing), ...sectionsFromMap(incoming)]
    : sectionsFromMap(connected);
}

export function buildPeridotInspectorEntityProfile(rows = [], options = {}) {
  const entityType = options.entityType === 'place' ? 'place' : 'person';
  const entityLabel = asText(options.entityLabel);
  const entityId = asText(options.entityId);
  const matchingRows = (rows || []).filter((row) => rowMatchesPeridotInspectorEntity(row, { entityType, entityLabel, entityId }));
  const structure = buildPeridotEntityAttributedStructure(matchingRows, {
    entityType,
    entityLabel,
    entityId,
    entityEvidence: options.entityEvidence || [],
  });

  const peopleGroups = new Map();
  const placeGroups = new Map();

  if (entityType === 'person') {
    structure.relationships.forEach((entry) => {
      addCount(peopleGroups, entry.label || 'Related people / entities', entry.counterpart || entry.value, entry.counterpartId || '');
    });
    structure.places.forEach((entry) => {
      addCount(placeGroups, entry.label || 'Associated place', entry.value);
    });
  } else {
    structure.participants.forEach((entry) => {
      addCount(peopleGroups, entry.label || 'Associated people / entities', entry.value, entry.entityId || '');
    });
  }

  const routeSections = buildRouteSections(matchingRows, { entityType, entityLabel, entityId });
  const relatedPeopleSections = sectionsFromMap(peopleGroups);
  const relatedPlacesSections = sectionsFromMap(placeGroups);

  return {
    entityType,
    entityLabel,
    entityId,
    matchingRows,
    structure,
    dateSpan: getDateSpan(matchingRows),
    dateCount: getDateCount(matchingRows),
    relatedPeopleSections,
    relatedPlacesSections,
    routeSections,
    relatedPeopleCount: sectionItemCount(relatedPeopleSections),
    relatedPlacesCount: sectionItemCount(relatedPlacesSections),
    routeCount: sectionItemCount(routeSections),
  };
}
