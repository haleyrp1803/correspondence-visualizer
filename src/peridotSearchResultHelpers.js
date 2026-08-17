import { getRowTimelineCapability, getRowTemporalSearchValues, getRowTemporalYears, getRowTemporalDisplayLabels } from './timelinePlaybackHelpers.js';

/*
 * Search-result helpers for Peridot's Advanced Search workspace.
 *
 * Phase 2 scope:
 * - derive lightweight result-card records from the already filtered active rows;
 * - explain which applied search terms and capability filters matched a row;
 * - expose capability predicates for App.jsx's global Search & Filter pipeline;
 * - derive result facets/counts for Search refinement without introducing saved-search persistence.
 *
 * Phase 3 scope:
 * - add a small structured-criteria evaluator for App.jsx's global active-row
 *   filtering pipeline;
 * - support simple non-nested Boolean operators displayed to users as
 *   Start with, AND, OR, and EXCLUDING;
 * - keep all helper functions pure and UI-agnostic so the Search workspace can
 *   remain a presentation/control surface rather than a second data pipeline.
 *
 * Phase 4 scope:
 * - support a dataset-wide Browse index by allowing structured criteria to match
 *   evidence/custom field labels, not only evidence field values.
 */
const FIELD_LABELS = {
  date: 'Date',
  displayDate: 'Display date',
  sourcePerson: 'Source entity',
  source: 'Source entity',
  targetPerson: 'Target entity',
  target: 'Target entity',
  sourcePlaceLabel: 'Source place',
  targetPlaceLabel: 'Target place',
  sourcePlace: 'Source place',
  targetPlace: 'Target place',
  sourceLoc: 'Source place',
  targetLoc: 'Target place',
  relationshipType: 'Relationship',
  relationship: 'Relationship',
  archive: 'Archive',
  archivalCollection: 'Archival collection',
  archivalPage: 'Archival page',
  pdfPage: 'PDF page',
  cipher: 'Cipher',
  topic: 'Topic',
  language: 'Language',
  transcription: 'Transcription',
  translation: 'Translation',
  sourceTitle: 'Source title',
  targetTitle: 'Target title',
  title: 'Title',
  citation: 'Citation',
  notes: 'Notes',
  links: 'Links',
};

const TITLE_FIELDS = ['title', 'recordTitle', 'Title', 'Record_Title', 'Letter_Title', 'label'];
const DATE_FIELDS = ['displayDate', 'date', 'Date', 'Date*', 'dateDisplay', 'dateLabel'];
const SOURCE_PERSON_FIELDS = ['sourcePerson', 'source', 'Source', 'Source_Person', 'Source_Entity', 'sender', 'Sender'];
const TARGET_PERSON_FIELDS = ['targetPerson', 'target', 'Target', 'Target_Person', 'Target_Entity', 'recipient', 'Recipient'];
const SOURCE_PLACE_FIELDS = ['sourcePlaceLabel', 'sourcePlace', 'sourceLoc', 'Source_Loc', 'Source_Place', 'sourceLocation'];
const TARGET_PLACE_FIELDS = ['targetPlaceLabel', 'targetPlace', 'targetLoc', 'Target_Inferred_Loc', 'Target_Loc', 'Target_Place', 'targetLocation'];
const COORDINATE_FIELDS = ['sourceLat', 'sourceLon', 'targetLat', 'targetLon', 'lat', 'lon', 'latitude', 'longitude'];
const EVIDENCE_FIELDS = [
  'archivalCollection',
  'archivalPage',
  'pdfPage',
  'relationship',
  'relationshipType',
  'cipher',
  'topic',
  'language',
  'transcription',
  'translation',
  'notes',
  'citation',
  'sourceTitle',
  'targetTitle',
];

const CORE_FIELDS = new Set([
  'id',
  'recordId',
  'parsedDate',
  ...TITLE_FIELDS,
  ...DATE_FIELDS,
  ...SOURCE_PERSON_FIELDS,
  ...TARGET_PERSON_FIELDS,
  ...SOURCE_PLACE_FIELDS,
  ...TARGET_PLACE_FIELDS,
  ...COORDINATE_FIELDS,
  'sourcePlaceId',
  'targetPlaceId',
  'mappable',
  'personKey',
  'dateStart',
  'dateEnd',
  'dateDisplay',
  'pointLoc',
  'pointCoordinates',
  'pointLat',
  'pointLon',
  'pointPlaceId',
  'pointRecord',
  'sourcePoliticalHint',
  'targetPoliticalHint',
]);

/*
 * These fields are implementation payloads rather than researcher-facing
 * evidence. They must not appear as Browse/Refine evidence fields, and nested
 * objects must not be stringified into misleading “[object Object]” entries.
 */
const NON_EVIDENCE_FIELD_KEYS = new Set([
  ...CORE_FIELDS,
  'peridotCapabilities',
  'capabilities',
  'capabilityFlags',
  'customInspectorFields',
  'ignoredUploadedColumns',
  'originalUploadedRow',
  'originalTemplateRow',
]);


function normalizeLinkText(value) {
  const normalized = asText(value).toLowerCase();
  // The bundled legacy tables use 0 as an empty-cell sentinel in a handful
  // of source-entity cells. Treat it as blank for record-link validation only.
  return normalized === '0' ? '' : normalized;
}

function getRecordId(row) {
  return asText(row?.recordId || row?.sourceRecordId || row?.sourceRecordKey);
}

function getSourcePerson(row) {
  return firstText(row, SOURCE_PERSON_FIELDS);
}

function getTargetPerson(row) {
  return firstText(row, TARGET_PERSON_FIELDS);
}

function getSourcePlace(row) {
  return firstText(row, SOURCE_PLACE_FIELDS);
}

function getLegacyRecordSignature(row) {
  return [
    normalizeLinkText(firstText(row, DATE_FIELDS)),
    normalizeLinkText(getSourcePerson(row)),
    normalizeLinkText(getTargetPerson(row)),
    normalizeLinkText(getSourcePlace(row)),
  ].join('\u0000');
}

function buildUniqueLinkedRecordIndex(linkedRows) {
  const groups = new Map();
  (Array.isArray(linkedRows) ? linkedRows : []).forEach((row) => {
    const recordId = getRecordId(row);
    if (!recordId) return;
    const current = groups.get(recordId) || [];
    current.push(row);
    groups.set(recordId, current);
  });

  const unique = new Map();
  groups.forEach((rows, recordId) => {
    if (rows.length === 1) unique.set(recordId, rows[0]);
  });
  return unique;
}

function buildValidatedParallelLinkedRecordIndex(geographyRows, linkedRows) {
  const linkedByIndex = new Map();
  const geography = Array.isArray(geographyRows) ? geographyRows : [];
  const linked = Array.isArray(linkedRows) ? linkedRows : [];

  if (!geography.length || geography.length !== linked.length) return linkedByIndex;

  geography.forEach((geographyRow, index) => {
    const linkedRow = linked[index];
    if (!linkedRow) return;
    const geographySignature = getLegacyRecordSignature(geographyRow);
    const linkedSignature = getLegacyRecordSignature(linkedRow);

    /*
     * This compatibility route is intentionally strict: it is available only
     * to the bundled parallel legacy sample tables and only when the record at
     * the same ordinal position agrees on date, source, target, and source
     * place. It never performs a loose person/date/place lookup.
     */
    if (geographySignature && geographySignature === linkedSignature) {
      linkedByIndex.set(index, linkedRow);
    }
  });

  return linkedByIndex;
}

function getLinkedResearchMetadata(linkedRow) {
  if (!linkedRow) return {};

  const metadata = {};
  Object.entries(linkedRow).forEach(([key, value]) => {
    if (
      key === 'id'
      || key === 'recordId'
      || key === 'sourceRecordId'
      || key === 'sourceRecordKey'
      || key === 'source'
      || key === 'target'
      || key === 'sourceLoc'
      || key === 'targetLoc'
      || key === 'date'
      || key === 'parsedDate'
      || key === 'personKey'
      || key === 'peridotCapabilities'
      || key === 'capabilities'
      || key === 'capabilityFlags'
      || key === 'ignoredUploadedColumns'
      || key === 'originalUploadedRow'
      || key === 'originalTemplateRow'
      || key === 'customInspectorFields'
      || !isSearchableScalar(value)
      || !asText(value)
    ) {
      return;
    }
    metadata[key] = value;
  });

  const customInspectorFields = Array.isArray(linkedRow.customInspectorFields)
    ? linkedRow.customInspectorFields.map((field) => ({ ...field }))
    : [];

  if (customInspectorFields.length) metadata.customInspectorFields = customInspectorFields;
  return metadata;
}

/*
 * Create the one record shape evaluated by Search. Map and graph consumers
 * retain the geographic row fields they already require; researcher-facing
 * metadata is copied from an exactly linked record where that relationship is
 * known. This helper never guesses a link from an arbitrary matching person,
 * date, or place value.
 */
export function buildPeridotSearchRecords(geographyRows = [], linkedRows = [], options = {}) {
  const geography = Array.isArray(geographyRows) ? geographyRows : [];
  const linkedByRecordId = buildUniqueLinkedRecordIndex(linkedRows);
  const linkedByValidatedIndex = options.allowValidatedParallelRows
    ? buildValidatedParallelLinkedRecordIndex(geography, linkedRows)
    : new Map();

  return geography.map((geographyRow, index) => {
    const recordId = getRecordId(geographyRow);
    const linkedRow = (recordId && linkedByRecordId.get(recordId)) || linkedByValidatedIndex.get(index) || null;
    const metadata = getLinkedResearchMetadata(linkedRow);

    return {
      ...geographyRow,
      ...metadata,
    };
  });
}

export const CAPABILITY_FILTER_OPTIONS = Object.freeze([
  {
    id: 'inspector-ready',
    label: 'Inspector-ready',
    shortLabel: 'Inspector',
    description: 'Rows with enough content to open as evidence records.',
  },
  {
    id: 'map-ready',
    label: 'Map-relevant',
    shortLabel: 'Map',
    description: 'Rows with place names or coordinate evidence.',
  },
  {
    id: 'route-ready',
    label: 'Route-ready',
    shortLabel: 'Route',
    description: 'Rows with source/target route evidence.',
  },
  {
    id: 'network-ready',
    label: 'Network-ready',
    shortLabel: 'Network',
    description: 'Rows with source and target people/entities.',
  },
  {
    id: 'timeline-ready',
    label: 'Timeline-ready',
    shortLabel: 'Timeline',
    description: 'Rows with at least one date or period that can be positioned on the timeline.',
  },
  {
    id: 'evidence-ready',
    label: 'Evidence-rich',
    shortLabel: 'Evidence',
    description: 'Rows with notes, topics, citations, transcription, or custom metadata.',
  },
  {
    id: 'missing-date',
    label: 'Missing time',
    shortLabel: 'No time',
    description: 'Rows without mapped temporal evidence.',
  },
  {
    id: 'missing-coordinates',
    label: 'Missing coordinates',
    shortLabel: 'No coordinates',
    description: 'Rows without detected route or point coordinates.',
  },
]);

function asText(value) {
  return String(value ?? '').trim();
}

function firstText(row, fields) {
  for (const field of fields) {
    const value = asText(row?.[field]);
    if (value) return value;
  }
  return '';
}

function includesNeedle(value, needle) {
  const cleanNeedle = asText(needle).toLowerCase();
  if (!cleanNeedle) return false;
  return asText(value).toLowerCase().includes(cleanNeedle);
}

function hasFiniteCoordinate(value) {
  if (value === null || value === undefined || value === '') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric !== 0;
}

function hasAnyCoordinate(row) {
  if (row?.mappable) return true;
  return COORDINATE_FIELDS.some((field) => hasFiniteCoordinate(row?.[field]));
}

function isSearchableScalar(value) {
  return (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  );
}

function getFieldLabel(key) {
  return FIELD_LABELS[key] || String(key || '').replace(/_/g, ' ');
}

function collectCustomInspectorFieldEntries(row) {
  const fields = Array.isArray(row?.customInspectorFields) ? row.customInspectorFields : [];
  return fields
    .filter((field) => isSearchableScalar(field?.value) && asText(field?.value))
    .map((field) => ({
      key: asText(field?.key || field?.sourceColumn || field?.label),
      label: asText(field?.label || field?.sourceColumn || field?.key) || 'Custom metadata',
      value: asText(field?.value),
    }));
}

/*
 * Search deliberately operates on researcher-facing scalar values. Internal
 * geometry, timeline, capability, and original-row payloads are excluded so
 * technical identifiers cannot create misleading keyword or metadata matches.
 */
function collectSearchableFields(row) {
  const entries = [];

  Object.entries(row || {}).forEach(([key, value]) => {
    if (
      NON_EVIDENCE_FIELD_KEYS.has(key)
      || value === null
      || value === undefined
      || !isSearchableScalar(value)
      || !asText(value)
    ) {
      return;
    }
    entries.push({ key, label: getFieldLabel(key), value: asText(value) });
  });

  collectCustomInspectorFieldEntries(row).forEach((entry) => entries.push(entry));

  const deduped = new Map();
  entries.forEach((entry) => {
    const dedupeKey = `${entry.key}\u0000${entry.label}\u0000${entry.value}`;
    if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, entry);
  });

  return Array.from(deduped.values());
}

export function rowMatchesSearchText(row, query) {
  const cleanQuery = asText(query);
  if (!cleanQuery) return true;

  return collectSearchableFields(row).some((field) => (
    includesNeedle(field.value, cleanQuery) || includesNeedle(field.label, cleanQuery)
  ));
}

/*
 * A single shared evidence-field inventory keeps Browse, Refine facets, and
 * structured “evidence field present” criteria aligned. It deliberately keeps
 * researcher-facing scalar metadata while excluding internal compatibility
 * payloads and nested original-row snapshots.
 */
export function getSearchableEvidenceFieldEntries(row) {
  const entries = [];

  Object.entries(row || {}).forEach(([key, value]) => {
    if (
      NON_EVIDENCE_FIELD_KEYS.has(key)
      || value === null
      || value === undefined
      || !isSearchableScalar(value)
      || !asText(value)
    ) {
      return;
    }
    entries.push({ key, label: getFieldLabel(key), value: asText(value) });
  });

  collectCustomInspectorFieldEntries(row).forEach((entry) => entries.push(entry));

  const fieldsByIdentity = new Map();
  entries.forEach((entry) => {
    const identity = `${entry.key}\u0000${entry.label}`;
    if (!fieldsByIdentity.has(identity)) fieldsByIdentity.set(identity, entry);
  });

  return Array.from(fieldsByIdentity.values());
}

function hasAnyEvidenceField(row) {
  return getSearchableEvidenceFieldEntries(row).length > 0;
}

function hasAnySearchableContent(row) {
  return collectSearchableFields(row).length > 0;
}

function findFirstFieldMatch(row, query, preferredKeys = []) {
  const cleanQuery = asText(query);
  if (!cleanQuery) return null;
  const fields = collectSearchableFields(row);
  const preferred = fields.filter((field) => preferredKeys.includes(field.key));
  const remaining = fields.filter((field) => !preferredKeys.includes(field.key));
  return [...preferred, ...remaining].find((field) => includesNeedle(field.value, cleanQuery)) || null;
}

function compactRouteLabel(source, target) {
  const cleanSource = asText(source) || 'Unknown source';
  const cleanTarget = asText(target) || 'Unknown target';
  return `${cleanSource} → ${cleanTarget}`;
}

function addFacetCount(map, rawValue) {
  const value = asText(rawValue);
  if (!value) return;
  map.set(value, (map.get(value) || 0) + 1);
}

function facetItemsFromMap(map, limit = Number.POSITIVE_INFINITY) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, limit) : Number.POSITIVE_INFINITY;
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    })
    .slice(0, safeLimit);
}

function buildResultTitle(row, index) {
  const explicitTitle = firstText(row, TITLE_FIELDS);
  if (explicitTitle) return explicitTitle;
  const sourcePerson = firstText(row, SOURCE_PERSON_FIELDS);
  const targetPerson = firstText(row, TARGET_PERSON_FIELDS);
  if (sourcePerson || targetPerson) return compactRouteLabel(sourcePerson, targetPerson);
  const sourcePlace = firstText(row, SOURCE_PLACE_FIELDS);
  const targetPlace = firstText(row, TARGET_PLACE_FIELDS);
  if (sourcePlace || targetPlace) return compactRouteLabel(sourcePlace, targetPlace);
  return `Record ${index + 1}`;
}

function getRowCapabilityState(row) {
  const sourcePerson = firstText(row, SOURCE_PERSON_FIELDS);
  const targetPerson = firstText(row, TARGET_PERSON_FIELDS);
  const sourcePlace = firstText(row, SOURCE_PLACE_FIELDS);
  const targetPlace = firstText(row, TARGET_PLACE_FIELDS);
  const hasPeople = Boolean(sourcePerson || targetPerson);
  const hasEntityRoute = Boolean(sourcePerson && targetPerson);
  const hasPlaces = Boolean(sourcePlace || targetPlace);
  const hasPlaceRoute = Boolean(sourcePlace && targetPlace);
  const temporalCapability = getRowTimelineCapability(row);
  const hasDate = temporalCapability.hasTemporalEvidence;
  const hasCoordinates = hasAnyCoordinate(row);
  const hasEvidence = hasAnyEvidenceField(row);
  return {
    hasPeople,
    hasEntityRoute,
    hasPlaces,
    hasPlaceRoute,
    hasDate,
    hasCoordinates,
    hasEvidence,
    inspectorReady: hasAnySearchableContent(row),
    mapReady: hasPlaces || hasCoordinates,
    routeReady: hasPlaceRoute || Boolean(row?.mappable),
    networkReady: hasEntityRoute,
    timelineReady: temporalCapability.timelineReady,
    evidenceReady: hasEvidence,
    missingDate: !hasDate,
    missingCoordinates: !hasCoordinates,
  };
}

export function rowMatchesSearchCapabilityFilter(row, filterId) {
  const state = getRowCapabilityState(row);
  switch (filterId) {
    case 'inspector-ready':
      return state.inspectorReady;
    case 'map-ready':
      return state.mapReady;
    case 'route-ready':
      return state.routeReady;
    case 'network-ready':
      return state.networkReady;
    case 'timeline-ready':
      return state.timelineReady;
    case 'evidence-ready':
      return state.evidenceReady;
    case 'missing-date':
      return state.missingDate;
    case 'missing-coordinates':
      return state.missingCoordinates;
    default:
      return true;
  }
}

export function getCapabilityFilterLabel(filterId) {
  return CAPABILITY_FILTER_OPTIONS.find((option) => option.id === filterId)?.label || filterId;
}

function normalizeMetadataFieldId(value) {
  return asText(value).toLowerCase();
}

function metadataEntriesForCriterion(row, metadataField = '') {
  const requestedField = normalizeMetadataFieldId(metadataField);
  const entries = getSearchableEvidenceFieldEntries(row);
  if (!requestedField) return entries;

  return entries.filter((entry) => (
    normalizeMetadataFieldId(entry.key) === requestedField
    || normalizeMetadataFieldId(entry.label) === requestedField
  ));
}

function normalizeEntityPairValue(value) {
  return asText(value).toLowerCase();
}

function rowMatchesEntityPairCriterion(row, criterion) {
  const source = firstText(row, SOURCE_PERSON_FIELDS);
  const target = firstText(row, TARGET_PERSON_FIELDS);
  const sourceIdentity = normalizeEntityPairValue(source);
  const targetIdentity = normalizeEntityPairValue(target);
  if (!source || !target || !sourceIdentity || sourceIdentity === targetIdentity) return false;

  const firstMode = criterion.firstMode || 'exact';
  const secondMode = criterion.secondMode || 'contains';
  const firstValue = criterion.firstValue;
  const secondValue = criterion.secondValue;

  return (
    (valueMatchesMode(source, firstMode, firstValue) && valueMatchesMode(target, secondMode, secondValue))
    || (valueMatchesMode(target, firstMode, firstValue) && valueMatchesMode(source, secondMode, secondValue))
  );
}

function valuesForStructuredField(row, field, metadataField = '') {
  if (field === 'person') return SOURCE_PERSON_FIELDS.concat(TARGET_PERSON_FIELDS).map((key) => row?.[key]);
  if (field === 'place') return SOURCE_PLACE_FIELDS.concat(TARGET_PLACE_FIELDS).map((key) => row?.[key]);
  if (field === 'routePlace') {
    return [compactRouteLabel(firstText(row, SOURCE_PLACE_FIELDS), firstText(row, TARGET_PLACE_FIELDS))];
  }
  if (field === 'routePeople') {
    return [compactRouteLabel(firstText(row, SOURCE_PERSON_FIELDS), firstText(row, TARGET_PERSON_FIELDS))];
  }
  if (field === 'date') return getRowTemporalSearchValues(row);
  if (field === 'evidenceFieldPresent' || field === 'metadataFieldPresent') {
    return getSearchableEvidenceFieldEntries(row).map((entry) => entry.label);
  }
  if (field === 'evidence' || field === 'metadataValue') {
    return metadataEntriesForCriterion(row, metadataField).map((entry) => entry.value);
  }
  return collectSearchableFields(row).map((fieldRecord) => fieldRecord.value);
}

function criterionNeedsValue(mode) {
  return mode !== 'isEmpty' && mode !== 'isNotEmpty';
}

function valueMatchesMode(value, mode, query) {
  const text = asText(value);
  const q = asText(query);
  if (mode === 'isEmpty') return !text;
  if (mode === 'isNotEmpty') return Boolean(text);
  if (!q) return true;
  if (mode === 'exact') return text.toLowerCase() === q.toLowerCase();
  if (mode === 'startsWith') return text.toLowerCase().startsWith(q.toLowerCase());
  return text.toLowerCase().includes(q.toLowerCase());
}

function normalizeStructuredOperator(operator) {
  // `must` and `should` remain the persisted compatibility values. The Search
  // workspace renders them as explicit Required and Any-of groups rather than
  // a misleading left-to-right Boolean sequence.
  return ['must', 'should', 'exclude'].includes(operator) ? operator : 'must';
}

function normalizeStructuredField(field) {
  if (field === 'evidence') return 'metadataValue';
  if (field === 'evidenceFieldPresent') return 'metadataFieldPresent';
  return field || 'any';
}

function normalizeStructuredCriteria(criteria = []) {
  return (Array.isArray(criteria) ? criteria : [])
    .map((criterion) => ({
      operator: normalizeStructuredOperator(criterion?.operator),
      field: normalizeStructuredField(criterion?.field),
      metadataField: asText(criterion?.metadataField),
      mode: criterion?.mode || 'contains',
      value: asText(criterion?.value),
      firstMode: criterion?.firstMode || 'exact',
      firstValue: asText(criterion?.firstValue),
      secondMode: criterion?.secondMode || 'contains',
      secondValue: asText(criterion?.secondValue),
    }))
    .filter((criterion) => (
      criterion.field === 'entityPair'
        ? criterion.firstValue && criterion.secondValue
        : (!criterionNeedsValue(criterion.mode) || criterion.value)
    ));
}

function rowMatchesStructuredCriterion(row, criterion) {
  if (criterion.field === 'entityPair') {
    return rowMatchesEntityPairCriterion(row, criterion);
  }
  if (criterion.field === 'capability') {
    if (!criterionNeedsValue(criterion.mode)) {
      return criterion.mode === 'isNotEmpty';
    }
    const query = asText(criterion.value).toLowerCase();
    const matchingOptions = CAPABILITY_FILTER_OPTIONS.filter((option) => (
      option.id.toLowerCase().includes(query)
      || option.label.toLowerCase().includes(query)
      || option.shortLabel.toLowerCase().includes(query)
    ));
    return matchingOptions.some((option) => rowMatchesSearchCapabilityFilter(row, option.id));
  }
  const values = valuesForStructuredField(row, criterion.field, criterion.metadataField);
  if (criterion.mode === 'isEmpty') return values.every((value) => !asText(value));
  if (criterion.mode === 'isNotEmpty') return values.some((value) => asText(value));
  return values.some((value) => valueMatchesMode(value, criterion.mode, criterion.value));
}

export function rowMatchesStructuredCriteria(row, criteria = []) {
  const normalizedCriteria = normalizeStructuredCriteria(criteria);
  if (!normalizedCriteria.length) return true;

  const mustCriteria = normalizedCriteria.filter((criterion) => criterion.operator === 'must');
  const shouldCriteria = normalizedCriteria.filter((criterion) => criterion.operator === 'should');
  const excludeCriteria = normalizedCriteria.filter((criterion) => criterion.operator === 'exclude');

  const passesMust = mustCriteria.every((criterion) => rowMatchesStructuredCriterion(row, criterion));
  const passesShould = shouldCriteria.length === 0 || shouldCriteria.some((criterion) => rowMatchesStructuredCriterion(row, criterion));
  const passesExclude = excludeCriteria.every((criterion) => !rowMatchesStructuredCriterion(row, criterion));

  return passesMust && passesShould && passesExclude;
}

function structuredOperatorLabel(operator) {
  if (operator === 'should') return 'OR';
  if (operator === 'exclude') return 'EXCLUDING';
  return 'AND';
}

function describeStructuredCriterionMatch(row, criterion) {
  if (criterion.operator === 'exclude') return null;
  if (!rowMatchesStructuredCriterion(row, criterion)) return null;
  const fieldLabel = {
    any: 'Structured criterion',
    person: 'Structured person',
    place: 'Structured place',
    routePlace: 'Structured route place',
    routePeople: 'Structured route people',
    entityPair: 'Connected entity pair',
    date: 'Structured date',
    metadataValue: 'Metadata value',
    metadataFieldPresent: 'Metadata field',
    evidence: 'Metadata value',
    evidenceFieldPresent: 'Metadata field',
    capability: 'Structured capability',
  }[criterion.field] || 'Structured criterion';
  const operatorPrefix = structuredOperatorLabel(criterion.operator);

  if (criterion.field === 'entityPair') {
    return {
      label: `${operatorPrefix}: ${fieldLabel}`,
      value: `${criterion.firstValue} + ${criterion.secondValue}`,
    };
  }

  if (criterion.field === 'capability') {
    const matched = CAPABILITY_FILTER_OPTIONS.find((option) => (
      option.id === criterion.value || option.label.toLowerCase() === asText(criterion.value).toLowerCase()
    ));
    return { label: `${operatorPrefix}: ${fieldLabel}`, value: matched?.label || criterion.value || criterion.mode };
  }

  const values = valuesForStructuredField(row, criterion.field, criterion.metadataField);
  if (criterion.mode === 'isEmpty') return { label: `${operatorPrefix}: ${fieldLabel}`, value: 'is empty' };
  if (criterion.mode === 'isNotEmpty') {
    const firstValue = values.find((value) => asText(value));
    return { label: `${operatorPrefix}: ${fieldLabel}`, value: asText(firstValue) || 'is not empty' };
  }
  const matchedValue = values.find((value) => valueMatchesMode(value, criterion.mode, criterion.value));
  return { label: `${operatorPrefix}: ${fieldLabel}`, value: asText(matchedValue) || criterion.value };
}

function buildMatchedFields(row, appliedFilters) {
  const matches = [];
  const keywordMatch = findFirstFieldMatch(row, appliedFilters.search, []);
  if (keywordMatch) {
    matches.push({
      label: `Keyword in ${keywordMatch.label}`,
      value: keywordMatch.value,
    });
  }

  const personMatch = findFirstFieldMatch(
    row,
    appliedFilters.personFilter,
    SOURCE_PERSON_FIELDS.concat(TARGET_PERSON_FIELDS),
  );
  if (personMatch) matches.push({ label: `Person in ${personMatch.label}`, value: personMatch.value });

  const placeMatch = findFirstFieldMatch(
    row,
    appliedFilters.placeFilter,
    SOURCE_PLACE_FIELDS.concat(TARGET_PLACE_FIELDS),
  );
  if (placeMatch) matches.push({ label: `Place in ${placeMatch.label}`, value: placeMatch.value });

  const routePlaceQuery = asText(appliedFilters.routePlaceFilter);
  if (routePlaceQuery) {
    const placeRoute = compactRouteLabel(firstText(row, SOURCE_PLACE_FIELDS), firstText(row, TARGET_PLACE_FIELDS));
    if (includesNeedle(placeRoute, routePlaceQuery)) matches.push({ label: 'Route place', value: placeRoute });
  }

  const routePeopleQuery = asText(appliedFilters.routePeopleFilter);
  if (routePeopleQuery) {
    const peopleRoute = compactRouteLabel(firstText(row, SOURCE_PERSON_FIELDS), firstText(row, TARGET_PERSON_FIELDS));
    if (includesNeedle(peopleRoute, routePeopleQuery)) matches.push({ label: 'Route entities', value: peopleRoute });
  }

  const capabilityMatches = (appliedFilters.capabilityFilters || [])
    .filter((filterId) => rowMatchesSearchCapabilityFilter(row, filterId))
    .map((filterId) => ({ label: 'Capability', value: getCapabilityFilterLabel(filterId) }));

  const structuredMatches = normalizeStructuredCriteria(appliedFilters.structuredCriteria)
    .map((criterion) => describeStructuredCriterionMatch(row, criterion))
    .filter(Boolean);

  return matches.concat(capabilityMatches, structuredMatches).slice(0, 5);
}

function buildCapabilityBadges(row) {
  const state = getRowCapabilityState(row);
  const badges = [];
  if (state.inspectorReady) badges.push('Inspector-ready');
  if (state.mapReady) badges.push('Map-relevant');
  if (state.networkReady) badges.push('Network-ready');
  if (state.timelineReady) badges.push('Timeline-ready');
  if (state.evidenceReady) badges.push('Evidence-rich');
  return badges.slice(0, 5);
}


/*
 * Metadata facets retain the field/value relationship that a flat evidence
 * inventory loses. Each returned field group can therefore add a precise
 * refinement such as Language = Italian rather than a broad text search for
 * “Italian” anywhere in a record.
 */
export function buildPeridotMetadataFacetGroups(rows = [], options = {}) {
  const fieldLimit = Number.isFinite(options.fieldLimit)
    ? Math.max(1, options.fieldLimit)
    : Number.POSITIVE_INFINITY;
  const valueLimit = Number.isFinite(options.valueLimit)
    ? Math.max(1, options.valueLimit)
    : Number.POSITIVE_INFINITY;
  const fields = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const seenInRow = new Set();
    getSearchableEvidenceFieldEntries(row).forEach((entry) => {
      const key = asText(entry.key) || asText(entry.label);
      const label = asText(entry.label) || key;
      const value = asText(entry.value);
      if (!key || !label || !value) return;

      const fieldIdentity = `${key}\u0000${label}`;
      const valueIdentity = `${fieldIdentity}\u0000${value}`;
      if (seenInRow.has(valueIdentity)) return;
      seenInRow.add(valueIdentity);

      if (!fields.has(fieldIdentity)) {
        fields.set(fieldIdentity, {
          id: `metadata-${key}`,
          key,
          label,
          values: new Map(),
          recordCount: 0,
        });
      }

      const field = fields.get(fieldIdentity);
      field.recordCount += 1;
      field.values.set(value, (field.values.get(value) || 0) + 1);
    });
  });

  return Array.from(fields.values())
    .map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      recordCount: field.recordCount,
      items: facetItemsFromMap(field.values, valueLimit),
    }))
    .filter((field) => field.items.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, fieldLimit);
}

export function buildPeridotSearchFacets(rows = [], options = {}) {
  const limit = Number.isFinite(options.limit)
    ? Math.max(1, options.limit)
    : Number.POSITIVE_INFINITY;
  const people = new Map();
  const places = new Map();
  const placeRoutes = new Map();
  const years = new Map();
  const evidenceFields = new Map();

  rows.forEach((row) => {
    const sourcePerson = firstText(row, SOURCE_PERSON_FIELDS);
    const targetPerson = firstText(row, TARGET_PERSON_FIELDS);
    const sourcePlace = firstText(row, SOURCE_PLACE_FIELDS);
    const targetPlace = firstText(row, TARGET_PLACE_FIELDS);
    const temporalYears = getRowTemporalYears(row);
    addFacetCount(people, sourcePerson);
    addFacetCount(people, targetPerson);
    addFacetCount(places, sourcePlace);
    addFacetCount(places, targetPlace);
    if (sourcePlace || targetPlace) addFacetCount(placeRoutes, compactRouteLabel(sourcePlace, targetPlace));
    Array.from(new Set(temporalYears)).forEach((year) => addFacetCount(years, String(year).slice(0, 4)));
    getSearchableEvidenceFieldEntries(row).forEach((entry) => {
      addFacetCount(evidenceFields, entry.label);
    });
  });

  const capabilityItems = CAPABILITY_FILTER_OPTIONS.map((option) => ({
    value: option.id,
    label: option.label,
    count: rows.filter((row) => rowMatchesSearchCapabilityFilter(row, option.id)).length,
  })).filter((item) => item.count > 0);

  return [
    { id: 'people', label: 'People / entities', type: 'person', items: facetItemsFromMap(people, limit) },
    { id: 'places', label: 'Places', type: 'place', items: facetItemsFromMap(places, limit) },
    { id: 'placeRoutes', label: 'Place routes', type: 'routePlace', items: facetItemsFromMap(placeRoutes, limit) },
    { id: 'years', label: 'Years', type: 'year', items: facetItemsFromMap(years, limit) },
    { id: 'capabilities', label: 'Capabilities', type: 'capability', items: capabilityItems },
    { id: 'metadataFields', label: 'Metadata fields present', type: 'metadataFieldPresent', items: facetItemsFromMap(evidenceFields, limit) },
  ].filter((group) => group.items.length > 0);
}

export function buildPeridotSearchResults(rows = [], appliedFilters = {}, options = {}) {
  const limit = Math.max(1, options.limit ?? 50);
  return rows.slice(0, limit).map((row, index) => {
    const sourcePerson = firstText(row, SOURCE_PERSON_FIELDS);
    const targetPerson = firstText(row, TARGET_PERSON_FIELDS);
    const sourcePlace = firstText(row, SOURCE_PLACE_FIELDS);
    const targetPlace = firstText(row, TARGET_PLACE_FIELDS);
    const displayDate = getRowTemporalDisplayLabels(row).slice(0, 2).join(' · ') || firstText(row, DATE_FIELDS) || 'Undated';
    const matchedFields = buildMatchedFields(row, appliedFilters);
    return {
      id: row?.id || row?.recordId || row?.Record_ID || row?.Letter_ID || `search-result-${index}`,
      index,
      row,
      title: buildResultTitle(row, index),
      displayDate,
      peopleRoute: compactRouteLabel(sourcePerson, targetPerson),
      placeRoute: compactRouteLabel(sourcePlace, targetPlace),
      sourcePerson,
      targetPerson,
      sourcePlace,
      targetPlace,
      matchedFields,
      capabilityBadges: buildCapabilityBadges(row),
    };
  });
}
