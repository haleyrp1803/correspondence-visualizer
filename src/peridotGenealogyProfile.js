/*
 * Genealogy normalization profile for the canonical Peridot model.
 *
 * Pass 3A converts person-centered family-tree rows into canonical Agents,
 * birth/death Events, parent/partner Relationships, Places, Assertions, and
 * source-level diagnostics. It is additive and is not wired into App.jsx.
 */

import {
  makePeridotAssertion,
  makePeridotCanonicalId,
  makePeridotEntity,
  makePeridotEvent,
  makePeridotNormalizedDataset,
  makePeridotPlace,
  makePeridotRelationship,
  PERIDOT_ENTITY_TYPES,
  PERIDOT_RELATIONSHIP_DIRECTIONS,
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
import {
  PERIDOT_VALIDATION_SEVERITY,
  validatePeridotNormalizedDataset,
} from './peridotNormalizedValidation.js';

export const PERIDOT_GENEALOGY_PROFILE_ID = 'peridot.genealogy-person-centered';
export const PERIDOT_GENEALOGY_PROFILE_VERSION = '1.0.0-draft';

const ATTRIBUTE_COLUMNS = Object.freeze([
  ['gender', 'Gender'],
  ['givenNamesNow', 'Given names now'],
  ['surnameNow', 'Surname now'],
  ['surnameAtBirth', 'Surname at birth'],
  ['profession', 'Profession'],
  ['company', 'Company'],
  ['interests', 'Interests'],
  ['activities', 'Activities'],
  ['bioNotes', 'Bio notes'],
]);

function asText(value) {
  return String(value ?? '').trim();
}

function asNumberOrNull(value) {
  const text = asText(value);
  if (!text) return null;
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

function parseCoordinatePair(value) {
  const text = asText(value);
  if (!text) return null;
  const parts = text.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [latitude, longitude] = parts;
  return { latitude, longitude };
}

function normalizeZeroDateParts(value) {
  return asText(value)
    .replace(/^(\d{1,4})-00-00$/, '$1')
    .replace(/^(\d{1,4})\/00\/00$/, '$1')
    .replace(/^(\d{1,4})-(\d{1,2})-00$/, '$1-$2')
    .replace(/^(\d{1,4})\/(\d{1,2})\/00$/, '$1/$2');
}

function componentDate(row, prefix) {
  const year = asText(row?.[`${prefix} year`]);
  const month = asText(row?.[`${prefix} month`]);
  const day = asText(row?.[`${prefix} day`]);
  if (!year) return '';
  return [year, month, day].filter(Boolean).join('/');
}

function temporalFromComponents(row, prefix) {
  const dateType = asText(row?.[`${prefix} date type`]).toLowerCase();
  const startValue = componentDate(row, prefix);
  const rangeEnd = normalizeZeroDateParts(row?.[`${prefix} range end`]);

  if (dateType === 'range' || rangeEnd) {
    return parsePeridotTemporalRange({
      startValue,
      endValue: rangeEnd,
      displayValue: startValue && rangeEnd ? `${startValue}–${rangeEnd}` : startValue || rangeEnd,
    });
  }

  if (!startValue) return null;
  const qualified = dateType === 'approximate' ? `c. ${startValue}` : startValue;
  return parsePeridotTemporalValue(qualified);
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
  derivationInputs = [],
  notes = '',
} = {}) {
  return makePeridotProvenance({
    source: {
      sourceFileId,
      sourceFileName,
      sourceSheet,
      sourceRowNumber: rowIndex + 2,
      sourceColumns,
      sourceValues: Object.fromEntries(sourceColumns.map((column) => [column, row?.[column] ?? ''])),
    },
    mappingProfileId: PERIDOT_GENEALOGY_PROFILE_ID,
    mappingProfileVersion: PERIDOT_GENEALOGY_PROFILE_VERSION,
    transformation,
    status,
    confidence,
    userConfirmed: true,
    derivationInputs,
    notes,
  });
}

function entityId(datasetId, sourceId) {
  return makePeridotCanonicalId({
    itemType: 'entity',
    datasetId,
    sourceId,
  });
}

function relationshipKey(type, a, b, directed = false) {
  return directed ? `${type}:${a}->${b}` : `${type}:${[a, b].sort().join('<->')}`;
}

function parseExPartnerIds(value) {
  return asText(value).split(/\s+/).map(asText).filter(Boolean);
}

function mergeValidation(baseValidation, profileIssues) {
  const issues = [...(baseValidation?.issues || []), ...profileIssues];
  const counts = Object.fromEntries(
    Object.values(PERIDOT_VALIDATION_SEVERITY).map((severity) => [
      severity,
      issues.filter((item) => item.severity === severity).length,
    ])
  );

  return Object.freeze({
    valid: counts.blocking === 0 && counts.error === 0,
    canCommit: counts.blocking === 0,
    counts: Object.freeze(counts),
    issues: Object.freeze(issues),
  });
}

function profileIssue({ severity, code, message, rowNumber = null, sourceId = '', relatedIds = [] }) {
  return Object.freeze({
    severity,
    code,
    message,
    collection: '',
    itemId: sourceId,
    relatedIds: Object.freeze(relatedIds.filter(Boolean)),
    sourceRowNumber: rowNumber,
  });
}

export function normalizePeridotGenealogyRows(rows = [], options = {}) {
  const datasetId = asText(options.datasetId) || 'peridot-genealogy-dataset';
  const datasetLabel = asText(options.datasetLabel) || asText(options.sourceFileName) || 'Peridot genealogy dataset';
  const sourceFileId = asText(options.sourceFileId) || datasetId;
  const sourceFileName = asText(options.sourceFileName);
  const sourceSheet = asText(options.sourceSheet) || 'Family tree';

  const profileIssues = [];
  const sourceRows = rows
    .map((row, index) => ({ row: row || {}, index }))
    .filter(({ row }) => Object.values(row).some((value) => asText(value)));

  const rowsBySourceId = new Map();
  const duplicateSourceIds = new Set();

  sourceRows.forEach(({ row, index }) => {
    const sourceId = asText(row.ID);
    if (!sourceId) {
      profileIssues.push(profileIssue({
        severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING,
        code: 'genealogy_missing_source_id',
        message: `Populated genealogy row ${index + 2} has no source ID.`,
        rowNumber: index + 2,
      }));
      return;
    }
    if (rowsBySourceId.has(sourceId)) {
      duplicateSourceIds.add(sourceId);
      profileIssues.push(profileIssue({
        severity: PERIDOT_VALIDATION_SEVERITY.BLOCKING,
        code: 'genealogy_duplicate_source_id',
        message: `Genealogy source ID “${sourceId}” appears more than once.`,
        rowNumber: index + 2,
        sourceId,
      }));
      return;
    }
    rowsBySourceId.set(sourceId, { row, index });
  });

  const entities = [];
  const places = [];
  const events = [];
  const relationships = [];
  const assertions = [];
  const placeByKey = new Map();
  const relationshipKeys = new Set();
  const unresolvedReferences = [];

  function ensurePlace(label, coordinateValue, role, row, rowIndex) {
    const placeLabel = asText(label);
    const coordinate = parseCoordinatePair(coordinateValue);
    if (!placeLabel && !coordinate) return '';

    const effectiveLabel = placeLabel || `Unlabeled ${role} place`;
    const key = `${effectiveLabel}:${coordinate?.latitude ?? ''}:${coordinate?.longitude ?? ''}`;
    if (!placeByKey.has(key)) {
      const id = makePeridotCanonicalId({
        itemType: 'place',
        datasetId,
        sourceId: encodeURIComponent(key),
      });
      const place = makePeridotPlace({
        id,
        label: effectiveLabel,
        placeType: role,
        latitude: coordinate?.latitude ?? null,
        longitude: coordinate?.longitude ?? null,
        attributes: {
          generatedLabel: !placeLabel,
          sourceCoordinateText: asText(coordinateValue),
        },
        provenance: makeRowProvenance({
          row,
          rowIndex,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: role === 'birth-place'
            ? ['place of birth', 'coordinate location birth']
            : ['place of death', 'coordinate location death'],
          transformation: `Create ${role} Place from genealogy row.`,
        }),
      });
      placeByKey.set(key, place);
      places.push(place);
    }
    return placeByKey.get(key).id;
  }

  rowsBySourceId.forEach(({ row, index }, sourceId) => {
    if (duplicateSourceIds.has(sourceId)) return;
    const id = entityId(datasetId, sourceId);
    const label = asText(row['Full name']) || sourceId;
    const wikidata = asText(row.WikiData);
    const imageUrl = asText(row.image);

    entities.push(makePeridotEntity({
      id,
      entityType: PERIDOT_ENTITY_TYPES.AGENT,
      subtype: 'person',
      label,
      alternateLabels: [],
      externalIdentifiers: wikidata ? { wikidata } : {},
      image: imageUrl ? { url: imageUrl, sourceValue: imageUrl } : null,
      attributes: compactObject(Object.fromEntries(
        ATTRIBUTE_COLUMNS.map(([key, column]) => [key, asText(row[column])])
      )),
      provenance: makeRowProvenance({
        row,
        rowIndex: index,
        sourceFileId,
        sourceFileName,
        sourceSheet,
        sourceColumns: ['ID', 'Full name', 'WikiData', 'image', ...ATTRIBUTE_COLUMNS.map(([, column]) => column)],
        transformation: 'Create one canonical person Agent from one source person row.',
        status: PERIDOT_PROVENANCE_STATUS.IMPORTED_DIRECTLY,
      }),
    }));

    ATTRIBUTE_COLUMNS.forEach(([key, column]) => {
      const value = asText(row[column]);
      if (!value) return;
      assertions.push(makePeridotAssertion({
        id: `${id}:assertion:${key}`,
        subjectId: id,
        predicate: key,
        value,
        provenance: makeRowProvenance({
          row,
          rowIndex: index,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: [column],
          transformation: `Preserve genealogy person attribute “${column}” as an assertion.`,
          status: PERIDOT_PROVENANCE_STATUS.IMPORTED_DIRECTLY,
        }),
      }));
    });

    const eventSpecs = [
      {
        type: 'birth',
        placeLabel: row['place of birth'],
        coordinateValue: row['coordinate location birth'],
        placeRole: 'birth-place',
        prefix: 'Birth',
        columns: ['Birth date type', 'Birth year', 'Birth month', 'Birth day', 'Birth range end', 'place of birth', 'coordinate location birth'],
      },
      {
        type: 'death',
        placeLabel: row['place of death'],
        coordinateValue: row['coordinate location death'],
        placeRole: 'death-place',
        prefix: 'Death',
        columns: ['Death date type', 'Death year', 'Death month', 'Death day', 'Death range end', 'place of death', 'coordinate location death'],
      },
    ];

    eventSpecs.forEach((spec) => {
      const temporalAssertion = temporalFromComponents(row, spec.prefix);
      const placeId = ensurePlace(spec.placeLabel, spec.coordinateValue, spec.placeRole, row, index);
      if (!temporalAssertion && !placeId) return;

      const eventId = `${id}:event:${spec.type}`;
      events.push(makePeridotEvent({
        id: eventId,
        eventType: spec.type,
        label: `${spec.type === 'birth' ? 'Birth' : 'Death'} of ${label}`,
        temporalAssertion,
        participantIds: [id],
        placeReferenceIds: placeId ? [placeId] : [],
        attributes: {
          sourceDateType: asText(row[`${spec.prefix} date type`]),
        },
        provenance: makeRowProvenance({
          row,
          rowIndex: index,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: spec.columns,
          transformation: `Create ${spec.type} Event for source person.`,
        }),
      }));

      if (placeId) {
        assertions.push(makePeridotAssertion({
          id: `${eventId}:assertion:place`,
          subjectId: eventId,
          predicate: 'occurred-at',
          objectId: placeId,
          temporalAssertion,
          provenance: makeRowProvenance({
            row,
            rowIndex: index,
            sourceFileId,
            sourceFileName,
            sourceSheet,
            sourceColumns: spec.columns.slice(-2),
            transformation: `Link ${spec.type} Event to its recorded place; no movement relationship is inferred.`,
          }),
        }));
      }
    });
  });

  function resolveReference(ownerSourceId, referencedSourceId, column, row, rowIndex) {
    if (!referencedSourceId) return '';
    if (!rowsBySourceId.has(referencedSourceId) || duplicateSourceIds.has(referencedSourceId)) {
      const diagnostic = {
        ownerSourceId,
        referencedSourceId,
        column,
        rowNumber: rowIndex + 2,
      };
      unresolvedReferences.push(diagnostic);
      profileIssues.push(profileIssue({
        severity: PERIDOT_VALIDATION_SEVERITY.WARNING,
        code: 'genealogy_unresolved_reference',
        message: `Genealogy row ${rowIndex + 2} references missing source ID “${referencedSourceId}” in ${column}.`,
        rowNumber: rowIndex + 2,
        sourceId: ownerSourceId,
        relatedIds: [referencedSourceId],
      }));
      return '';
    }
    return entityId(datasetId, referencedSourceId);
  }

  rowsBySourceId.forEach(({ row, index }, childSourceId) => {
    if (duplicateSourceIds.has(childSourceId)) return;
    const childId = entityId(datasetId, childSourceId);

    [
      ['Mother ID', 'mother'],
      ['Father ID', 'father'],
    ].forEach(([column, parentRole]) => {
      const parentSourceId = asText(row[column]);
      const parentId = resolveReference(childSourceId, parentSourceId, column, row, index);
      if (!parentId) return;

      const key = relationshipKey('parent-child', parentId, childId, true);
      if (relationshipKeys.has(key)) return;
      relationshipKeys.add(key);
      relationships.push(makePeridotRelationship({
        id: makePeridotCanonicalId({
          itemType: 'relationship',
          datasetId,
          sourceId: encodeURIComponent(key),
        }),
        relationshipType: 'parent-child',
        direction: PERIDOT_RELATIONSHIP_DIRECTIONS.DIRECTED,
        participantAId: parentId,
        participantBId: childId,
        participantARole: parentRole,
        participantBRole: 'child',
        attributes: compactObject({
          parentsType: asText(row['Parents type']),
          recordedParentName: asText(row[parentRole === 'mother' ? 'Mother name' : 'Father name']),
        }),
        provenance: makeRowProvenance({
          row,
          rowIndex: index,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: [column, parentRole === 'mother' ? 'Mother name' : 'Father name', 'Parents type'],
          transformation: `Create directed ${parentRole}-child Relationship from source IDs.`,
        }),
      }));
    });

    const currentPartnerSourceId = asText(row['Partner ID']);
    const partnerId = resolveReference(childSourceId, currentPartnerSourceId, 'Partner ID', row, index);
    if (partnerId && partnerId !== childId) {
      const partnershipType = asText(row['Partnership type']) || 'partner';
      const key = relationshipKey(`partner:${partnershipType}`, childId, partnerId, false);
      if (!relationshipKeys.has(key)) {
        relationshipKeys.add(key);
        relationships.push(makePeridotRelationship({
          id: makePeridotCanonicalId({
            itemType: 'relationship',
            datasetId,
            sourceId: encodeURIComponent(key),
          }),
          relationshipType: partnershipType.toLowerCase(),
          direction: PERIDOT_RELATIONSHIP_DIRECTIONS.UNDIRECTED,
          participantAId: childId,
          participantBId: partnerId,
          participantARole: 'partner',
          participantBRole: 'partner',
          temporalAssertion: temporalFromComponents(row, 'Partnership'),
          attributes: compactObject({
            recordedPartnerName: asText(row['Partner name']),
            recordedPartnerTitle: asText(row['Partner title']),
            sourcePartnershipType: partnershipType,
          }),
          provenance: makeRowProvenance({
            row,
            rowIndex: index,
            sourceFileId,
            sourceFileName,
            sourceSheet,
            sourceColumns: [
              'Partner ID', 'Partner name', 'Partner title', 'Partnership type',
              'Partnership date type', 'Partnership year', 'Partnership month',
              'Partnership day', 'Partnership range end',
            ],
            transformation: 'Create deduplicated undirected current-partner Relationship from source IDs.',
          }),
        }));
      }
    }

    parseExPartnerIds(row['Ex-partner IDs']).forEach((formerPartnerSourceId) => {
      const formerPartnerId = resolveReference(childSourceId, formerPartnerSourceId, 'Ex-partner IDs', row, index);
      if (!formerPartnerId || formerPartnerId === childId) return;
      const key = relationshipKey('former-partner', childId, formerPartnerId, false);
      if (relationshipKeys.has(key)) return;
      relationshipKeys.add(key);
      relationships.push(makePeridotRelationship({
        id: makePeridotCanonicalId({
          itemType: 'relationship',
          datasetId,
          sourceId: encodeURIComponent(key),
        }),
        relationshipType: 'former-partner',
        direction: PERIDOT_RELATIONSHIP_DIRECTIONS.UNDIRECTED,
        participantAId: childId,
        participantBId: formerPartnerId,
        participantARole: 'former-partner',
        participantBRole: 'former-partner',
        provenance: makeRowProvenance({
          row,
          rowIndex: index,
          sourceFileId,
          sourceFileName,
          sourceSheet,
          sourceColumns: ['Ex-partner IDs'],
          transformation: 'Create deduplicated undirected former-partner Relationship from source IDs.',
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
      populatedRowCount: sourceRows.length,
      blankRowCount: rows.length - sourceRows.length,
      uniqueSourceIdCount: rowsBySourceId.size,
      duplicateSourceIds: Array.from(duplicateSourceIds),
      unresolvedReferences,
      sourceShape: 'person-centered-genealogy-rows',
    },
    mappingProfile: {
      id: PERIDOT_GENEALOGY_PROFILE_ID,
      version: PERIDOT_GENEALOGY_PROFILE_VERSION,
      label: 'Genealogy / Person-Centered Family Tree',
      primaryRowType: 'person',
      identityPolicy: 'source-ID-based; no name-based reconciliation',
      userConfirmed: true,
    },
    entities,
    places,
    records: [],
    events,
    relationships,
    participations: [],
    evidenceSources: [],
    assertions,
    capabilities: {
      inspectorReady: entities.length > 0,
      searchReady: entities.length > 0,
      genealogyReady: relationships.length > 0,
      eventTimelineReady: events.some((event) => event.temporalAssertion),
      eventMapReady: events.some((event) => event.placeReferenceIds.length > 0),
      routeMapReady: false,
      correspondenceNetworkReady: false,
    },
  });

  const structuralValidation = validatePeridotNormalizedDataset(baseDataset);
  const validation = mergeValidation(structuralValidation, profileIssues);

  return makePeridotNormalizedDataset({
    ...baseDataset,
    validation,
  });
}
