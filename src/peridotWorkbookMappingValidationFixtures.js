/*
 * Dependency-free fixtures for workbook validation after generalized mapping
 * became authoritative. These checks ensure that unused workbook sheets do not
 * impose correspondence-era Letter_ID requirements, while genuine cross-sheet
 * mappings still require an explicit shared unique-ID join.
 */

import {
  makeWorkbookColumnRef,
  validatePeridotWorkbookMapping,
} from './peridotWorkbookMapping.js';

function sheet(sheetName, headers, rows = [{}]) {
  return {
    sheetName,
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

export function runPeridotWorkbookMappingValidationSelfAudit() {
  const workbookModel = {
    fileName: 'Cardinals-style workbook.xlsx',
    sheets: [
      sheet('Cardinal Index', ['Cardinal', 'Created by', 'Creation date', 'Nationality / political origin'], [
        {
          Cardinal: 'Alessandro Peretti di Montalto',
          'Created by': 'Sixtus V',
          'Creation date': '1585',
          'Nationality / political origin': 'Papal States',
        },
      ]),
      sheet('Conclave Attendance', ['Cardinal', '1621', '1623']),
      sheet('Core Bibliography', ['Citation']),
      sheet('Scope & Method', ['Notes']),
      sheet('Field Audit Notes', ['Field', 'Notes']),
      sheet('Treccani Audit Summary', ['Cardinal', 'Status']),
      sheet('Lifespan Audit Log', ['Cardinal', 'Status']),
      sheet('Political-Faction Audit Log', ['Cardinal', 'Status']),
    ],
  };

  const ref = makeWorkbookColumnRef;
  const primaryOnlyMapping = {
    // Deliberately preserve the stale correspondence-era mode to prove that the
    // active semantic mappings, not workbook sheet count or mode, control joins.
    mode: 'multi_sheet_letter_id',
    primarySheetName: 'Cardinal Index',
    primaryLetterIdColumn: '',
    letterLevelJoins: [],
    lookupJoins: [],
    relationshipParts: [
      { participantRef: ref('Cardinal Index', 'Cardinal'), roleMode: 'heading' },
      { participantRef: ref('Cardinal Index', 'Created by'), roleMode: 'heading' },
    ],
    placeParts: [
      { placeRef: ref('Cardinal Index', 'Nationality / political origin'), roleMode: 'heading' },
    ],
    temporalMappings: {
      Date: ref('Cardinal Index', 'Creation date'),
      Date_Start: ref('', ''),
      Date_End: ref('', ''),
      Date_Display: ref('', ''),
    },
    relationshipMetadataMappings: {},
    customFieldSelections: [],
    coreMappings: {},
    pointMappings: {},
    routeCoordinatePairMappings: {},
  };

  const primaryOnlyValidation = validatePeridotWorkbookMapping(workbookModel, primaryOnlyMapping);

  const crossSheetMapping = {
    ...primaryOnlyMapping,
    relationshipParts: [
      ...primaryOnlyMapping.relationshipParts,
      { participantRef: ref('Conclave Attendance', 'Cardinal'), roleMode: 'heading' },
    ],
  };
  const crossSheetValidation = validatePeridotWorkbookMapping(workbookModel, crossSheetMapping);

  const duplicateJoinWorkbook = {
    fileName: 'Duplicate join fixture.xlsx',
    sheets: [
      sheet('Records', ['ID', 'Person'], [{ ID: '1', Person: 'A' }, { ID: '2', Person: 'B' }]),
      sheet('Joined', ['ID', 'Place'], [{ ID: '1', Place: 'Rome' }, { ID: '1', Place: 'Florence' }, { ID: '2', Place: 'Mantua' }]),
    ],
  };
  const duplicateJoinMapping = {
    ...primaryOnlyMapping,
    primarySheetName: 'Records',
    primaryLetterIdColumn: 'ID',
    relationshipParts: [{ participantRef: ref('Records', 'Person'), roleMode: 'heading' }],
    placeParts: [{ placeRef: ref('Joined', 'Place'), roleMode: 'heading', subjectParticipantIndex: 0 }],
    temporalMappings: {},
    letterLevelJoins: [{
      type: 'letter_id',
      from: ref('Records', 'ID'),
      to: ref('Joined', 'ID'),
    }],
  };
  const duplicateJoinValidation = validatePeridotWorkbookMapping(duplicateJoinWorkbook, duplicateJoinMapping);

  const checks = Object.freeze({
    primaryOnlyMultiSheetWorkbookAccepted: primaryOnlyValidation.isValid === true,
    noLetterIdErrorForUnusedSheets: !primaryOnlyValidation.issues.some((issue) =>
      /Letter_ID|letter-level/i.test(String(issue?.message || ''))
    ),
    noJoinErrorForUnusedSheets: !primaryOnlyValidation.issues.some((issue) =>
      issue?.severity === 'error' && /join|unique ID/i.test(String(issue?.message || ''))
    ),
    genuineCrossSheetMappingStillBlockedWithoutJoin:
      crossSheetValidation.isValid === false
      && crossSheetValidation.issues.some((issue) => issue?.code === 'missing_primary_join_id')
      && crossSheetValidation.issues.some((issue) => issue?.code === 'missing_unique_id_join_for_mapped_sheet'),
    crossSheetLanguageIsDatasetNeutral: crossSheetValidation.issues
      .filter((issue) => ['missing_primary_join_id', 'missing_unique_id_join_for_mapped_sheet', 'cross_sheet_id_requirement'].includes(issue?.code))
      .every((issue) => !/Letter_ID|letter-level/i.test(String(issue?.message || ''))),
    duplicateJoinedIdsAreRejected:
      duplicateJoinValidation.isValid === false
      && duplicateJoinValidation.issues.some((issue) => issue?.code === 'duplicate_record_join_target_ids'),
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    primaryOnlyIssues: primaryOnlyValidation.issues,
    crossSheetIssues: crossSheetValidation.issues,
  });
}
