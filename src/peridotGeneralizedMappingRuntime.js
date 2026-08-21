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
import { composeTemporalPartsValue, getTemporalAssertionSourceColumns, normalizeTemporalAssertionMappings } from './peridotTemporalMapping.js';
import { getPeridotIdentityRuntimeSourceColumns, materializePeridotSingleTableIdentityMappingSuggestions, resolvePeridotMappedEntityIdentity, resolvePeridotMappedRecordIdentity } from './peridotIdentityRuntime.js';

function asText(value) {
  return String(value ?? '').trim();
}


function composeDisplayDateValue(singleDate, dateRange, dateStart, dateEnd) {
  const single = asText(singleDate);
  const range = asText(dateRange);
  const start = asText(dateStart);
  const end = asText(dateEnd);
  if (single) return single;
  if (range) return range;
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
  const explicitRole = asText(part?.roleLabel);
  if (explicitRole) return explicitRole;
  const valueColumn = asText(part?.[valueColumnKey]);
  if (part?.roleMode === 'column') return asText(valueFrom(row, part?.roleColumn));
  return asText(part?.headingRole) || valueColumn;
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

function buildGeneralizedParticipants(row = {}, relationshipParts = [], identityMapping = {}, rowIndex = 0) {
  return (relationshipParts || [])
    .map((part, index) => {
      const sourceColumn = asText(part?.participantColumn);
      const value = asText(valueFrom(row, sourceColumn));
      if (!sourceColumn || !value) return null;
      const identity = resolvePeridotMappedEntityIdentity({
        row, rowIndex, identityMapping, appearanceKind: 'relationship', appearanceIndex: index, label: value,
      });
      return {
        index,
        value,
        entityId: identity.entityId,
        identity,
        role: roleFromPart(row, part, 'participantColumn') || `participant-${index + 1}`,
        sourceColumn,
        roleSourceColumn: part?.roleMode === 'column' ? asText(part?.roleColumn) : '',
      };
    })
    .filter(Boolean);
}

function buildGeneralizedPlaces(row = {}, placeParts = [], identityMapping = {}, rowIndex = 0) {
  return (placeParts || [])
    .map((part, index) => {
      const sourceColumn = asText(part?.placeColumn);
      const label = asText(valueFrom(row, sourceColumn));
      const coordinates = coordinatesFromPlacePart(row, part);
      const hasCoordinates = Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
      if (!sourceColumn && !hasCoordinates) return null;
      if (!label && !hasCoordinates) return null;
      const identity = resolvePeridotMappedEntityIdentity({
        row, rowIndex, identityMapping, appearanceKind: 'place', appearanceIndex: index, label,
      });
      return {
        index,
        label,
        entityId: identity.entityId,
        identity,
        role: roleFromPart(row, part, 'placeColumn') || `place-${index + 1}`,
        sourceColumn,
        roleSourceColumn: part?.roleMode === 'column' ? asText(part?.roleColumn) : '',
        subjectParticipantIndex: Number.isInteger(part?.subjectParticipantIndex) ? part.subjectParticipantIndex : null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        coordinateSourceColumns: coordinates.sourceColumns,
      };
    })
    .filter(Boolean);
}

function buildTemporalNotes(row = {}, noteColumns = []) {
  return (Array.isArray(noteColumns) ? noteColumns : [])
    .map((sourceColumn) => {
      const column = asText(sourceColumn);
      if (!column) return null;
      return { label: column, sourceColumn: column, value: valueFrom(row, column) };
    })
    .filter(Boolean);
}

function buildTemporalAssertionDescriptors(row = {}, temporalAssertionMappings = []) {
  const value = (column) => valueFrom(row, column);
  const notesFor = (mapping) => buildTemporalNotes(row, mapping.noteColumns || []);
  const partValue = (mapping, prefix = '') => composeTemporalPartsValue({
    year: value(mapping[prefix ? `${prefix}YearColumn` : 'yearColumn']),
    month: value(mapping[prefix ? `${prefix}MonthColumn` : 'monthColumn']),
    day: value(mapping[prefix ? `${prefix}DayColumn` : 'dayColumn']),
  });

  return normalizeTemporalAssertionMappings(temporalAssertionMappings).map((mapping, index) => {
    const role = asText(mapping.role) || `Time ${index + 1}`;
    const notes = notesFor(mapping);
    if (mapping.kind === 'period') {
      if (mapping.sourceMode === 'single') {
        const sourceText = value(mapping.column);
        if (!asText(sourceText)) return null;
        return { fieldKey: mapping.id, role, sourceText, kind: 'span', notes, subjectParticipantIndex: Number.isInteger(mapping.subjectParticipantIndex) ? mapping.subjectParticipantIndex : null };
      }
      const startValue = mapping.startMode === 'parts' ? partValue(mapping, 'start') : value(mapping.startColumn);
      const endValue = mapping.endMode === 'parts' ? partValue(mapping, 'end') : value(mapping.endColumn);
      if (!asText(startValue) && !asText(endValue)) return null;
      return {
        fieldKey: mapping.id, role, startValue, endValue,
        sourceText: composeDisplayDateValue('', '', startValue, endValue), kind: 'range', notes, subjectParticipantIndex: Number.isInteger(mapping.subjectParticipantIndex) ? mapping.subjectParticipantIndex : null,
      };
    }
    const sourceText = mapping.sourceMode === 'parts' ? partValue(mapping) : value(mapping.column);
    if (!asText(sourceText)) return null;
    return { fieldKey: mapping.id, role, sourceText, kind: 'point', notes, subjectParticipantIndex: Number.isInteger(mapping.subjectParticipantIndex) ? mapping.subjectParticipantIndex : null };
  }).filter(Boolean);
}

function buildGeneralizedTemporal(row = {}, temporalMapping = {}, temporalNoteMappings = {}, temporalAssertionMappings = []) {
  const date = valueFrom(row, temporalMapping.Date);
  const dateRange = valueFrom(row, temporalMapping.Date_Range);
  const dateStart = valueFrom(row, temporalMapping.Date_Start);
  const dateEnd = valueFrom(row, temporalMapping.Date_End);
  const mappedAssertions = buildTemporalAssertionDescriptors(row, temporalAssertionMappings);
  const assertions = mappedAssertions.length ? mappedAssertions : [];

  if (!mappedAssertions.length) {
    if (asText(date)) assertions.push({ fieldKey: 'Date', role: asText(temporalMapping.Date) || 'Date', sourceText: date, kind: 'point', notes: buildTemporalNotes(row, temporalNoteMappings.Date) });
    if (asText(dateRange)) assertions.push({ fieldKey: 'Date_Range', role: asText(temporalMapping.Date_Range) || 'Date range', sourceText: dateRange, kind: 'span', notes: buildTemporalNotes(row, temporalNoteMappings.Date_Range) });
    if (asText(dateStart) || asText(dateEnd)) assertions.push({
      fieldKey: 'Date_Start_End', role: [asText(temporalMapping.Date_Start), asText(temporalMapping.Date_End)].filter(Boolean).join(' / ') || 'Date interval',
      startValue: dateStart, endValue: dateEnd, sourceText: composeDisplayDateValue('', '', dateStart, dateEnd), kind: 'range',
      notes: [...buildTemporalNotes(row, temporalNoteMappings.Date_Start), ...buildTemporalNotes(row, temporalNoteMappings.Date_End)]
        .filter((note, index, all) => all.findIndex((candidate) => candidate.sourceColumn === note.sourceColumn) === index),
    });
  }

  const first = assertions[0] || null;
  const compatibilityDate = first?.kind === 'point' ? first.sourceText : '';
  const compatibilityRange = first?.kind === 'span' ? first.sourceText : '';
  const compatibilityStart = first?.kind === 'range' ? first.startValue : '';
  const compatibilityEnd = first?.kind === 'range' ? first.endValue : '';
  return {
    date: date || compatibilityDate,
    dateRange: dateRange || compatibilityRange,
    dateStart: dateStart || compatibilityStart,
    dateEnd: dateEnd || compatibilityEnd,
    displayDate: composeDisplayDateValue(date || compatibilityDate, dateRange || compatibilityRange, dateStart || compatibilityStart, dateEnd || compatibilityEnd),
    assertions: Object.freeze(assertions.map((assertion) => Object.freeze({ ...assertion, notes: Object.freeze(assertion.notes || []) }))),
    sourceColumns: { date: asText(temporalMapping.Date), dateRange: asText(temporalMapping.Date_Range), dateStart: asText(temporalMapping.Date_Start), dateEnd: asText(temporalMapping.Date_End) },
    noteSourceColumns: Object.freeze(Object.fromEntries(Object.entries(temporalNoteMappings || {}).map(([key, columns]) => [key, Object.freeze([...(Array.isArray(columns) ? columns : [])].map(asText).filter(Boolean))]))),
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
  const recordIdentity = resolvePeridotMappedRecordIdentity({ row, rowIndex, identityMapping: mapping.identityMapping || {} });
  return Object.freeze({
    schemaVersion: '1.0.0-draft',
    rowIndex,
    recordId: recordIdentity.recordId,
    recordIdentity,
    originalUploadedRow: { ...(row || {}) },
    participants: Object.freeze(buildGeneralizedParticipants(row, mapping.relationshipParts || [], mapping.identityMapping || {}, rowIndex)),
    places: Object.freeze(buildGeneralizedPlaces(row, mapping.placeParts || [], mapping.identityMapping || {}, rowIndex)),
    temporal: Object.freeze(buildGeneralizedTemporal(row, mapping.temporalMapping || {}, mapping.temporalNoteMappings || {}, mapping.temporalAssertionMappings || [])),
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
  legacyRow.sourceEntityId = sourceParticipant?.entityId || '';
  legacyRow.targetEntityId = targetParticipant?.entityId || '';
  legacyRow.recordId = observation.recordId || legacyRow.recordId || legacyRow.id || '';

  const temporal = observation.temporal || {};
  legacyRow.Date = temporal.date || temporal.dateRange || temporal.dateStart || temporal.dateEnd || '';
  legacyRow.Date_Start = temporal.dateStart || '';
  legacyRow.Date_End = temporal.dateEnd || '';
  legacyRow.Date_Display = temporal.displayDate || '';

  const explicitlySourceAssociatedPlace = (observation.places || []).find((place) => place.subjectParticipantIndex === 0) || null;
  const explicitlyTargetAssociatedPlace = (observation.places || []).find((place) => place.subjectParticipantIndex === 1) || null;
  const explicitlyRecordAssociatedPlace = (observation.places || []).find((place) => place.subjectParticipantIndex === null) || null;

  const pointPlace = explicitlyRecordAssociatedPlace
    || findPlaceByLegacySourceColumn(observation, mapping.pointMapping?.Point_Place);
  const sourcePlace = explicitlySourceAssociatedPlace
    || findPlaceByLegacySourceColumn(observation, mapping.coreMapping?.Source_Location);
  const targetPlace = explicitlyTargetAssociatedPlace
    || findPlaceByLegacySourceColumn(observation, mapping.coreMapping?.Target_Location);

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
    ...Object.values(temporal.noteSourceColumns || {}).flat(),
    ...getTemporalAssertionSourceColumns(mapping.temporalAssertionMappings || []),
    ...Object.values(relationship.sourceColumns || {}),
    ...getPeridotIdentityRuntimeSourceColumns(mapping.identityMapping || {}),
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
  const sourceRows = Array.isArray(rows) ? rows : [];
  const headers = Array.from(new Set(sourceRows.flatMap((row) => Object.keys(row || {}))));
  const effectiveMapping = {
    ...mapping,
    identityMapping: materializePeridotSingleTableIdentityMappingSuggestions({
      identityMapping: mapping.identityMapping || {},
      relationshipParts: mapping.relationshipParts || [],
      placeParts: mapping.placeParts || [],
      headers,
    }),
  };
  return sourceRows.map((row, index) => {
    const observation = buildPeridotGeneralizedObservation(row, effectiveMapping, index);
    return projectGeneralizedObservationToLegacyRow(observation, effectiveMapping);
  });
}
