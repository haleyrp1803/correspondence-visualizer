/*
 * Shared record-structure reader for Search and Inspector.
 *
 * This module makes the user's mapped structure legible without asking each UI
 * surface to reinterpret legacy Source/Target fields independently. It prefers
 * generalized/canonical structures and uses compatibility-shaped row fields only
 * when richer mapped structure is not available.
 */

import { getPeridotRowEntityParticipantEntries, getPeridotRowEntityParticipants, getPeridotRowEntityRelationships } from './peridotEntityNetwork.js';
import { getRowTemporalAssertions } from './timelinePlaybackHelpers.js';

function asText(value) {
  return String(value ?? '').trim();
}

function uniqueEntries(entries = [], keyBuilder = (entry) => JSON.stringify(entry)) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry) return false;
    const key = keyBuilder(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function participantForMappedIndex(participants, index) {
  if (!Number.isInteger(index)) return null;
  return (participants || []).find((participant) => participant?.participantIndex === index) || null;
}

function participantLabel(participants, index) {
  return asText(participantForMappedIndex(participants, index)?.value);
}

function participantEntityId(participants, index) {
  return asText(participantForMappedIndex(participants, index)?.entityId);
}

function buildParticipants(row, observation) {
  const generalized = Array.isArray(observation?.participants)
    ? observation.participants.map((participant, index) => ({
      label: asText(participant?.role) || `Participant ${index + 1}`,
      value: asText(participant?.value),
      entityId: asText(participant?.entityId || participant?.canonicalEntityId || participant?.id),
      participantIndex: Number.isInteger(participant?.index) ? participant.index : index,
    })).filter((entry) => entry.value)
    : [];
  if (generalized.length) return generalized;

  const relationships = getPeridotRowEntityRelationships(row);
  if (relationships.length) {
    const entries = [];
    relationships.forEach((relationship) => {
      if (asText(relationship.source)) entries.push({
        label: asText(relationship.sourceRole) || 'Participant A',
        value: asText(relationship.source),
        entityId: asText(relationship.sourceId),
        participantIndex: null,
      });
      if (asText(relationship.target)) entries.push({
        label: asText(relationship.targetRole) || 'Participant B',
        value: asText(relationship.target),
        entityId: asText(relationship.targetId),
        participantIndex: null,
      });
    });
    return uniqueEntries(entries, (entry) => `${entry.label}::${entry.value}`);
  }

  const participants = getPeridotRowEntityParticipantEntries(row);
  return participants.map((participant, index) => ({
    label: asText(participant.role) || (index === 0 ? 'Person / entity' : `Related entity ${index}`),
    value: participant.label,
    entityId: participant.id,
    participantIndex: null,
  }));
}

function buildTemporalEntries(row, participants, observation) {
  const canonicalAssertions = getRowTemporalAssertions(row);
  if (canonicalAssertions.length) {
    return canonicalAssertions.map((assertion, index) => ({
      label: asText(assertion?.role) || `Date or period ${index + 1}`,
      value: asText(assertion?.display || assertion?.sourceText),
      subject: participantLabel(participants, assertion?.subjectParticipantIndex),
      subjectId: participantEntityId(participants, assertion?.subjectParticipantIndex),
      notes: Array.isArray(assertion?.temporalNotes)
        ? assertion.temporalNotes.map((note) => ({
          label: asText(note?.label || note?.sourceColumn) || 'Note',
          value: asText(note?.value),
        })).filter((note) => note.value)
        : [],
    })).filter((entry) => entry.value);
  }

  const mappedAssertions = Array.isArray(observation?.temporal?.assertions)
    ? observation.temporal.assertions
    : [];
  return mappedAssertions.map((assertion, index) => ({
    label: asText(assertion?.role) || `Date or period ${index + 1}`,
    value: asText(assertion?.sourceText || [assertion?.startValue, assertion?.endValue].filter(Boolean).join('–')),
    subject: participantLabel(participants, assertion?.subjectParticipantIndex),
    subjectId: participantEntityId(participants, assertion?.subjectParticipantIndex),
    notes: Array.isArray(assertion?.notes)
      ? assertion.notes.map((note) => ({ label: asText(note?.label || note?.sourceColumn) || 'Note', value: asText(note?.value) })).filter((note) => note.value)
      : [],
  })).filter((entry) => entry.value);
}

function buildPlaces(row, participants, observation) {
  const generalized = Array.isArray(observation?.places)
    ? observation.places.map((place, index) => ({
      label: asText(place?.role) || `Place ${index + 1}`,
      value: asText(place?.label),
      subject: participantLabel(participants, place?.subjectParticipantIndex),
      subjectId: participantEntityId(participants, place?.subjectParticipantIndex),
    })).filter((entry) => entry.value)
    : [];
  if (generalized.length) return generalized;

  if (asText(row?.recordType) === 'genealogy-event') {
    const value = asText(row?.location || row?.sourceLoc);
    if (!value) return [];
    return [{
      label: asText(row?.eventType) ? `${asText(row.eventType)} place` : 'Place',
      value,
      subject: asText(row?.person || row?.entity || row?.sourcePerson),
      subjectId: asText(row?.personEntityId || row?.entityId || row?.sourceEntityId),
    }];
  }

  const entries = [];
  const sourcePlace = asText(row?.sourceLoc || row?.sourceLocation);
  const targetPlace = asText(row?.targetLoc || row?.targetLocation);
  const pointPlace = asText(row?.location || row?.place || row?.Point_Place);
  if (sourcePlace) entries.push({ label: 'Source place', value: sourcePlace, subject: asText(row?.sourcePerson || row?.source), subjectId: asText(row?.sourceEntityId) });
  if (targetPlace) entries.push({ label: 'Target place', value: targetPlace, subject: asText(row?.targetPerson || row?.target), subjectId: asText(row?.targetEntityId) });
  if (pointPlace && pointPlace !== sourcePlace && pointPlace !== targetPlace) entries.push({ label: 'Place', value: pointPlace, subject: asText(row?.entity || row?.person) });
  return uniqueEntries(entries, (entry) => `${entry.label}::${entry.value}::${entry.subject}`);
}

function buildRelationships(row) {
  return getPeridotRowEntityRelationships(row).map((relationship, index) => {
    const connector = relationship.direction === 'directed' ? '→' : '—';
    const type = asText(relationship.relationshipLabel || relationship.relationshipType);
    return {
      label: type || `Relationship ${index + 1}`,
      value: `${asText(relationship.source)} ${connector} ${asText(relationship.target)}`.trim(),
      detail: [
        asText(relationship.sourceRole) ? `${asText(relationship.sourceRole)}: ${asText(relationship.source)}` : '',
        asText(relationship.targetRole) ? `${asText(relationship.targetRole)}: ${asText(relationship.target)}` : '',
      ].filter(Boolean).join(' · '),
      source: asText(relationship.source),
      target: asText(relationship.target),
      sourceId: asText(relationship.sourceId),
      targetId: asText(relationship.targetId),
      sourceRole: asText(relationship.sourceRole),
      targetRole: asText(relationship.targetRole),
      relationshipType: asText(relationship.relationshipType),
      relationshipLabel: asText(relationship.relationshipLabel),
      direction: relationship.direction === 'directed' ? 'directed' : 'undirected',
    };
  }).filter((entry) => entry.value);
}

function buildEvidence(row, observation) {
  const generalized = Array.isArray(observation?.evidenceFields)
    ? observation.evidenceFields.map((field) => ({
      label: asText(field?.label || field?.sourceColumn),
      value: asText(field?.value),
    })).filter((entry) => entry.label && entry.value)
    : [];

  const custom = Array.isArray(row?.customInspectorFields)
    ? row.customInspectorFields.map((field) => ({
      label: asText(field?.label || field?.sourceColumn),
      value: asText(field?.value),
    })).filter((entry) => entry.label && entry.value)
    : [];

  const core = [
    ['Archival collection', row?.archivalCollection || row?.collection],
    ['Relationship', row?.relationship],
    ['Archival page', row?.archivalPage || row?.pdfPage],
    ['Topic', row?.topic],
    ['Language', row?.language],
    ['Links', row?.links],
    ['Notes', row?.notes],
    ['Transcription', row?.transcription],
    ['Translation', row?.translation],
  ].map(([label, value]) => ({ label, value: asText(value) })).filter((entry) => entry.value);

  return uniqueEntries([...generalized, ...custom, ...core], (entry) => `${entry.label.toLowerCase()}::${entry.value}`);
}

export function buildPeridotRecordStructure(row = {}) {
  const observation = row?.generalizedObservation || null;
  const participants = buildParticipants(row, observation);
  return Object.freeze({
    temporal: Object.freeze(buildTemporalEntries(row, participants, observation)),
    participants: Object.freeze(participants),
    places: Object.freeze(buildPlaces(row, participants, observation)),
    relationships: Object.freeze(buildRelationships(row)),
    evidence: Object.freeze(buildEvidence(row, observation)),
  });
}

export function peridotRecordStructureHasContent(structure = {}) {
  return ['temporal', 'participants', 'places', 'relationships', 'evidence']
    .some((key) => Array.isArray(structure?.[key]) && structure[key].length > 0);
}



function normalizeRoleLabel(value) {
  return asText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticRoleToken(value) {
  const normalized = normalizeRoleLabel(value).toLowerCase();
  if (!normalized) return '';
  return normalized
    .replace(/\b(full|preferred|display)\s+name\b/g, 'name')
    .replace(/\b(person|entity)\s+name\b/g, 'name')
    .replace(/\bname\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isIdentityRole(value) {
  const normalized = normalizeRoleLabel(value).toLowerCase();
  return !normalized || ['name', 'full name', 'person', 'entity', 'person / entity', 'participant'].includes(normalized);
}

function inverseRoleFromCounterpartRole(value) {
  const token = semanticRoleToken(value);
  if (!token) return '';
  if (token.includes('mother') || token.includes('father') || token === 'parent') return 'child';
  if (token.includes('child') || token.includes('son') || token.includes('daughter')) return 'parent';
  if (token.includes('partner') || token.includes('spouse') || token.includes('husband') || token.includes('wife')) return 'partner';
  return '';
}

function relationshipRoleForSelected(ownRole, counterpartRole, relationshipType = '') {
  const own = semanticRoleToken(ownRole);
  if (own && !isIdentityRole(ownRole)) return own;

  const inverse = inverseRoleFromCounterpartRole(counterpartRole);
  if (inverse) return inverse;

  const type = normalizeRoleLabel(relationshipType).toLowerCase();
  if (type.includes('partner') || type.includes('marri') || type.includes('spouse')) return 'partner';
  if (type.includes('parent') && type.includes('child')) return 'related family member';
  return 'related entity';
}

function humanizeRelationshipRole(role) {
  const token = semanticRoleToken(role);
  if (!token) return 'Related to';
  if (token.includes('mother')) return 'Mother of';
  if (token.includes('father')) return 'Father of';
  if (token === 'parent' || token.includes('parent')) return 'Parent of';
  if (token === 'child' || token.includes('child') || token.includes('son') || token.includes('daughter')) return 'Child of';
  if (token.includes('partner') || token.includes('spouse') || token.includes('husband') || token.includes('wife')) return 'Partner / spouse of';
  return `${normalizeRoleLabel(role)} relationship with`;
}

function meaningfulRelationshipType(entry) {
  const candidates = [entry?.relationshipLabel, entry?.relationshipType]
    .map(normalizeRoleLabel)
    .filter(Boolean)
    .filter((value) => !/^relationship\s+\d+$/i.test(value));
  return candidates[0] || '';
}

function resolveRelationshipForEntity(entry, entityIdentity, entityId = '') {
  const selectedEntityId = asText(entityId);
  const sourceId = asText(entry?.sourceId);
  const targetId = asText(entry?.targetId);
  const sourceIdentity = comparable(entry?.source);
  const targetIdentity = comparable(entry?.target);

  const rowHasCanonicalIds = Boolean(sourceId || targetId);
  const selectedIsSource = selectedEntityId && rowHasCanonicalIds
    ? sourceId === selectedEntityId
    : sourceIdentity === entityIdentity;
  const selectedIsTarget = selectedEntityId && rowHasCanonicalIds
    ? targetId === selectedEntityId
    : targetIdentity === entityIdentity;
  if (!selectedIsSource && !selectedIsTarget) return null;

  const counterpart = selectedIsSource ? asText(entry?.target) : asText(entry?.source);
  const counterpartId = selectedIsSource ? targetId : sourceId;
  const counterpartIdentity = comparable(counterpart);

  // Canonical IDs are authoritative when present. Label equality alone must not
  // turn two distinct people with the same display name into a self-relationship.
  const isSelfCounterpart = selectedEntityId && counterpartId
    ? counterpartId === selectedEntityId
    : counterpartIdentity === entityIdentity;
  if (!counterpart || !counterpartIdentity || isSelfCounterpart) return null;

  const ownRole = selectedIsSource ? entry?.sourceRole : entry?.targetRole;
  const counterpartRole = selectedIsSource ? entry?.targetRole : entry?.sourceRole;
  const relationshipType = meaningfulRelationshipType(entry);
  const semanticRole = relationshipRoleForSelected(ownRole, counterpartRole, relationshipType);
  const label = humanizeRelationshipRole(semanticRole);
  const detailParts = [];
  if (relationshipType) detailParts.push(`Type: ${relationshipType}`);
  const counterpartRoleLabel = semanticRoleToken(counterpartRole);
  if (counterpartRoleLabel && !isIdentityRole(counterpartRole)) detailParts.push(`Counterpart role: ${counterpartRoleLabel}`);

  return {
    label,
    value: counterpart,
    counterpart,
    counterpartId,
    selectedRole: semanticRole,
    counterpartRole: counterpartRoleLabel,
    relationshipType,
    direction: entry?.direction === 'directed' ? 'directed' : 'undirected',
    detail: detailParts.join(' · '),
  };
}

function relationshipRoleCategory(role) {
  const token = semanticRoleToken(role);
  if (!token) return 'related entity';
  if (token.includes('mother') || token.includes('father') || token === 'parent' || token.includes('parent')) return 'parent';
  if (token === 'child' || token.includes('child') || token.includes('son') || token.includes('daughter')) return 'child';
  if (token.includes('partner') || token.includes('spouse') || token.includes('husband') || token.includes('wife')) return 'partner';
  if (token === 'related entity' || token === 'related family member') return 'related entity';
  return `custom:${token}`;
}

function relationshipRoleSpecificity(role) {
  const token = semanticRoleToken(role);
  if (!token || token === 'related entity' || token === 'related family member') return 0;
  if (token === 'parent' || token === 'child' || token === 'partner') return 1;
  if (token.includes('mother') || token.includes('father') || token.includes('son') || token.includes('daughter')) return 2;
  return 2;
}

function relationshipResolutionKey(entry) {
  const category = relationshipRoleCategory(entry?.selectedRole);
  const typeDisambiguator = category === 'related entity'
    ? comparable(entry?.relationshipType)
    : '';
  return [
    asText(entry?.counterpartId) || comparable(entry?.counterpart),
    category,
    typeDisambiguator,
  ].join('::');
}

function mergeResolvedRelationships(entries = []) {
  const merged = new Map();

  entries.forEach((entry) => {
    if (!entry) return;
    const key = relationshipResolutionKey(entry);
    if (!key) return;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, entry);
      return;
    }

    // Reciprocal rows may describe the same historical relationship with unequal
    // specificity (for example "Mother name" in one observation and generic
    // "Parent" in another). Keep one semantic relationship and prefer the more
    // informative selected-entity role without collapsing distinct custom roles.
    if (relationshipRoleSpecificity(entry.selectedRole) > relationshipRoleSpecificity(existing.selectedRole)) {
      merged.set(key, entry);
    }
  });

  return Array.from(merged.values());
}

function comparable(value) {
  return asText(value).toLowerCase();
}

function entryBelongsToPerson(entry, entityIdentity, entityId = '') {
  const selectedEntityId = asText(entityId);
  const subjectId = asText(entry?.subjectId);
  if (selectedEntityId && subjectId) return subjectId === selectedEntityId;
  return comparable(entry?.subject) === entityIdentity;
}

function eventRowBelongsToPerson(row, entityIdentity, entityId = '') {
  if (asText(row?.recordType) !== 'genealogy-event') return false;
  const selectedEntityId = asText(entityId);
  const rowEntityId = asText(row?.personEntityId || row?.entityId || row?.sourceEntityId);
  if (selectedEntityId && rowEntityId) return rowEntityId === selectedEntityId;
  return [row?.person, row?.entity, row?.sourcePerson, row?.source]
    .some((value) => comparable(value) === entityIdentity);
}

function freezeEntityStructure(structure) {
  return Object.freeze({
    temporal: Object.freeze(structure.temporal || []),
    participants: Object.freeze(structure.participants || []),
    places: Object.freeze(structure.places || []),
    relationships: Object.freeze(structure.relationships || []),
    evidence: Object.freeze(structure.evidence || []),
  });
}

/**
 * Build the mapped-information view for one selected entity.
 *
 * A profile may aggregate across many records, but ownership remains strict:
 * participant-attached dates/places belong only to that participant, relationship
 * entries appear only when the selected person is one of their endpoints, and
 * record-level evidence is not inherited merely because the record is connected.
 * Genealogy event rows are the one explicit row-level exception because the row
 * itself represents an event of the named person.
 *
 * `entityEvidence` is reserved for fields already projected as attributes of the
 * selected canonical entity (for example genealogy person metadata).  These may
 * safely appear on the entity profile even though their source was an imported row.
 */
export function buildPeridotEntityAttributedStructure(rows = [], options = {}) {
  const entityLabel = asText(options.entityLabel);
  const entityId = asText(options.entityId);
  const entityIdentity = comparable(entityLabel);
  const entityType = options.entityType === 'place' ? 'place' : 'person';
  if (!entityIdentity && !entityId) return freezeEntityStructure({});

  const temporal = [];
  const participants = [];
  const places = [];
  const relationships = [];
  const evidence = [];

  (rows || []).forEach((row) => {
    const structure = buildPeridotRecordStructure(row || {});
    const genealogyEventOwner = entityType === 'person' && eventRowBelongsToPerson(row, entityIdentity, entityId);

    if (entityType === 'person') {
      // Entity profiles should explain what mapped assertions *say about* the
      // selected entity, not repeat every source column in which its name occurs.
      // Counterpart people are therefore resolved through relationship semantics
      // below rather than rendered as self-valued participant fields.

      structure.temporal
        .filter((entry) => entryBelongsToPerson(entry, entityIdentity, entityId) || (!asText(entry?.subject) && genealogyEventOwner))
        .forEach((entry) => temporal.push({ ...entry, subject: '' }));

      structure.places
        .filter((entry) => entryBelongsToPerson(entry, entityIdentity, entityId) || (!asText(entry?.subject) && genealogyEventOwner))
        .forEach((entry) => places.push({ ...entry, subject: '' }));

      structure.relationships
        .map((entry) => resolveRelationshipForEntity(entry, entityIdentity, entityId))
        .filter(Boolean)
        .forEach((entry) => relationships.push(entry));
    } else {
      structure.places
        .filter((entry) => comparable(entry?.value) === entityIdentity)
        .forEach((entry) => {
          places.push(entry);
          const subject = asText(entry?.subject);
          const subjectId = asText(entry?.subjectId);
          if (subject || subjectId) {
            participants.push({
              label: asText(entry?.label) || 'Associated with',
              value: subject || subjectId,
              entityId: subjectId,
            });
          }
        });
    }
  });

  (options.entityEvidence || []).forEach((field) => {
    const label = asText(field?.label || field?.sourceColumn || field?.key);
    const value = asText(field?.value);
    if (label && value) evidence.push({ label, value });
  });

  return freezeEntityStructure({
    temporal: uniqueEntries(temporal, (entry) => `${entry.label}::${entry.value}::${entry.subject || ''}`),
    participants: uniqueEntries(participants, (entry) => `${entry.label}::${entry.entityId || entry.value}`),
    places: uniqueEntries(places, (entry) => `${entry.label}::${entry.value}::${entry.subject || ''}`),
    relationships: mergeResolvedRelationships(relationships),
    evidence: uniqueEntries(evidence, (entry) => `${entry.label.toLowerCase()}::${entry.value}`),
  });
}
