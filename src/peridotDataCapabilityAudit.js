/*
 * Dataset capability audit helper.
 * 
 * This pure module inspects uploaded/mapped rows and reports field-role evidence, row shapes, and dataset-level readiness for Peridot's tools. It supports broader humanistic data beyond correspondence: point/site rows, route rows, temporal intervals, chart/evidence rows, and exportable records.
 * 
 * Important relationships:
 * - `PeridotColumnMappingModal.jsx` uses this for mapping review.
 * - `PeridotExploreWorkspace.jsx` and Visualizations capability states present results derived from this model.
 * 
 * Maintenance cautions:
 * - Capability rules should explain what a dataset can support without mutating or standardizing the data.
 * - Keep role detection conservative so accidental column matches do not overpromise visualization readiness.
 */

/*
 * Peridot data capability audit helper.
 *
 * This module is intentionally pure and UI-agnostic. It inspects arbitrary
 * uploaded table rows and reports what the dataset appears able to support:
 * Inspector records, Search, point maps, route maps, networks, timelines,
 * charts, and export.
 *
 * It does not mutate uploaded data, clean researcher-entered values, geocode
 * places, or force a dataset into the existing correspondence schema.
 */

import {
  parsePeridotTemporalRange as parseCanonicalTemporalRange,
  parsePeridotTemporalSpan as parseCanonicalTemporalSpan,
} from './peridotTemporalAssertions.js';

export const PERIDOT_FIELD_ROLES = Object.freeze({
  RECORD_LABEL: 'record_label',
  RECORD_TYPE: 'record_type',
  RECORD_ID: 'record_id',
  SOURCE_CITATION: 'source_citation',
  LINK: 'link',
  DATE: 'date',
  DATE_START: 'date_start',
  DATE_END: 'date_end',
  DATE_DISPLAY: 'date_display',
  DATE_SORT: 'date_sort',
  DATE_PRECISION: 'date_precision',
  POINT_PLACE: 'point_place',
  POINT_LATITUDE: 'point_latitude',
  POINT_LONGITUDE: 'point_longitude',
  POINT_COORDINATES: 'point_coordinates',
  SOURCE_ENTITY: 'source_entity',
  SOURCE_PLACE: 'source_place',
  SOURCE_LATITUDE: 'source_latitude',
  SOURCE_LONGITUDE: 'source_longitude',
  TARGET_ENTITY: 'target_entity',
  TARGET_PLACE: 'target_place',
  TARGET_LATITUDE: 'target_latitude',
  TARGET_LONGITUDE: 'target_longitude',
  SOURCE_COORDINATES: 'source_coordinates',
  TARGET_COORDINATES: 'target_coordinates',
  RELATIONSHIP_TYPE: 'relationship_type',
  PERSON: 'person',
  INSTITUTION: 'institution',
  WORK: 'work',
  OBJECT: 'object',
  GROUP: 'group',
  CATEGORY: 'category',
  MEASURE: 'measure',
  SERIES: 'series',
  LONG_TEXT: 'long_text',
  BOOLEAN_FLAG: 'boolean_flag',
});

export const PERIDOT_CAPABILITY_FLAGS = Object.freeze({
  INSPECTOR_READY: 'inspectorReady',
  SEARCH_READY: 'searchReady',
  POINT_MAP_READY: 'pointMapReady',
  ROUTE_MAP_READY: 'routeMapReady',
  NETWORK_READY: 'networkReady',
  TIMELINE_READY: 'timelineReady',
  CHART_READY: 'chartReady',
  EXPORT_READY: 'exportReady',
});

export const PERIDOT_RECORD_SHAPES = Object.freeze({
  DIRECTED_RELATIONSHIP: 'directedRelationship',
  POINT_SITE: 'pointSite',
  TIME_SERIES_MEASUREMENT: 'timeSeriesMeasurement',
  GENERIC_EVIDENCE: 'genericEvidence',
});

const ROLE = PERIDOT_FIELD_ROLES;
const CAPABILITY = PERIDOT_CAPABILITY_FLAGS;

const MAX_CATEGORICAL_UNIQUE_VALUES = 80;
const LONG_TEXT_AVERAGE_LENGTH = 80;
const LONG_TEXT_MAX_LENGTH = 180;

const ROLE_PATTERNS = [
  { role: ROLE.SOURCE_LATITUDE, patterns: [/^source.*lat/i, /^sender.*lat/i, /^origin.*lat/i, /^from.*lat/i] },
  { role: ROLE.SOURCE_LONGITUDE, patterns: [/^source.*lon/i, /^source.*long/i, /^sender.*lon/i, /^origin.*lon/i, /^from.*lon/i] },
  { role: ROLE.TARGET_LATITUDE, patterns: [/^target.*lat/i, /^recipient.*lat/i, /^destination.*lat/i, /^to.*lat/i] },
  { role: ROLE.TARGET_LONGITUDE, patterns: [/^target.*lon/i, /^target.*long/i, /^recipient.*lon/i, /^destination.*lon/i, /^to.*lon/i] },
  { role: ROLE.SOURCE_COORDINATES, patterns: [/^source.*coordinates?/i, /^origin.*coordinates?/i, /^from.*coordinates?/i, /^sender.*coordinates?/i] },
  { role: ROLE.TARGET_COORDINATES, patterns: [/^target.*coordinates?/i, /^destination.*coordinates?/i, /^to.*coordinates?/i, /^recipient.*coordinates?/i] },
  { role: ROLE.POINT_LATITUDE, patterns: [/^point.*lat/i, /^site.*lat/i, /^location.*lat/i, /^lat$/i, /^latitude$/i, /\blatitude\b/i] },
  { role: ROLE.POINT_LONGITUDE, patterns: [/^point.*lon/i, /^point.*long/i, /^site.*lon/i, /^site.*long/i, /^location.*lon/i, /^location.*long/i, /^lon$/i, /^lng$/i, /^long$/i, /^longitude$/i, /\blongitude\b/i] },
  { role: ROLE.POINT_COORDINATES, patterns: [/^point.*coordinates?/i, /^site.*coordinates?/i, /^location.*coordinates?/i, /^coordinates?$/i, /^coord/i, /coordinate location/i, /lat.*lon/i, /lon.*lat/i, /coordinate pair/i] },
  { role: ROLE.SOURCE_ENTITY, patterns: [/^source(_|\s|-)?name$/i, /^source$/i, /^sender$/i, /^author$/i, /^from person$/i, /^source entity$/i] },
  { role: ROLE.TARGET_ENTITY, patterns: [/^target(_|\s|-)?name$/i, /^target$/i, /^recipient$/i, /^addressee$/i, /^to person$/i, /^target entity$/i] },
  { role: ROLE.SOURCE_PLACE, patterns: [/^source(_|\s|-)?location$/i, /^source.*place$/i, /^origin$/i, /^from place$/i, /^sender.*place$/i] },
  { role: ROLE.TARGET_PLACE, patterns: [/^target(_|\s|-)?location$/i, /^target.*place$/i, /^destination$/i, /^to place$/i, /^recipient.*place$/i] },
  { role: ROLE.DATE_START, patterns: [/^date start$/i, /^start date$/i, /^start$/i, /^date_begin$/i, /^begin/i, /^from date$/i, /^start year$/i] },
  { role: ROLE.DATE_END, patterns: [/^end date$/i, /^date end$/i, /^end$/i, /^date_finish$/i, /^finish/i, /^to date$/i, /^end year$/i] },
  { role: ROLE.DATE, patterns: [/^date\b/i, /letter date/i, /event date/i, /record date/i] },
  { role: ROLE.DATE_DISPLAY, patterns: [/display date/i, /date display/i, /uncertain date/i] },
  { role: ROLE.DATE_SORT, patterns: [/sort date/i, /date sort/i, /sortable date/i] },
  { role: ROLE.DATE_PRECISION, patterns: [/date precision/i, /precision/i] },
  { role: ROLE.RECORD_LABEL, patterns: [/^name$/i, /^title$/i, /name of site/i, /site name/i, /item label/i, /record label/i, /^label$/i] },
  { role: ROLE.RECORD_TYPE, patterns: [/record type/i, /^type$/i, /^genre$/i, /^format$/i] },
  { role: ROLE.RECORD_ID, patterns: [/^id$/i, /record id/i, /item id/i, /accession/i, /catalog/i, /catalogue/i, /identifier/i, /number$/i] },
  { role: ROLE.SOURCE_CITATION, patterns: [/^source$/i, /citation/i, /archive/i, /collection/i, /repository/i, /page/i, /folio/i] },
  { role: ROLE.LINK, patterns: [/^link/i, /^url/i, /uri/i, /digital/i, /image link/i] },
  { role: ROLE.RELATIONSHIP_TYPE, patterns: [/relationship/i, /relation/i, /edge type/i, /action/i] },
  { role: ROLE.PERSON, patterns: [/person/i, /people/i, /traveler/i, /owner/i, /member/i] },
  { role: ROLE.INSTITUTION, patterns: [/institution/i, /department/i, /company/i, /publisher/i, /printer/i, /archive/i, /office/i] },
  { role: ROLE.WORK, patterns: [/work/i, /book/i, /text/i, /publication/i, /cited/i] },
  { role: ROLE.OBJECT, patterns: [/object/i, /artifact/i, /artefact/i, /manuscript/i, /item/i] },
  { role: ROLE.GROUP, patterns: [/group/i, /order/i, /community/i, /affiliation/i] },
  { role: ROLE.MEASURE, patterns: [/magnitude/i, /price/i, /value/i, /count/i, /amount/i, /quantity/i, /total/i, /measure/i, /score/i, /rate/i] },
  { role: ROLE.SERIES, patterns: [/series/i, /company/i, /commodity/i] },
  { role: ROLE.BOOLEAN_FLAG, patterns: [/\?$/i, /^is /i, /^has /i, /flag/i] },
  { role: ROLE.LONG_TEXT, patterns: [/transcription/i, /translation/i, /notes?/i, /description/i, /abstract/i, /summary/i, /comment/i] },
  { role: ROLE.CATEGORY, patterns: [/category/i, /department/i, /reason/i, /language/i, /topic/i, /genre/i, /type/i, /status/i] },
];

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeTextValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isBlankValue(value) {
  return normalizeTextValue(value) === '';
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = normalizeTextValue(value);
  if (!raw) return null;
  const cleaned = raw
    .replace(/[,$£€]/g, '')
    .replace(/%$/, '')
    .trim();
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelSerialDateToIso(serial) {
  if (!Number.isFinite(serial)) return '';
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + Math.round(serial) * 24 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function yearFromCanonicalSort(sortKey) {
  if (!Number.isFinite(sortKey)) return null;
  const year = Math.floor(Math.abs(Math.trunc(sortKey)) / 10000);
  return Number.isInteger(year) && year > 0 ? year : null;
}

function canonicalRangeKind(assertion) {
  if (!assertion) return 'unknown';
  if (assertion.boundedness === 'openStart') return 'openStart';
  if (assertion.boundedness === 'openEnd' || assertion.boundedness === 'ongoing') return 'openEnd';
  if (['interval', 'partialInterval', 'approximateInterval'].includes(assertion.temporalShape)) return 'closedRange';
  if (assertion.temporalShape === 'inconsistent') return 'closedRange';
  if (assertion.temporalShape && assertion.temporalShape !== 'unknown') return 'single';
  return 'unknown';
}

function canonicalTemporalCapability(assertion, displayOverride = '') {
  const startSort = Number.isFinite(assertion?.sortBounds?.start) ? assertion.sortBounds.start : null;
  const endSort = Number.isFinite(assertion?.sortBounds?.end) ? assertion.sortBounds.end : null;
  const startYear = Number(assertion?.start?.year) || yearFromCanonicalSort(startSort) || null;
  const endYear = Number(assertion?.end?.year) || yearFromCanonicalSort(endSort) || startYear;
  const rangeKind = canonicalRangeKind(assertion);
  const isSortable = Boolean(assertion?.visualizationUsability?.timelinePositionable)
    && (startSort !== null || endSort !== null);
  return {
    display: normalizeTextValue(displayOverride || assertion?.display || assertion?.sourceText),
    startSort: startSort ?? endSort,
    endSort: endSort ?? startSort,
    startYear: startYear ?? endYear,
    endYear: endYear ?? startYear,
    precision: assertion?.precision || 'unknown',
    rangeKind,
    hasRange: startSort !== null && endSort !== null && startSort !== endSort,
    isInterval: ['closedRange', 'openStart', 'openEnd'].includes(rangeKind),
    startOpen: rangeKind === 'openStart',
    endOpen: rangeKind === 'openEnd',
    isSortable,
    warnings: [...(assertion?.parseWarnings || [])],
    temporalAssertion: assertion || null,
  };
}

function makeTemporalResult({ display = '' } = {}) {
  return canonicalTemporalCapability(null, display);
}

// Compatibility-shaped capability adapters. These functions remain exported
// because mapping/review callers expect the older capability-result shape, but
// all temporal interpretation now comes from the canonical assertion parser.
export function parsePeridotTemporalRange({ startValue, endValue, displayValue } = {}) {
  return canonicalTemporalCapability(parseCanonicalTemporalRange({
    startValue,
    endValue,
    displayValue,
  }));
}

export function parsePeridotTemporalValue(value, options = {}) {
  let sourceValue = value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    sourceValue = value.toISOString().slice(0, 10);
  } else if (typeof value === 'number' && options.allowExcelSerialDates !== false && value > 1 && value < 100000) {
    sourceValue = excelSerialDateToIso(value) || value;
  }
  return canonicalTemporalCapability(parseCanonicalTemporalSpan(sourceValue));
}

export function parsePeridotCoordinatePair(value) {
  const raw = normalizeTextValue(value);
  if (!raw) return null;

  const pointMatch = raw.match(/^point\s*\(\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s*\)$/i);
  if (pointMatch) {
    const latitude = Number(pointMatch[1]);
    const longitude = Number(pointMatch[2]);
    return isValidCoordinate(latitude, longitude) ? { latitude, longitude, format: 'pointLatLong' } : null;
  }

  const numericParts = raw.match(/[-+]?\d*\.?\d+/g);
  if (!numericParts || numericParts.length < 2) return null;

  const first = Number(numericParts[0]);
  const second = Number(numericParts[1]);
  if (isValidCoordinate(first, second)) {
    return { latitude: first, longitude: second, format: 'latLongPair' };
  }
  if (isValidCoordinate(second, first)) {
    return { latitude: second, longitude: first, format: 'longLatPair' };
  }
  return null;
}

export function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function inferRolesFromHeader(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return [];
  const roles = [];
  for (const { role, patterns } of ROLE_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      roles.push(role);
    }
  }
  return uniqueValues(roles);
}

function normalizeManualRoleMap(fieldRoleMap = {}) {
  const roleToHeaders = new Map();
  Object.entries(fieldRoleMap).forEach(([role, headers]) => {
    if (!role || headers === null || headers === undefined) return;
    const headerList = Array.isArray(headers) ? headers : [headers];
    roleToHeaders.set(role, headerList.map((header) => String(header)));
  });
  return roleToHeaders;
}

function buildFieldSummaries(rows, headers, options) {
  const manualRoleMap = normalizeManualRoleMap(options.fieldRoleMap);
  const manualRolesByHeader = new Map();
  manualRoleMap.forEach((headerList, role) => {
    headerList.forEach((header) => {
      const key = String(header);
      if (!manualRolesByHeader.has(key)) manualRolesByHeader.set(key, []);
      manualRolesByHeader.get(key).push(role);
    });
  });

  return headers.map((header) => {
    const values = rows.map((row) => row?.[header]);
    const filledValues = values.filter((value) => !isBlankValue(value));
    const textValues = filledValues.map(normalizeTextValue);
    const numericValues = filledValues.map(toFiniteNumber).filter((value) => value !== null);
    const initialRoles = uniqueValues([...(manualRolesByHeader.get(header) || []), ...inferRolesFromHeader(header)]);
    const headerHasTemporalRole = initialRoles.some((role) => [ROLE.DATE, ROLE.DATE_START, ROLE.DATE_END, ROLE.DATE_SORT, ROLE.DATE_DISPLAY].includes(role));
    const temporalValues = filledValues.map((value) => parsePeridotTemporalValue(value, { allowExcelSerialDates: headerHasTemporalRole }));
    const sortableTemporalValues = temporalValues.filter((value) => value.isSortable);
    const coordinateValues = filledValues.map(parsePeridotCoordinatePair).filter(Boolean);
    const inferredRoles = inferRolesFromHeader(header);
    const manualRoles = manualRolesByHeader.get(header) || [];
    const roles = uniqueValues([...manualRoles, ...inferredRoles]);
    const avgTextLength = textValues.length
      ? textValues.reduce((sum, value) => sum + value.length, 0) / textValues.length
      : 0;
    const maxTextLength = textValues.length
      ? Math.max(...textValues.map((value) => value.length))
      : 0;
    const uniqueNonBlankValues = uniqueValues(textValues);

    const numericRatio = filledValues.length ? numericValues.length / filledValues.length : 0;
    const temporalRatio = filledValues.length ? sortableTemporalValues.length / filledValues.length : 0;
    const coordinateRatio = filledValues.length ? coordinateValues.length / filledValues.length : 0;
    const uniqueRatio = filledValues.length ? uniqueNonBlankValues.length / filledValues.length : 0;

    const appearsLongText = avgTextLength >= LONG_TEXT_AVERAGE_LENGTH || maxTextLength >= LONG_TEXT_MAX_LENGTH;
    const appearsNumeric = numericRatio >= 0.65 && !roles.includes(ROLE.RECORD_ID);
    const appearsTemporal = temporalRatio >= 0.65 || roles.some((role) => [ROLE.DATE, ROLE.DATE_START, ROLE.DATE_END, ROLE.DATE_SORT].includes(role));
    const appearsCoordinatePair = coordinateRatio >= 0.65 || roles.includes(ROLE.POINT_COORDINATES);
    const appearsCategorical = filledValues.length > 0
      && uniqueNonBlankValues.length <= MAX_CATEGORICAL_UNIQUE_VALUES
      && uniqueRatio <= 0.75
      && !appearsLongText
      && !appearsCoordinatePair
      && !appearsNumeric
      && !isCoordinateOrDateRole(roles);

    const enrichedRoles = [...roles];
    if (appearsLongText && !enrichedRoles.includes(ROLE.LONG_TEXT)) enrichedRoles.push(ROLE.LONG_TEXT);
    if (appearsNumeric && !enrichedRoles.includes(ROLE.MEASURE)) enrichedRoles.push(ROLE.MEASURE);
    if (appearsCategorical && !enrichedRoles.includes(ROLE.CATEGORY)) enrichedRoles.push(ROLE.CATEGORY);

    return {
      header,
      normalizedHeader: normalizeHeader(header),
      roles: uniqueValues(enrichedRoles),
      inferredRoles,
      manualRoles,
      filledCount: filledValues.length,
      blankCount: values.length - filledValues.length,
      uniqueCount: uniqueNonBlankValues.length,
      sampleValues: uniqueNonBlankValues.slice(0, 8),
      numeric: {
        count: numericValues.length,
        ratio: numericRatio,
        min: numericValues.length ? Math.min(...numericValues) : null,
        max: numericValues.length ? Math.max(...numericValues) : null,
        appearsNumeric,
      },
      temporal: {
        count: sortableTemporalValues.length,
        ratio: temporalRatio,
        appearsTemporal,
        precisions: uniqueValues(temporalValues.map((value) => value.precision)).filter(Boolean),
      },
      coordinates: {
        count: coordinateValues.length,
        ratio: coordinateRatio,
        appearsCoordinatePair,
      },
      text: {
        averageLength: avgTextLength,
        maxLength: maxTextLength,
        appearsLongText,
      },
      categorical: {
        appearsCategorical,
        uniqueRatio,
      },
    };
  });
}

function headersForRole(fieldSummaries, role) {
  return fieldSummaries.filter((field) => field.roles.includes(role)).map((field) => field.header);
}

function firstValueForRoles(row, roleHeaders) {
  for (const header of roleHeaders) {
    const value = row?.[header];
    if (!isBlankValue(value)) return value;
  }
  return null;
}

function coordinateFromSeparateFields(row, latHeaders, longHeaders) {
  const lat = toFiniteNumber(firstValueForRoles(row, latHeaders));
  const long = toFiniteNumber(firstValueForRoles(row, longHeaders));
  if (!isValidCoordinate(lat, long)) return null;
  return { latitude: lat, longitude: long, format: 'separateLatitudeLongitude' };
}

function coordinateFromCombinedField(row, coordinateHeaders) {
  for (const header of coordinateHeaders) {
    const parsed = parsePeridotCoordinatePair(row?.[header]);
    if (parsed) return parsed;
  }
  return null;
}

function temporalFromRow(row, roleHeaders) {
  const singleValue = firstValueForRoles(row, roleHeaders.dateHeaders);
  const startValue = firstValueForRoles(row, roleHeaders.dateStartHeaders);
  const endValue = firstValueForRoles(row, roleHeaders.dateEndHeaders);
  const displayValue = firstValueForRoles(row, roleHeaders.dateDisplayHeaders);

  if (!isBlankValue(startValue) || !isBlankValue(endValue)) {
    return parsePeridotTemporalRange({ startValue, endValue, displayValue });
  }

  if (!isBlankValue(singleValue)) {
    return parsePeridotTemporalValue(singleValue);
  }

  if (!isBlankValue(displayValue)) {
    return parsePeridotTemporalValue(displayValue);
  }

  return makeTemporalResult({ display: '', precision: 'unknown', rangeKind: 'unknown' });
}

function auditRow(row, index, roleHeaders, fieldSummaries) {
  const sourceEntity = firstValueForRoles(row, roleHeaders.sourceEntityHeaders);
  const targetEntity = firstValueForRoles(row, roleHeaders.targetEntityHeaders);
  const sourcePlace = firstValueForRoles(row, roleHeaders.sourcePlaceHeaders);
  const targetPlace = firstValueForRoles(row, roleHeaders.targetPlaceHeaders);
  const pointPlace = firstValueForRoles(row, roleHeaders.pointPlaceHeaders);
  const recordLabel = firstValueForRoles(row, roleHeaders.recordLabelHeaders);
  const sourceCitation = firstValueForRoles(row, roleHeaders.sourceCitationHeaders);
  const relationshipType = firstValueForRoles(row, roleHeaders.relationshipTypeHeaders);

  const pointCoordinate = coordinateFromSeparateFields(row, roleHeaders.pointLatitudeHeaders, roleHeaders.pointLongitudeHeaders)
    || coordinateFromCombinedField(row, roleHeaders.pointCoordinateHeaders);
  const sourceCoordinate = coordinateFromSeparateFields(row, roleHeaders.sourceLatitudeHeaders, roleHeaders.sourceLongitudeHeaders)
    || coordinateFromCombinedField(row, roleHeaders.sourceCoordinateHeaders);
  const targetCoordinate = coordinateFromSeparateFields(row, roleHeaders.targetLatitudeHeaders, roleHeaders.targetLongitudeHeaders)
    || coordinateFromCombinedField(row, roleHeaders.targetCoordinateHeaders);
  const temporal = temporalFromRow(row, roleHeaders);

  const filledHeaders = fieldSummaries
    .map((field) => field.header)
    .filter((header) => !isBlankValue(row?.[header]));
  const hasAnyValue = filledHeaders.length > 0;
  const hasEvidence = Boolean(recordLabel || sourceCitation || relationshipType || filledHeaders.length);
  const hasPointLocation = Boolean(pointCoordinate || pointPlace);
  const hasRouteLocation = Boolean((sourceCoordinate || sourcePlace) && (targetCoordinate || targetPlace));
  const hasNetworkRelationship = Boolean(sourceEntity && targetEntity);
  const hasTemporalValue = Boolean(temporal?.isSortable);

  const numericHeaders = fieldSummaries
    .filter((field) => field.numeric.appearsNumeric && !isCoordinateOrDateRole(field.roles))
    .map((field) => field.header)
    .filter((header) => toFiniteNumber(row?.[header]) !== null);
  const categoricalHeaders = fieldSummaries
    .filter((field) => field.categorical.appearsCategorical)
    .map((field) => field.header)
    .filter((header) => !isBlankValue(row?.[header]));

  const capabilities = {
    [CAPABILITY.INSPECTOR_READY]: hasEvidence,
    [CAPABILITY.SEARCH_READY]: hasAnyValue,
    [CAPABILITY.POINT_MAP_READY]: hasPointLocation,
    [CAPABILITY.ROUTE_MAP_READY]: hasRouteLocation,
    [CAPABILITY.NETWORK_READY]: hasNetworkRelationship,
    [CAPABILITY.TIMELINE_READY]: hasTemporalValue,
    [CAPABILITY.CHART_READY]: Boolean(numericHeaders.length || categoricalHeaders.length || hasTemporalValue),
    [CAPABILITY.EXPORT_READY]: hasAnyValue,
  };

  return {
    index,
    label: normalizeTextValue(recordLabel || sourceEntity || pointPlace || sourcePlace || sourceCitation || `Row ${index + 1}`),
    capabilities,
    temporal,
    locations: {
      point: pointCoordinate ? { ...pointCoordinate, place: normalizeTextValue(pointPlace) || null } : (pointPlace ? { place: normalizeTextValue(pointPlace) } : null),
      source: sourceCoordinate ? { ...sourceCoordinate, place: normalizeTextValue(sourcePlace) || null } : (sourcePlace ? { place: normalizeTextValue(sourcePlace) } : null),
      target: targetCoordinate ? { ...targetCoordinate, place: normalizeTextValue(targetPlace) || null } : (targetPlace ? { place: normalizeTextValue(targetPlace) } : null),
    },
    relationship: {
      sourceEntity: normalizeTextValue(sourceEntity) || null,
      targetEntity: normalizeTextValue(targetEntity) || null,
      type: normalizeTextValue(relationshipType) || null,
    },
    chartFields: {
      numeric: numericHeaders,
      categorical: categoricalHeaders,
    },
    filledHeaders,
  };
}

function isCoordinateOrDateRole(roles) {
  return roles.some((role) => [
    ROLE.DATE,
    ROLE.DATE_START,
    ROLE.DATE_END,
    ROLE.DATE_SORT,
    ROLE.DATE_DISPLAY,
    ROLE.DATE_PRECISION,
    ROLE.POINT_LATITUDE,
    ROLE.POINT_LONGITUDE,
    ROLE.POINT_COORDINATES,
    ROLE.SOURCE_LATITUDE,
    ROLE.SOURCE_LONGITUDE,
    ROLE.TARGET_LATITUDE,
    ROLE.TARGET_LONGITUDE,
    ROLE.SOURCE_COORDINATES,
    ROLE.TARGET_COORDINATES,
  ].includes(role));
}

function summarizeCapabilityCounts(rowAudits) {
  const counts = Object.values(CAPABILITY).reduce((acc, capability) => {
    acc[capability] = 0;
    return acc;
  }, {});
  rowAudits.forEach((row) => {
    Object.entries(row.capabilities).forEach(([capability, enabled]) => {
      if (enabled) counts[capability] += 1;
    });
  });
  return counts;
}

function summarizeRecordShapes(rowAudits, fieldSummaries) {
  const capabilityCounts = summarizeCapabilityCounts(rowAudits);
  const totalRows = rowAudits.length || 1;
  const numericMeasureFields = fieldSummaries.filter((field) => field.numeric.appearsNumeric && !isCoordinateOrDateRole(field.roles));
  const temporalFields = fieldSummaries.filter((field) => field.temporal.appearsTemporal);

  return {
    [PERIDOT_RECORD_SHAPES.DIRECTED_RELATIONSHIP]: capabilityCounts.networkReady > 0 || capabilityCounts.routeMapReady > 0,
    [PERIDOT_RECORD_SHAPES.POINT_SITE]: capabilityCounts.pointMapReady > 0 && capabilityCounts.routeMapReady / totalRows < 0.5,
    [PERIDOT_RECORD_SHAPES.TIME_SERIES_MEASUREMENT]: temporalFields.length > 0 && numericMeasureFields.length >= 2,
    [PERIDOT_RECORD_SHAPES.GENERIC_EVIDENCE]: capabilityCounts.inspectorReady > 0 || capabilityCounts.searchReady > 0,
  };
}

function buildRoleHeaders(fieldSummaries) {
  return {
    recordLabelHeaders: headersForRole(fieldSummaries, ROLE.RECORD_LABEL),
    sourceCitationHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_CITATION),
    relationshipTypeHeaders: headersForRole(fieldSummaries, ROLE.RELATIONSHIP_TYPE),
    dateHeaders: headersForRole(fieldSummaries, ROLE.DATE),
    dateStartHeaders: headersForRole(fieldSummaries, ROLE.DATE_START),
    dateEndHeaders: headersForRole(fieldSummaries, ROLE.DATE_END),
    dateDisplayHeaders: headersForRole(fieldSummaries, ROLE.DATE_DISPLAY),
    pointPlaceHeaders: headersForRole(fieldSummaries, ROLE.POINT_PLACE),
    pointLatitudeHeaders: headersForRole(fieldSummaries, ROLE.POINT_LATITUDE),
    pointLongitudeHeaders: headersForRole(fieldSummaries, ROLE.POINT_LONGITUDE),
    pointCoordinateHeaders: headersForRole(fieldSummaries, ROLE.POINT_COORDINATES),
    sourceEntityHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_ENTITY),
    sourcePlaceHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_PLACE),
    sourceLatitudeHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_LATITUDE),
    sourceLongitudeHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_LONGITUDE),
    targetEntityHeaders: headersForRole(fieldSummaries, ROLE.TARGET_ENTITY),
    targetPlaceHeaders: headersForRole(fieldSummaries, ROLE.TARGET_PLACE),
    targetLatitudeHeaders: headersForRole(fieldSummaries, ROLE.TARGET_LATITUDE),
    targetLongitudeHeaders: headersForRole(fieldSummaries, ROLE.TARGET_LONGITUDE),
    sourceCoordinateHeaders: headersForRole(fieldSummaries, ROLE.SOURCE_COORDINATES),
    targetCoordinateHeaders: headersForRole(fieldSummaries, ROLE.TARGET_COORDINATES),
  };
}

function summarizeTemporalCapabilities(rowAudits, fieldSummaries) {
  const precisionCounts = rowAudits.reduce((acc, row) => {
    const precision = row.temporal?.precision || 'unknown';
    acc[precision] = (acc[precision] || 0) + 1;
    return acc;
  }, {});
  const rangeKindCounts = rowAudits.reduce((acc, row) => {
    const rangeKind = row.temporal?.rangeKind || 'unknown';
    acc[rangeKind] = (acc[rangeKind] || 0) + 1;
    return acc;
  }, {});
  const temporalRoleFields = fieldSummaries
    .filter((field) => field.roles.some((role) => [ROLE.DATE, ROLE.DATE_START, ROLE.DATE_END, ROLE.DATE_SORT, ROLE.DATE_DISPLAY].includes(role)))
    .map((field) => field.header);

  return {
    sortableRows: rowAudits.filter((row) => row.temporal?.isSortable).length,
    intervalRows: rowAudits.filter((row) => row.temporal?.isInterval).length,
    closedRangeRows: rowAudits.filter((row) => row.temporal?.rangeKind === 'closedRange').length,
    openStartRows: rowAudits.filter((row) => row.temporal?.rangeKind === 'openStart').length,
    openEndRows: rowAudits.filter((row) => row.temporal?.rangeKind === 'openEnd').length,
    temporalRoleFields,
    precisionCounts,
    rangeKindCounts,
  };
}

function summarizeDataset(rows, fieldSummaries, rowAudits) {
  const totalRows = rows.length;
  const capabilityCounts = summarizeCapabilityCounts(rowAudits);
  const capabilityPercentages = Object.fromEntries(
    Object.entries(capabilityCounts).map(([capability, count]) => [
      capability,
      totalRows ? count / totalRows : 0,
    ]),
  );
  const numericMeasureFields = fieldSummaries
    .filter((field) => field.numeric.appearsNumeric && !isCoordinateOrDateRole(field.roles))
    .map((field) => field.header);
  const categoricalFields = fieldSummaries
    .filter((field) => field.categorical.appearsCategorical)
    .map((field) => field.header);
  const temporalFields = fieldSummaries
    .filter((field) => field.temporal.appearsTemporal)
    .map((field) => field.header);
  const coordinateFields = fieldSummaries
    .filter((field) => field.coordinates.appearsCoordinatePair || field.roles.some((role) => [ROLE.POINT_LATITUDE, ROLE.POINT_LONGITUDE, ROLE.SOURCE_LATITUDE, ROLE.SOURCE_LONGITUDE, ROLE.TARGET_LATITUDE, ROLE.TARGET_LONGITUDE].includes(role)))
    .map((field) => field.header);

  return {
    totalRows,
    totalFields: fieldSummaries.length,
    capabilityCounts,
    capabilityPercentages,
    recordShapes: summarizeRecordShapes(rowAudits, fieldSummaries),
    fieldsByRole: Object.fromEntries(
      Object.values(ROLE).map((role) => [role, headersForRole(fieldSummaries, role)]),
    ),
    analytics: {
      numericMeasureFields,
      categoricalFields,
      temporalFields,
      coordinateFields,
      wideNumericSeriesLikely: temporalFields.length > 0 && numericMeasureFields.length >= 2,
    },
    temporal: summarizeTemporalCapabilities(rowAudits, fieldSummaries),
    warnings: buildDatasetWarnings(totalRows, capabilityCounts, fieldSummaries),
  };
}

function buildDatasetWarnings(totalRows, capabilityCounts, fieldSummaries) {
  const warnings = [];
  if (!totalRows) warnings.push('No rows were available for capability auditing.');
  if (totalRows && capabilityCounts.pointMapReady === 0 && capabilityCounts.routeMapReady === 0) {
    warnings.push('No point-map or route-map records were detected. Records may still be searchable, inspectable, chartable, or exportable.');
  }
  if (totalRows && capabilityCounts.networkReady === 0) {
    warnings.push('No source-target entity relationships were detected for network views. Point/site, catalogue, and time-series datasets can still be valid without network data.');
  }
  if (totalRows && capabilityCounts.timelineReady === 0) {
    warnings.push('No sortable temporal values were detected for timeline playback or date-range filters. Date text may still be preserved as evidence.');
  }
  if (!fieldSummaries.some((field) => field.numeric.appearsNumeric && !isCoordinateOrDateRole(field.roles))) {
    warnings.push('No numeric measure fields were detected for quantitative charts. Categorical, temporal, or evidence fields may still support other chart types.');
  }
  return warnings;
}

export function inferPeridotFieldRoles(headers = []) {
  return Object.fromEntries(
    headers.map((header) => [header, inferRolesFromHeader(header)]),
  );
}

export function auditPeridotDataCapabilities(rows = [], options = {}) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const explicitHeaders = Array.isArray(options.headers) ? options.headers : [];
  const detectedHeaders = uniqueValues(
    safeRows.flatMap((row) => Object.keys(row || {})),
  );
  const headers = explicitHeaders.length ? explicitHeaders : detectedHeaders;
  const fieldSummaries = buildFieldSummaries(safeRows, headers, options);
  const roleHeaders = buildRoleHeaders(fieldSummaries);
  const rowAudits = safeRows.map((row, index) => auditRow(row, index, roleHeaders, fieldSummaries));
  const dataset = summarizeDataset(safeRows, fieldSummaries, rowAudits);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    fields: fieldSummaries,
    rows: rowAudits,
    dataset,
  };
}

export function createPeridotCapabilitySummary(audit) {
  const dataset = audit?.dataset;
  if (!dataset) return [];
  const total = dataset.totalRows || 0;
  const counts = dataset.capabilityCounts || {};
  return [
    `Rows reviewed: ${total}`,
    `Available in Inspector: ${counts.inspectorReady ?? 0} of ${total}`,
    `Searchable: ${counts.searchReady ?? 0} of ${total}`,
    `Point Map available: ${counts.pointMapReady ?? 0} of ${total}`,
    `Route Map available: ${counts.routeMapReady ?? 0} of ${total}`,
    `Network available: ${counts.networkReady ?? 0} of ${total}`,
    `Timeline available: ${counts.timelineReady ?? 0} of ${total}`,
    `Temporal intervals: ${dataset.temporal?.intervalRows ?? 0} of ${total} (${dataset.temporal?.closedRangeRows ?? 0} closed ranges, ${dataset.temporal?.openStartRows ?? 0} start-only, ${dataset.temporal?.openEndRows ?? 0} end-only)`,
    `Charts available: ${counts.chartReady ?? 0} of ${total}`,
    `Numeric measure fields: ${dataset.analytics?.numericMeasureFields?.join(', ') || 'none detected'}`,
    `Categorical fields: ${dataset.analytics?.categoricalFields?.join(', ') || 'none detected'}`,
    `Temporal fields: ${dataset.analytics?.temporalFields?.join(', ') || 'none detected'}`,
  ];
}
