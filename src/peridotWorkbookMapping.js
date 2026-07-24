/*
 * Workbook-aware mapping and join helpers.
 * 
 * This module models multi-sheet workbook imports. It tracks primary sheets, joined sheets, user-selected unique-ID columns, joined row contexts, core field references, evidence fields, validation, and final assembly into Peridot-shaped rows.
 * 
 * Important relationships:
 * - `PeridotColumnMappingModal.jsx` renders the workbook mapping UI based on these helpers.
 * - `peridotWorkbookParsing.js` produces the workbook model consumed here.
 * - `peridotColumnMapping.js` supplies shared field definitions and single-table logic.
 * 
 * Maintenance cautions:
 * - Joins must remain user-configured and explicit. Do not use row-order joining as the primary strategy.
 * - Header names for join columns do not need to match; selected ID columns are authoritative.
 */

/**
 * Peridot workbook-aware mapping helper.
 *
 * Pass E3-model scope:
 * - define a workbook-aware mapping state for CSV/TSV/Excel workbook models;
 * - support Sheet + Column references instead of flat column-only mappings;
 * - define primary record sheet selection;
 * - define Letter_ID-based joins for multi-sheet letter-level assembly;
 * - allow person/place lookup joins by exact-match name/place keys;
 * - validate mapping rules before UI import wiring;
 * - keep this module pure and unmounted. No React state, no modal rendering,
 *   no active data import, and no workbook parsing.
 *
 * Product rules encoded here:
 * - Peridot route/network core variables remain exactly nine fields:
 *   Date, Source_Name, Target_Name, Source_Location, Source_Latitude,
 *   Source_Longitude, Target_Location, Target_Latitude, Target_Longitude.
 * - Peridot also supports optional temporal roles for Date_Start, Date_End,
 *   and Date_Display so datasets can preserve intervals or multiple dates.
 * - Single-sheet imports do not require Letter_ID.
 * - If users assemble letter-level record information from multiple Excel
 *   sheets, a true Letter_ID join is required.
 * - Person names and place names may act as exact-match lookup keys.
 * - Exact-match person/place keys are intentionally not cleaned, normalized,
 *   translated, merged, or fuzzy-matched. Rome/Roma remain separate places.
 */

import {
  buildInitialPeridotPointMapping,
  buildInitialPeridotRouteCoordinatePairMapping,
  buildInitialPeridotTemporalMapping,
  CUSTOM_INSPECTOR_FIELD_DEFAULTS,
  PERIDOT_CORE_FIELD_DEFINITIONS,
  PERIDOT_CORE_FIELDS,
  PERIDOT_POINT_FIELDS,
  PERIDOT_POINT_FIELD_DEFINITIONS,
  PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS,
  PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS,
  PERIDOT_TEMPORAL_FIELDS,
  PERIDOT_TEMPORAL_FIELD_DEFINITIONS,
  suggestCustomInspectorFieldSelections,
  suggestPeridotCoreFieldMappings,
} from './peridotColumnMapping.js';

export const PERIDOT_WORKBOOK_JOIN_TYPES = Object.freeze({
  letterId: 'letter_id',
  personLookup: 'person_lookup',
  placeLookup: 'place_lookup',
});

export const PERIDOT_WORKBOOK_MAPPING_MODES = Object.freeze({
  singleSheet: 'single_sheet',
  multiSheetLetterId: 'multi_sheet_letter_id',
});

export const PERIDOT_RECOMMENDED_LETTER_ID_NAMES = Object.freeze([
  'Letter_ID',
  'Letter ID',
  'letter_id',
  'letter id',
  'Correspondence_ID',
  'Correspondence ID',
  'Record_ID',
  'Record ID',
  'Document_ID',
  'Document ID',
  'Item_ID',
  'Item ID',
]);

export const PERIDOT_RECOMMENDED_PERSON_KEY_NAMES = Object.freeze([
  'Person_ID',
  'Person ID',
  'Person',
  'Person_Name',
  'Person Name',
  'Name',
  'Source',
  'Target',
  'Sender',
  'Recipient',
]);

export const PERIDOT_RECOMMENDED_PLACE_KEY_NAMES = Object.freeze([
  'Place_ID',
  'Place ID',
  'Place',
  'Place_Name',
  'Place Name',
  'Location',
  'Source_Loc',
  'Target_Loc',
  'Target_Inferred_Loc',
  'City',
]);

export const PERIDOT_EXACT_MATCH_LOOKUP_WARNING =
  'Peridot matches person and place keys exactly as written. Variants such as Rome/Roma, Florence/Firenze, or Suor Maria/Maria Maddalena will be treated as separate entities unless standardized before upload.';

export const PERIDOT_LETTER_ID_REQUIREMENT_WARNING =
  'Peridot requires a true Letter_ID when assembling letter-level record information from multiple workbook sheets. Row order is not used as the primary join strategy.';

function asText(value) {
  return String(value ?? '').trim();
}

function normalizeName(value) {
  return asText(value)
    .toLowerCase()
    .replace(/["'’‘“”]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLoose(value) {
  return normalizeName(value).replace(/\s+/g, '');
}

function titleCase(value) {
  const text = asText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

/*
 * Build the display date stored on imported workbook rows. The mapping UI now
 * hides Date_Display because most users should only choose a single date or a
 * start/end interval; this helper keeps workbook imports aligned with ordinary
 * single-table imports by composing the readable display value automatically.
 */
function composeDisplayDateValue(singleDate, dateStart, dateEnd, explicitDisplayDate) {
  const display = asText(explicitDisplayDate);
  const single = asText(singleDate);
  const start = asText(dateStart);
  const end = asText(dateEnd);
  if (display) return display;
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–`;
  if (end) return `–${end}`;
  return single;
}

export function makeWorkbookColumnRef(sheetName = '', columnName = '') {
  return Object.freeze({
    sheetName: asText(sheetName),
    columnName: asText(columnName),
  });
}

export function makeWorkbookColumnRefKey(ref = {}) {
  return `${asText(ref.sheetName)}::${asText(ref.columnName)}`;
}

function isWorkbookColumnRefPresent(ref = {}) {
  return Boolean(asText(ref.sheetName) && asText(ref.columnName));
}

export function getWorkbookSheet(workbookModel, sheetName) {
  return (workbookModel?.sheets || []).find((sheet) => sheet.sheetName === sheetName) || null;
}

export function getWorkbookSheetNames(workbookModel) {
  return (workbookModel?.sheets || []).map((sheet) => sheet.sheetName);
}

export function getUsableWorkbookSheets(workbookModel) {
  return (workbookModel?.sheets || []).filter((sheet) => (sheet.rowCount || 0) > 0 && (sheet.headers || []).length > 0);
}

export function getWorkbookColumnRefs(workbookModel) {
  return getUsableWorkbookSheets(workbookModel).flatMap((sheet) =>
    (sheet.headers || []).map((header) => makeWorkbookColumnRef(sheet.sheetName, header))
  );
}

function getSheetRows(workbookModel, sheetName) {
  return getWorkbookSheet(workbookModel, sheetName)?.rows || [];
}

function getSheetHeaders(workbookModel, sheetName) {
  return getWorkbookSheet(workbookModel, sheetName)?.headers || [];
}

function columnExists(workbookModel, ref = {}) {
  const sheet = getWorkbookSheet(workbookModel, ref.sheetName);
  return Boolean(sheet && (sheet.headers || []).includes(ref.columnName));
}

function scoreHeaderAgainstCandidates(header, candidates = []) {
  const normalizedHeader = normalizeName(header);
  const looseHeader = normalizeLoose(header);
  if (!normalizedHeader) return 0;

  return candidates.reduce((best, candidate) => {
    const normalizedCandidate = normalizeName(candidate);
    const looseCandidate = normalizeLoose(candidate);
    if (!normalizedCandidate) return best;

    if (normalizedHeader === normalizedCandidate) return Math.max(best, 100);
    if (looseHeader === looseCandidate) return Math.max(best, 96);

    if (normalizedHeader.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHeader)) {
      return Math.max(best, 72);
    }

    const headerTokens = new Set(normalizedHeader.split(' ').filter(Boolean));
    const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
    const shared = candidateTokens.filter((token) => headerTokens.has(token));

    if (shared.length) {
      return Math.max(best, Math.round((shared.length / candidateTokens.length) * 55));
    }

    return best;
  }, 0);
}

function scoreSheetForPrimaryRecord(sheet = {}) {
  const headers = sheet.headers || [];
  const headerText = headers.map(normalizeName).join(' ');
  let score = 0;

  if ((sheet.rowCount || 0) > 0) score += Math.min(30, Math.log10((sheet.rowCount || 1) + 1) * 10);
  if (headers.length >= 5) score += 10;
  if (headers.length >= 9) score += 10;

  const coreSuggestionScores = suggestPeridotCoreFieldMappings(headers);
  Object.values(coreSuggestionScores).forEach((suggestion) => {
    if (suggestion?.score >= 55) score += 6;
    if (suggestion?.score >= 90) score += 4;
  });

  if (/\bdate\b|\bdate\*\b/.test(headerText)) score += 8;
  if (/\bsource\b|\bsender\b|\bfrom\b/.test(headerText)) score += 8;
  if (/\btarget\b|\brecipient\b|\bto\b/.test(headerText)) score += 8;
  if (/\btranscription\b|\bnotes\b|\barchive\b|\barchival\b/.test(headerText)) score += 8;

  if (/aggregated|summary|drop down|dropdown|lookup list/.test(normalizeName(sheet.sheetName))) score -= 20;
  if (/geodata|wikidata|people|persons|places|locations/.test(normalizeName(sheet.sheetName))) score -= 8;

  return Math.round(score);
}

export function suggestPrimaryRecordSheets(workbookModel) {
  return Object.freeze(
    getUsableWorkbookSheets(workbookModel)
      .map((sheet) => ({
        sheetName: sheet.sheetName,
        score: scoreSheetForPrimaryRecord(sheet),
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
      }))
      .sort((a, b) => b.score - a.score || b.rowCount - a.rowCount || a.sheetName.localeCompare(b.sheetName))
  );
}

export function findLikelyColumn(headers = [], candidates = []) {
  const scored = headers
    .map((header) => ({
      columnName: header,
      score: scoreHeaderAgainstCandidates(header, candidates),
    }))
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score || a.columnName.localeCompare(b.columnName));

  return scored[0] || null;
}

export function suggestLetterIdColumnForSheet(sheet = {}) {
  const match = findLikelyColumn(sheet.headers || [], PERIDOT_RECOMMENDED_LETTER_ID_NAMES);
  return match
    ? Object.freeze({
        sheetName: sheet.sheetName,
        columnName: match.columnName,
        confidence: match.score >= 95 ? 'high' : match.score >= 70 ? 'medium' : 'low',
        score: match.score,
      })
    : Object.freeze({
        sheetName: sheet.sheetName,
        columnName: '',
        confidence: 'none',
        score: 0,
      });
}

export function suggestLetterIdColumns(workbookModel) {
  return Object.freeze(
    getUsableWorkbookSheets(workbookModel).map((sheet) => suggestLetterIdColumnForSheet(sheet))
  );
}

export function getLetterIdColumnCandidatesForSheet(sheet = {}) {
  return Object.freeze(
    (sheet.headers || [])
      .map((header) => ({
        sheetName: sheet.sheetName,
        columnName: header,
        score: scoreHeaderAgainstCandidates(header, PERIDOT_RECOMMENDED_LETTER_ID_NAMES),
      }))
      .filter((candidate) => candidate.score >= 55)
      .sort((a, b) => b.score - a.score || a.columnName.localeCompare(b.columnName))
  );
}

function findMatchingLetterIdColumn(sheet = {}, primaryLetterIdColumn = '') {
  const candidates = getLetterIdColumnCandidatesForSheet(sheet);
  const normalizedPrimary = normalizeLoose(primaryLetterIdColumn);

  if (normalizedPrimary) {
    const exact = candidates.find((candidate) => normalizeLoose(candidate.columnName) === normalizedPrimary);
    if (exact) return exact;
  }

  return candidates[0] || null;
}

export function suggestSharedLetterIdJoins(workbookModel, primarySheetName = '', primaryLetterIdColumn = '') {
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);
  if (!primarySheet) return Object.freeze([]);

  const primaryColumn = asText(primaryLetterIdColumn)
    || suggestLetterIdColumnForSheet(primarySheet).columnName
    || '';

  if (!primaryColumn) return Object.freeze([]);

  return Object.freeze(
    getUsableWorkbookSheets(workbookModel)
      .filter((sheet) => sheet.sheetName !== primarySheetName)
      .map((sheet) => {
        const match = findMatchingLetterIdColumn(sheet, primaryColumn);
        if (!match) return null;

        return Object.freeze({
          ...makeLetterIdJoin({
            fromSheetName: primarySheetName,
            fromColumnName: primaryColumn,
            toSheetName: sheet.sheetName,
            toColumnName: match.columnName,
          }),
          confidence: match.score >= 95 ? 'high' : match.score >= 70 ? 'medium' : 'low',
          score: match.score,
          suggested: true,
        });
      })
      .filter(Boolean)
  );
}


export function suggestDefaultLetterIdJoinForSheet(
  workbookModel,
  primarySheetName = '',
  joinedSheetName = '',
  primaryColumnName = ''
) {
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);
  const joinedSheet = getWorkbookSheet(workbookModel, joinedSheetName);
  if (!primarySheet || !joinedSheet || primarySheetName === joinedSheetName) return null;

  const primaryColumn = asText(primaryColumnName)
    || suggestLetterIdColumnForSheet(primarySheet).columnName
    || primarySheet.headers?.[0]
    || '';
  const joinedMatch = findMatchingLetterIdColumn(joinedSheet, primaryColumn)
    || suggestLetterIdColumnForSheet(joinedSheet);
  const joinedColumn = joinedMatch?.columnName || joinedSheet.headers?.[0] || '';

  if (!primaryColumn || !joinedColumn) return null;

  return Object.freeze({
    ...makeLetterIdJoin({
      fromSheetName: primarySheetName,
      fromColumnName: primaryColumn,
      toSheetName: joinedSheetName,
      toColumnName: joinedColumn,
    }),
    confidence: joinedMatch?.confidence || (joinedMatch?.score >= 95 ? 'high' : joinedMatch?.score >= 70 ? 'medium' : joinedMatch ? 'low' : 'manual'),
    score: joinedMatch?.score || 0,
    suggested: Boolean(joinedMatch?.columnName),
  });
}

function suggestCoreMappingsForSingleSheet(sheet = {}) {
  const suggestions = suggestPeridotCoreFieldMappings(sheet.headers || []);
  return Object.fromEntries(
    PERIDOT_CORE_FIELDS.map((field) => [
      field,
      suggestions[field]?.sourceColumn
        ? makeWorkbookColumnRef(sheet.sheetName, suggestions[field].sourceColumn)
        : makeWorkbookColumnRef('', ''),
    ])
  );
}

function getBestCoreMappingForWorkbookField(workbookModel, field) {
  const definition = PERIDOT_CORE_FIELD_DEFINITIONS.find((item) => item.key === field);
  const candidates = [definition?.key, definition?.label, ...(definition?.commonNames || [])].filter(Boolean);

  const scored = getWorkbookColumnRefs(workbookModel)
    .map((ref) => ({
      ref,
      score: scoreHeaderAgainstCandidates(ref.columnName, candidates),
    }))
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score || a.ref.sheetName.localeCompare(b.ref.sheetName));

  return scored[0]?.ref || makeWorkbookColumnRef('', '');
}

export function suggestWorkbookCoreMappings(workbookModel, primarySheetName = '') {
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);

  if (primarySheet) {
    return Object.freeze(suggestCoreMappingsForSingleSheet(primarySheet));
  }

  return Object.freeze(
    Object.fromEntries(PERIDOT_CORE_FIELDS.map((field) => [field, getBestCoreMappingForWorkbookField(workbookModel, field)]))
  );
}

function suggestTemporalMappingsForSingleSheet(sheet = {}, coreMappings = {}) {
  const temporalMapping = buildInitialPeridotTemporalMapping(sheet.headers || [], Object.fromEntries(
    Object.entries(coreMappings || {})
      .filter(([, ref]) => ref?.sheetName === sheet.sheetName)
      .map(([field, ref]) => [field, ref.columnName])
  ));

  return Object.freeze(
    Object.fromEntries(
      PERIDOT_TEMPORAL_FIELDS.map((field) => [
        field,
        temporalMapping[field]
          ? makeWorkbookColumnRef(sheet.sheetName, temporalMapping[field])
          : makeWorkbookColumnRef('', ''),
      ])
    )
  );
}

function getBestTemporalMappingForWorkbookField(workbookModel, field) {
  const definition = PERIDOT_TEMPORAL_FIELD_DEFINITIONS.find((item) => item.key === field);
  const candidates = [definition?.key, definition?.label, ...(definition?.commonNames || [])].filter(Boolean);

  const scored = getWorkbookColumnRefs(workbookModel)
    .map((ref) => ({
      ref,
      score: scoreHeaderAgainstCandidates(ref.columnName, candidates),
    }))
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score || a.ref.sheetName.localeCompare(b.ref.sheetName));

  return scored[0]?.ref || makeWorkbookColumnRef('', '');
}

export function suggestWorkbookTemporalMappings(workbookModel, primarySheetName = '', coreMappings = {}) {
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);

  if (primarySheet) {
    return suggestTemporalMappingsForSingleSheet(primarySheet, coreMappings);
  }

  return Object.freeze(
    Object.fromEntries(PERIDOT_TEMPORAL_FIELDS.map((field) => [field, getBestTemporalMappingForWorkbookField(workbookModel, field)]))
  );
}


function suggestWorkbookFieldMappingsFromDefinitions(workbookModel, primarySheetName = '', definitions = [], occupiedRefs = []) {
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);
  const occupiedKeys = new Set((occupiedRefs || []).filter(isWorkbookColumnRefPresent).map(makeWorkbookColumnRefKey));
  const refs = primarySheet
    ? (primarySheet.headers || []).map((header) => makeWorkbookColumnRef(primarySheet.sheetName, header))
    : getWorkbookColumnRefs(workbookModel);

  return Object.freeze(Object.fromEntries(definitions.map((definition) => {
    const candidates = [definition?.key, definition?.label, ...(definition?.commonNames || [])].filter(Boolean);
    const scored = refs
      .filter((ref) => !occupiedKeys.has(makeWorkbookColumnRefKey(ref)))
      .map((ref) => ({ ref, score: scoreHeaderAgainstCandidates(ref.columnName, candidates) }))
      .filter((item) => item.score >= 55)
      .sort((a, b) => b.score - a.score || a.ref.sheetName.localeCompare(b.ref.sheetName));
    const best = scored[0]?.ref || makeWorkbookColumnRef('', '');
    if (isWorkbookColumnRefPresent(best)) occupiedKeys.add(makeWorkbookColumnRefKey(best));
    return [definition.key, best];
  })));
}

export function suggestWorkbookPointMappings(workbookModel, primarySheetName = '', coreMappings = {}, temporalMappings = {}) {
  return suggestWorkbookFieldMappingsFromDefinitions(
    workbookModel,
    primarySheetName,
    PERIDOT_POINT_FIELD_DEFINITIONS,
    [...Object.values(temporalMappings || {})]
  );
}

export function suggestWorkbookRouteCoordinatePairMappings(workbookModel, primarySheetName = '', coreMappings = {}, temporalMappings = {}, pointMappings = {}) {
  return suggestWorkbookFieldMappingsFromDefinitions(
    workbookModel,
    primarySheetName,
    PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS,
    [...Object.values(coreMappings || {}), ...Object.values(temporalMappings || {}), ...Object.values(pointMappings || {})]
  );
}

function isLikelyLookupSheet(sheet = {}) {
  const name = normalizeName(sheet.sheetName);
  if (/geodata|place|places|location|locations/.test(name)) return 'place';
  if (/wikidata|person|people|correspondent|correspondents/.test(name)) return 'person';
  return '';
}

export function suggestLookupSheetRoles(workbookModel) {
  return Object.freeze(
    getUsableWorkbookSheets(workbookModel)
      .map((sheet) => {
        const role = isLikelyLookupSheet(sheet);
        if (!role) return null;

        const keyCandidates =
          role === 'place' ? PERIDOT_RECOMMENDED_PLACE_KEY_NAMES : PERIDOT_RECOMMENDED_PERSON_KEY_NAMES;
        const keyColumn = findLikelyColumn(sheet.headers || [], keyCandidates);

        return {
          sheetName: sheet.sheetName,
          role,
          suggestedKeyColumn: keyColumn?.columnName || '',
          confidence: keyColumn?.score >= 95 ? 'high' : keyColumn?.score >= 70 ? 'medium' : keyColumn ? 'low' : 'none',
          score: keyColumn?.score || 0,
        };
      })
      .filter(Boolean)
  );
}

function getMappedCoreSheets(coreMappings = {}, temporalMappings = {}, pointMappings = {}, routeCoordinatePairMappings = {}) {
  return Array.from(
    new Set(
      [...Object.values(coreMappings || {}), ...Object.values(temporalMappings || {}), ...Object.values(pointMappings || {}), ...Object.values(routeCoordinatePairMappings || {})]
        .filter(isWorkbookColumnRefPresent)
        .map((ref) => ref.sheetName)
    )
  );
}

export function buildInitialPeridotWorkbookMappingState(workbookModel, options = {}) {
  const usableSheets = getUsableWorkbookSheets(workbookModel);
  const primarySuggestions = suggestPrimaryRecordSheets(workbookModel);
  const primarySheetName = primarySuggestions[0]?.sheetName || usableSheets[0]?.sheetName || '';
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);
  const letterIdSuggestion = primarySheet ? suggestLetterIdColumnForSheet(primarySheet) : null;
  const coreMappings = suggestWorkbookCoreMappings(workbookModel, primarySheetName);
  const temporalMappings = suggestWorkbookTemporalMappings(workbookModel, primarySheetName, coreMappings);
  const pointMappings = suggestWorkbookPointMappings(workbookModel, primarySheetName, coreMappings, temporalMappings);
  const routeCoordinatePairMappings = suggestWorkbookRouteCoordinatePairMappings(workbookModel, primarySheetName, coreMappings, temporalMappings, pointMappings);
  const suggestedLetterLevelJoins = suggestSharedLetterIdJoins(
    workbookModel,
    primarySheetName,
    letterIdSuggestion?.columnName || ''
  );
  const primaryCustomSelections = primarySheet
    ? suggestCustomInspectorFieldSelections(primarySheet.headers || [], primarySheet.rows || {}, Object.fromEntries(
        Object.entries(coreMappings)
          .filter(([, ref]) => ref.sheetName === primarySheetName)
          .map(([field, ref]) => [field, ref.columnName])
      ),
      Object.fromEntries(
        Object.entries(temporalMappings)
          .filter(([, ref]) => ref.sheetName === primarySheetName)
          .map(([field, ref]) => [field, ref.columnName])
      ),
      Object.fromEntries(
        Object.entries(pointMappings)
          .filter(([, ref]) => ref.sheetName === primarySheetName)
          .map(([field, ref]) => [field, ref.columnName])
      ),
      Object.fromEntries(
        Object.entries(routeCoordinatePairMappings)
          .filter(([, ref]) => ref.sheetName === primarySheetName)
          .map(([field, ref]) => [field, ref.columnName])
      ))
    : [];

  return Object.freeze({
    datasetProfileId: String(options.datasetProfileId || '').trim() || 'peridot.correspondence-directed-record',
    mode: usableSheets.length <= 1 ? PERIDOT_WORKBOOK_MAPPING_MODES.singleSheet : PERIDOT_WORKBOOK_MAPPING_MODES.multiSheetLetterId,
    primarySheetName,
    primaryLetterIdColumn: letterIdSuggestion?.columnName || '',
    primaryRecordSheetSuggestions: primarySuggestions,
    letterIdColumnSuggestions: suggestLetterIdColumns(workbookModel),
    lookupSheetSuggestions: suggestLookupSheetRoles(workbookModel),
    coreMappings,
    temporalMappings,
    pointMappings,
    routeCoordinatePairMappings,
    letterLevelJoinSuggestions: suggestedLetterLevelJoins,
    letterLevelJoins: suggestedLetterLevelJoins,
    lookupJoins: Object.freeze([]),
    customFieldSelections: Object.freeze(
      primaryCustomSelections.map((selection) =>
        Object.freeze({
          ...selection,
          sheetName: primarySheetName,
          sourceColumn: selection.sourceColumn,
          sourceRef: makeWorkbookColumnRef(primarySheetName, selection.sourceColumn),
        })
      )
    ),
    warnings: Object.freeze([
      PERIDOT_LETTER_ID_REQUIREMENT_WARNING,
      PERIDOT_EXACT_MATCH_LOOKUP_WARNING,
    ]),
  });
}

export function makeLetterIdJoin({ fromSheetName = '', fromColumnName = '', toSheetName = '', toColumnName = '' } = {}) {
  return Object.freeze({
    type: PERIDOT_WORKBOOK_JOIN_TYPES.letterId,
    from: makeWorkbookColumnRef(fromSheetName, fromColumnName),
    to: makeWorkbookColumnRef(toSheetName, toColumnName),
  });
}

export function makeExactLookupJoin({
  role = PERIDOT_WORKBOOK_JOIN_TYPES.placeLookup,
  recordSheetName = '',
  recordColumnName = '',
  lookupSheetName = '',
  lookupKeyColumnName = '',
} = {}) {
  return Object.freeze({
    type: role,
    recordKey: makeWorkbookColumnRef(recordSheetName, recordColumnName),
    lookupKey: makeWorkbookColumnRef(lookupSheetName, lookupKeyColumnName),
  });
}

function getReferenceValidationIssue(workbookModel, ref, codePrefix, label) {
  if (!isWorkbookColumnRefPresent(ref)) {
    return {
      code: `${codePrefix}_missing_reference`,
      message: `${label} is missing a sheet or column selection.`,
      ref,
    };
  }

  if (!getWorkbookSheet(workbookModel, ref.sheetName)) {
    return {
      code: `${codePrefix}_missing_sheet`,
      message: `${label} refers to sheet “${ref.sheetName}”, which is not present in the workbook.`,
      ref,
    };
  }

  if (!columnExists(workbookModel, ref)) {
    return {
      code: `${codePrefix}_missing_column`,
      message: `${label} refers to column “${ref.columnName}” on sheet “${ref.sheetName}”, but that column is not present.`,
      ref,
    };
  }

  return null;
}

export function validatePeridotWorkbookMapping(workbookModel, mappingState = {}) {
  const issues = [];
  const usableSheets = getUsableWorkbookSheets(workbookModel);
  const primarySheetName = asText(mappingState.primarySheetName);
  const primarySheet = getWorkbookSheet(workbookModel, primarySheetName);
  const mode = mappingState.mode || (usableSheets.length <= 1 ? PERIDOT_WORKBOOK_MAPPING_MODES.singleSheet : PERIDOT_WORKBOOK_MAPPING_MODES.multiSheetLetterId);
  const coreMappings = mappingState.coreMappings || {};
  const temporalMappings = mappingState.temporalMappings || {};
  const pointMappings = mappingState.pointMappings || {};
  const routeCoordinatePairMappings = mappingState.routeCoordinatePairMappings || {};

  if (!primarySheetName) {
    issues.push({
      code: 'missing_primary_sheet',
      severity: 'error',
      message: 'Choose a primary record sheet before importing workbook data.',
    });
  } else if (!primarySheet) {
    issues.push({
      code: 'invalid_primary_sheet',
      severity: 'error',
      message: `Primary record sheet “${primarySheetName}” is not present in this workbook.`,
    });
  }

  Object.entries(coreMappings).forEach(([field, ref]) => {
    if (!PERIDOT_CORE_FIELDS.includes(field)) {
      issues.push({
        code: 'unknown_core_field',
        severity: 'error',
        message: `${field} is not one of the nine core Peridot variables.`,
      });
      return;
    }

    if (!isWorkbookColumnRefPresent(ref)) return;

    const issue = getReferenceValidationIssue(workbookModel, ref, `core_${field}`, `Core field ${field}`);
    if (issue) issues.push({ ...issue, severity: 'error' });
  });

  Object.entries(temporalMappings).forEach(([field, ref]) => {
    if (!PERIDOT_TEMPORAL_FIELDS.includes(field)) {
      issues.push({
        code: 'unknown_temporal_field',
        severity: 'error',
        message: `${field} is not one of the supported Peridot temporal roles.`,
      });
      return;
    }

    if (!isWorkbookColumnRefPresent(ref)) return;

    const issue = getReferenceValidationIssue(workbookModel, ref, `temporal_${field}`, `Temporal field ${field}`);
    if (issue) issues.push({ ...issue, severity: 'error' });
  });

  Object.entries(pointMappings).forEach(([field, ref]) => {
    if (!PERIDOT_POINT_FIELDS.includes(field)) {
      issues.push({ code: 'unknown_point_field', severity: 'error', message: `${field} is not one of the supported Peridot point-location roles.` });
      return;
    }
    if (!isWorkbookColumnRefPresent(ref)) return;
    const issue = getReferenceValidationIssue(workbookModel, ref, `point_${field}`, `Point-location field ${field}`);
    if (issue) issues.push({ ...issue, severity: 'error' });
  });

  Object.entries(routeCoordinatePairMappings).forEach(([field, ref]) => {
    if (!PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS.includes(field)) {
      issues.push({ code: 'unknown_route_coordinate_pair_field', severity: 'error', message: `${field} is not one of the supported Peridot route coordinate-pair roles.` });
      return;
    }
    if (!isWorkbookColumnRefPresent(ref)) return;
    const issue = getReferenceValidationIssue(workbookModel, ref, `route_pair_${field}`, `Route coordinate-pair field ${field}`);
    if (issue) issues.push({ ...issue, severity: 'error' });
  });

  const mappedSheets = getMappedCoreSheets(coreMappings, temporalMappings, pointMappings, routeCoordinatePairMappings);
  const nonPrimaryMappedSheets = mappedSheets.filter((sheetName) => sheetName !== primarySheetName);

  if (usableSheets.length > 1 && nonPrimaryMappedSheets.length > 0 && mode !== PERIDOT_WORKBOOK_MAPPING_MODES.multiSheetLetterId) {
    issues.push({
      code: 'multi_sheet_mapping_requires_letter_id_mode',
      severity: 'error',
      message: 'Core fields mapped from multiple sheets require Letter_ID-based workbook assembly.',
      sheets: mappedSheets,
    });
  }

  if (usableSheets.length > 1 && (nonPrimaryMappedSheets.length > 0 || mode === PERIDOT_WORKBOOK_MAPPING_MODES.multiSheetLetterId)) {
    if (!asText(mappingState.primaryLetterIdColumn)) {
      issues.push({
        code: 'missing_primary_letter_id',
        severity: 'error',
        message: 'Choose a Letter_ID column on the primary record sheet before combining letter-level data from multiple sheets.',
      });
    } else if (!columnExists(workbookModel, makeWorkbookColumnRef(primarySheetName, mappingState.primaryLetterIdColumn))) {
      issues.push({
        code: 'invalid_primary_letter_id',
        severity: 'error',
        message: `Primary Letter_ID column “${mappingState.primaryLetterIdColumn}” is not present on sheet “${primarySheetName}”.`,
      });
    }

    nonPrimaryMappedSheets.forEach((sheetName) => {
      const hasJoin = (mappingState.letterLevelJoins || []).some((join) => {
        const fromSheet = join?.from?.sheetName;
        const toSheet = join?.to?.sheetName;
        return (
          (fromSheet === primarySheetName && toSheet === sheetName) ||
          (fromSheet === sheetName && toSheet === primarySheetName)
        );
      });

      if (!hasJoin) {
        issues.push({
          code: 'missing_letter_id_join_for_mapped_sheet',
          severity: 'error',
          message: `Sheet “${sheetName}” is used for core mappings but has no Letter_ID join to primary sheet “${primarySheetName}”.`,
          sheetName,
        });
      }
    });
  }

  (mappingState.letterLevelJoins || []).forEach((join, index) => {
    const fromIssue = getReferenceValidationIssue(workbookModel, join?.from, 'letter_join_from', `Letter_ID join ${index + 1} source`);
    const toIssue = getReferenceValidationIssue(workbookModel, join?.to, 'letter_join_to', `Letter_ID join ${index + 1} target`);
    if (fromIssue) issues.push({ ...fromIssue, severity: 'error' });
    if (toIssue) issues.push({ ...toIssue, severity: 'error' });
  });

  (mappingState.lookupJoins || []).forEach((join, index) => {
    const role = join?.type;
    if (![PERIDOT_WORKBOOK_JOIN_TYPES.personLookup, PERIDOT_WORKBOOK_JOIN_TYPES.placeLookup].includes(role)) {
      issues.push({
        code: 'invalid_lookup_join_type',
        severity: 'error',
        message: `Lookup join ${index + 1} must be a person or place lookup join.`,
      });
    }

    const recordIssue = getReferenceValidationIssue(workbookModel, join?.recordKey, 'lookup_record_key', `Lookup join ${index + 1} record key`);
    const lookupIssue = getReferenceValidationIssue(workbookModel, join?.lookupKey, 'lookup_lookup_key', `Lookup join ${index + 1} lookup key`);
    if (recordIssue) issues.push({ ...recordIssue, severity: 'error' });
    if (lookupIssue) issues.push({ ...lookupIssue, severity: 'error' });
  });

  if (usableSheets.length > 1) {
    issues.push({
      code: 'exact_match_warning',
      severity: 'warning',
      message: PERIDOT_EXACT_MATCH_LOOKUP_WARNING,
    });
    issues.push({
      code: 'letter_id_requirement',
      severity: 'warning',
      message: PERIDOT_LETTER_ID_REQUIREMENT_WARNING,
    });
  }

  return Object.freeze({
    isValid: issues.every((issue) => issue.severity !== 'error'),
    issues: Object.freeze(issues),
  });
}

function indexRowsByColumn(rows = [], columnName = '') {
  const index = new Map();

  rows.forEach((row) => {
    const key = asText(row?.[columnName]);
    if (!key) return;

    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  });

  return index;
}


export function getLetterIdJoinMatchSummary(workbookModel, join = {}) {
  const from = join?.from || {};
  const to = join?.to || {};
  const fromRows = getSheetRows(workbookModel, from.sheetName);
  const toRows = getSheetRows(workbookModel, to.sheetName);

  if (!from.sheetName || !from.columnName || !to.sheetName || !to.columnName) {
    return Object.freeze({
      isConfigured: false,
      matchingIdCount: 0,
      matchedPrimaryRowCount: 0,
      unmatchedPrimaryRowCount: 0,
      primaryBlankIdCount: 0,
      joinedOnlyIdCount: 0,
      primaryDuplicateIdCount: 0,
      joinedDuplicateIdCount: 0,
      message: 'Select a primary ID column and joined-sheet ID column to check matches.',
    });
  }

  const fromIndex = indexRowsByColumn(fromRows, from.columnName);
  const toIndex = indexRowsByColumn(toRows, to.columnName);
  const fromKeys = new Set(fromIndex.keys());
  const toKeys = new Set(toIndex.keys());
  const matchingIds = Array.from(fromKeys).filter((key) => toKeys.has(key));
  const primaryBlankIdCount = fromRows.filter((row) => !asText(row?.[from.columnName])).length;
  const joinedBlankIdCount = toRows.filter((row) => !asText(row?.[to.columnName])).length;
  const primaryDuplicateIdCount = Array.from(fromIndex.values()).filter((rows) => rows.length > 1).length;
  const joinedDuplicateIdCount = Array.from(toIndex.values()).filter((rows) => rows.length > 1).length;
  const matchedPrimaryRowCount = fromRows.filter((row) => {
    const key = asText(row?.[from.columnName]);
    return Boolean(key && toKeys.has(key));
  }).length;
  const unmatchedPrimaryRowCount = fromRows.filter((row) => {
    const key = asText(row?.[from.columnName]);
    return Boolean(key && !toKeys.has(key));
  }).length;
  const joinedOnlyIdCount = Array.from(toKeys).filter((key) => !fromKeys.has(key)).length;

  const message = `${matchingIds.length} matching unique ID${matchingIds.length === 1 ? '' : 's'}; ${unmatchedPrimaryRowCount} primary row${unmatchedPrimaryRowCount === 1 ? '' : 's'} without a match.`;

  return Object.freeze({
    isConfigured: true,
    matchingIdCount: matchingIds.length,
    matchedPrimaryRowCount,
    unmatchedPrimaryRowCount,
    primaryBlankIdCount,
    joinedBlankIdCount,
    joinedOnlyIdCount,
    primaryDuplicateIdCount,
    joinedDuplicateIdCount,
    message,
  });
}

export function buildLetterIdJoinIndexes(workbookModel, mappingState = {}) {
  return Object.freeze(
    (mappingState.letterLevelJoins || []).map((join) => {
      const fromRows = getSheetRows(workbookModel, join.from.sheetName);
      const toRows = getSheetRows(workbookModel, join.to.sheetName);

      return Object.freeze({
        join,
        fromIndex: indexRowsByColumn(fromRows, join.from.columnName),
        toIndex: indexRowsByColumn(toRows, join.to.columnName),
      });
    })
  );
}

export function buildLookupJoinIndexes(workbookModel, mappingState = {}) {
  return Object.freeze(
    (mappingState.lookupJoins || []).map((join) => {
      const lookupRows = getSheetRows(workbookModel, join.lookupKey.sheetName);

      return Object.freeze({
        join,
        lookupIndex: indexRowsByColumn(lookupRows, join.lookupKey.columnName),
      });
    })
  );
}

export function getValueFromWorkbookRef(workbookModel, baseRowContext = {}, ref = {}) {
  if (!isWorkbookColumnRefPresent(ref)) return '';

  const row = baseRowContext[ref.sheetName];
  if (!row) return '';

  return asText(row?.[ref.columnName]);
}

/**
 * Build a lightweight preview of how workbook rows would map from the primary
 * sheet only. This intentionally does not perform joins yet; later import
 * wiring can use the join index helpers above.
 */
export function previewWorkbookCoreMappedRows(workbookModel, mappingState = {}, limit = 5) {
  const primarySheetName = asText(mappingState.primarySheetName);
  const primaryRows = getSheetRows(workbookModel, primarySheetName).slice(0, limit);
  const coreMappings = mappingState.coreMappings || {};

  return primaryRows.map((row) => {
    const context = { [primarySheetName]: row };
    return Object.fromEntries(
      PERIDOT_CORE_FIELDS.map((field) => [
        field,
        getValueFromWorkbookRef(workbookModel, context, coreMappings[field]),
      ])
    );
  });
}



function getPrimaryWorkbookRowContext(workbookModel, mappingState = {}, primaryRow = {}) {
  const primarySheetName = asText(mappingState.primarySheetName);
  const context = { [primarySheetName]: primaryRow };

  (mappingState.letterLevelJoins || []).forEach((join) => {
    const fromRef = join?.from || {};
    const toRef = join?.to || {};
    const fromSheetName = asText(fromRef.sheetName);
    const toSheetName = asText(toRef.sheetName);
    const fromColumnName = asText(fromRef.columnName);
    const toColumnName = asText(toRef.columnName);

    if (!fromSheetName || !toSheetName || !fromColumnName || !toColumnName) return;
    if (fromSheetName !== primarySheetName) return;

    const key = asText(primaryRow?.[fromColumnName]);
    if (!key) return;

    const joinedRows = getSheetRows(workbookModel, toSheetName);
    const match = joinedRows.find((row) => asText(row?.[toColumnName]) === key);
    if (match) context[toSheetName] = match;
  });

  return context;
}

function normalizeWorkbookCustomInspectorSelections(mappingState = {}) {
  return (mappingState.customFieldSelections || [])
    .filter((selection) => selection?.action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include)
    .map((selection) => ({
      key: asText(selection.key || selection.sourceColumn || selection.label),
      sourceColumn: asText(selection.sourceColumn || selection.key || selection.label),
      label: asText(selection.label || selection.sourceColumn || selection.key),
      sheetName: asText(selection.sheetName || selection.sourceRef?.sheetName || mappingState.primarySheetName),
      sourceRef: selection.sourceRef || makeWorkbookColumnRef(
        selection.sheetName || mappingState.primarySheetName,
        selection.sourceColumn || selection.key || selection.label
      ),
      analyticsEligible: Boolean(selection.analyticsEligible),
    }))
    .filter((selection) => selection.sourceColumn || selection.sourceRef?.columnName);
}

function buildOriginalWorkbookRowContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([sheetName, row]) => [sheetName, { ...(row || {}) }])
  );
}

/**
 * Assemble Peridot-shaped rows from a workbook mapping configuration.
 *
 * This first assembly pass supports:
 * - primary-sheet rows as the record basis;
 * - configured unique-ID joins from the primary sheet to one or more joined
 *   sheets;
 * - core Peridot variables mapped from any sheet available in the row context;
 * - custom Inspector fields from the primary sheet mapping state.
 *
 * It intentionally does not yet perform person/place lookup enrichment or
 * custom Inspector field selection from joined lookup sheets. Those can be
 * layered on once this core letter-level assembly path is stable.
 */
export function buildPeridotRowsFromWorkbookMapping(workbookModel, mappingState = {}) {
  const validation = validatePeridotWorkbookMapping(workbookModel, mappingState);
  if (!validation.isValid) {
    const firstError = validation.issues.find((issue) => issue.severity === 'error');
    throw new Error(firstError?.message || 'Workbook mapping is not valid.');
  }

  const primarySheetName = asText(mappingState.primarySheetName);
  const primaryRows = getSheetRows(workbookModel, primarySheetName);
  const coreMappings = mappingState.coreMappings || {};
  const temporalMappings = mappingState.temporalMappings || {};
  const pointMappings = mappingState.pointMappings || {};
  const routeCoordinatePairMappings = mappingState.routeCoordinatePairMappings || {};
  const customSelections = normalizeWorkbookCustomInspectorSelections(mappingState);

  return primaryRows.map((primaryRow, index) => {
    const context = getPrimaryWorkbookRowContext(workbookModel, mappingState, primaryRow);
    const coreValues = Object.fromEntries(
      PERIDOT_CORE_FIELDS.map((field) => [
        field,
        getValueFromWorkbookRef(workbookModel, context, coreMappings[field]),
      ])
    );
    const temporalValues = Object.fromEntries(
      PERIDOT_TEMPORAL_FIELDS.map((field) => [field, getValueFromWorkbookRef(workbookModel, context, temporalMappings[field])])
    );
    const pointValues = Object.fromEntries(
      PERIDOT_POINT_FIELDS.map((field) => [field, getValueFromWorkbookRef(workbookModel, context, pointMappings[field])])
    );
    const routeCoordinatePairValues = Object.fromEntries(
      PERIDOT_ROUTE_COORDINATE_PAIR_FIELDS.map((field) => [field, getValueFromWorkbookRef(workbookModel, context, routeCoordinatePairMappings[field])])
    );

    if (temporalValues.Date) coreValues.Date = temporalValues.Date;
    if (!coreValues.Date && temporalValues.Date_Start) coreValues.Date = temporalValues.Date_Start;
    if (!coreValues.Date && temporalValues.Date_End) coreValues.Date = temporalValues.Date_End;

    const composedDisplayDate = composeDisplayDateValue(
      coreValues.Date || temporalValues.Date,
      temporalValues.Date_Start,
      temporalValues.Date_End,
      temporalValues.Date_Display
    );

    const customInspectorFields = customSelections.map((selection) => ({
      key: selection.key || selection.sourceColumn || selection.label,
      sourceColumn: selection.sourceColumn || selection.sourceRef?.columnName || selection.key,
      label: selection.label || selection.sourceColumn || selection.key,
      value: getValueFromWorkbookRef(workbookModel, context, selection.sourceRef),
      analyticsEligible: Boolean(selection.analyticsEligible),
    }));

    const customFieldValues = Object.fromEntries(
      customInspectorFields
        .filter((field) => field.label)
        .map((field) => [field.label, field.value])
    );

    return {
      ...customFieldValues,
      ...coreValues,
      Date_Start: temporalValues.Date_Start || '',
      Date_End: temporalValues.Date_End || '',
      Date_Display: composedDisplayDate,
      ...pointValues,
      ...routeCoordinatePairValues,
      customInspectorFields,
      ignoredUploadedColumns: [],
      originalUploadedRow: {
        workbookFileName: workbookModel?.fileName || workbookModel?.workbookName || '',
        primarySheetName,
        primaryRowNumber: index + 2,
        sheetRows: buildOriginalWorkbookRowContext(context),
      },
    };
  });
}

export function getWorkbookMappingSummary(workbookModel, mappingState = {}) {
  const validation = validatePeridotWorkbookMapping(workbookModel, mappingState);
  const coreMappings = mappingState.coreMappings || {};
  const temporalMappings = mappingState.temporalMappings || {};
  const pointMappings = mappingState.pointMappings || {};
  const routeCoordinatePairMappings = mappingState.routeCoordinatePairMappings || {};
  const mappedCoreFields = Object.entries(coreMappings).filter(([, ref]) => isWorkbookColumnRefPresent(ref));
  const mappedSheets = getMappedCoreSheets(coreMappings, temporalMappings, pointMappings, routeCoordinatePairMappings);

  return Object.freeze({
    primarySheetName: mappingState.primarySheetName || '',
    mode: mappingState.mode || '',
    primaryLetterIdColumn: mappingState.primaryLetterIdColumn || '',
    mappedCoreFieldCount: mappedCoreFields.length,
    mappedTemporalFieldCount: Object.values(temporalMappings).filter(isWorkbookColumnRefPresent).length,
    mappedPointFieldCount: Object.values(pointMappings).filter(isWorkbookColumnRefPresent).length,
    mappedRouteCoordinatePairFieldCount: Object.values(routeCoordinatePairMappings).filter(isWorkbookColumnRefPresent).length,
    mappedSheets,
    letterLevelJoinCount: (mappingState.letterLevelJoins || []).length,
    suggestedLetterLevelJoinCount: (mappingState.letterLevelJoinSuggestions || []).length,
    lookupJoinCount: (mappingState.lookupJoins || []).length,
    customFieldCount: (mappingState.customFieldSelections || []).filter(
      (selection) => selection.action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include
    ).length,
    isValid: validation.isValid,
    issueCount: validation.issues.length,
    errorCount: validation.issues.filter((issue) => issue.severity === 'error').length,
    warningCount: validation.issues.filter((issue) => issue.severity === 'warning').length,
  });
}

export function listUnmappedWorkbookColumns(workbookModel, mappingState = {}) {
  const mappedRefs = new Set(
    [...Object.values(mappingState.coreMappings || {}), ...Object.values(mappingState.temporalMappings || {}), ...Object.values(mappingState.pointMappings || {}), ...Object.values(mappingState.routeCoordinatePairMappings || {})]
      .filter(isWorkbookColumnRefPresent)
      .map(makeWorkbookColumnRefKey)
  );

  (mappingState.customFieldSelections || []).forEach((selection) => {
    const ref = selection.sourceRef || makeWorkbookColumnRef(selection.sheetName, selection.sourceColumn);
    if (isWorkbookColumnRefPresent(ref)) mappedRefs.add(makeWorkbookColumnRefKey(ref));
  });

  return Object.freeze(
    getWorkbookColumnRefs(workbookModel).filter((ref) => !mappedRefs.has(makeWorkbookColumnRefKey(ref)))
  );
}

export function buildWorkbookCustomFieldSelectionsForSheet(workbookModel, sheetName, coreMappings = {}, temporalMappings = {}, pointMappings = {}, routeCoordinatePairMappings = {}) {
  const sheet = getWorkbookSheet(workbookModel, sheetName);
  if (!sheet) return Object.freeze([]);

  const flatCoreMappingForSheet = Object.fromEntries(
    Object.entries(coreMappings || {})
      .filter(([, ref]) => ref?.sheetName === sheetName)
      .map(([field, ref]) => [field, ref.columnName])
  );
  const flatTemporalMappingForSheet = Object.fromEntries(
    Object.entries(temporalMappings || {})
      .filter(([, ref]) => ref?.sheetName === sheetName)
      .map(([field, ref]) => [field, ref.columnName])
  );

  const flatPointMappingForSheet = Object.fromEntries(
    Object.entries(pointMappings || {})
      .filter(([, ref]) => ref?.sheetName === sheetName)
      .map(([field, ref]) => [field, ref.columnName])
  );
  const flatRouteCoordinatePairMappingForSheet = Object.fromEntries(
    Object.entries(routeCoordinatePairMappings || {})
      .filter(([, ref]) => ref?.sheetName === sheetName)
      .map(([field, ref]) => [field, ref.columnName])
  );

  return Object.freeze(
    suggestCustomInspectorFieldSelections(sheet.headers || [], sheet.rows || [], flatCoreMappingForSheet, flatTemporalMappingForSheet, flatPointMappingForSheet, flatRouteCoordinatePairMappingForSheet).map((selection) =>
      Object.freeze({
        ...selection,
        sheetName,
        sourceRef: makeWorkbookColumnRef(sheetName, selection.sourceColumn),
        label: selection.label || titleCase(selection.sourceColumn),
      })
    )
  );
}
