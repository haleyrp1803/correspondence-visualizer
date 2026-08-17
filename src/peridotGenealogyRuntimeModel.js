/*
 * Canonical genealogy runtime projection.
 *
 * Pass 3B.4 activates canonical genealogy datasets without sending them through
 * the correspondence compatibility adapter. The canonical dataset remains the
 * authority. This module projects canonical Agents, Relationships, Events, and
 * Places into the read-only arrays still consumed by the current App.jsx
 * visualization, Search, Timeline, and Inspector surfaces.
 *
 * No correspondence records or geographic routes are invented. Relationship
 * rows support the person-network view. Event rows preserve birth/death dates
 * and places for Search, Timeline, Inspector, charts, and export.
 */

import { applyPeridotGenealogyMapping } from './peridotGenealogyMapping.js';
import { normalizePeridotGenealogyRows } from './peridotGenealogyProfile.js';

function asText(value) {
  return String(value ?? '').trim();
}

function makeDatasetId(fileLabel = '', sourceKind = '') {
  const seed = `${sourceKind}:${fileLabel}`.toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `genealogy-${(hash >>> 0).toString(16)}`;
}

function temporalDisplay(temporal) {
  return asText(temporal?.display)
    || asText(temporal?.sourceText)
    || asText(temporal?.displayValue)
    || asText(temporal?.originalValue)
    || asText(temporal?.normalizedValue);
}

function temporalYearFromSortBound(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.trunc(number / 10000);
}

function makeLegacyParsedDate(temporal) {
  if (!temporal) {
    return Object.freeze({
      raw: '',
      isKnown: false,
      isTimelineUsable: false,
      monthKey: null,
      sortKey: null,
      label: 'Unknown date',
    });
  }

  const start = Number(temporal?.sortBounds?.start);
  const year = temporalYearFromSortBound(start);
  const raw = temporalDisplay(temporal);
  return Object.freeze({
    raw,
    year,
    month: null,
    day: null,
    isKnown: Number.isFinite(year),
    isTimelineUsable: Number.isFinite(year),
    precision: asText(temporal?.precision) || 'year',
    monthKey: Number.isFinite(year) ? String(year) : null,
    sortKey: Number.isFinite(start) ? start : null,
    label: raw || (Number.isFinite(year) ? String(year) : 'Unknown date'),
  });
}

function entityLabel(entityById, id) {
  return entityById.get(id)?.label || id || 'Unknown';
}

function placeForEvent(placeById, event) {
  const id = event?.placeReferenceIds?.[0] || '';
  return placeById.get(id) || null;
}

function makeRelationshipRow(relationship, index, entityById) {
  const source = entityLabel(entityById, relationship.participantAId);
  const target = entityLabel(entityById, relationship.participantBId);
  const date = temporalDisplay(relationship.temporalAssertion);
  return Object.freeze({
    id: relationship.id || `genealogy_relationship_${index + 1}`,
    sourcePerson: source,
    targetPerson: target,
    source,
    target,
    sourceLoc: '',
    targetLoc: '',
    sourceLat: NaN,
    sourceLon: NaN,
    targetLat: NaN,
    targetLon: NaN,
    sourcePlaceId: null,
    targetPlaceId: null,
    mappable: false,
    date,
    Date: date,
    temporalAssertions: relationship.temporalAssertion ? Object.freeze([relationship.temporalAssertion]) : Object.freeze([]),
    parsedDate: makeLegacyParsedDate(relationship.temporalAssertion),
    relationship: relationship.relationshipType,
    relationshipType: relationship.relationshipType,
    relationshipDirection: relationship.direction,
    sourceRole: relationship.participantARole,
    targetRole: relationship.participantBRole,
    recordType: 'genealogy-relationship',
    personKey: `${source}-->${target}`,
    originalCanonicalItem: relationship,
    customInspectorFields: Object.freeze([
      { label: 'Relationship type', value: relationship.relationshipType },
      { label: 'Direction', value: relationship.direction },
      { label: 'Source role', value: relationship.participantARole },
      { label: 'Target role', value: relationship.participantBRole },
    ].filter((item) => asText(item.value))),
  });
}

function makeEventRow(event, index, entityById, placeById) {
  const personId = event?.participantIds?.[0] || '';
  const person = entityLabel(entityById, personId);
  const place = placeForEvent(placeById, event);
  const date = temporalDisplay(event.temporalAssertion);
  return Object.freeze({
    id: event.id || `genealogy_event_${index + 1}`,
    sourcePerson: person,
    targetPerson: '',
    source: person,
    target: '',
    entity: person,
    person,
    sourceLoc: place?.label || '',
    targetLoc: '',
    location: place?.label || '',
    sourceLat: place?.latitude ?? NaN,
    sourceLon: place?.longitude ?? NaN,
    targetLat: NaN,
    targetLon: NaN,
    sourcePlaceId: place?.id || null,
    targetPlaceId: null,
    mappable: false,
    date,
    Date: date,
    temporalAssertions: event.temporalAssertion ? Object.freeze([event.temporalAssertion]) : Object.freeze([]),
    parsedDate: makeLegacyParsedDate(event.temporalAssertion),
    relationship: '',
    topic: event.eventType,
    eventType: event.eventType,
    recordType: 'genealogy-event',
    personKey: '',
    originalCanonicalItem: event,
    customInspectorFields: Object.freeze([
      { label: 'Event type', value: event.eventType },
      { label: 'Place', value: place?.label || '' },
      { label: 'Date', value: date },
    ].filter((item) => asText(item.value))),
  });
}

function makePersonMetadata(entity) {
  const attributes = entity?.attributes || {};
  const wikidata = asText(entity?.externalIdentifiers?.wikidata);
  return Object.freeze({
    id: entity.id,
    person: entity.label,
    wikiEn: wikidata,
    wikiIt: '',
    treccani: '',
    imageCreativeCommons: asText(entity?.image?.url),
    canonicalEntityId: entity.id,
    customInspectorFields: Object.freeze(
      Object.entries(attributes)
        .filter(([, value]) => asText(value))
        .map(([label, value]) => ({ label, value: asText(value) }))
    ),
    originalCanonicalItem: entity,
  });
}

function makeLegacyPlace(place) {
  return Object.freeze({
    id: place.id,
    label: place.label,
    lat: place.latitude,
    lon: place.longitude,
    type: 'place',
    roleHint: place.placeType,
    politicalHints: Object.freeze([]),
    originalCanonicalItem: place,
  });
}

function buildValidationSummary(canonicalDataset, projectedRows, options = {}) {
  const warningIssues = (canonicalDataset.validation?.issues || []).filter(
    (issue) => issue.severity === 'warning' || issue.severity === 'information'
  );
  const relationships = canonicalDataset.relationships?.length || 0;
  const events = canonicalDataset.events?.length || 0;
  const people = canonicalDataset.entities?.length || 0;
  const places = canonicalDataset.places?.length || 0;

  return Object.freeze({
    popup: Object.freeze({
      title: 'Genealogy dataset imported',
      intro: `${people} people were normalized into Peridot’s canonical genealogy model.`,
      capabilityLines: Object.freeze([
        `${relationships} family relationship${relationships === 1 ? '' : 's'} available in the person-network view.`,
        `${events} life event${events === 1 ? '' : 's'} available for Timeline, Search, Inspector, charts, and export.`,
        `${places} recorded event place${places === 1 ? '' : 's'} preserved without inferring movement routes.`,
      ]),
      warningLines: Object.freeze(warningIssues.slice(0, 8).map((issue) => issue.message)),
      closingLines: Object.freeze([
        'Geographic route visualization is unavailable because genealogy birth and death places are not movement routes.',
      ]),
    }),
    summaryLines: Object.freeze([
      `${people} people`,
      `${relationships} relationships`,
      `${events} life events`,
      `${places} places`,
    ]),
    warnings: Object.freeze(warningIssues),
    hasWarnings: warningIssues.length > 0,
    totalRows: projectedRows.length,
    acceptedRecordCount: projectedRows.length,
    unsupportedRowCount: 0,
    capabilityCounts: Object.freeze({
      inspectorReady: projectedRows.length,
      searchReady: projectedRows.length,
      pointMapReady: 0,
      routeMapReady: 0,
      networkReady: relationships,
      timelineReady: projectedRows.filter((row) => (row.temporalAssertions || []).some(
        (assertion) => assertion?.visualizationUsability?.timelinePositionable
          && assertion?.consistency !== 'backwards'
          && assertion?.temporalShape !== 'inconsistent'
      )).length,
      chartReady: projectedRows.length,
      exportReady: projectedRows.length,
    }),
    sourceProfile: 'genealogy',
    excludedSupplementalRowCount: options?.supplementalResolution?.excludedRowIndexes?.length || 0,
    attachedSupplementalRowCount: options?.supplementalResolution?.attachedRowIndexes?.length || 0,
  });
}

export function buildPeridotGenealogyRuntimeModel(sourceRows = [], fieldMapping = {}, options = {}) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  const fileLabel = asText(options.fileLabel) || 'Uploaded genealogy';
  const sourceKind = asText(options.sourceKind) || 'mapped-genealogy';
  const sourceSheet = asText(options.sourceSheet) || 'People';
  const datasetId = asText(options.datasetId) || makeDatasetId(fileLabel, sourceKind);
  const mappedRows = applyPeridotGenealogyMapping(rows, fieldMapping);

  const canonicalDataset = normalizePeridotGenealogyRows(mappedRows, {
    datasetId,
    datasetLabel: `${fileLabel} canonical genealogy dataset`,
    sourceFileId: asText(options.sourceFileId) || makeDatasetId(fileLabel, `${sourceKind}:file`),
    sourceFileName: fileLabel,
    sourceSheet,
    importedAt: asText(options.importedAt),
  });

  if (canonicalDataset.validation?.canCommit !== true || canonicalDataset.validation?.valid !== true) {
    const blockingCount = Number(canonicalDataset.validation?.counts?.blocking || 0);
    const errorCount = Number(canonicalDataset.validation?.counts?.error || 0);
    throw new Error(
      `Canonical genealogy normalization could not commit ${fileLabel}: ${blockingCount} blocking issue(s) and ${errorCount} error(s).`
    );
  }

  const entityById = new Map((canonicalDataset.entities || []).map((entity) => [entity.id, entity]));
  const placeById = new Map((canonicalDataset.places || []).map((place) => [place.id, place]));
  const relationshipRows = (canonicalDataset.relationships || []).map((item, index) => (
    makeRelationshipRow(item, index, entityById)
  ));
  const eventRows = (canonicalDataset.events || []).map((item, index) => (
    makeEventRow(item, index, entityById, placeById)
  ));
  const projectedRows = Object.freeze([...relationshipRows, ...eventRows]);
  const personMetadata = Object.freeze((canonicalDataset.entities || []).map(makePersonMetadata));
  const places = Object.freeze((canonicalDataset.places || []).map(makeLegacyPlace));
  const validationSummary = buildValidationSummary(canonicalDataset, projectedRows, options);

  return Object.freeze({
    normalizedRows: projectedRows,
    normalizedLetters: projectedRows,
    normalizedPersonMetadata: personMetadata,
    places,
    acceptedRows: projectedRows,
    unsupportedRows: Object.freeze([]),
    allRows: projectedRows,
    canonicalDataset,
    validationSummary,
    runtimeProjection: Object.freeze({
      mode: 'canonical-genealogy-projection',
      datasetId: canonicalDataset.datasetId,
      projectedRelationshipRowCount: relationshipRows.length,
      projectedEventRowCount: eventRows.length,
      geographicRoutesInvented: false,
      correspondenceAdapterUsed: false,
    }),
    normalizationSource: Object.freeze({
      mode: 'canonical-genealogy',
      datasetId: canonicalDataset.datasetId,
      mappingProfileId: canonicalDataset.mappingProfile?.id || '',
      mappingProfileVersion: canonicalDataset.mappingProfile?.version || '',
      validationValid: canonicalDataset.validation?.valid === true,
      canCommit: canonicalDataset.validation?.canCommit === true,
    }),
  });
}
