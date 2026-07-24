/*
 * Static UI configuration for the role-based column/workbook mapping modal.
 *
 * This file intentionally contains no React state and no import/application logic.
 * `PeridotColumnMappingModal.jsx` imports these constants and formatters so the
 * modal can focus on rendering and state transitions rather than owning every
 * label, step sequence, and role grouping inline.
 *
 * Maintenance relationship:
 * - `PeridotColumnMappingModal.jsx` remains the active mapping workspace.
 * - `peridotColumnMapping.js` and `peridotWorkbookMapping.js` own the pure data
 *   mapping rules; this file owns only UI-facing grouping and label metadata.
 */

export const SINGLE_TABLE_STEP_KEYS = Object.freeze([
  'preview',
  'time',
  'places',
  'relationships',
  'evidence',
  'review',
]);

export const WORKBOOK_STEP_KEYS = Object.freeze([
  'workbook-preview',
  'workbook-setup',
  'workbook-time',
  'workbook-places',
  'workbook-relationships',
  'workbook-evidence',
  'workbook-review',
]);

export const CORE_FIELD_GROUPS = Object.freeze({
  relationship: Object.freeze(['Source_Name', 'Target_Name']),
  routePlaces: Object.freeze([
    'Source_Location',
    'Source_Latitude',
    'Source_Longitude',
    'Target_Location',
    'Target_Latitude',
    'Target_Longitude',
  ]),
});

export const RECORD_SHAPE_LABELS = Object.freeze({
  directedRelationship: 'Directed relationship',
  pointSite: 'Point / site',
  timeSeriesMeasurement: 'Time-series measurement',
  genericEvidence: 'Generic evidence',
});

export const CAPABILITY_LABELS = Object.freeze({
  inspectorReady: 'Available in Inspector',
  searchReady: 'Searchable',
  pointMapReady: 'Point Map available',
  routeMapReady: 'Route Map available',
  networkReady: 'Network available',
  timelineReady: 'Timeline available',
  chartReady: 'Charts available',
  exportReady: 'Export available',
});

export function definitionsForFields(definitions = [], fields = []) {
  const fieldSet = new Set(fields);
  return definitions.filter((definition) => fieldSet.has(definition.key));
}

export function formatRecordShapeName(shape) {
  return RECORD_SHAPE_LABELS[shape] || shape;
}

export function formatCapabilityName(capability) {
  return CAPABILITY_LABELS[capability] || capability;
}


export const GENEALOGY_STEP_KEYS = Object.freeze([
  'genealogy-preview',
  'genealogy-identity',
  'genealogy-parents',
  'genealogy-partners',
  'genealogy-life-events',
  'genealogy-places',
  'genealogy-attributes',
  'genealogy-review',
]);

export const GENEALOGY_FIELD_GROUP_LABELS = Object.freeze({
  identity: 'Person identity',
  parents: 'Parents',
  partners: 'Partners',
  birth: 'Birth',
  death: 'Death',
  attributes: 'Person attributes',
});
