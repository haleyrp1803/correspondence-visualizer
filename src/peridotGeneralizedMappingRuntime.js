/*
 * Runtime application for the generalized single-table mapping vocabulary.
 *
 * This module is the controlled boundary between user-confirmed semantic
 * assignments (places, relationship participants, time, evidence) and the
 * temporary correspondence-shaped rows still required by legacy consumers.
 * The generalized observation is authoritative; the legacy row is a derived
 * compatibility projection only.
 */

import { parsePeridotCoordinatePair } from './peridotDataCapabilityAudit.js';

function asText(value) {
  return String(value ?? '').trim();
}


function composeDisplayDateValue(singleDate, dateStart, dateEnd) {
  const single = asText(singleDate);
  const start = asText(dateStart);
  const end = asText(dateEnd);
  if (single) return single;
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return start || end || '';
}

function asNumber(value) {
  const text = asText(value);
  if (!text || text === '-' || text.toLowerCase() === 'unknown') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function valueFrom(row = {}, column = '') {
  return column ? row?.[column] ?? '' : '';
}

function roleFromPart(row = {}, part = {}, valueColumnKey = '') {
  const valueColumn = asText(part?.[valueColumnKey]);
  if (part?.roleMode === 'column') return asText(valueFrom(row, part?.roleColumn));
  return valueColumn;
}

function coordinatesFromPlacePart(row = {}, part = {}) {
  const pairColumn = asText(part?.coordinatePairColumn);
  const latitudeColumn = asText(part?.latitudeColumn);
  const longitudeColumn = asText(part?.longitudeColumn);
  const parsedPair = pairColumn ? parsePeridotCoordinatePair(valueFrom(row, pairColumn)) : null;

  if (parsedPair) {
    return {
      latitude: parsedPair.latitude,
      longitude: parsedPair.longitude,
      sourceColumns: [pairColumn],
    };
  }

  return {
    latitude: asNumber(valueFrom(row, latitudeColumn)),
    longitude: asNumber(valueFrom(row, longitudeColumn)),
    sourceColumns: [latitudeColumn, longitudeColumn].filter(Boolean),
  };
}

function buildGeneralizedParticipants(row = {}, relationshipParts = []) {
  return (relationshipParts || [])
    .map((part, index) => {
      const sourceColumn = asText(part?.participantColumn);
      const value = asText(valueFrom(row, sourceColumn));
      if (!sourceColumn || !value) return null;
      return {
        index,
        value,
        role: roleFromPart(row, part, 'participantColumn') || `participant-${index + 1}`,
        sourceColumn,
        roleSourceColumn: part?.roleMode === 'column' ? asText(part?.roleColumn) : '',
      };
    })
    .filter(Boolean);
}

function buildGeneralizedPlaces(row = {}, placeParts = []) {
  return (placeParts || [])
    .map((part, index) => {
      const sourceColumn = asText(part?.placeColumn);
      const label = asText(valueFrom(row, sourceColumn));
      const coordinates = coordinatesFromPlacePart(row, part);
      const hasCoordinates = Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
      if (!sourceColumn && !hasCoordinates) return null;
      if (!label && !hasCoordinates) return null;
      return {
        index,
        label,
        role: roleFromPart(row, part, 'placeColumn') || `place-${index + 1}`,
        sourceColumn,
        roleSourceColumn: part?.roleMode === 'column' ? asText(part?.roleColumn) : '',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        coordinateSourceColumns: coordinates.sourceColumns,
      };
    })
    .filter(Boolean);
}

function buildGeneralizedTemporal(row = {}, temporalMapping = {}) {
  const date = valueFrom(row, temporalMapping.Date);
  const dateStart = valueFrom(row, temporalMapping.Date_Start);
  const dateEnd = valueFrom(row, temporalMapping.Date_End);
  return {
    date,
    dateStart,
    dateEnd,
    displayDate: composeDisplayDateValue(date, dateStart, dateEnd, ''),
    sourceColumns: {
      date: asText(temporalMapping.Date),
      dateStart: asText(temporalMapping.Date_Start),
      dateEnd: asText(temporalMapping.Date_End),
    },
  };
}

function buildGeneralizedRelationshipMetadata(row = {}, mapping = {}) {
  return {
    type: asText(valueFrom(row, mapping.Relationship_Type)),
    label: asText(valueFrom(row, mapping.Relationship_Label)),
    sourceColumns: {
      type: asText(mapping.Relationship_Type),
      label: asText(mapping.Relationship_Label),
    },
  };
}

function buildEvidenceFields(row = {}, selections = []) {
  return (selections || [])
    .filter((selection) => selection?.action === 'include')
    .map((selection) => ({
      sourceColumn: asText(selection?.sourceColumn),
      label: asText(selection?.label || selection?.sourceColumn),
      value: valueFrom(row, selection?.sourceColumn),
      analyticsEligible: Boolean(selection?.analyticsEligible),
    }))
    .filter((field) => field.sourceColumn);
}

export function buildPeridotGeneralizedObservation(row = {}, mapping = {}, rowIndex = 0) {
  return Object.freeze({
    schemaVersion: '1.0.0-draft',
    rowIndex,
    originalUploadedRow: { ...(row || {}) },
    participants: Object.freeze(buildGeneralizedParticipants(row, mapping.relationshipParts || [])),
    places: Object.freeze(buildGeneralizedPlaces(row, mapping.placeParts || [])),
    temporal: Object.freeze(buildGeneralizedTemporal(row, mapping.temporalMapping || {})),
    relationship: Object.freeze(buildGeneralizedRelationshipMetadata(row, mapping.relationshipMetadataMapping || {})),
    evidenceFields: Object.freeze(buildEvidenceFields(row, mapping.customFieldSelections || [])),
  });
}

function projectPlaceToLegacy(row, place, prefix) {
  if (!place) return;
  if (prefix === 'Point') {
    row.Point_Place = place.label || '';
    row.Point_Latitude = Number.isFinite(place.latitude) ? place.latitude : '';
    row.Point_Longitude = Number.isFinite(place.longitude) ? place.longitude : '';
    return;
  }
  row[`${prefix}_Location`] = place.label || '';
  row[`${prefix}_Latitude`] = Number.isFinite(place.latitude) ? place.latitude : '';
  row[`${prefix}_Longitude`] = Number.isFinite(place.longitude) ? place.longitude : '';
}

function findPlaceByLegacySourceColumn(observation, legacyColumn) {
  const sourceColumn = asText(legacyColumn);
  if (!sourceColumn) return null;
  return observation.places.find((place) => place.sourceColumn === sourceColumn) || null;
}

/**
 * Build one temporary correspondence-shaped compatibility row from an
 * authoritative generalized observation.
 *
 * Directed-record compatibility uses the first two mapped relationship parts
 * as Source and Target. Place routing is only retained when the generalized
 * place still corresponds to a previously recognized point/source/target
 * column; otherwise the first mapped place is exposed conservatively as a
 * point rather than inventing a route.
 */
export function projectGeneralizedObservationToLegacyRow(observation = {}, mapping = {}) {
  const original = observation.originalUploadedRow || {};
  const legacyRow = { ...original };
  const [sourceParticipant, targetParticipant] = observation.participants || [];

  legacyRow.Source_Name = sourceParticipant?.value || '';
  legacyRow.Target_Name = targetParticipant?.value || '';

  const temporal = observation.temporal || {};
  legacyRow.Date = temporal.date || temporal.dateStart || temporal.dateEnd || '';
  legacyRow.Date_Start = temporal.dateStart || '';
  legacyRow.Date_End = temporal.dateEnd || '';
  legacyRow.Date_Display = temporal.displayDate || '';

  const pointPlace = findPlaceByLegacySourceColumn(observation, mapping.pointMapping?.Point_Place);
  const sourcePlace = findPlaceByLegacySourceColumn(observation, mapping.coreMapping?.Source_Location);
  const targetPlace = findPlaceByLegacySourceColumn(observation, mapping.coreMapping?.Target_Location);

  projectPlaceToLegacy(legacyRow, pointPlace, 'Point');
  projectPlaceToLegacy(legacyRow, sourcePlace, 'Source');
  projectPlaceToLegacy(legacyRow, targetPlace, 'Target');

  if (!pointPlace && !sourcePlace && !targetPlace && observation.places?.length) {
    projectPlaceToLegacy(legacyRow, observation.places[0], 'Point');
  }

  const relationship = observation.relationship || {};
  legacyRow.Relationship = relationship.type || relationship.label || legacyRow.Relationship || '';

  const customInspectorFields = (observation.evidenceFields || []).map((field) => ({ ...field }));
  const usedColumns = new Set([
    ...(observation.participants || []).flatMap((part) => [part.sourceColumn, part.roleSourceColumn]),
    ...(observation.places || []).flatMap((place) => [place.sourceColumn, place.roleSourceColumn, ...(place.coordinateSourceColumns || [])]),
    ...Object.values(temporal.sourceColumns || {}),
    ...Object.values(relationship.sourceColumns || {}),
    ...customInspectorFields.map((field) => field.sourceColumn),
  ].filter(Boolean));

  return {
    ...legacyRow,
    originalUploadedRow: { ...original },
    customInspectorFields,
    ignoredUploadedColumns: Object.keys(original).filter((column) => !usedColumns.has(column)),
    generalizedObservation: observation,
  };
}

export function applyPeridotGeneralizedColumnMapping(rows = [], mapping = {}) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const observation = buildPeridotGeneralizedObservation(row, mapping, index);
    return projectGeneralizedObservationToLegacyRow(observation, mapping);
  });
}
