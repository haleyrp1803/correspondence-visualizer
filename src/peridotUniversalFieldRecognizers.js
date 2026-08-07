/*
 * Phase 2.2 deterministic recognizers for the isolated universal-upload prototype.
 *
 * Recognizers inspect source values and conservative header-role evidence, then
 * return suggestions only. They never alter mapping state, accept a mapping on
 * the researcher's behalf, standardize source values, or persist confidence
 * scores. The user must explicitly accept, edit, dismiss, or override every
 * suggestion through the prototype mapping controls.
 */

import {
  PERIDOT_FIELD_ROLES,
  auditPeridotDataCapabilities,
} from './peridotDataCapabilityAudit.js';
import { PERIDOT_VARIABLE_KINDS } from './peridotUniversalMappingModel.js';

function asText(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fieldSuggestionId(tableId, fieldId) {
  return `field-suggestion:${tableId}:${fieldId}`;
}

function isBooleanLike(field, rows) {
  const values = rows
    .map((row) => asText(row?.[field.header]).toLowerCase())
    .filter(Boolean);
  if (!values.length) return false;
  const allowed = new Set(['yes', 'no', 'true', 'false', 'y', 'n', '1', '0']);
  return values.every((value) => allowed.has(value));
}

function temporalHeaderRole(header = '') {
  const value = asText(header).toLowerCase();
  if (/\b(start|begin|inception|birth|born)\b/.test(value)) return 'beginning-date';
  if (/\b(end|finish|dissolved|abolished|demolished|death|died)\b/.test(value)) return 'ending-date';
  if (/\b(date|year|month|day|time)\b/.test(value)) return 'record-or-event-date';
  return '';
}

function temporalRoleFromRoles(roles = []) {
  const R = PERIDOT_FIELD_ROLES;
  if (roles.includes(R.DATE_START)) return 'beginning-date';
  if (roles.includes(R.DATE_END)) return 'ending-date';
  if (roles.includes(R.DATE_DISPLAY)) return 'display-date';
  if (roles.includes(R.DATE_SORT)) return 'sort-date';
  if (roles.includes(R.DATE)) return 'record-or-event-date';
  return '';
}

function firstEntityRole(roles = []) {
  const R = PERIDOT_FIELD_ROLES;
  if (roles.includes(R.PERSON)) return 'person';
  if (roles.includes(R.INSTITUTION)) return 'institution-or-organization';
  if (roles.includes(R.WORK)) return 'work';
  if (roles.includes(R.OBJECT)) return 'object';
  if (roles.includes(R.GROUP)) return 'group';
  if (roles.includes(R.SOURCE_ENTITY)) return 'source-entity';
  if (roles.includes(R.TARGET_ENTITY)) return 'target-entity';
  return '';
}

function suggestionForField(field, rows) {
  const R = PERIDOT_FIELD_ROLES;
  const roles = field.roles || [];
  const reasons = [];
  let kind = '';
  let semanticRole = '';
  let temporalRole = '';

  const isSeparateCoordinate = roles.some((role) => [
    R.POINT_LATITUDE, R.POINT_LONGITUDE,
    R.SOURCE_LATITUDE, R.SOURCE_LONGITUDE,
    R.TARGET_LATITUDE, R.TARGET_LONGITUDE,
  ].includes(role));
  const isPlaceRole = roles.some((role) => [R.POINT_PLACE, R.SOURCE_PLACE, R.TARGET_PLACE].includes(role));
  const entityRole = firstEntityRole(roles);
  const headerTemporalRole = temporalHeaderRole(field.header);
  const numericDominant = (field.numeric?.ratio || 0) >= 0.65;

  if (roles.includes(R.RECORD_ID) || /(^|[ _-])(qid|id|identifier)([ _-]|$)/i.test(field.header)) {
    kind = PERIDOT_VARIABLE_KINDS.IDENTIFIER;
    semanticRole = 'identifier';
    reasons.push('The column heading looks like an identifier field.');
  } else if (field.coordinates?.appearsCoordinatePair || roles.includes(R.POINT_COORDINATES) || roles.includes(R.SOURCE_COORDINATES) || roles.includes(R.TARGET_COORDINATES) || isSeparateCoordinate) {
    kind = PERIDOT_VARIABLE_KINDS.PLACE;
    semanticRole = isSeparateCoordinate ? 'coordinate-component' : 'coordinates';
    if (field.coordinates?.appearsCoordinatePair) reasons.push('Most nonblank values look like coordinate pairs.');
    else reasons.push('The column heading identifies a latitude, longitude, or coordinate field.');
  } else if (isPlaceRole) {
    kind = PERIDOT_VARIABLE_KINDS.PLACE;
    semanticRole = roles.includes(R.SOURCE_PLACE) ? 'source-place' : roles.includes(R.TARGET_PLACE) ? 'target-place' : 'place';
    reasons.push('The column heading describes a place or location.');
  } else if (field.temporal?.appearsTemporal && (headerTemporalRole || !numericDominant)) {
    kind = PERIDOT_VARIABLE_KINDS.TEMPORAL;
    temporalRole = temporalRoleFromRoles(roles) || headerTemporalRole;
    semanticRole = temporalRole || 'date-or-time';
    reasons.push(field.temporal.ratio >= 0.65
      ? 'Most nonblank values look like dates or times.'
      : 'The column heading identifies a date or time role.');
  } else if (roles.includes(R.LINK)) {
    kind = PERIDOT_VARIABLE_KINDS.LINK_MEDIA;
    semanticRole = 'link-or-media';
    reasons.push('The column heading identifies a link or media field.');
  } else if (entityRole) {
    kind = PERIDOT_VARIABLE_KINDS.ENTITY;
    semanticRole = entityRole;
    reasons.push('The column heading describes a person, organization, work, object, group, source, or target entity.');
  } else if (roles.includes(R.RELATIONSHIP_TYPE)) {
    kind = PERIDOT_VARIABLE_KINDS.RELATIONSHIP;
    semanticRole = 'relationship-type';
    reasons.push('The column heading describes a relationship or relation type.');
  } else if (isBooleanLike(field, rows) || roles.includes(R.BOOLEAN_FLAG)) {
    kind = PERIDOT_VARIABLE_KINDS.BOOLEAN;
    semanticRole = 'yes-no';
    reasons.push(isBooleanLike(field, rows)
      ? 'The observed values are consistently yes/no or true/false values.'
      : 'The column heading looks like a yes/no flag.');
  } else if (field.numeric?.appearsNumeric) {
    kind = PERIDOT_VARIABLE_KINDS.NUMBER;
    semanticRole = roles.includes(R.MEASURE) ? 'measure' : 'number';
    reasons.push('Most nonblank values are numeric.');
  } else if (field.text?.appearsLongText || roles.includes(R.LONG_TEXT)) {
    kind = PERIDOT_VARIABLE_KINDS.TEXT;
    semanticRole = 'text-or-notes';
    reasons.push(field.text?.appearsLongText
      ? 'The observed values look like longer text rather than short categories.'
      : 'The column heading identifies notes, transcription, description, or other long text.');
  } else if (roles.includes(R.SOURCE_CITATION) && !roles.includes(R.SOURCE_ENTITY)) {
    kind = PERIDOT_VARIABLE_KINDS.EVIDENCE;
    semanticRole = 'citation-or-evidence';
    reasons.push('The column heading identifies citation, archive, collection, repository, page, or folio information.');
  } else if (field.categorical?.appearsCategorical || roles.includes(R.CATEGORY)) {
    kind = PERIDOT_VARIABLE_KINDS.CATEGORY;
    semanticRole = 'category';
    reasons.push(field.categorical?.appearsCategorical
      ? 'The column repeats a manageable set of short values that may function as categories.'
      : 'The column heading identifies a category-like field.');
  }

  if (!kind) return null;

  return Object.freeze({
    suggestedKind: kind,
    suggestedLabel: asText(field.header),
    semanticRole,
    temporalRole,
    basis: Object.freeze(unique(reasons)),
    sampleValues: Object.freeze((field.sampleValues || []).slice(0, 4)),
  });
}

export function recognizePeridotUniversalFields({ sourceManifest = {}, sourceRowsByTableId = {} } = {}) {
  const tables = Array.isArray(sourceManifest?.sourceTables) ? sourceManifest.sourceTables : [];
  const suggestions = [];

  tables.forEach((table) => {
    const rows = Array.isArray(sourceRowsByTableId?.[table.id]) ? sourceRowsByTableId[table.id] : [];
    const headers = (table.fields || []).map((field) => field.name);
    const audit = auditPeridotDataCapabilities(rows, { headers });
    const summaryByHeader = new Map((audit.fields || []).map((field) => [field.header, field]));

    (table.fields || []).forEach((sourceField) => {
      const summary = summaryByHeader.get(sourceField.name);
      if (!summary) return;
      const recognized = suggestionForField(summary, rows);
      if (!recognized) return;
      suggestions.push(Object.freeze({
        id: fieldSuggestionId(table.id, sourceField.id),
        sourceTableId: table.id,
        sourceFieldId: sourceField.id,
        sourceFieldName: sourceField.name,
        ...recognized,
      }));
    });
  });

  return Object.freeze(suggestions);
}

export function findPeridotUniversalFieldSuggestion(suggestions = [], suggestionId = '') {
  return suggestions.find((suggestion) => suggestion.id === suggestionId) || null;
}
