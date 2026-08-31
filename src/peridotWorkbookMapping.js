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
 * - define explicit unique-ID joins for multi-sheet record assembly;
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
 * - The number of sheets in a workbook does not create a join requirement.
 * - A shared unique-ID join is required only when the user's active semantic
 *   mappings actually read record information from more than one sheet.
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
import { buildInitialPeridotGenealogyWorkbookMappingState } from './peridotGenealogyMapping.js';
import {
  buildPeridotGeneralizedObservation,
  projectGeneralizedObservationToLegacyRow,
} from './peridotGeneralizedMappingRuntime.js';
import { convertWorkbookIdentityMappingToRuntime, getWorkbookIdentityRefs, materializePeridotWorkbookIdentityMappingSuggestions } from './peridotIdentityRuntime.js';
import { normalizePeridotSubjectSelectionFromMapping } from './peridotSubjectSelection.js';

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

export const PERIDOT_CROSS_SHEET_ID_REQUIREMENT_WARNING =
  'When mapped record information comes from multiple workbook sheets, Peridot requires an explicit shared unique-ID join. Row order is not used as the primary join strategy.';

// Temporary export alias retained while older callers/tests may still import the
// correspondence-era name. The user-facing requirement is now dataset-neutral.
export const PERIDOT_LETTER_ID_REQUIREMENT_WARNING = PERIDOT_CROSS_SHEET_ID_REQUIREMENT_WARNING;

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
function composeDisplayDateValue(singleDate, dateRange, dateStart, dateEnd, explicitDisplayDate) {
  const display = asText(explicitDisplayDate);
  const single = asText(singleDate);
  const range = asText(dateRange);
  const start = asText(dateStart);
  const end = asText(dateEnd);
  if (display) return display;
  if (range) return range;
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
  return Boolean(asText(ref?.sheetName) && asText(ref?.columnName));
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

function buildWorkbookTemporalAssertionMappingsFromLegacy(temporalMappings = {}, temporalNoteMappings = {}) {
  const result=[];
  if (isWorkbookColumnRefPresent(temporalMappings.Date)) result.push({ id:'legacy-date', role:temporalMappings.Date.columnName, kind:'date', sourceMode:'single', column:temporalMappings.Date, noteColumns:temporalNoteMappings.Date || [] });
  if (isWorkbookColumnRefPresent(temporalMappings.Date_Range)) result.push({ id:'legacy-range', role:temporalMappings.Date_Range.columnName, kind:'period', sourceMode:'single', column:temporalMappings.Date_Range, noteColumns:temporalNoteMappings.Date_Range || [] });
  if (isWorkbookColumnRefPresent(temporalMappings.Date_Start) || isWorkbookColumnRefPresent(temporalMappings.Date_End)) result.push({ id:'legacy-start-end', role:[temporalMappings.Date_Start?.columnName,temporalMappings.Date_End?.columnName].filter(Boolean).join(' / ') || 'Date interval', kind:'period', sourceMode:'endpoints', startMode:'single', startColumn:temporalMappings.Date_Start || makeWorkbookColumnRef('',''), endMode:'single', endColumn:temporalMappings.Date_End || makeWorkbookColumnRef('',''), noteColumns:[...(temporalNoteMappings.Date_Start||[]),...(temporalNoteMappings.Date_End||[])] });
  return result.length ? result : [{ id:'time-1', role:'', kind:'date', sourceMode:'single', column:makeWorkbookColumnRef('',''), noteColumns:[] }];
}

export function getWorkbookTemporalAssertionRefs(mappings = []) {
  const refs=[]; const add=(ref)=>{ if(isWorkbookColumnRefPresent(ref)) refs.push(ref); };
  (mappings||[]).forEach((mapping)=>{ ['column','yearColumn','monthColumn','dayColumn','startColumn','startYearColumn','startMonthColumn','startDayColumn','endColumn','endYearColumn','endMonthColumn','endDayColumn'].forEach((key)=>add(mapping?.[key])); (mapping?.noteColumns||[]).forEach(add); });
  return refs;
}

function temporalAssertionMappingToRuntime(mapping = {}) {
  const next={...mapping, subjectSelection: normalizePeridotSubjectSelectionFromMapping(mapping)};
  delete next.subjectParticipantIndex;
  ['column','yearColumn','monthColumn','dayColumn','startColumn','startYearColumn','startMonthColumn','startDayColumn','endColumn','endYearColumn','endMonthColumn','endDayColumn'].forEach((key)=>{ next[key]=workbookRefRuntimeKey(mapping?.[key]); });
  next.noteColumns=(mapping.noteColumns||[]).map(workbookRefRuntimeKey).filter(Boolean);
  return next;
}

function getWorkbookSemanticRefs(mappingState = {}) {
  const placeRefs = (mappingState.placeParts || []).flatMap((part) => [
    part?.placeRef,
    part?.roleMode === 'column' ? part?.roleRef : null,
    part?.coordinatePairRef,
    part?.latitudeRef,
    part?.longitudeRef,
  ]);
  const relationshipRefs = (mappingState.relationshipParts || []).flatMap((part) => [
    part?.participantRef,
    part?.roleMode === 'column' ? part?.roleRef : null,
  ]);
  const relationshipMetadataRefs = Object.values(mappingState.relationshipMetadataMappings || {});
  const temporalNoteRefs = Object.values(mappingState.temporalNoteMappings || {}).flat();
  const temporalAssertionRefs = getWorkbookTemporalAssertionRefs(mappingState.temporalAssertionMappings || []);
  const evidenceRefs = (mappingState.customFieldSelections || []).map((selection) =>
    selection?.sourceRef || makeWorkbookColumnRef(selection?.sheetName, selection?.sourceColumn)
  );
  const identityRefs = getWorkbookIdentityRefs(mappingState.identityMapping || {});
  const workbookRecordIdentityRef = mappingState?.identityMapping?.record?.strategy === 'workbook-key'
    && mappingState.primarySheetName && mappingState.primaryLetterIdColumn
    ? makeWorkbookColumnRef(mappingState.primarySheetName, mappingState.primaryLetterIdColumn)
    : null;

  return [
    ...Object.values(mappingState.coreMappings || {}),
    ...Object.values(mappingState.temporalMappings || {}),
    ...temporalNoteRefs,
    ...temporalAssertionRefs,
    ...Object.values(mappingState.pointMappings || {}),
    ...Object.values(mappingState.routeCoordinatePairMappings || {}),
    ...placeRefs,
    ...relationshipRefs,
    ...relationshipMetadataRefs,
    workbookRecordIdentityRef,
    ...identityRefs,
    ...evidenceRefs,
  ].filter((ref) => isWorkbookColumnRefPresent(ref));
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

function getMappedWorkbookSemanticSheets(mappingState = {}) {
  return Array.from(new Set(getWorkbookSemanticRefs(mappingState).map((ref) => ref.sheetName)));
}

export function buildInitialPeridotWorkbookMappingState(workbookModel, options = {}) {
  if (String(options.datasetProfileId || '').trim() === 'peridot.genealogy-person-centered') {
    return buildInitialPeridotGenealogyWorkbookMappingState(workbookModel, options);
  }
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
    // A workbook containing several sheets is not automatically a multi-sheet
    // import. The active semantic mappings determine whether joins are needed.
    mode: PERIDOT_WORKBOOK_MAPPING_MODES.singleSheet,
    primarySheetName,
    primaryLetterIdColumn: letterIdSuggestion?.columnName || '',
    primaryRecordSheetSuggestions: primarySuggestions,
    letterIdColumnSuggestions: suggestLetterIdColumns(workbookModel),
    lookupSheetSuggestions: suggestLookupSheetRoles(workbookModel),
    coreMappings,
    temporalMappings,
    temporalNoteMappings: {},
    temporalAssertionMappings: buildWorkbookTemporalAssertionMappingsFromLegacy(temporalMappings, {}),
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
  const coreMappings = mappingState.coreMappings || {};
  const temporalMappings = mappingState.temporalMappings || {};
  const temporalNoteMappings = mappingState.temporalNoteMappings || {};
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

  Object.entries(temporalNoteMappings).forEach(([field, refs]) => {
    if (!PERIDOT_TEMPORAL_FIELDS.includes(field)) {
      issues.push({ code: 'unknown_temporal_note_field', severity: 'error', message: `${field} cannot receive temporal notes because it is not a supported temporal role.` });
      return;
    }
    (Array.isArray(refs) ? refs : []).forEach((ref) => {
      if (!isWorkbookColumnRefPresent(ref)) return;
      const issue = getReferenceValidationIssue(workbookModel, ref, `temporal_note_${field}`, `Temporal note for ${field}`);
      if (issue) issues.push({ ...issue, severity: 'error' });
    });
  });

  getWorkbookTemporalAssertionRefs(mappingState.temporalAssertionMappings || []).forEach((ref, index) => {
    const issue = getReferenceValidationIssue(workbookModel, ref, `temporal_assertion_${index}`, 'Temporal assertion source');
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

  const mappedSheets = getMappedWorkbookSemanticSheets(mappingState);
  const nonPrimaryMappedSheets = mappedSheets.filter((sheetName) => sheetName !== primarySheetName);

  // Cross-sheet requirements are driven by what the user actually mapped, not
  // by how many auxiliary/reference sheets happen to exist in the workbook.
  if (nonPrimaryMappedSheets.length > 0) {
    if (!asText(mappingState.primaryLetterIdColumn)) {
      issues.push({
        code: 'missing_primary_join_id',
        severity: 'error',
        message: 'Choose the shared unique ID column on the primary record sheet before combining mapped data from multiple sheets.',
      });
    } else if (!columnExists(workbookModel, makeWorkbookColumnRef(primarySheetName, mappingState.primaryLetterIdColumn))) {
      issues.push({
        code: 'invalid_primary_join_id',
        severity: 'error',
        message: `Primary unique ID column “${mappingState.primaryLetterIdColumn}” is not present on sheet “${primarySheetName}”.`,
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
          code: 'missing_unique_id_join_for_mapped_sheet',
          severity: 'error',
          message: `Sheet “${sheetName}” supplies mapped data but has no explicit unique-ID join to primary sheet “${primarySheetName}”.`,
          sheetName,
        });
      }
    });
  }

  (mappingState.letterLevelJoins || []).forEach((join, index) => {
    const fromIssue = getReferenceValidationIssue(workbookModel, join?.from, 'record_join_from', `Unique-ID join ${index + 1} source`);
    const toIssue = getReferenceValidationIssue(workbookModel, join?.to, 'record_join_to', `Unique-ID join ${index + 1} target`);
    if (fromIssue) issues.push({ ...fromIssue, severity: 'error' });
    if (toIssue) issues.push({ ...toIssue, severity: 'error' });
    if (fromIssue || toIssue) return;

    const summary = getLetterIdJoinMatchSummary(workbookModel, join);
    if (summary.primaryDuplicateIdCount > 0) {
      issues.push({
        code: 'duplicate_record_join_source_ids',
        severity: 'error',
        message: `Unique-ID join ${index + 1} cannot be used because ${summary.primaryDuplicateIdCount} ID value${summary.primaryDuplicateIdCount === 1 ? '' : 's'} occur more than once on the primary/source side. Choose a field whose populated values identify one record each.`,
      });
    }
    if (summary.joinedDuplicateIdCount > 0) {
      issues.push({
        code: 'duplicate_record_join_target_ids',
        severity: 'error',
        message: `Unique-ID join ${index + 1} cannot be used because ${summary.joinedDuplicateIdCount} ID value${summary.joinedDuplicateIdCount === 1 ? '' : 's'} occur more than once on the joined-sheet side. Peridot will not silently choose the first matching row.`,
      });
    }
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
  }

  if (nonPrimaryMappedSheets.length > 0) {
    issues.push({
      code: 'cross_sheet_id_requirement',
      severity: 'warning',
      message: PERIDOT_CROSS_SHEET_ID_REQUIREMENT_WARNING,
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

  const uniquenessNote = primaryDuplicateIdCount || joinedDuplicateIdCount ? ' Duplicate ID values make this join ambiguous.' : ' Both join columns are unique for populated values.';
  const message = `${matchingIds.length} matching ID value${matchingIds.length === 1 ? '' : 's'}; ${unmatchedPrimaryRowCount} primary row${unmatchedPrimaryRowCount === 1 ? '' : 's'} without a match.${uniquenessNote}`;

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



function getPrimaryWorkbookRowContext(workbookModel, mappingState = {}, primaryRow = {}, preparedJoinIndexes = []) {
  const primarySheetName = asText(mappingState.primarySheetName);
  const context = { [primarySheetName]: primaryRow };

  (mappingState.letterLevelJoins || []).forEach((join, joinIndex) => {
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

    const prepared = preparedJoinIndexes[joinIndex];
    const joinedIndex = prepared?.toIndex || indexRowsByColumn(getSheetRows(workbookModel, toSheetName), toColumnName);
    const matches = joinedIndex.get(key) || [];
    // Validation guarantees one-to-one record joins. Do not reintroduce the old
    // ambiguous first-match behavior if this helper is called independently.
    if (matches.length === 1) context[toSheetName] = matches[0];
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
      valueHandling: selection.valueHandling,
      subjectSelection: normalizePeridotSubjectSelectionFromMapping(selection),
    }))
    .filter((selection) => selection.sourceColumn || selection.sourceRef?.columnName);
}

function buildOriginalWorkbookRowContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([sheetName, row]) => [sheetName, { ...(row || {}) }])
  );
}

function workbookRefRuntimeKey(ref = {}) {
  return isWorkbookColumnRefPresent(ref) ? makeWorkbookColumnRefKey(ref) : '';
}

function buildWorkbookGeneralizedRuntimeMapping(mappingState = {}, workbookModel = {}) {
  const materializedIdentityMapping = materializePeridotWorkbookIdentityMappingSuggestions({
    identityMapping: mappingState.identityMapping || {},
    relationshipParts: mappingState.relationshipParts || [],
    placeParts: mappingState.placeParts || [],
    workbookModel,
  });
  const identityMapping = convertWorkbookIdentityMappingToRuntime(materializedIdentityMapping, workbookRefRuntimeKey);
  if (identityMapping?.record?.strategy === 'workbook-key' && mappingState.primarySheetName && mappingState.primaryLetterIdColumn) {
    identityMapping.record = {
      ...identityMapping.record,
      columns: [workbookRefRuntimeKey(makeWorkbookColumnRef(mappingState.primarySheetName, mappingState.primaryLetterIdColumn))],
    };
  }
  return {
    identityMapping,
    relationshipParts: (mappingState.relationshipParts || []).map((part) => ({
      participantColumn: workbookRefRuntimeKey(part?.participantRef),
      headingRole: asText(part?.participantRef?.columnName),
      roleMode: part?.roleMode === 'column' ? 'column' : 'heading',
      roleColumn: workbookRefRuntimeKey(part?.roleRef),
      valueHandling: part?.valueHandling,
    })),
    placeParts: (mappingState.placeParts || []).map((part) => ({
      placeColumn: workbookRefRuntimeKey(part?.placeRef),
      headingRole: asText(part?.placeRef?.columnName),
      roleLabel: asText(part?.roleLabel),
      roleMode: part?.roleMode === 'column' ? 'column' : 'heading',
      roleColumn: workbookRefRuntimeKey(part?.roleRef),
      subjectSelection: normalizePeridotSubjectSelectionFromMapping(part),
      coordinatePairColumn: workbookRefRuntimeKey(part?.coordinatePairRef),
      latitudeColumn: workbookRefRuntimeKey(part?.latitudeRef),
      longitudeColumn: workbookRefRuntimeKey(part?.longitudeRef),
      valueHandling: part?.valueHandling,
    })),
    temporalMapping: Object.fromEntries(
      Object.entries(mappingState.temporalMappings || {}).map(([field, ref]) => [field, workbookRefRuntimeKey(ref)])
    ),
    temporalNoteMappings: Object.fromEntries(
      Object.entries(mappingState.temporalNoteMappings || {}).map(([field, refs]) => [field, (Array.isArray(refs) ? refs : []).map(workbookRefRuntimeKey).filter(Boolean)])
    ),
    temporalAssertionMappings: (mappingState.temporalAssertionMappings || []).map(temporalAssertionMappingToRuntime),
    relationshipMetadataMapping: Object.fromEntries(
      Object.entries(mappingState.relationshipMetadataMappings || {}).map(([field, ref]) => [field, workbookRefRuntimeKey(ref)])
    ),
    customFieldSelections: (mappingState.customFieldSelections || []).map((selection) => ({
      ...selection,
      subjectSelection: normalizePeridotSubjectSelectionFromMapping(selection),
      sourceColumn: workbookRefRuntimeKey(
        selection?.sourceRef || makeWorkbookColumnRef(selection?.sheetName, selection?.sourceColumn)
      ),
    })),
    coreMapping: Object.fromEntries(
      Object.entries(mappingState.coreMappings || {}).map(([field, ref]) => [field, workbookRefRuntimeKey(ref)])
    ),
    pointMapping: Object.fromEntries(
      Object.entries(mappingState.pointMappings || {}).map(([field, ref]) => [field, workbookRefRuntimeKey(ref)])
    ),
    routeCoordinatePairMapping: Object.fromEntries(
      Object.entries(mappingState.routeCoordinatePairMappings || {}).map(([field, ref]) => [field, workbookRefRuntimeKey(ref)])
    ),
  };
}

function buildWorkbookSemanticRuntimeRow(workbookModel, context = {}, mappingState = {}) {
  return Object.fromEntries(
    getWorkbookSemanticRefs(mappingState).map((ref) => [
      makeWorkbookColumnRefKey(ref),
      getValueFromWorkbookRef(workbookModel, context, ref),
    ])
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

  const effectiveIdentityMapping = materializePeridotWorkbookIdentityMappingSuggestions({
    identityMapping: mappingState.identityMapping || {},
    relationshipParts: mappingState.relationshipParts || [],
    placeParts: mappingState.placeParts || [],
    workbookModel,
  });
  const effectiveMappingState = { ...mappingState, identityMapping: effectiveIdentityMapping };
  const primarySheetName = asText(effectiveMappingState.primarySheetName);
  const primaryRows = getSheetRows(workbookModel, primarySheetName);
  const runtimeMapping = buildWorkbookGeneralizedRuntimeMapping(effectiveMappingState, workbookModel);
  // Build indexes once per import. The previous implementation scanned every
  // joined sheet again for every primary row, which made larger workbooks much
  // more expensive than their row counts warranted.
  const preparedJoinIndexes = buildLetterIdJoinIndexes(workbookModel, effectiveMappingState);

  return primaryRows.map((primaryRow, index) => {
    const context = getPrimaryWorkbookRowContext(workbookModel, effectiveMappingState, primaryRow, preparedJoinIndexes);
    const semanticRow = buildWorkbookSemanticRuntimeRow(workbookModel, context, effectiveMappingState);
    const generalizedObservation = buildPeridotGeneralizedObservation(semanticRow, runtimeMapping, index);
    const authoritativeObservation = Object.freeze({
      ...generalizedObservation,
      originalUploadedRow: {
        workbookFileName: workbookModel?.fileName || workbookModel?.workbookName || '',
        primarySheetName,
        primaryRowNumber: index + 2,
        sheetRows: buildOriginalWorkbookRowContext(context),
      },
    });

    return projectGeneralizedObservationToLegacyRow(authoritativeObservation, runtimeMapping);
  });
}

export function getWorkbookMappingSummary(workbookModel, mappingState = {}) {
  const validation = validatePeridotWorkbookMapping(workbookModel, mappingState);
  const coreMappings = mappingState.coreMappings || {};
  const temporalMappings = mappingState.temporalMappings || {};
  const pointMappings = mappingState.pointMappings || {};
  const routeCoordinatePairMappings = mappingState.routeCoordinatePairMappings || {};
  const mappedCoreFields = Object.entries(coreMappings).filter(([, ref]) => isWorkbookColumnRefPresent(ref));
  const mappedSheets = getMappedWorkbookSemanticSheets(mappingState);

  return Object.freeze({
    primarySheetName: mappingState.primarySheetName || '',
    mode: mappingState.mode || '',
    primaryLetterIdColumn: mappingState.primaryLetterIdColumn || '',
    mappedCoreFieldCount: mappedCoreFields.length,
    mappedTemporalFieldCount: (mappingState.temporalAssertionMappings || []).filter((mapping) => getWorkbookTemporalAssertionRefs([mapping]).length).length || Object.values(temporalMappings).filter(isWorkbookColumnRefPresent).length,
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
    [...Object.values(mappingState.coreMappings || {}), ...Object.values(mappingState.temporalMappings || {}), ...getWorkbookTemporalAssertionRefs(mappingState.temporalAssertionMappings || []), ...Object.values(mappingState.pointMappings || {}), ...Object.values(mappingState.routeCoordinatePairMappings || {})]
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
