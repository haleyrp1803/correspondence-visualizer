/*
 * Phase 2.6 return-and-edit continuity helpers for the isolated universal-upload prototype.
 *
 * These helpers never delete draft work. They report which saved choices are currently
 * operational and which are temporarily dormant because an upstream sheet-purpose
 * decision no longer allows the dependent mapping to participate.
 */

import { PERIDOT_FIELD_ASSIGNMENT_STATUS } from './peridotUniversalMappingModel.js';
import { listPeridotUniversalPrototypeTablesFor } from './peridotUniversalSheetPurposePolicy.js';

function tableLabel(sourceManifest, tableId) {
  const table = (sourceManifest?.sourceTables || []).find((item) => item.id === tableId);
  return table?.label || table?.sheetName || tableId;
}

export function buildPeridotUniversalMappingEditContinuityReview(state) {
  const fieldTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'fields').map((table) => table.id));
  const repeatedTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'repeated-headings').map((table) => table.id));
  const connectionTableIds = new Set(listPeridotUniversalPrototypeTablesFor(state, 'connections').map((table) => table.id));

  const dormantFieldAssignments = (state?.fieldAssignments || [])
    .filter((item) => item.status !== PERIDOT_FIELD_ASSIGNMENT_STATUS.UNASSIGNED && !fieldTableIds.has(item.sourceTableId))
    .map((item) => Object.freeze({
      id: item.sourceFieldId,
      sourceTableId: item.sourceTableId,
      label: `${tableLabel(state.sourceManifest, item.sourceTableId)}: ${item.sourceFieldName || item.sourceFieldId}`,
      reason: 'This sheet is not currently available for variable mapping.',
      editStep: 'purposes',
    }));

  const dormantRepeatedHeadingGroups = (state?.repeatedHeadingGroups || [])
    .filter((item) => !repeatedTableIds.has(item.sourceTableId))
    .map((item) => Object.freeze({
      id: item.id,
      sourceTableId: item.sourceTableId,
      label: tableLabel(state.sourceManifest, item.sourceTableId),
      reason: 'This repeated-data rule is paused because its sheet is not currently available for repeated-data mapping.',
      editStep: 'purposes',
    }));

  const dormantTableConnections = (state?.tableConnections || [])
    .filter((item) => !connectionTableIds.has(item.fromTableId) || !connectionTableIds.has(item.toTableId))
    .map((item) => Object.freeze({
      id: item.id,
      fromTableId: item.fromTableId,
      toTableId: item.toTableId,
      label: `${tableLabel(state.sourceManifest, item.fromTableId)} ↔ ${tableLabel(state.sourceManifest, item.toTableId)}`,
      reason: 'This connection is paused because one or both sheets are not currently available for connections.',
      editStep: 'purposes',
    }));

  const dormantCount = dormantFieldAssignments.length + dormantRepeatedHeadingGroups.length + dormantTableConnections.length;
  return Object.freeze({
    dormantFieldAssignments: Object.freeze(dormantFieldAssignments),
    dormantRepeatedHeadingGroups: Object.freeze(dormantRepeatedHeadingGroups),
    dormantTableConnections: Object.freeze(dormantTableConnections),
    dormantCount,
    hasDormantWork: dormantCount > 0,
    message: dormantCount
      ? `${dormantCount} saved draft choice(s) are temporarily inactive. They are preserved and will become active again if the relevant sheet purpose is restored.`
      : 'All saved draft choices are currently active.',
  });
}
