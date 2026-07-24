/*
 * Pure helpers for arbitrary table column mapping.
 * 
 * This module defines Peridot core field roles, suggested mappings, field groups, coordinate-pair parsing guidance, temporal roles, point-location roles, route-coordinate roles, custom evidence field handling, and row assembly for single-table imports.
 * 
 * Important relationships:
 * - `PeridotColumnMappingModal.jsx` renders controls based on these definitions.
 * - `peridotDataCapabilityAudit.js` evaluates the rows that these helpers assemble.
 * - `peridotCsvNormalizer.js` handles the public template path; this file handles arbitrary mapped tables.
 * 
 * Maintenance cautions:
 * - Keep mapping suggestions transparent and user-confirmed. Do not silently force uploaded columns into roles.
 * - Coordinate pairs are latitude-first by project decision.
 */

/**
 * Peridot arbitrary-column mapping helper.
 *
 * Pass A scope:
 * - define the nine core Peridot variables used by map/person/place/timeline logic;
 * - define descriptions, capability labels, and common-name/synonym hints for
 *   a future mapping modal;
 * - suggest likely mappings from arbitrary uploaded CSV/TSV headers;
 * - classify remaining uploaded columns as suggested custom Inspector fields
 *   or ignored fields;
 * - apply a user-confirmed mapping to arbitrary uploaded rows and produce
 *   Peridot-shaped rows for the existing validation/normalization pipeline.
 *
 * This module is intentionally pure and unmounted. It does not parse uploaded
 * files, open a modal, update React state, or change the active upload flow.
 *
 * Product rule:
 * Peridot's route/network core variables remain:
 *
 * - Date
 * - Source_Name
 * - Target_Name
 * - Source_Location
 * - Source_Latitude
 * - Source_Longitude
 * - Target_Location
 * - Target_Latitude
 * - Target_Longitude
 *
 * Peridot also supports optional temporal role mappings:
 *
 * - Date_Start
 * - Date_End
 * - Date_Display
 *
 * All other uploaded columns are user metadata. They should be preserved
 * internally, but only user-selected columns should be displayed in Inspector.
 * User-selected custom Inspector fields may later become Analytics variables
 * when they are categorical/usable.
 */

import { PERIDOT_TEMPLATE_COLUMNS } from './peridotCsvSchema.js';

export const PERIDOT_CORE_FIELDS = Object.freeze([
  'Date',
  'Source_Name',
  'Target_Name',
  'Source_Location',
  'Source_Latitude',
  'Source_Longitude',
  'Target_Location',
  'Target_Latitude',
  'Target_Longitude',
]);

export const PERIDOT_TEMPORAL_FIELDS = Object.freeze([
  'Date',
  'Date_Start',
  'Date_End',
  'Date_Display',
]);

export const PERIDOT_INTERVAL_TEMPORAL_FIELDS = Object.freeze([
  'Date_Start',
  'Date_End',
  'Date_Display',
]);

export const PERIDOT_POINT_FIELDS = Object.freeze([
  'Point_Place',
  'Point_Latitude',
  'Point_Longitude',
  'Point_Coordinates',
]);

export const PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS = Object.freeze([
  'Source_Coordinates',
  'Target_Coordinates',
]);

export const PERIDOT_FIELD_CAPABILITIES = Object.freeze({
  peopleView: 'People view',
  placeView: 'Place view',
  geographicMap: 'Geographic map',
  timeline: 'Timeline',
  inspector: 'Inspector',
  searchFilter: 'Search & Filter',
  analytics: 'Chart Visualizations',
  export: 'Export',
});

export const PERIDOT_CORE_FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'Date',
    label: 'Date',
    description:
      'Date of the correspondence record. Peridot preserves the entered value and uses parseable dates for timeline playback and date-based filtering.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.timeline,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat:
      'YYYY, YYYY/MM, YYYY-MM, YYYY/MM/DD, or YYYY-MM-DD. Ambiguous scholarly dates are preserved for evidence but may not be available for timeline playback.',
    commonNames: Object.freeze([
      'date',
      'year',
      'sent date',
      'sent_date',
      'letter date',
      'letter_date',
      'document date',
      'document_date',
      'dated',
      'data',
      'datum',
    ]),
  }),
  Object.freeze({
    key: 'Source_Name',
    label: 'Source name',
    description:
      'Person or entity at the start of a correspondence relationship; usually the sender, author, source, or origin correspondent.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.peopleView,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze([
      'source',
      'source name',
      'source_name',
      'sender',
      'sender name',
      'from',
      'from person',
      'author',
      'writer',
      'correspondent',
      'person',
      'name',
      'start person',
      'origin person',
    ]),
  }),
  Object.freeze({
    key: 'Target_Name',
    label: 'Target name',
    description:
      'Person or entity at the target end of a correspondence relationship; usually the recipient, addressee, target, or destination correspondent.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.peopleView,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze([
      'target',
      'target name',
      'target_name',
      'recipient',
      'recipient name',
      'to',
      'to person',
      'addressee',
      'receiver',
      'destination person',
      'end person',
    ]),
  }),
  Object.freeze({
    key: 'Source_Location',
    label: 'Source location',
    description:
      'Location at the start of a route; where a letter or document is sent from, authored from, or otherwise associated from.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.placeView,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze([
      'source location',
      'source_location',
      'source place',
      'source_place',
      'origin',
      'origin place',
      'origin_place',
      'from place',
      'from_place',
      'sent from',
      'sent_from',
      'place sent from',
      'place_sent_from',
      'start location',
      'start_location',
      'location from',
    ]),
  }),
  Object.freeze({
    key: 'Source_Latitude',
    label: 'Source latitude',
    description:
      'Decimal latitude for the source location. This is required, with source longitude, for source-side map placement.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.geographicMap,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat: 'Decimal number from -90 to 90. Example: 43.7696.',
    commonNames: Object.freeze([
      'source latitude',
      'source_latitude',
      'source lat',
      'source_lat',
      'origin latitude',
      'origin_latitude',
      'origin lat',
      'origin_lat',
      'from latitude',
      'from_latitude',
      'from lat',
      'from_lat',
      'lat from',
      'latitude from',
    ]),
  }),
  Object.freeze({
    key: 'Source_Longitude',
    label: 'Source longitude',
    description:
      'Decimal longitude for the source location. This is required, with source latitude, for source-side map placement.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.geographicMap,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat: 'Decimal number from -180 to 180. Example: 11.2558.',
    commonNames: Object.freeze([
      'source longitude',
      'source_longitude',
      'source long',
      'source_long',
      'source lon',
      'source_lon',
      'source lng',
      'source_lng',
      'origin longitude',
      'origin_longitude',
      'origin long',
      'origin_long',
      'origin lon',
      'origin_lon',
      'from longitude',
      'from_longitude',
      'from long',
      'from_long',
      'from lon',
      'from_lon',
      'long from',
      'longitude from',
    ]),
  }),
  Object.freeze({
    key: 'Target_Location',
    label: 'Target location',
    description:
      'Location at the end of a route; where a letter or document is sent to, received, or inferred to arrive.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.placeView,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze([
      'target location',
      'target_location',
      'target place',
      'target_place',
      'destination',
      'destination place',
      'destination_place',
      'to place',
      'to_place',
      'sent to',
      'sent_to',
      'place sent to',
      'place_sent_to',
      'end location',
      'end_location',
      'location to',
    ]),
  }),
  Object.freeze({
    key: 'Target_Latitude',
    label: 'Target latitude',
    description:
      'Decimal latitude for the target location. This is required, with target longitude, for target-side map placement.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.geographicMap,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat: 'Decimal number from -90 to 90. Example: 41.9028.',
    commonNames: Object.freeze([
      'target latitude',
      'target_latitude',
      'target lat',
      'target_lat',
      'destination latitude',
      'destination_latitude',
      'destination lat',
      'destination_lat',
      'to latitude',
      'to_latitude',
      'to lat',
      'to_lat',
      'lat to',
      'latitude to',
    ]),
  }),
  Object.freeze({
    key: 'Target_Longitude',
    label: 'Target longitude',
    description:
      'Decimal longitude for the target location. This is required, with target latitude, for target-side map placement.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.geographicMap,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat: 'Decimal number from -180 to 180. Example: 12.4964.',
    commonNames: Object.freeze([
      'target longitude',
      'target_longitude',
      'target long',
      'target_long',
      'target lon',
      'target_lon',
      'target lng',
      'target_lng',
      'destination longitude',
      'destination_longitude',
      'destination long',
      'destination_long',
      'destination lon',
      'destination_lon',
      'to longitude',
      'to_longitude',
      'to long',
      'to_long',
      'to lon',
      'to_lon',
      'long to',
      'longitude to',
    ]),
  }),
]);

export const PERIDOT_CORE_FIELD_DEFINITIONS_BY_KEY = Object.freeze(
  Object.fromEntries(PERIDOT_CORE_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]))
);

export const PERIDOT_TEMPORAL_FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'Date',
    label: 'Single date',
    description:
      'One date associated with the record. For correspondence data this may be the sent date, received date, document date, or another chosen primary date.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.timeline,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat:
      'YYYY, YYYY/MM, YYYY-MM, YYYY/MM/DD, YYYY-MM-DD, or a simple year range. Other date text is preserved for evidence but may not be available for timeline playback.',
    commonNames: Object.freeze([
      'date',
      'year',
      'sent date',
      'received date',
      'letter date',
      'document date',
      'event date',
      'record date',
    ]),
  }),
  Object.freeze({
    key: 'Date_Start',
    label: 'Date start',
    description:
      'Start date for a temporal interval, such as inception, sent date, opening date, beginning of activity, or earliest known date.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.timeline,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat:
      'YYYY, YYYY/MM, YYYY-MM, YYYY/MM/DD, or YYYY-MM-DD. Date Start can be paired with Date End to define an interval.',
    commonNames: Object.freeze([
      'date start',
      'start date',
      'start year',
      'inception',
      'inception date',
      'began',
      'begin date',
      'opening date',
      'sent date',
      'from date',
      'earliest date',
    ]),
  }),
  Object.freeze({
    key: 'Date_End',
    label: 'Date end',
    description:
      'End date for a temporal interval, such as dissolved date, demolished date, closing date, received date, termination date, or latest known date.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.timeline,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    acceptedFormat:
      'YYYY, YYYY/MM, YYYY-MM, YYYY/MM/DD, or YYYY-MM-DD. Date End can be paired with Date Start to define an interval.',
    commonNames: Object.freeze([
      'date end',
      'end date',
      'end year',
      'dissolved date',
      'dissolved',
      'dissolution',
      'abolished date',
      'abolished',
      'demolished date',
      'demolished',
      'demolition date',
      'closed date',
      'closing date',
      'received date',
      'to date',
      'latest date',
    ]),
  }),
  Object.freeze({
    key: 'Date_Display',
    label: 'Display date',
    description:
      'Human-readable date text to preserve for Inspector/export when sortable start/end values need a separate label.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze([
      'display date',
      'date display',
      'date label',
      'uncertain date',
      'scholarly date',
      'written date',
    ]),
  }),
]);

export const PERIDOT_TEMPORAL_FIELD_DEFINITIONS_BY_KEY = Object.freeze(
  Object.fromEntries(PERIDOT_TEMPORAL_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]))
);

export const PERIDOT_POINT_FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'Point_Place',
    label: 'Point place',
    description: 'Place, site, institution, event location, object location, or observation location when each record has one primary location.',
    usedFor: Object.freeze([
      PERIDOT_FIELD_CAPABILITIES.geographicMap,
      PERIDOT_FIELD_CAPABILITIES.inspector,
      PERIDOT_FIELD_CAPABILITIES.searchFilter,
      PERIDOT_FIELD_CAPABILITIES.analytics,
      PERIDOT_FIELD_CAPABILITIES.export,
    ]),
    commonNames: Object.freeze(['place', 'place name', 'site', 'site name', 'name of site', 'airfield', 'institution', 'city']),
  }),
  Object.freeze({
    key: 'Point_Latitude',
    label: 'Point latitude',
    description: 'Decimal latitude for a one-location record. Use with Point longitude unless the record has a combined coordinate pair.',
    usedFor: Object.freeze([PERIDOT_FIELD_CAPABILITIES.geographicMap, PERIDOT_FIELD_CAPABILITIES.export]),
    acceptedFormat: 'Decimal latitude from -90 to 90.',
    commonNames: Object.freeze(['latitude', 'lat', 'point latitude', 'site latitude', 'location latitude']),
  }),
  Object.freeze({
    key: 'Point_Longitude',
    label: 'Point longitude',
    description: 'Decimal longitude for a one-location record. Use with Point latitude unless the record has a combined coordinate pair.',
    usedFor: Object.freeze([PERIDOT_FIELD_CAPABILITIES.geographicMap, PERIDOT_FIELD_CAPABILITIES.export]),
    acceptedFormat: 'Decimal longitude from -180 to 180.',
    commonNames: Object.freeze(['longitude', 'long', 'lon', 'lng', 'point longitude', 'site longitude', 'location longitude']),
  }),
  Object.freeze({
    key: 'Point_Coordinates',
    label: 'Point coordinate pair',
    description: 'Combined latitude-first coordinate pair for a one-location record. Examples: 64.2008, -149.4937 or POINT(64.2008 -149.4937).',
    usedFor: Object.freeze([PERIDOT_FIELD_CAPABILITIES.geographicMap, PERIDOT_FIELD_CAPABILITIES.export]),
    acceptedFormat: 'Latitude first, longitude second. Examples: 64.2008, -149.4937 or POINT(64.2008 -149.4937).',
    commonNames: Object.freeze(['coordinates', 'coordinate location', 'coordinate pair', 'point coordinates', 'site coordinates', 'location coordinates']),
  }),
]);

export const PERIDOT_POINT_FIELD_DEFINITIONS_BY_KEY = Object.freeze(
  Object.fromEntries(PERIDOT_POINT_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]))
);

export const PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'Source_Coordinates',
    label: 'Source coordinate pair',
    description: 'Combined latitude-first coordinate pair for the source/origin side of a route or directed-place record.',
    usedFor: Object.freeze([PERIDOT_FIELD_CAPABILITIES.geographicMap, PERIDOT_FIELD_CAPABILITIES.export]),
    acceptedFormat: 'Latitude first, longitude second. Examples: 43.7696, 11.2558 or POINT(43.7696 11.2558).',
    commonNames: Object.freeze(['source coordinates', 'source coordinate pair', 'origin coordinates', 'from coordinates', 'sender coordinates']),
  }),
  Object.freeze({
    key: 'Target_Coordinates',
    label: 'Target coordinate pair',
    description: 'Combined latitude-first coordinate pair for the target/destination side of a route or directed-place record.',
    usedFor: Object.freeze([PERIDOT_FIELD_CAPABILITIES.geographicMap, PERIDOT_FIELD_CAPABILITIES.export]),
    acceptedFormat: 'Latitude first, longitude second. Examples: 41.9028, 12.4964 or POINT(41.9028 12.4964).',
    commonNames: Object.freeze(['target coordinates', 'target coordinate pair', 'destination coordinates', 'to coordinates', 'recipient coordinates']),
  }),
]);

export const PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS_BY_KEY = Object.freeze(
  Object.fromEntries(PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]))
);


export const PERIDOT_ACCEPTED_FORMAT_GUIDANCE = Object.freeze({
  dates:
    'Accepted date formats: YYYY, YYYY/MM, YYYY-MM, YYYY/MM/DD, YYYY-MM-DD, or simple year ranges. Use Date Start and Date End for intervals when both values are recorded.',
  coordinates:
    'Coordinates should be decimal numbers. Coordinate-pair fields are latitude first, longitude second. Latitude must be between -90 and 90. Longitude must be between -180 and 180.',
});

export const CUSTOM_INSPECTOR_FIELD_DEFAULTS = Object.freeze({
  include: 'include',
  ignore: 'ignore',
});

function asText(value) {
  return String(value ?? '').trim();
}

function normalizeColumnName(value) {
  return asText(value)
    .toLowerCase()
    .replace(/["'’‘“”]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForLooseMatch(value) {
  return normalizeColumnName(value).replace(/\s+/g, '');
}

function titleCaseFromColumnName(value) {
  const text = asText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function getUniqueHeaders(headers = []) {
  const seen = new Set();
  const unique = [];

  headers.forEach((header) => {
    const text = asText(header);
    if (!text || seen.has(text)) return;
    seen.add(text);
    unique.push(text);
  });

  return unique;
}

function getDefinitionForCoreField(coreField) {
  return PERIDOT_CORE_FIELD_DEFINITIONS_BY_KEY[coreField] || null;
}

function getDefinitionForTemporalField(temporalField) {
  return PERIDOT_TEMPORAL_FIELD_DEFINITIONS_BY_KEY[temporalField] || null;
}

function getAllCommonNamesForDefinition(definition) {
  if (!definition) return [];
  return [definition.key, definition.label, ...(definition.commonNames || [])].filter(Boolean);
}

function scoreHeaderForDefinition(header, definition) {
  const normalizedHeader = normalizeColumnName(header);
  const looseHeader = normalizeForLooseMatch(header);
  if (!normalizedHeader || !definition) return 0;

  let bestScore = 0;

  getAllCommonNamesForDefinition(definition).forEach((candidate) => {
    const normalizedCandidate = normalizeColumnName(candidate);
    const looseCandidate = normalizeForLooseMatch(candidate);
    if (!normalizedCandidate) return;

    if (normalizedHeader === normalizedCandidate) {
      bestScore = Math.max(bestScore, 100);
      return;
    }

    if (looseHeader === looseCandidate) {
      bestScore = Math.max(bestScore, 96);
      return;
    }

    if (normalizedHeader.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHeader)) {
      bestScore = Math.max(bestScore, 72);
    }

    const headerTokens = new Set(normalizedHeader.split(' ').filter(Boolean));
    const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
    const sharedTokens = candidateTokens.filter((token) => headerTokens.has(token));

    if (sharedTokens.length) {
      const tokenScore = Math.round((sharedTokens.length / candidateTokens.length) * 55);
      bestScore = Math.max(bestScore, tokenScore);
    }
  });

  return bestScore;
}

/**
 * Suggest likely uploaded-column mappings for the nine core Peridot variables.
 *
 * Suggestions are only suggestions. The user should make the final mapping
 * decision in the UI.
 */
export function suggestPeridotCoreFieldMappings(headers = []) {
  const uniqueHeaders = getUniqueHeaders(headers);
  const usedHeaders = new Set();
  const suggestions = {};

  PERIDOT_CORE_FIELD_DEFINITIONS.forEach((definition) => {
    const scoredHeaders = uniqueHeaders
      .filter((header) => !usedHeaders.has(header))
      .map((header) => ({
        header,
        score: scoreHeaderForDefinition(header, definition),
      }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || a.header.localeCompare(b.header));

    const best = scoredHeaders[0] || null;
    suggestions[definition.key] = best
      ? Object.freeze({
          field: definition.key,
          sourceColumn: best.header,
          confidence: best.score >= 95 ? 'high' : best.score >= 70 ? 'medium' : 'low',
          score: best.score,
          alternatives: Object.freeze(scoredHeaders.slice(1, 5)),
        })
      : Object.freeze({
          field: definition.key,
          sourceColumn: '',
          confidence: 'none',
          score: 0,
          alternatives: Object.freeze([]),
        });

    if (best) usedHeaders.add(best.header);
  });

  return Object.freeze(suggestions);
}

export function suggestPeridotTemporalFieldMappings(headers = [], coreMapping = {}) {
  const uniqueHeaders = getUniqueHeaders(headers);
  const usedHeaders = new Set();
  const suggestions = {};

  PERIDOT_TEMPORAL_FIELD_DEFINITIONS.forEach((definition) => {
    const allowReuseOfCoreDate = definition.key === 'Date';
    const scoredHeaders = uniqueHeaders
      .filter((header) => allowReuseOfCoreDate || !usedHeaders.has(header))
      .map((header) => ({
        header,
        score: scoreHeaderForDefinition(header, definition),
      }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || a.header.localeCompare(b.header));

    const best = scoredHeaders[0] || null;
    suggestions[definition.key] = best
      ? Object.freeze({
          field: definition.key,
          sourceColumn: best.header,
          confidence: best.score >= 95 ? 'high' : best.score >= 70 ? 'medium' : 'low',
          score: best.score,
          alternatives: Object.freeze(scoredHeaders.slice(1, 5)),
        })
      : Object.freeze({
          field: definition.key,
          sourceColumn: '',
          confidence: 'none',
          score: 0,
          alternatives: Object.freeze([]),
        });

    if (best && !allowReuseOfCoreDate) usedHeaders.add(best.header);
  });

  return Object.freeze(suggestions);
}

export function buildInitialPeridotTemporalMapping(headers = [], coreMapping = {}) {
  const suggestions = suggestPeridotTemporalFieldMappings(headers, coreMapping);
  const uniqueHeaders = getUniqueHeaders(headers);
  const exactDateHeader = uniqueHeaders.find((header) => {
    const normalized = normalizeColumnName(header);
    return normalized === 'date' || normalized === 'letter date' || normalized === 'document date' || normalized === 'record date' || normalized === 'event date';
  }) || '';
  const intervalDetected = Boolean(suggestions.Date_Start?.sourceColumn || suggestions.Date_End?.sourceColumn);
  const singleDate = intervalDetected
    ? exactDateHeader
    : (suggestions.Date?.sourceColumn || coreMapping?.Date || exactDateHeader || '');

  return Object.freeze({
    Date: singleDate,
    Date_Start: suggestions.Date_Start?.sourceColumn || '',
    Date_End: suggestions.Date_End?.sourceColumn || '',
    Date_Display: suggestions.Date_Display?.sourceColumn || '',
  });
}


function suggestFieldMappingsFromDefinitions(headers = [], definitions = [], usedColumns = new Set()) {
  const uniqueHeaders = getUniqueHeaders(headers);
  const suggestions = {};

  definitions.forEach((definition) => {
    const scoredHeaders = uniqueHeaders
      .filter((header) => !usedColumns.has(header))
      .map((header) => ({ header, score: scoreHeaderForDefinition(header, definition) }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || a.header.localeCompare(b.header));
    const best = scoredHeaders[0] || null;
    suggestions[definition.key] = best
      ? Object.freeze({ field: definition.key, sourceColumn: best.header, confidence: best.score >= 95 ? 'high' : best.score >= 70 ? 'medium' : 'low', score: best.score, alternatives: Object.freeze(scoredHeaders.slice(1, 5)) })
      : Object.freeze({ field: definition.key, sourceColumn: '', confidence: 'none', score: 0, alternatives: Object.freeze([]) });
    if (best) usedColumns.add(best.header);
  });

  return Object.freeze(suggestions);
}

export function suggestPeridotPointFieldMappings(headers = [], coreMapping = {}, temporalMapping = {}) {
  const usedColumns = new Set([...Object.values(temporalMapping || {})].map(asText).filter(Boolean));
  return suggestFieldMappingsFromDefinitions(headers, PERIDOT_POINT_FIELD_DEFINITIONS, usedColumns);
}

export function buildInitialPeridotPointMapping(headers = [], coreMapping = {}, temporalMapping = {}) {
  const suggestions = suggestPeridotPointFieldMappings(headers, coreMapping, temporalMapping);
  return Object.freeze(Object.fromEntries(PERIDOT_POINT_FIELDS.map((field) => [field, suggestions[field]?.sourceColumn || ''])));
}

export function suggestPeridotRouteCoordinatePairMappings(headers = [], coreMapping = {}, temporalMapping = {}, pointMapping = {}) {
  const usedColumns = new Set([...Object.values(coreMapping || {}), ...Object.values(temporalMapping || {}), ...Object.values(pointMapping || {})].map(asText).filter(Boolean));
  return suggestFieldMappingsFromDefinitions(headers, PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS, usedColumns);
}

export function buildInitialPeridotRouteCoordinatePairMapping(headers = [], coreMapping = {}, temporalMapping = {}, pointMapping = {}) {
  const suggestions = suggestPeridotRouteCoordinatePairMappings(headers, coreMapping, temporalMapping, pointMapping);
  return Object.freeze(Object.fromEntries(PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS.map((field) => [field, suggestions[field]?.sourceColumn || ''])));
}

function composeDisplayDateValue(singleDate, dateStart, dateEnd, explicitDisplayDate) {
  const display = asText(explicitDisplayDate);
  const single = asText(singleDate);
  const start = asText(dateStart);
  const end = asText(dateEnd);
  if (display) return display;
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–`;
  if (end) return `–${end}`;
  return single;
}

function isLikelyTechnicalColumn(header) {
  const normalized = normalizeColumnName(header);
  if (!normalized) return true;

  const exactTechnicalNames = new Set([
    'id',
    'uuid',
    'guid',
    'row id',
    'record id',
    'database id',
    'internal id',
    'pdf page',
    'pdf pages',
    'page id',
    'object id',
    'file id',
  ]);

  if (exactTechnicalNames.has(normalized)) return true;
  if (/\b(id|uuid|guid)\b/.test(normalized)) return true;
  if (/\b(lat|latitude|lon|long|lng|longitude)\b/.test(normalized)) return true;
  if (/\burl\b/.test(normalized) && normalized.length <= 8) return false;

  return false;
}

function isLikelyHumanReadableMetadataColumn(header, rows = []) {
  const normalized = normalizeColumnName(header);
  if (!normalized || isLikelyTechnicalColumn(header)) return false;

  const sampleValues = rows
    .slice(0, 50)
    .map((row) => row?.[header])
    .filter((value) => asText(value));

  if (!sampleValues.length) return false;

  const usableValues = sampleValues.filter((value) => {
    const text = asText(value);
    if (!text) return false;
    if (text.length > 500) return true; // Long text can still be intentionally useful in Inspector.
    return true;
  });

  return usableValues.length > 0;
}

function isLikelyAnalyticsCompatibleColumn(header, rows = []) {
  if (isLikelyTechnicalColumn(header)) return false;

  const values = rows
    .map((row) => row?.[header])
    .map(asText)
    .filter(Boolean);

  if (!values.length) return false;

  const shortValues = values.filter((value) => value.length <= 140);
  if (!shortValues.length) return false;

  const nonNumericValues = shortValues.filter((value) => !/^-?\d+(\.\d+)?$/.test(value));
  if (!nonNumericValues.length) return false;

  const unique = new Set(nonNumericValues.map((value) => normalizeColumnName(value)));
  if (!unique.size) return false;

  // Avoid near-unique record identifiers.
  if (values.length >= 5 && unique.size / values.length > 0.95) return false;

  return true;
}

function isMappedCoreSourceColumn(header, coreMapping = {}, temporalMapping = {}, pointMapping = {}, routeCoordinatePairMapping = {}) {
  return [...Object.values(coreMapping || {}), ...Object.values(temporalMapping || {}), ...Object.values(pointMapping || {}), ...Object.values(routeCoordinatePairMapping || {})]
    .some((sourceColumn) => asText(sourceColumn) === asText(header));
}

/**
 * Suggest default include/ignore choices for unmapped uploaded columns.
 *
 * Defaults should be helpful but reversible. Technical-looking columns such as
 * IDs and coordinate fields default to ignored. Human-readable metadata columns
 * default to included for Inspector.
 */
export function suggestCustomInspectorFieldSelections(headers = [], rows = [], coreMapping = {}, temporalMapping = {}, pointMapping = {}, routeCoordinatePairMapping = {}) {
  return Object.freeze(
    getUniqueHeaders(headers)
      .filter((header) => !isMappedCoreSourceColumn(header, coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping))
      .map((header) => {
        const analyticsEligible = isLikelyAnalyticsCompatibleColumn(header, rows);
        const suggestedAction = isLikelyHumanReadableMetadataColumn(header, rows)
          ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.include
          : CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore;

        return Object.freeze({
          sourceColumn: header,
          label: titleCaseFromColumnName(header) || header,
          action: suggestedAction,
          suggested: suggestedAction === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include,
          analyticsEligible,
          reason:
            suggestedAction === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include
              ? 'Appears to contain human-readable metadata.'
              : 'Appears technical, empty, or unsuitable for default Inspector display.',
        });
      })
  );
}

function buildEmptyPeridotTemplateRow() {
  return Object.fromEntries(PERIDOT_TEMPLATE_COLUMNS.map((column) => [column, '']));
}

function getMappedValue(uploadedRow, sourceColumn) {
  const column = asText(sourceColumn);
  if (!column) return '';
  return uploadedRow?.[column] ?? '';
}

/**
 * Convert a confirmed core mapping into a Peridot-template-shaped row.
 *
 * coreMapping shape:
 *
 * {
 *   Date: "Uploaded date column",
 *   Source_Name: "Uploaded sender column",
 *   ...
 * }
 */
export function applyCoreMappingToRow(uploadedRow = {}, coreMapping = {}, temporalMapping = {}, pointMapping = {}, routeCoordinatePairMapping = {}) {
  const mappedRow = buildEmptyPeridotTemplateRow();

  PERIDOT_CORE_FIELDS.forEach((field) => {
    mappedRow[field] = getMappedValue(uploadedRow, coreMapping[field]);
  });

  const explicitSingleDate = getMappedValue(uploadedRow, temporalMapping.Date);
  const dateStart = getMappedValue(uploadedRow, temporalMapping.Date_Start);
  const dateEnd = getMappedValue(uploadedRow, temporalMapping.Date_End);
  const dateDisplay = getMappedValue(uploadedRow, temporalMapping.Date_Display);
  const composedDisplayDate = composeDisplayDateValue(explicitSingleDate || mappedRow.Date, dateStart, dateEnd, dateDisplay);

  if (explicitSingleDate) mappedRow.Date = explicitSingleDate;
  if (!mappedRow.Date && dateStart) mappedRow.Date = dateStart;
  if (!mappedRow.Date && dateDisplay) mappedRow.Date = dateDisplay;
  if (!mappedRow.Date && dateEnd) mappedRow.Date = dateEnd;

  mappedRow.Date_Start = dateStart;
  mappedRow.Date_End = dateEnd;
  mappedRow.Date_Display = composedDisplayDate;

  PERIDOT_POINT_FIELDS.forEach((field) => {
    mappedRow[field] = getMappedValue(uploadedRow, pointMapping[field]);
  });
  PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS.forEach((field) => {
    mappedRow[field] = getMappedValue(uploadedRow, routeCoordinatePairMapping[field]);
  });

  return mappedRow;
}

/**
 * Build user-selected custom Inspector fields for one uploaded row.
 *
 * customFieldSelections shape:
 *
 * [
 *   {
 *     sourceColumn: "Gender",
 *     label: "Gender",
 *     action: "include",
 *     analyticsEligible: true
 *   }
 * ]
 */
export function buildCustomInspectorFieldsForRow(uploadedRow = {}, customFieldSelections = []) {
  return customFieldSelections
    .filter((selection) => selection?.action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include)
    .map((selection) => {
      const sourceColumn = asText(selection.sourceColumn);
      return {
        key: sourceColumn,
        sourceColumn,
        label: asText(selection.label) || titleCaseFromColumnName(sourceColumn) || sourceColumn,
        value: getMappedValue(uploadedRow, sourceColumn),
        analyticsEligible: Boolean(selection.analyticsEligible),
      };
    })
    .filter((field) => field.sourceColumn);
}

/**
 * Apply a confirmed arbitrary-column import mapping.
 *
 * Returns Peridot-shaped rows that can feed the existing validation and
 * normalization helpers. Each row also preserves:
 *
 * - originalUploadedRow: full original row object;
 * - customInspectorFields: user-selected metadata fields for Inspector;
 * - ignoredUploadedColumns: uploaded columns not mapped to a core field and not
 *   selected for Inspector display.
 */
export function applyPeridotColumnMapping(rows = [], mapping = {}) {
  const coreMapping = mapping.coreMapping || {};
  const temporalMapping = mapping.temporalMapping || {};
  const pointMapping = mapping.pointMapping || {};
  const routeCoordinatePairMapping = mapping.routeCoordinatePairMapping || {};
  const customFieldSelections = mapping.customFieldSelections || [];
  const includedCustomColumns = new Set(
    customFieldSelections
      .filter((selection) => selection?.action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include)
      .map((selection) => asText(selection.sourceColumn))
      .filter(Boolean)
  );
  const mappedCoreColumns = new Set(
    [...Object.values(coreMapping), ...Object.values(temporalMapping), ...Object.values(pointMapping), ...Object.values(routeCoordinatePairMapping)]
      .map(asText)
      .filter(Boolean)
  );

  return rows.map((uploadedRow) => {
    const mappedRow = applyCoreMappingToRow(uploadedRow, coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping);
    const originalUploadedRow = { ...(uploadedRow || {}) };
    const customInspectorFields = buildCustomInspectorFieldsForRow(uploadedRow, customFieldSelections);
    const ignoredUploadedColumns = Object.keys(originalUploadedRow).filter(
      (column) => !mappedCoreColumns.has(column) && !includedCustomColumns.has(column)
    );

    return {
      ...mappedRow,
      originalUploadedRow,
      customInspectorFields,
      ignoredUploadedColumns,
    };
  });
}

/**
 * Validate the mapping shape before the user confirms import.
 *
 * This does not enforce required fields, because Peridot accepts partial data.
 * It only reports structural mapping issues that the UI should disclose.
 */
export function validatePeridotColumnMapping(headers = [], mapping = {}) {
  const available = new Set(getUniqueHeaders(headers));
  const coreMapping = mapping.coreMapping || {};
  const temporalMapping = mapping.temporalMapping || {};
  const pointMapping = mapping.pointMapping || {};
  const routeCoordinatePairMapping = mapping.routeCoordinatePairMapping || {};
  const customFieldSelections = mapping.customFieldSelections || [];
  const issues = [];

  Object.entries(coreMapping).forEach(([field, sourceColumn]) => {
    if (!PERIDOT_CORE_FIELDS.includes(field)) {
      issues.push({
        code: 'unknown_core_field',
        field,
        message: `${field} is not one of the nine core Peridot variables.`,
      });
    }

    if (asText(sourceColumn) && !available.has(sourceColumn)) {
      issues.push({
        code: 'missing_source_column',
        field,
        sourceColumn,
        message: `The mapped source column “${sourceColumn}” is not present in the uploaded table.`,
      });
    }
  });

  Object.entries(temporalMapping).forEach(([field, sourceColumn]) => {
    if (!PERIDOT_TEMPORAL_FIELDS.includes(field)) {
      issues.push({
        code: 'unknown_temporal_field',
        field,
        message: `${field} is not one of the supported Peridot temporal roles.`,
      });
    }

    if (asText(sourceColumn) && !available.has(sourceColumn)) {
      issues.push({
        code: 'missing_temporal_source_column',
        field,
        sourceColumn,
        message: `The mapped temporal column “${sourceColumn}” is not present in the uploaded table.`,
      });
    }
  });

  Object.entries(pointMapping).forEach(([field, sourceColumn]) => {
    if (!PERIDOT_POINT_FIELDS.includes(field)) {
      issues.push({ code: 'unknown_point_field', field, message: `${field} is not one of the supported Peridot point-location roles.` });
    }
    if (asText(sourceColumn) && !available.has(sourceColumn)) {
      issues.push({ code: 'missing_point_source_column', field, sourceColumn, message: `The mapped point-location column “${sourceColumn}” is not present in the uploaded table.` });
    }
  });

  Object.entries(routeCoordinatePairMapping).forEach(([field, sourceColumn]) => {
    if (!PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS.includes(field)) {
      issues.push({ code: 'unknown_route_coordinate_pair_field', field, message: `${field} is not one of the supported Peridot route coordinate-pair roles.` });
    }
    if (asText(sourceColumn) && !available.has(sourceColumn)) {
      issues.push({ code: 'missing_route_coordinate_pair_source_column', field, sourceColumn, message: `The mapped route coordinate-pair column “${sourceColumn}” is not present in the uploaded table.` });
    }
  });

  const seenCoreFields = new Set();
  Object.keys(coreMapping).forEach((field) => {
    if (seenCoreFields.has(field)) {
      issues.push({
        code: 'duplicate_core_field',
        field,
        message: `${field} has more than one mapping. Each Peridot field should receive only one uploaded column.`,
      });
    }
    seenCoreFields.add(field);
  });

  customFieldSelections.forEach((selection) => {
    const sourceColumn = asText(selection?.sourceColumn);
    if (sourceColumn && !available.has(sourceColumn)) {
      issues.push({
        code: 'missing_custom_source_column',
        sourceColumn,
        message: `The selected Inspector column “${sourceColumn}” is not present in the uploaded table.`,
      });
    }
  });

  return Object.freeze({
    isValid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

/**
 * Build all initial mapping state needed by a future mapping modal.
 */
export function buildInitialPeridotColumnMappingState(headers = [], rows = [], options = {}) {
  const coreSuggestions = suggestPeridotCoreFieldMappings(headers);
  const coreMapping = Object.fromEntries(
    PERIDOT_CORE_FIELDS.map((field) => [field, coreSuggestions[field]?.sourceColumn || ''])
  );
  const temporalSuggestions = suggestPeridotTemporalFieldMappings(headers, coreMapping);
  const temporalMapping = buildInitialPeridotTemporalMapping(headers, coreMapping);
  const pointSuggestions = suggestPeridotPointFieldMappings(headers, coreMapping, temporalMapping);
  const pointMapping = buildInitialPeridotPointMapping(headers, coreMapping, temporalMapping);
  const routeCoordinatePairSuggestions = suggestPeridotRouteCoordinatePairMappings(headers, coreMapping, temporalMapping, pointMapping);
  const routeCoordinatePairMapping = buildInitialPeridotRouteCoordinatePairMapping(headers, coreMapping, temporalMapping, pointMapping);
  const customFieldSelections = suggestCustomInspectorFieldSelections(headers, rows, coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping);

  return Object.freeze({
    datasetProfileId: String(options.datasetProfileId || '').trim() || 'peridot.correspondence-directed-record',
    headers: Object.freeze(getUniqueHeaders(headers)),
    coreFieldDefinitions: PERIDOT_CORE_FIELD_DEFINITIONS,
    temporalFieldDefinitions: PERIDOT_TEMPORAL_FIELD_DEFINITIONS,
    pointFieldDefinitions: PERIDOT_POINT_FIELD_DEFINITIONS,
    routeCoordinatePairFieldDefinitions: PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS,
    coreSuggestions,
    temporalSuggestions,
    pointSuggestions,
    routeCoordinatePairSuggestions,
    coreMapping: Object.freeze(coreMapping),
    temporalMapping: Object.freeze(temporalMapping),
    pointMapping: Object.freeze(pointMapping),
    routeCoordinatePairMapping: Object.freeze(routeCoordinatePairMapping),
    customFieldSelections,
    formatGuidance: PERIDOT_ACCEPTED_FORMAT_GUIDANCE,
  });
}

export function getCoreFieldDefinition(field) {
  return getDefinitionForCoreField(field);
}

export function getCoreFieldCommonNames(field) {
  return Object.freeze([...(getDefinitionForCoreField(field)?.commonNames || [])]);
}

export function getTemporalFieldDefinition(field) {
  return getDefinitionForTemporalField(field);
}

export function getTemporalFieldCommonNames(field) {
  return Object.freeze([...(getDefinitionForTemporalField(field)?.commonNames || [])]);
}

export function getPointFieldDefinition(field) {
  return PERIDOT_POINT_FIELD_DEFINITIONS_BY_KEY[field] || null;
}

export function getRouteCoordinatePairFieldDefinition(field) {
  return PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS_BY_KEY[field] || null;
}
