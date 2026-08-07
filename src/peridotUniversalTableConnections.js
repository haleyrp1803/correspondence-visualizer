/*
 * Phase 2.5 operational related-sheet connection helpers.
 *
 * A connection is user-declared: Peridot only compares the selected fields and
 * reports what the current source rows do. It does not flatten related rows,
 * infer relationship meaning, standardize values, or treat several matches as
 * an error unless the researcher says they expected one matching row.
 */

export const PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS = Object.freeze({
  UNANSWERED: 'unanswered',
  EXPECT_ONE: 'expect-one',
  ALLOW_SEVERAL: 'allow-several',
});

export const PERIDOT_CONNECTION_MULTIPLE_MATCH_OPTIONS = Object.freeze([
  Object.freeze({ value: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.UNANSWERED, label: 'I have not decided' }),
  Object.freeze({ value: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.ALLOW_SEVERAL, label: 'Yes — several matching rows can be meaningful here' }),
  Object.freeze({ value: PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.EXPECT_ONE, label: 'No — I usually expect one matching row' }),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sourceTables(sourceManifest) {
  return asArray(sourceManifest?.sourceTables);
}

function tableById(sourceManifest, tableId) {
  return sourceTables(sourceManifest).find((table) => table.id === tableId) || null;
}

function fieldById(table, fieldId) {
  return asArray(table?.fields).find((field) => field.id === fieldId) || null;
}

function sourceRows(sourceRowsByTableId, tableId) {
  return asArray(sourceRowsByTableId?.[tableId]);
}

function scalarKey(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return `number:${String(value)}`;
  if (typeof value === 'boolean') return `boolean:${value ? 'true' : 'false'}`;
  if (typeof value === 'string') return `string:${value}`;
  return `other:${String(value)}`;
}

function connectionExpectation(connection) {
  const value = connection?.attributes?.multipleMatchesExpectation;
  return Object.values(PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS).includes(value)
    ? value
    : PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.UNANSWERED;
}

export function buildPeridotTableConnectionMatchReport({
  sourceManifest = {},
  sourceRowsByTableId = {},
  connection = {},
  maxRows = 12,
} = {}) {
  const fromTable = tableById(sourceManifest, connection.fromTableId);
  const toTable = tableById(sourceManifest, connection.toTableId);
  const fromField = fieldById(fromTable, connection.fromFieldId);
  const toField = fieldById(toTable, connection.toFieldId);
  const problems = [];

  if (!fromTable) problems.push('Choose the sheet whose rows should look for related information.');
  if (!toTable) problems.push('Choose the sheet that may contain matching rows.');
  if (fromTable && toTable && fromTable.id === toTable.id) problems.push('Choose two different sheets.');
  if (fromTable && !fromField) problems.push('Choose the field to match from the first sheet.');
  if (toTable && !toField) problems.push('Choose the field to match in the related sheet.');

  const expectation = connectionExpectation(connection);
  if (problems.length) {
    return Object.freeze({
      valid: false,
      problems: Object.freeze(problems),
      fromTableLabel: fromTable?.label || fromTable?.sheetName || '',
      toTableLabel: toTable?.label || toTable?.sheetName || '',
      fromFieldName: fromField?.name || '',
      toFieldName: toField?.name || '',
      expectation,
      needsMultipleMatchAnswer: false,
      expectationConflict: false,
      summary: Object.freeze({ fromRows: 0, noMatchRows: 0, oneMatchRows: 0, severalMatchRows: 0, blankSourceRows: 0 }),
      rows: Object.freeze([]),
    });
  }

  const toRows = sourceRows(sourceRowsByTableId, toTable.id);
  const targetIndex = new Map();
  toRows.forEach((row, index) => {
    const key = scalarKey(row?.[toField.name]);
    if (key === null) return;
    const matches = targetIndex.get(key) || [];
    matches.push(index + 1);
    targetIndex.set(key, matches);
  });

  const fromRows = sourceRows(sourceRowsByTableId, fromTable.id);
  let noMatchRows = 0;
  let oneMatchRows = 0;
  let severalMatchRows = 0;
  let blankSourceRows = 0;
  const rows = [];

  fromRows.forEach((row, index) => {
    const value = row?.[fromField.name];
    const key = scalarKey(value);
    const matchedRowNumbers = key === null ? [] : (targetIndex.get(key) || []);
    const matchCount = matchedRowNumbers.length;
    let outcome = 'no match';
    if (key === null) blankSourceRows += 1;
    if (matchCount === 0) noMatchRows += 1;
    if (matchCount === 1) {
      oneMatchRows += 1;
      outcome = 'one match';
    }
    if (matchCount > 1) {
      severalMatchRows += 1;
      outcome = 'several matches';
    }
    if (rows.length < maxRows) {
      rows.push(Object.freeze({
        sourceRowNumber: index + 1,
        sourceValue: value,
        outcome,
        matchCount,
        matchedRowNumbers: Object.freeze([...matchedRowNumbers]),
      }));
    }
  });

  const needsMultipleMatchAnswer = severalMatchRows > 0
    && expectation === PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.UNANSWERED;
  const expectationConflict = severalMatchRows > 0
    && expectation === PERIDOT_CONNECTION_MULTIPLE_MATCH_EXPECTATIONS.EXPECT_ONE;

  return Object.freeze({
    valid: true,
    problems: Object.freeze([]),
    fromTableLabel: fromTable.label || fromTable.sheetName || fromTable.id,
    toTableLabel: toTable.label || toTable.sheetName || toTable.id,
    fromFieldName: fromField.name,
    toFieldName: toField.name,
    expectation,
    needsMultipleMatchAnswer,
    expectationConflict,
    summary: Object.freeze({
      fromRows: fromRows.length,
      toRows: toRows.length,
      noMatchRows,
      oneMatchRows,
      severalMatchRows,
      blankSourceRows,
    }),
    rows: Object.freeze(rows),
  });
}

export function describePeridotTableConnection({ sourceManifest = {}, connection = {} } = {}) {
  const fromTable = tableById(sourceManifest, connection.fromTableId);
  const toTable = tableById(sourceManifest, connection.toTableId);
  const fromField = fieldById(fromTable, connection.fromFieldId);
  const toField = fieldById(toTable, connection.toFieldId);
  return Object.freeze({
    fromTableLabel: fromTable?.label || fromTable?.sheetName || connection.fromTableId || '',
    toTableLabel: toTable?.label || toTable?.sheetName || connection.toTableId || '',
    fromFieldName: fromField?.name || connection.fromFieldId || '',
    toFieldName: toField?.name || connection.toFieldId || '',
    expectation: connectionExpectation(connection),
  });
}

export function buildPeridotTableConnectionReview({
  sourceManifest = {},
  sourceRowsByTableId = {},
  connections = [],
} = {}) {
  const reports = asArray(connections).map((connection) => Object.freeze({
    connectionId: connection.id,
    ...buildPeridotTableConnectionMatchReport({ sourceManifest, sourceRowsByTableId, connection, maxRows: 0 }),
  }));
  return Object.freeze({
    reports: Object.freeze(reports),
    invalidConnections: reports.filter((report) => !report.valid).length,
    unresolvedMultipleMatchQuestions: reports.filter((report) => report.needsMultipleMatchAnswer).length,
    expectationConflicts: reports.filter((report) => report.expectationConflict).length,
    noMatchRows: reports.reduce((sum, report) => sum + report.summary.noMatchRows, 0),
    oneMatchRows: reports.reduce((sum, report) => sum + report.summary.oneMatchRows, 0),
    severalMatchRows: reports.reduce((sum, report) => sum + report.summary.severalMatchRows, 0),
  });
}
