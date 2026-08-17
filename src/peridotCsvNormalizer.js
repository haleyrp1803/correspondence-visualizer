/*
 * Normalizer for the public one-file Peridot CSV template.
 * 
 * This module converts template rows into the legacy internal shapes used by the visualization pipeline: geography rows, linked-record metadata, lightweight person metadata, place entries, and custom Inspector fields.
 * 
 * Important relationships:
 * - `peridotCsvSchema.js` defines the public columns this file expects.
 * - `App.jsx` uses this file after upload to produce active app data.
 * 
 * Maintenance cautions:
 * - Do not clean or standardize user-entered names, places, topics, languages, or dates beyond the explicit parsing needed for capabilities. Peridot preserves user values as entered.
 */

/**
 * Peridot template CSV normalizer.
 *
 * Pass 2 scope:
 * - convert parsed rows from the standardized one-file Peridot CSV template
 *   into the existing internal row shapes used by the legacy D3/SVG app;
 * - preserve original user-entered metadata for Inspector/Export/Analytics;
 * - keep this module pure and unmounted: no UI wiring, no upload-state changes,
 *   no validation popup, and no legacy three-file upload removal yet.
 *
 * This file intentionally does not clean, standardize, merge, or reinterpret
 * user values beyond light trimming and numeric coordinate parsing. Peridot
 * treats names, places, topics, languages, relationships, and notes exactly as
 * the user entered them.
 */

import {
  getPeridotRowCapabilities,
  hasMappableCoordinatePair,
  isAcceptedPeridotRecord,
} from './peridotCsvSchema.js';
import { parsePeridotCoordinatePair } from './peridotDataCapabilityAudit.js';

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value) {
  const text = asText(value);
  if (!text || text === '-' || text.toLowerCase() === 'unknown') return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function hasValidCoordinatePair(lat, lon) {
  return isValidLatitude(lat) && isValidLongitude(lon);
}


function coordinateFromPairValue(value) {
  const parsed = parsePeridotCoordinatePair(value);
  if (!parsed) return null;
  return { lat: parsed.latitude, lon: parsed.longitude };
}

function coordinateFromFields(row, latitudeField, longitudeField, coordinatePairField) {
  const pair = coordinateFromPairValue(row?.[coordinatePairField]);
  if (pair) return pair;
  const lat = asNumber(row?.[latitudeField]);
  const lon = asNumber(row?.[longitudeField]);
  return hasValidCoordinatePair(lat, lon) ? { lat, lon } : null;
}

function getPointPlaceLabel(row) {
  return asText(row?.Point_Place) || asText(row?.Source_Location) || asText(row?.Target_Location) || asText(row?.Source_Name) || asText(row?.Target_Name) || 'Mapped point';
}

function makePlaceKey(label, lat, lon) {
  return `${label}__${lat}__${lon}`;
}

function makePersonKey(source, target) {
  return `${source}-->${target}`;
}

function normalizeCustomInspectorFields(row) {
  const fields = Array.isArray(row?.customInspectorFields) ? row.customInspectorFields : [];
  return fields
    .map((field) => ({
      key: asText(field?.key || field?.sourceColumn || field?.label),
      sourceColumn: asText(field?.sourceColumn || field?.key || field?.label),
      label: asText(field?.label || field?.sourceColumn || field?.key),
      value: field?.value ?? '',
      analyticsEligible: Boolean(field?.analyticsEligible),
    }))
    .filter((field) => field.key || field.label);
}

function buildCustomInspectorFieldObject(row) {
  const result = {};
  normalizeCustomInspectorFields(row).forEach((field) => {
    const label = field.label || field.key;
    if (!label) return;
    result[label] = field.value;
  });
  return result;
}

function getDisplayDateValue(row) {
  return asText(row?.Date_Display)
    || asText(row?.Date)
    || asText(row?.Date_Start)
    || asText(row?.Date_End);
}

function buildPeridotTemplatePlaceMapEntry(placeMap, { label, lat, lon, roleHint }) {
  if (!label || !hasValidCoordinatePair(lat, lon) || (lat === 0 && lon === 0)) {
    return null;
  }

  const key = makePlaceKey(label, lat, lon);

  if (!placeMap.has(key)) {
    placeMap.set(key, {
      id: key,
      label,
      lat,
      lon,
      type: 'place',
      roleHint,
      politicalHints: [],
    });
  }

  return key;
}

/**
 * Convert one public Peridot template row into the internal geographic-row
 * shape currently consumed by map and graph derivation.
 */
export function normalizePeridotTemplateRowForGeography(
  row,
  index = 0,
  placeMap = new Map(),
  recordId = `peridot_record_${index + 1}`,
) {
  const customInspectorFields = normalizeCustomInspectorFields(row);
  const customInspectorFieldValues = buildCustomInspectorFieldObject(row);
  const pointCoordinate = coordinateFromFields(row, 'Point_Latitude', 'Point_Longitude', 'Point_Coordinates');
  const sourceCoordinate = coordinateFromFields(row, 'Source_Latitude', 'Source_Longitude', 'Source_Coordinates');
  const targetCoordinate = coordinateFromFields(row, 'Target_Latitude', 'Target_Longitude', 'Target_Coordinates');
  const pointLoc = asText(row?.Point_Place);
  const sourceLoc = asText(row?.Source_Location) || (sourceCoordinate ? '' : pointLoc);
  const targetLoc = asText(row?.Target_Location) || '';
  const sourcePerson = asText(row?.Source_Name);
  const targetPerson = asText(row?.Target_Name);
  const pointLabel = getPointPlaceLabel(row);
  const pointPlaceId = pointCoordinate
    ? buildPeridotTemplatePlaceMapEntry(placeMap, {
        label: pointLabel,
        lat: pointCoordinate.lat,
        lon: pointCoordinate.lon,
        roleHint: 'point',
      })
    : null;
  const sourceLat = sourceCoordinate?.lat ?? (pointCoordinate ? pointCoordinate.lat : asNumber(row?.Source_Latitude));
  const sourceLon = sourceCoordinate?.lon ?? (pointCoordinate ? pointCoordinate.lon : asNumber(row?.Source_Longitude));
  const targetLat = targetCoordinate?.lat ?? (pointCoordinate ? pointCoordinate.lat : asNumber(row?.Target_Latitude));
  const targetLon = targetCoordinate?.lon ?? (pointCoordinate ? pointCoordinate.lon : asNumber(row?.Target_Longitude));
  const resolvedSourceLoc = sourceCoordinate ? asText(row?.Source_Location) : (pointCoordinate ? pointLabel : sourceLoc);
  const resolvedTargetLoc = targetCoordinate ? asText(row?.Target_Location) : (pointCoordinate ? pointLabel : targetLoc);
  const sourcePlaceId = sourceCoordinate || pointCoordinate ? buildPeridotTemplatePlaceMapEntry(placeMap, {
    label: resolvedSourceLoc,
    lat: sourceLat,
    lon: sourceLon,
    roleHint: pointCoordinate && !sourceCoordinate ? 'point' : 'source',
  }) : null;
  const targetPlaceId = targetCoordinate || pointCoordinate ? buildPeridotTemplatePlaceMapEntry(placeMap, {
    label: resolvedTargetLoc,
    lat: targetLat,
    lon: targetLon,
    roleHint: pointCoordinate && !targetCoordinate ? 'point' : 'target',
  }) : null;

  return {
    ...customInspectorFieldValues,
    id: `peridot_geo_${index + 1}`,
    recordId,
    date: getDisplayDateValue(row),
    dateStart: asText(row?.Date_Start),
    dateEnd: asText(row?.Date_End),
    dateDisplay: asText(row?.Date_Display),
    pointLoc: asText(row?.Point_Place),
    pointCoordinates: asText(row?.Point_Coordinates),
    pointLoc,
    pointLat: pointCoordinate?.lat ?? NaN,
    pointLon: pointCoordinate?.lon ?? NaN,
    pointPlaceId,
    pointRecord: Boolean(pointCoordinate && !sourceCoordinate && !targetCoordinate),
    sourceLoc: resolvedSourceLoc,
    sourceLat,
    sourceLon,
    sourcePerson,
    sourcePoliticalHint: '',
    targetPerson,
    targetLoc: resolvedTargetLoc,
    targetLat,
    targetLon,
    targetPoliticalHint: '',
    sourcePlaceId,
    targetPlaceId,
    mappable: Boolean(sourcePlaceId && targetPlaceId),
    peridotCapabilities: getPeridotRowCapabilities(row),
    customInspectorFields,
    ignoredUploadedColumns: Array.isArray(row?.ignoredUploadedColumns) ? [...row.ignoredUploadedColumns] : [],
    originalUploadedRow: row?.originalUploadedRow ? { ...row.originalUploadedRow } : null,
    // Preserve the authoritative generalized mapping semantics through the
    // temporary legacy runtime adapter. Network and other generalized
    // consumers must not have to reconstruct relationship meaning from
    // Source/Target compatibility fields after import.
    generalizedObservation: row?.generalizedObservation || null,
    originalTemplateRow: { ...(row || {}) },
  };
}

/**
 * Convert one public Peridot template row into the internal letter/Inspector
 * metadata shape currently consumed by inspector and Analytics workflows.
 */
export function normalizePeridotTemplateRowForLetter(
  row,
  index = 0,
  recordId = `peridot_record_${index + 1}`,
) {
  const customInspectorFields = normalizeCustomInspectorFields(row);
  const customInspectorFieldValues = buildCustomInspectorFieldObject(row);
  const source = asText(row?.Source_Name);
  const target = asText(row?.Target_Name);
  const archive = asText(row?.Archive);
  const collection = asText(row?.Collection);
  const pages = asText(row?.['Page(s)']);
  const links = asText(row?.['Link(s)']);
  const date = getDisplayDateValue(row);

  return {
    ...customInspectorFieldValues,
    id: `peridot_letter_${index + 1}`,
    recordId,
    archive,
    archivalCollection: collection,
    archivalPage: pages,
    pdfPage: '',
    date,
    dateStart: asText(row?.Date_Start),
    dateEnd: asText(row?.Date_End),
    dateDisplay: asText(row?.Date_Display),
    pointLoc: asText(row?.Point_Place),
    pointCoordinates: asText(row?.Point_Coordinates),
    sourceLoc: asText(row?.Source_Location),
    source,
    sourceTitle: asText(row?.Source_Title),
    target,
    targetTitle: asText(row?.Target_Title),
    targetLoc: asText(row?.Target_Location),
    relationship: asText(row?.Relationship),
    cipher: '',
    topic: asText(row?.Topic),
    language: asText(row?.Language),
    transcription: asText(row?.Transcription),
    translation: '',
    notes: asText(row?.Notes),
    links,
    personKey: makePersonKey(source, target),
    peridotCapabilities: getPeridotRowCapabilities(row),
    customInspectorFields,
    ignoredUploadedColumns: Array.isArray(row?.ignoredUploadedColumns) ? [...row.ignoredUploadedColumns] : [],
    originalUploadedRow: row?.originalUploadedRow ? { ...row.originalUploadedRow } : null,
    // Preserve the authoritative generalized mapping semantics through the
    // temporary legacy runtime adapter. Network and other generalized
    // consumers must not have to reconstruct relationship meaning from
    // Source/Target compatibility fields after import.
    generalizedObservation: row?.generalizedObservation || null,
    originalTemplateRow: { ...(row || {}) },
  };
}

/**
 * Build a lightweight person-metadata table from source/target names and titles.
 *
 * This does not infer identity, merge variants, or standardize names. It only
 * preserves exact entered names and the first title encountered for that exact
 * string. The existing external-link metadata fields are kept empty because the
 * one-file public template does not include them.
 */
export function buildPersonMetadataRowsFromPeridotTemplate(rows = []) {
  const people = new Map();

  rows.forEach((row) => {
    const pairs = [
      [asText(row?.Source_Name), asText(row?.Source_Title)],
      [asText(row?.Target_Name), asText(row?.Target_Title)],
    ];

    pairs.forEach(([person, title]) => {
      if (!person || people.has(person)) return;
      people.set(person, {
        id: `peridot_person_meta_${people.size + 1}`,
        person,
        title,
        wikiEn: '',
        wikiIt: '',
        treccani: '',
        imageCreativeCommons: '',
        originalTemplateRows: [],
      });
    });

    pairs.forEach(([person]) => {
      if (!person || !people.has(person)) return;
      people.get(person).originalTemplateRows.push({ ...(row || {}) });
    });
  });

  return Array.from(people.values());
}

/**
 * Normalize parsed rows from the one-file Peridot CSV template.
 *
 * Returns:
 * - normalizedRows: internal geography rows for map/place graph workflows;
 * - normalizedLetters: internal letter rows for Inspector/Analytics metadata;
 * - normalizedPersonMetadata: exact-name person metadata derived from template
 *   names/titles only;
 * - places: map-ready places derived only from valid coordinate pairs;
 * - acceptedRows: accepted database records under the permissive minimum rule;
 * - unsupportedRows: rows with no usable relationship, place, point/site,
 *   temporal, chart, citation, evidence, or metadata content.
 */
export function normalizePeridotTemplateRows(rows = []) {
  const placeMap = new Map();

  const preparedRows = rows.map((row, index) => {
    const recordId = `peridot_record_${index + 1}`;
    const geographyRow = normalizePeridotTemplateRowForGeography(row, index, placeMap, recordId);
    const letterRow = normalizePeridotTemplateRowForLetter(row, index, recordId);
    const accepted = isAcceptedPeridotRecord(row);
    const capabilities = getPeridotRowCapabilities(row);

    return {
      index,
      rowNumber: index + 2,
      originalRow: { ...(row || {}) },
      accepted,
      mappable: hasMappableCoordinatePair(row),
      capabilities,
      geographyRow,
      letterRow,
    };
  });

  const acceptedPreparedRows = preparedRows.filter((row) => row.accepted);
  const unsupportedRows = preparedRows.filter((row) => !row.accepted);

  return {
    normalizedRows: acceptedPreparedRows.map((row) => row.geographyRow),
    normalizedLetters: acceptedPreparedRows.map((row) => row.letterRow),
    normalizedPersonMetadata: buildPersonMetadataRowsFromPeridotTemplate(
      acceptedPreparedRows.map((row) => row.originalRow)
    ),
    places: Array.from(placeMap.values()),
    acceptedRows: acceptedPreparedRows,
    unsupportedRows,
    allRows: preparedRows,
  };
}

/**
 * Convert normalized template output into CSV text strings that match the
 * current three-source internal upload model. This is useful for transition
 * testing before the one-file workflow is wired directly into React state.
 */
export function buildLegacyCsvTablesFromPeridotTemplateRows(rows = []) {
  const {
    normalizedRows,
    normalizedLetters,
    normalizedPersonMetadata,
  } = normalizePeridotTemplateRows(rows);

  return {
    geographyRows: normalizedRows,
    letterRows: normalizedLetters,
    personMetadataRows: normalizedPersonMetadata,
  };
}
