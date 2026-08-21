/*
 * Correspondence regression fixtures for the generalized workbook model.
 * These checks deliberately model the same structural choices used by the
 * correspondence-network sample: primary Raw Data participants, a one-to-one
 * Geographic Mapping join, composite Name + Title identity shared across
 * Source/Target roles, and participant-attached origin/destination places.
 */

import {
  buildPeridotRowsFromWorkbookMapping,
  makeLetterIdJoin,
  makeWorkbookColumnRef,
  validatePeridotWorkbookMapping,
} from './peridotWorkbookMapping.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';
import { derivePeridotEntityNetworkSemantics } from './peridotEntityNetwork.js';
import { buildPeridotInspectorEntityProfile } from './peridotInspectorSemantics.js';

function assert(name, condition, details = '') {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
  return { name, passed: true };
}

function makeWorkbook() {
  return {
    fileName: 'Correspondence Network Sample Data.xlsx',
    sheets: [
      {
        sheetName: 'Raw Data',
        headers: ['Unique ID', 'Date*', 'Source', 'Source Title', 'Target', 'Target Title', 'Relationship'],
        rows: [
          { 'Unique ID': 'L1', 'Date*': '1610/01/01', Source: 'Maria', 'Source Title': 'Grand Duchess', Target: 'Carlo', 'Target Title': 'Cardinal', Relationship: 'Family' },
          { 'Unique ID': 'L2', 'Date*': '1610/01/02', Source: 'Carlo', 'Source Title': 'Cardinal', Target: 'Maria', 'Target Title': 'Grand Duchess', Relationship: 'Family' },
          { 'Unique ID': 'L3', 'Date*': '1610/01/03', Source: 'Maria', 'Source Title': 'Grand Duchess', Target: 'Virginia', 'Target Title': 'Duchess', Relationship: 'Political' },
          { 'Unique ID': 'L4', 'Date*': '1610/01/04', Source: 'Virginia', 'Source Title': 'Duchess', Target: 'Maria', 'Target Title': 'Grand Duchess', Relationship: 'Political' },
        ],
        rowCount: 4,
        columnCount: 7,
      },
      {
        sheetName: 'Geographic Mapping',
        headers: ['Unique ID', 'Source Location', 'Source Latitude', 'Source Longitude', 'Target Location (Inferred)', 'Target Latitude', 'Target Longitude'],
        rows: [
          { 'Unique ID': 'L1', 'Source Location': 'Florence', 'Source Latitude': '43.7696', 'Source Longitude': '11.2558', 'Target Location (Inferred)': 'Rome', 'Target Latitude': '41.9028', 'Target Longitude': '12.4964' },
          { 'Unique ID': 'L2', 'Source Location': 'Rome', 'Source Latitude': '41.9028', 'Source Longitude': '12.4964', 'Target Location (Inferred)': 'Florence', 'Target Latitude': '43.7696', 'Target Longitude': '11.2558' },
          { 'Unique ID': 'L3', 'Source Location': 'Florence', 'Source Latitude': '43.7696', 'Source Longitude': '11.2558', 'Target Location (Inferred)': 'Mantua', 'Target Latitude': '45.1564', 'Target Longitude': '10.7914' },
          { 'Unique ID': 'L4', 'Source Location': 'Mantua', 'Source Latitude': '45.1564', 'Source Longitude': '10.7914', 'Target Location (Inferred)': 'Florence', 'Target Latitude': '43.7696', 'Target Longitude': '11.2558' },
        ],
        rowCount: 4,
        columnCount: 7,
      },
    ],
  };
}

function makeMapping() {
  const ref = makeWorkbookColumnRef;
  return {
    mode: 'multi_sheet_letter_id',
    primarySheetName: 'Raw Data',
    primaryLetterIdColumn: 'Unique ID',
    letterLevelJoins: [makeLetterIdJoin({
      fromSheetName: 'Raw Data',
      fromColumnName: 'Unique ID',
      toSheetName: 'Geographic Mapping',
      toColumnName: 'Unique ID',
    })],
    lookupJoins: [],
    relationshipParts: [
      { participantRef: ref('Raw Data', 'Source'), roleLabel: 'Source', roleMode: 'heading' },
      { participantRef: ref('Raw Data', 'Target'), roleLabel: 'Target', roleMode: 'heading' },
    ],
    identityMapping: {
      record: { strategy: 'workbook-key', refs: [ref('Raw Data', 'Unique ID')] },
      entityGroupsInitialized: true,
      entityGroups: [{
        id: 'people',
        label: 'People',
        appearanceIds: ['relationship:0', 'relationship:1'],
        strategy: 'composite',
        keys: ['Name', 'Title'],
        mappings: {
          'relationship:0': [
            { key: 'Name', ref: ref('Raw Data', 'Source') },
            { key: 'Title', ref: ref('Raw Data', 'Source Title') },
          ],
          'relationship:1': [
            { key: 'Name', ref: ref('Raw Data', 'Target') },
            { key: 'Title', ref: ref('Raw Data', 'Target Title') },
          ],
        },
      }],
    },
    placeParts: [
      {
        placeRef: ref('Geographic Mapping', 'Source Location'),
        roleLabel: 'Letter sent from',
        roleMode: 'heading',
        subjectParticipantIndex: 0,
        latitudeRef: ref('Geographic Mapping', 'Source Latitude'),
        longitudeRef: ref('Geographic Mapping', 'Source Longitude'),
      },
      {
        placeRef: ref('Geographic Mapping', 'Target Location (Inferred)'),
        roleLabel: 'Letter sent to',
        roleMode: 'heading',
        subjectParticipantIndex: 1,
        latitudeRef: ref('Geographic Mapping', 'Target Latitude'),
        longitudeRef: ref('Geographic Mapping', 'Target Longitude'),
      },
    ],
    temporalAssertionMappings: [
      { id: 'letter-date', role: 'Letter date', kind: 'date', sourceMode: 'single', column: ref('Raw Data', 'Date*'), noteColumns: [] },
    ],
    temporalMappings: {},
    temporalNoteMappings: {},
    relationshipMetadataMappings: { Relationship_Type: ref('Raw Data', 'Relationship') },
    customFieldSelections: [],
    coreMappings: {},
    pointMappings: {},
    routeCoordinatePairMappings: {},
  };
}

export function runPeridotCorrespondenceUniversalModelFixtures() {
  const workbook = makeWorkbook();
  const mapping = makeMapping();
  const validation = validatePeridotWorkbookMapping(workbook, mapping);
  const rows = buildPeridotRowsFromWorkbookMapping(workbook, mapping);
  const canonicalRuntime = buildPeridotCanonicalRuntimeModel(rows, {
    fileLabel: 'Correspondence Network Sample Data.xlsx',
    sourceKind: 'mapped-workbook',
    sourceSheet: 'Raw Data',
  });
  const canonical = canonicalRuntime.canonicalDataset;
  const network = derivePeridotEntityNetworkSemantics(rows);

  const mariaEntities = canonical.entities.filter((entity) => entity.label === 'Maria');
  const mariaParticipantIds = rows.flatMap((row) => row?.generalizedObservation?.participants || [])
    .filter((participant) => participant.value === 'Maria')
    .map((participant) => participant.entityId);

  const suggestedMapping = makeMapping();
  suggestedMapping.identityMapping.entityGroups[0].mappings = {};
  const suggestedRows = buildPeridotRowsFromWorkbookMapping(workbook, suggestedMapping);
  const suggestedRuntime = buildPeridotCanonicalRuntimeModel(suggestedRows, {
    fileLabel: 'Correspondence Network Sample Data.xlsx',
    sourceKind: 'mapped-workbook',
    sourceSheet: 'Raw Data',
  });
  const suggestedMariaIds = suggestedRows.flatMap((row) => row?.generalizedObservation?.participants || [])
    .filter((participant) => participant.value === 'Maria')
    .map((participant) => participant.entityId);
  const florenceProfile = buildPeridotInspectorEntityProfile(suggestedRuntime.normalizedRows, {
    entityType: 'place',
    entityLabel: 'Florence',
  });
  const florenceMariaItems = florenceProfile.relatedPeopleSections
    .flatMap((section) => section.items || [])
    .filter((item) => item.label === 'Maria');
  const suggestedMariaId = suggestedMariaIds[0] || '';
  const mariaProfile = buildPeridotInspectorEntityProfile(suggestedRuntime.normalizedRows, {
    entityType: 'person',
    entityLabel: 'Maria',
    entityId: suggestedMariaId,
  });

  const duplicateWorkbook = makeWorkbook();
  duplicateWorkbook.sheets[1].rows = [
    ...duplicateWorkbook.sheets[1].rows,
    { ...duplicateWorkbook.sheets[1].rows[0] },
  ];
  duplicateWorkbook.sheets[1].rowCount = duplicateWorkbook.sheets[1].rows.length;
  const duplicateValidation = validatePeridotWorkbookMapping(duplicateWorkbook, mapping);

  return [
    assert('one-to-one correspondence workbook join validates', validation.isValid === true),
    assert('composite identity unifies Source and Target appearances', mariaEntities.length === 1 && new Set(mariaParticipantIds).size === 1),
    assert('generalized correspondence relationships produce edges', network.relationships.length === 4),
    assert('participant-attached source and target places survive canonical normalization', canonical.assertions.some((assertion) => assertion.predicate === 'mapped-place:Letter sent from') && canonical.assertions.some((assertion) => assertion.predicate === 'mapped-place:Letter sent to')),
    assert('visible workbook identity suggestions become authoritative even when untouched', new Set(suggestedMariaIds).size === 1 && Boolean(suggestedMariaId)),
    assert('place Inspector does not split one repeated person into occurrence-level identities', florenceMariaItems.length === 2 && new Set(florenceMariaItems.map((item) => item.entityId)).size === 1),
    assert('person Inspector follows the same materialized identity across source and target rows', mariaProfile.matchingRows.length === 4),
    assert('duplicate joined IDs are blocked instead of first-match joined', duplicateValidation.isValid === false && duplicateValidation.issues.some((issue) => issue.code === 'duplicate_record_join_target_ids')),
  ];
}
