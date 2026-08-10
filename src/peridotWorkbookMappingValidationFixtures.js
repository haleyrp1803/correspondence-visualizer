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
  });

  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    primaryOnlyIssues: primaryOnlyValidation.issues,
    crossSheetIssues: crossSheetValidation.issues,
  });
}
