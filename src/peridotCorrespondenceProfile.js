/*
 * Correspondence normalization profile for the canonical Peridot model.
 *
 * Pass 2B converts current public-template and user-mapped Peridot rows into
 * consumer-neutral normalized collections. It is intentionally not wired into
 * App.jsx and does not replace peridotCsvNormalizer.js.
 */

import {
  makePeridotAssertion,
  makePeridotCanonicalId,
  makePeridotEntity,
  makePeridotEvidenceSource,
  makePeridotNormalizedDataset,
  makePeridotParticipation,
  makePeridotPlace,
  makePeridotRecord,
  PERIDOT_ENTITY_TYPES,
  PERIDOT_TARGET_TYPES,
  slugifyPeridotIdPart,
} from './peridotNormalizedModel.js';
import {
  makePeridotProvenance,
  PERIDOT_PROVENANCE_CONFIDENCE,
  PERIDOT_PROVENANCE_STATUS,
} from './peridotNormalizationProvenance.js';
import {
  parsePeridotTemporalRange,
  parsePeridotTemporalValue,
} from './peridotTemporalAssertions.js';
import { parsePeridotCoordinatePair } from './peridotDataCapabilityAudit.js';
import {
  getPeridotRowCapabilities,
  isAcceptedPeridotRecord,
} from './peridotCsvSchema.js';
import { validatePeridotNormalizedDataset } from './peridotNormalizedValidation.js';

export const PERIDOT_CORRESPONDENCE_PROFILE_ID = 'peridot.correspondence-directed-record';
export const PERIDOT_CORRESPONDENCE_PROFILE_VERSION = '1.0.0-draft';

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value) {
  const text = asText(value);
  if (!text || text === '-' || text.toLowerCase() === 'unknown') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => (
      item !== undefined
      && item !== null
      && !(typeof item === 'string' && item.trim() === '')
      && !(Array.isArray(item) && item.length === 0)
    ))
  );
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sourceRowFromMappedRow(row = {}) {
  if (row.originalUploadedRow && typeof row.originalUploadedRow === 'object') {
    return { ...row.originalUploadedRow };
  }
  if (row.originalWorkbookRows && typeof row.originalWorkbookRows === 'object') {
    return { ...row.originalWorkbookRows };
  }
  return { ...row };
}

function sourceColumnsWithValues(row = {}, columns = []) {
  return columns.filter((column) => asText(row?.[column]));
}

function makeRowProvenance({
  row,
  rowIndex,
  sourceFileId,
  sourceFileName,
  sourceSheet,
  sourceColumns = [],
  transformation,
  status = PERIDOT_PROVENANCE_STATUS.TRANSFORMED,
  confidence = PERIDOT_PROVENANCE_CONFIDENCE.CERTAIN,
  notes = '',
} = {}) {
  const originalRow = sourceRowFromMappedRow(row);
  const effectiveColumns = sourceColumns.length
    ? sourceColumns
    : Object.keys(originalRow).filter((key) => asText(originalRow[key]));

  return makePeridotProvenance({
    source: {
      sourceFileId,
      sourceFileName,
      sourceSheet,
      sourceRowNumber: rowIndex + 2,
      sourceColumns: effectiveColumns,
      sourceValues: Object.fromEntries(
        effectiveColumns.map((column) => [column, originalRow?.[column] ?? row?.[column] ?? ''])
      ),
    },
    mappingProfileId: PERIDOT_CORRESPONDENCE_PROFILE_ID,
    mappingProfileVersion: PERIDOT_CORRESPONDENCE_PROFILE_VERSION,
    transformation,
    status,
    confidence,
    userConfirmed: true,
    notes,
  });
}

function coordinateFromFields(row, latitudeField, longitudeField, pairField) {
  const parsedPair = parsePeridotCoordinatePair(row?.[pairField]);
  if (parsedPair) {
    return {
      latitude: parsedPair.latitude,
      longitude: parsedPair.longitude,
      sourceColumns: [pairField],
    };
  }

  const latitude = asNumber(row?.[latitudeField]);
  const longitude = asNumber(row?.[longitudeField]);
  return {
    latitude,
    longitude,
    sourceColumns: sourceColumnsWithValues(row, [latitudeField, longitudeField]),
  };
}

function buildPlaceIdentityKey({ label, latitude, longitude, role }) {
  const coordinateKey = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${latitude}:${longitude}`
    : 'no-coordinates';
  return `${role}:${asText(label)}:${coordinateKey}`;
}

function makeEntityId(datasetId, label) {
  return `agent:${slugifyPeridotIdPart(datasetId)}:exact-label:${encodeURIComponent(asText(label))}`;
}

function makePlaceId(datasetId, identityKey) {
  return `place:${slugifyPeridotIdPart(datasetId)}:${encodeURIComponent(identityKey)}`;
}

function makeTemporalAssertion(row = {}) {
  const startValue = asText(row.Date_Start);
  const endValue = asText(row.Date_End);
  const displayValue = asText(row.Date_Display);

  if (startValue || endValue) {
    return parsePeridotTemporalRange({
      startValue,
      endValue,
      displayValue,
    });
  }

  const singleDate = asText(row.Date) || displayValue;
  return singleDate ? parsePeridotTemporalValue(singleDate) : null;
}

function makeRecordLabel(row, index) {
  const source = asText(row.Source_Name);
  const target = asText(row.Target_Name);
  const date = asText(row.Date_Display) || asText(row.Date) || asText(row.Date_Start);
  const point = asText(row.Point_Place);

  if (source && target) {
    return `${source} → ${target}${date ? ` · ${date}` : ''}`;
  }
  if (point) return `${point}${date ? ` · ${date}` : ''}`;
  if (source || target) return `${source || target}${date ? ` · ${date}` : ''}`;
  return `Record ${index + 1}${date ? ` · ${date}` : ''}`;
}

function getEvidenceParts(row = {}) {
  const archive = asText(row.Archive);
  const collection = asText(row.Collection);
  const pages = asText(row['Page(s)']);
  const url = asText(row['Link(s)']);
  const citation = [archive, collection, pages].filter(Boolean).join(', ');

  return {
    archive,
    collection,
    pages,
    url,
    citation,
    hasEvidence: Boolean(archive || collection || pages || url),
  };
}

function getCustomAttributes(row = {}) {
  const customFields = Array.isArray(row.customInspectorFields)
    ? row.customInspectorFields
    : [];

  return Object.fromEntries(
    customFields
      .map((field) => [
        asText(field?.label || field?.key || field?.sourceColumn),
        field?.value ?? '',
      ])
      .filter(([label]) => label)
  );
}

function deriveDatasetCapabilities(dataset) {
  const temporalItems = [
    ...(dataset.records || []),
    ...(dataset.events || []),
    ...(dataset.relationships || []),
  ].filter((item) => item.temporalAssertion);

  const geolocatedPlaces = (dataset.places || []).filter(
    (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
  );

  const senderParticipations = (dataset.participations || []).filter(
    (item) => item.role === 'sender-source'
  );
  const recipientParticipations = (dataset.participations || []).filter(
    (item) => item.role === 'recipient-target'
  );

  return Object.freeze({
    inspectorReady: Boolean(dataset.records.length || dataset.entities.length || dataset.places.length),
    searchReady: Boolean(dataset.records.length || dataset.entities.length || dataset.places.length),
    pointMapReady: geolocatedPlaces.length > 0,
    routeMapReady: dataset.records.some((record) => {
      const predicates = new Set(
        dataset.assertions
          .filter((assertion) => assertion.subjectId === record.id)
          .map((assertion) => assertion.predicate)
      );
      return predicates.has('source-place') && predicates.has('target-place');
    }),
    networkReady: Boolean(senderParticipations.length && recipientParticipations.length),
    timelineReady: temporalItems.length > 0,
    chartReady: dataset.records.length > 0,
    exportReady: dataset.records.length > 0,
  });
}

/**
 * Convert current correspondence-compatible rows into the canonical model.
 *
 * The function accepts public-template rows and rows assembled by the current
 * arbitrary-table/workbook mappers. Unsupported rows are reported in the
 * source manifest and are not normalized as records by default.
 */
export function normalizePeridotCorrespondenceRows(rows = [], options = {}) {
  const datasetId = asText(options.datasetId) || 'peridot-correspondence-dataset';
  const datasetLabel = asText(options.datasetLabel) || asText(options.sourceFileName) || 'Peridot correspondence dataset';
  const sourceFileId = asText(options.sourceFileId) || datasetId;
  const sourceFileName = asText(options.sourceFileName) || '';
  const sourceSheet = asText(options.sourceSheet) || 'Uploaded table';
  const includeUnsupportedRows = Boolean(options.includeUnsupportedRows);

  const entitiesByLabel = new Map();
  const placesByIdentity = new Map();
  const records = [];
  const participations = [];
  const evidenceSources = [];
  const assertions = [];
  const acceptedRowNumbers = [];
  const unsupportedRowNumbers = [];

  function ensureEntity(label, row, rowIndex, role) {
    const exactLabel = asText(label);
    if (!exactLabel) return '';

    if (!entitiesByLabel.has(exactLabel)) {
      entitiesByLabel.set(exactLabel, makePeridotEntity({
        id: makeEntityId(datasetId, exactLabel),
        entityType: PERIDOT_ENTITY_TYPES.AGENT,
        subtype: 'correspondent-or-entity',
        label: exactLabel,
        attributes: {
          identityPolicy: 'exact-entered-label',
        },
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: [role === 'source' ? 'Source_Name' : 'Target_Name'],
          transformation: `Create exact-label Agent from ${role} entity field.`,
        }),
      }));
    }

    return entitiesByLabel.get(exactLabel).id;
  }

  function ensurePlace({ label, coordinate, role, row, rowIndex }) {
    const placeLabel = asText(label);
    const hasCoordinates = Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude);
    if (!placeLabel && !hasCoordinates) return '';

    const effectiveLabel = placeLabel || `Unlabeled ${role} coordinates`;
    const identityKey = buildPlaceIdentityKey({
      label: effectiveLabel,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      role,
    });

    if (!placesByIdentity.has(identityKey)) {
      const labelColumn = role === 'point'
        ? 'Point_Place'
        : role === 'source'
          ? 'Source_Location'
          : 'Target_Location';

      placesByIdentity.set(identityKey, makePeridotPlace({
        id: makePlaceId(datasetId, identityKey),
        label: effectiveLabel,
        placeType: role === 'point' ? 'point-or-site' : 'correspondence-place',
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        attributes: compactObject({
          roleHint: role,
          generatedLabel: !placeLabel,
          identityPolicy: 'exact-label-coordinate-and-role',
        }),
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique([labelColumn, ...coordinate.sourceColumns]),
          transformation: `Create ${role} Place from correspondence-compatible place fields.`,
        }),
      }));
    }

    return placesByIdentity.get(identityKey).id;
  }

  rows.forEach((row = {}, rowIndex) => {
    const accepted = isAcceptedPeridotRecord(row);
    if (!accepted && !includeUnsupportedRows) {
      unsupportedRowNumbers.push(rowIndex + 2);
      return;
    }
    acceptedRowNumbers.push(rowIndex + 2);

    const recordId = makePeridotCanonicalId({
      itemType: 'record',
      datasetId,
      sourceSheet,
      sourceRowNumber: rowIndex + 2,
      role: 'correspondence',
    });
    const sourceEntityId = ensureEntity(row.Source_Name, row, rowIndex, 'source');
    const targetEntityId = ensureEntity(row.Target_Name, row, rowIndex, 'target');

    const pointCoordinate = coordinateFromFields(
      row,
      'Point_Latitude',
      'Point_Longitude',
      'Point_Coordinates'
    );
    const sourceCoordinate = coordinateFromFields(
      row,
      'Source_Latitude',
      'Source_Longitude',
      'Source_Coordinates'
    );
    const targetCoordinate = coordinateFromFields(
      row,
      'Target_Latitude',
      'Target_Longitude',
      'Target_Coordinates'
    );

    const pointPlaceId = ensurePlace({
      label: row.Point_Place,
      coordinate: pointCoordinate,
      role: 'point',
      row,
      rowIndex,
    });
    const sourcePlaceId = ensurePlace({
      label: row.Source_Location,
      coordinate: sourceCoordinate,
      role: 'source',
      row,
      rowIndex,
    });
    const targetPlaceId = ensurePlace({
      label: row.Target_Location,
      coordinate: targetCoordinate,
      role: 'target',
      row,
      rowIndex,
    });

    const evidence = getEvidenceParts(row);
    let evidenceSourceId = '';

    if (evidence.hasEvidence) {
      evidenceSourceId = makePeridotCanonicalId({
        itemType: 'evidence',
        datasetId,
        sourceSheet,
        sourceRowNumber: rowIndex + 2,
        role: 'record-source',
      });
      evidenceSources.push(makePeridotEvidenceSource({
        id: evidenceSourceId,
        sourceType: 'archival-or-external-reference',
        citation: evidence.citation,
        archive: evidence.archive,
        collection: evidence.collection,
        pages: evidence.pages,
        url: evidence.url,
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: sourceColumnsWithValues(row, ['Archive', 'Collection', 'Page(s)', 'Link(s)']),
          transformation: 'Preserve mapped citation and link fields as an Evidence Source.',
          status: PERIDOT_PROVENANCE_STATUS.IMPORTED_DIRECTLY,
        }),
      }));
    }

    const temporalAssertion = makeTemporalAssertion(row);
    const capabilities = getPeridotRowCapabilities(row);
    const participantIds = unique([sourceEntityId, targetEntityId]);
    const placeReferenceIds = unique([pointPlaceId, sourcePlaceId, targetPlaceId]);

    records.push(makePeridotRecord({
      id: recordId,
      recordType: 'correspondence-or-directed-record',
      label: makeRecordLabel(row, rowIndex),
      temporalAssertion,
      participantIds,
      placeReferenceIds,
      evidenceSourceIds: evidenceSourceId ? [evidenceSourceId] : [],
      attributes: compactObject({
        relationship: asText(row.Relationship),
        topic: asText(row.Topic),
        language: asText(row.Language),
        transcription: asText(row.Transcription),
        notes: asText(row.Notes),
        sourceTitle: asText(row.Source_Title),
        targetTitle: asText(row.Target_Title),
        dateDisplay: asText(row.Date_Display),
        pointPlace: asText(row.Point_Place),
        customFields: getCustomAttributes(row),
        ignoredUploadedColumns: Array.isArray(row.ignoredUploadedColumns)
          ? [...row.ignoredUploadedColumns]
          : [],
        currentCapabilities: capabilities,
        originalMappedRow: { ...row },
      }),
      provenance: makeRowProvenance({
        row,
        rowIndex,
        sourceFileId,
        sourceFileName,
        sourceSheet,
        transformation: 'Create one documentary Record from one accepted correspondence-compatible row.',
      }),
    }));

    if (sourceEntityId) {
      participations.push(makePeridotParticipation({
        id: `${recordId}:participation:source`,
        subjectId: sourceEntityId,
        targetType: PERIDOT_TARGET_TYPES.RECORD,
        targetId: recordId,
        role: 'sender-source',
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: ['Source_Name'],
          transformation: 'Create typed source participation for documentary Record.',
        }),
      }));
    }

    if (targetEntityId) {
      participations.push(makePeridotParticipation({
        id: `${recordId}:participation:target`,
        subjectId: targetEntityId,
        targetType: PERIDOT_TARGET_TYPES.RECORD,
        targetId: recordId,
        role: 'recipient-target',
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: ['Target_Name'],
          transformation: 'Create typed target participation for documentary Record.',
        }),
      }));
    }

    [
      ['point-place', pointPlaceId, ['Point_Place', ...pointCoordinate.sourceColumns]],
      ['source-place', sourcePlaceId, ['Source_Location', ...sourceCoordinate.sourceColumns]],
      ['target-place', targetPlaceId, ['Target_Location', ...targetCoordinate.sourceColumns]],
    ].forEach(([predicate, objectId, columns]) => {
      if (!objectId) return;
      assertions.push(makePeridotAssertion({
        id: `${recordId}:assertion:${predicate}`,
        subjectId: recordId,
        predicate,
        objectId,
        evidenceSourceIds: evidenceSourceId ? [evidenceSourceId] : [],
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique(columns),
          transformation: `Create typed ${predicate} assertion for documentary Record.`,
        }),
      }));
    });

    [
      ['source-title', sourceEntityId, asText(row.Source_Title), ['Source_Name', 'Source_Title']],
      ['target-title', targetEntityId, asText(row.Target_Title), ['Target_Name', 'Target_Title']],
    ].forEach(([predicate, subjectId, value, columns]) => {
      if (!subjectId || !value) return;
      assertions.push(makePeridotAssertion({
        id: `${recordId}:assertion:${predicate}`,
        subjectId,
        predicate,
        value,
        evidenceSourceIds: evidenceSourceId ? [evidenceSourceId] : [],
        temporalAssertion,
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: columns,
          transformation: `Preserve record-contextual ${predicate} claim without merging it into entity identity.`,
        }),
      }));
    });
  });

  const baseDataset = makePeridotNormalizedDataset({
    datasetId,
    datasetLabel,
    importedAt: asText(options.importedAt),
    sourceManifest: {
      sourceFileId,
      sourceFileName,
      sourceSheet,
      totalRowCount: rows.length,
      acceptedRowCount: acceptedRowNumbers.length,
      unsupportedRowCount: unsupportedRowNumbers.length,
      acceptedRowNumbers,
      unsupportedRowNumbers,
      sourceShape: 'correspondence-compatible-rows',
    },
    mappingProfile: {
      id: PERIDOT_CORRESPONDENCE_PROFILE_ID,
      version: PERIDOT_CORRESPONDENCE_PROFILE_VERSION,
      label: 'Correspondence / Directed Record',
      primaryRowType: 'document-or-record',
      identityPolicy: 'exact-entered-labels; no automatic reconciliation',
      userConfirmed: true,
    },
    entities: Array.from(entitiesByLabel.values()),
    places: Array.from(placesByIdentity.values()),
    records,
    events: [],
    relationships: [],
    participations,
    evidenceSources,
    assertions,
  });

  const validation = validatePeridotNormalizedDataset(baseDataset);
  const capabilities = deriveDatasetCapabilities(baseDataset);

  return makePeridotNormalizedDataset({
    ...baseDataset,
    validation,
    capabilities,
  });
}

function makeGeneralizedTemporalAssertion(observation = {}) {
  const temporal = observation.temporal || {};
  const startValue = asText(temporal.dateStart);
  const endValue = asText(temporal.dateEnd);
  const displayValue = asText(temporal.displayDate);

  if (startValue || endValue) {
    return parsePeridotTemporalRange({ startValue, endValue, displayValue });
  }

  const dateValue = asText(temporal.date) || displayValue;
  return dateValue ? parsePeridotTemporalValue(dateValue) : null;
}

function generalizedObservationHasContent(observation = {}) {
  const temporal = observation.temporal || {};
  const relationship = observation.relationship || {};
  return Boolean(
    observation.participants?.length
    || observation.places?.length
    || observation.evidenceFields?.some((field) => asText(field?.value))
    || asText(relationship.type)
    || asText(relationship.label)
    || asText(temporal.date)
    || asText(temporal.dateStart)
    || asText(temporal.dateEnd)
  );
}

function makeGeneralizedRecordLabel(observation = {}, index = 0) {
  const participants = observation.participants || [];
  const temporal = observation.temporal || {};
  const date = asText(temporal.displayDate) || asText(temporal.date) || asText(temporal.dateStart);
  const participantLabel = participants.slice(0, 3).map((part) => asText(part.value)).filter(Boolean).join(' · ');
  const placeLabel = asText(observation.places?.[0]?.label);
  const base = participantLabel || placeLabel || `Record ${index + 1}`;
  return `${base}${date ? ` · ${date}` : ''}`;
}

/**
 * Normalize rows whose user-confirmed generalized mapping has already been
 * applied. Unlike normalizePeridotCorrespondenceRows(), this path does not use
 * Source/Target/Point/Route fields to determine canonical meaning. Those fields
 * may coexist on the row only as a downstream legacy compatibility projection.
 */
export function normalizePeridotGeneralizedMappedRows(rows = [], options = {}) {
  const datasetId = asText(options.datasetId) || 'peridot-generalized-mapped-dataset';
  const datasetLabel = asText(options.datasetLabel) || asText(options.sourceFileName) || 'Peridot mapped dataset';
  const sourceFileId = asText(options.sourceFileId) || datasetId;
  const sourceFileName = asText(options.sourceFileName) || '';
  const sourceSheet = asText(options.sourceSheet) || 'Uploaded table';

  const entitiesByLabel = new Map();
  const placesByIdentity = new Map();
  const records = [];
  const participations = [];
  const evidenceSources = [];
  const assertions = [];
  const acceptedRowNumbers = [];
  const unsupportedRowNumbers = [];

  function ensureGeneralizedEntity(participant, row, rowIndex) {
    const label = asText(participant?.value);
    if (!label) return '';
    if (!entitiesByLabel.has(label)) {
      entitiesByLabel.set(label, makePeridotEntity({
        id: makeEntityId(datasetId, label),
        entityType: PERIDOT_ENTITY_TYPES.AGENT,
        subtype: 'mapped-participant',
        label,
        attributes: {
          identityPolicy: 'exact-entered-label',
        },
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique([participant?.sourceColumn, participant?.roleSourceColumn]),
          transformation: 'Create exact-label Agent from user-confirmed generalized relationship participant.',
        }),
      }));
    }
    return entitiesByLabel.get(label).id;
  }

  function ensureGeneralizedPlace(place, row, rowIndex) {
    const label = asText(place?.label);
    const latitude = place?.latitude === null || place?.latitude === undefined || place?.latitude === '' ? null : Number(place.latitude);
    const longitude = place?.longitude === null || place?.longitude === undefined || place?.longitude === '' ? null : Number(place.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (!label && !hasCoordinates) return '';

    const effectiveLabel = label || `Unlabeled ${asText(place?.role) || 'mapped'} place`;
    const identityKey = buildPlaceIdentityKey({
      label: effectiveLabel,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      role: asText(place?.role) || 'mapped-place',
    });

    if (!placesByIdentity.has(identityKey)) {
      placesByIdentity.set(identityKey, makePeridotPlace({
        id: makePlaceId(datasetId, identityKey),
        label: effectiveLabel,
        placeType: 'user-mapped-place',
        latitude: hasCoordinates ? latitude : Number.NaN,
        longitude: hasCoordinates ? longitude : Number.NaN,
        attributes: compactObject({
          roleHint: asText(place?.role),
          generatedLabel: !label,
          identityPolicy: 'exact-label-coordinate-and-role',
        }),
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique([
            place?.sourceColumn,
            place?.roleSourceColumn,
            ...(place?.coordinateSourceColumns || []),
          ]),
          transformation: 'Create Place from user-confirmed generalized place assignment.',
        }),
      }));
    }

    return placesByIdentity.get(identityKey).id;
  }

  rows.forEach((row = {}, rowIndex) => {
    const observation = row?.generalizedObservation;
    if (!observation || !generalizedObservationHasContent(observation)) {
      unsupportedRowNumbers.push(rowIndex + 2);
      return;
    }
    acceptedRowNumbers.push(rowIndex + 2);

    const recordId = makePeridotCanonicalId({
      itemType: 'record',
      datasetId,
      sourceSheet,
      sourceRowNumber: rowIndex + 2,
      role: 'mapped-observation',
    });

    const participantEntries = (observation.participants || []).map((participant) => ({
      participant,
      entityId: ensureGeneralizedEntity(participant, row, rowIndex),
    })).filter((entry) => entry.entityId);

    const placeEntries = (observation.places || []).map((place) => ({
      place,
      placeId: ensureGeneralizedPlace(place, row, rowIndex),
    })).filter((entry) => entry.placeId);

    const evidenceFields = (observation.evidenceFields || []).filter((field) => asText(field?.value));
    let evidenceSourceId = '';
    if (evidenceFields.length) {
      evidenceSourceId = makePeridotCanonicalId({
        itemType: 'evidence',
        datasetId,
        sourceSheet,
        sourceRowNumber: rowIndex + 2,
        role: 'mapped-evidence',
      });
      evidenceSources.push(makePeridotEvidenceSource({
        id: evidenceSourceId,
        sourceType: 'user-mapped-evidence',
        citation: evidenceFields.map((field) => `${asText(field.label)}: ${asText(field.value)}`).join(' · '),
        attributes: {
          fields: evidenceFields.map((field) => ({ ...field })),
        },
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: evidenceFields.map((field) => field.sourceColumn),
          transformation: 'Preserve user-confirmed evidence fields on the mapped observation.',
          status: PERIDOT_PROVENANCE_STATUS.IMPORTED_DIRECTLY,
        }),
      }));
    }

    const temporalAssertion = makeGeneralizedTemporalAssertion(observation);
    const relationship = observation.relationship || {};

    records.push(makePeridotRecord({
      id: recordId,
      recordType: 'generalized-mapped-observation',
      label: makeGeneralizedRecordLabel(observation, rowIndex),
      temporalAssertion,
      participantIds: participantEntries.map((entry) => entry.entityId),
      placeReferenceIds: placeEntries.map((entry) => entry.placeId),
      evidenceSourceIds: evidenceSourceId ? [evidenceSourceId] : [],
      attributes: compactObject({
        relationshipType: asText(relationship.type),
        relationshipLabel: asText(relationship.label),
        participantRoles: participantEntries.map(({ participant, entityId }) => ({
          entityId,
          role: asText(participant.role),
          sourceColumn: asText(participant.sourceColumn),
        })),
        placeRoles: placeEntries.map(({ place, placeId }) => ({
          placeId,
          role: asText(place.role),
          sourceColumn: asText(place.sourceColumn),
        })),
        customFields: Object.fromEntries(evidenceFields.map((field) => [asText(field.label), field.value])),
        ignoredUploadedColumns: Array.isArray(row.ignoredUploadedColumns) ? [...row.ignoredUploadedColumns] : [],
        originalMappedRow: { ...row },
      }),
      provenance: makeRowProvenance({
        row,
        rowIndex,
        sourceFileId,
        sourceFileName,
        sourceSheet,
        transformation: 'Create canonical Record directly from user-confirmed generalized mapping semantics.',
      }),
    }));

    participantEntries.forEach(({ participant, entityId }, participantIndex) => {
      participations.push(makePeridotParticipation({
        id: `${recordId}:participation:${participantIndex + 1}`,
        subjectId: entityId,
        targetType: PERIDOT_TARGET_TYPES.RECORD,
        targetId: recordId,
        role: asText(participant.role) || `participant-${participantIndex + 1}`,
        temporalAssertion,
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique([participant.sourceColumn, participant.roleSourceColumn]),
          transformation: 'Create typed participation from user-confirmed generalized relationship part.',
        }),
      }));
    });

    placeEntries.forEach(({ place, placeId }, placeIndex) => {
      const associatedParticipant = Number.isInteger(place.subjectParticipantIndex)
        ? participantEntries[place.subjectParticipantIndex]
        : null;
      const placeSubjectId = associatedParticipant?.entityId || recordId;
      assertions.push(makePeridotAssertion({
        id: `${recordId}:assertion:place:${placeIndex + 1}`,
        subjectId: placeSubjectId,
        predicate: `mapped-place:${asText(place.role) || `place-${placeIndex + 1}`}`,
        objectId: placeId,
        evidenceSourceIds: evidenceSourceId ? [evidenceSourceId] : [],
        temporalAssertion,
        attributes: {
          mappedRole: asText(place.role),
          subjectParticipantIndex: Number.isInteger(place.subjectParticipantIndex) ? place.subjectParticipantIndex : null,
          sourceColumn: asText(place.sourceColumn),
        },
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: unique([place.sourceColumn, place.roleSourceColumn, ...(place.coordinateSourceColumns || [])]),
          transformation: 'Create typed place assertion from user-confirmed generalized place assignment.',
        }),
      }));
    });
  });

  const baseDataset = makePeridotNormalizedDataset({
    datasetId,
    datasetLabel,
    importedAt: asText(options.importedAt),
    sourceManifest: {
      sourceFileId,
      sourceFileName,
      sourceSheet,
      totalRowCount: rows.length,
      acceptedRowCount: acceptedRowNumbers.length,
      unsupportedRowCount: unsupportedRowNumbers.length,
      acceptedRowNumbers,
      unsupportedRowNumbers,
      sourceShape: 'generalized-user-mapped-observations',
    },
    mappingProfile: {
      id: PERIDOT_CORRESPONDENCE_PROFILE_ID,
      version: PERIDOT_CORRESPONDENCE_PROFILE_VERSION,
      label: 'Correspondence / Directed Record',
      primaryRowType: 'generalized-mapped-observation',
      identityPolicy: 'exact-entered-labels; no automatic reconciliation',
      semanticAuthority: 'user-confirmed-generalized-mapping',
      userConfirmed: true,
    },
    entities: Array.from(entitiesByLabel.values()),
    places: Array.from(placesByIdentity.values()),
    records,
    events: [],
    relationships: [],
    participations,
    evidenceSources,
    assertions,
  });

  const validation = validatePeridotNormalizedDataset(baseDataset);
  const baseCapabilities = deriveDatasetCapabilities(baseDataset);
  const capabilities = Object.freeze({
    ...baseCapabilities,
    networkReady: records.some((record) => (
      participations.filter((participation) => participation.targetId === record.id).length >= 2
    )),
  });

  return makePeridotNormalizedDataset({
    ...baseDataset,
    validation,
    capabilities,
  });
}
