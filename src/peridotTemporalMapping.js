/* Repeatable source mappings for canonical temporal assertions. */

function asText(value) { return String(value ?? '').trim(); }

export const PERIDOT_TEMPORAL_ASSERTION_KIND = Object.freeze({ DATE: 'date', PERIOD: 'period' });
export const PERIDOT_TEMPORAL_SOURCE_MODE = Object.freeze({ SINGLE: 'single', PARTS: 'parts', ENDPOINTS: 'endpoints' });

export function makeTemporalAssertionMapping(overrides = {}) {
  return {
    id: asText(overrides.id) || `time-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: String(overrides.role ?? ''),
    kind: overrides.kind === 'period' ? 'period' : 'date',
    sourceMode: overrides.sourceMode || 'single',
    column: overrides.column || '',
    yearColumn: overrides.yearColumn || '',
    monthColumn: overrides.monthColumn || '',
    dayColumn: overrides.dayColumn || '',
    startMode: overrides.startMode || 'single',
    startColumn: overrides.startColumn || '',
    startYearColumn: overrides.startYearColumn || '',
    startMonthColumn: overrides.startMonthColumn || '',
    startDayColumn: overrides.startDayColumn || '',
    endMode: overrides.endMode || 'single',
    endColumn: overrides.endColumn || '',
    endYearColumn: overrides.endYearColumn || '',
    endMonthColumn: overrides.endMonthColumn || '',
    endDayColumn: overrides.endDayColumn || '',
    noteColumns: Array.isArray(overrides.noteColumns) ? [...overrides.noteColumns] : [],
    subjectParticipantIndex: Number.isInteger(overrides.subjectParticipantIndex) ? overrides.subjectParticipantIndex : null,
  };
}

export function normalizeTemporalAssertionMappings(mappings = []) {
  return (Array.isArray(mappings) ? mappings : []).map((mapping) => makeTemporalAssertionMapping(mapping));
}

export function buildTemporalAssertionMappingsFromLegacy(temporalMapping = {}, temporalNoteMappings = {}) {
  const result = [];
  if (temporalMapping.Date) result.push(makeTemporalAssertionMapping({ id: 'legacy-date', role: temporalMapping.Date, kind: 'date', sourceMode: 'single', column: temporalMapping.Date, noteColumns: temporalNoteMappings.Date || [] }));
  if (temporalMapping.Date_Range) result.push(makeTemporalAssertionMapping({ id: 'legacy-range', role: temporalMapping.Date_Range, kind: 'period', sourceMode: 'single', column: temporalMapping.Date_Range, noteColumns: temporalNoteMappings.Date_Range || [] }));
  if (temporalMapping.Date_Start || temporalMapping.Date_End) result.push(makeTemporalAssertionMapping({
    id: 'legacy-start-end', role: [temporalMapping.Date_Start, temporalMapping.Date_End].filter(Boolean).join(' / ') || 'Date interval', kind: 'period', sourceMode: 'endpoints',
    startMode: 'single', startColumn: temporalMapping.Date_Start || '', endMode: 'single', endColumn: temporalMapping.Date_End || '',
    noteColumns: [...(temporalNoteMappings.Date_Start || []), ...(temporalNoteMappings.Date_End || [])].filter((value, index, all) => value && all.indexOf(value) === index),
  }));
  return result.length ? result : [makeTemporalAssertionMapping({ id: 'time-1' })];
}

export function getTemporalAssertionSourceColumns(mappings = []) {
  const columns = [];
  const add = (value) => { if (value && !columns.includes(value)) columns.push(value); };
  normalizeTemporalAssertionMappings(mappings).forEach((mapping) => {
    ['column','yearColumn','monthColumn','dayColumn','startColumn','startYearColumn','startMonthColumn','startDayColumn','endColumn','endYearColumn','endMonthColumn','endDayColumn'].forEach((key) => add(mapping[key]));
    (mapping.noteColumns || []).forEach(add);
  });
  return columns;
}

export function deriveLegacyTemporalMapping(mappings = []) {
  const result = { Date: '', Date_Range: '', Date_Start: '', Date_End: '', Date_Display: '' };
  normalizeTemporalAssertionMappings(mappings).forEach((mapping) => {
    if (mapping.kind === 'date' && mapping.sourceMode === 'single' && !result.Date) result.Date = mapping.column || '';
    if (mapping.kind === 'period' && mapping.sourceMode === 'single' && !result.Date_Range) result.Date_Range = mapping.column || '';
    if (mapping.kind === 'period' && mapping.sourceMode === 'endpoints') {
      if (mapping.startMode === 'single' && !result.Date_Start) result.Date_Start = mapping.startColumn || '';
      if (mapping.endMode === 'single' && !result.Date_End) result.Date_End = mapping.endColumn || '';
    }
  });
  return result;
}

const MONTHS = Object.freeze({ january:1,jan:1,february:2,feb:2,march:3,mar:3,april:4,apr:4,may:5,june:6,jun:6,july:7,jul:7,august:8,aug:8,september:9,sep:9,sept:9,october:10,oct:10,november:11,nov:11,december:12,dec:12 });
function normalizeIntegerPart(value, kind) {
  const text = asText(value);
  if (!text) return 0;
  if (kind === 'month' && MONTHS[text.toLowerCase()]) return MONTHS[text.toLowerCase()];
  const numeric = Number(text);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function composeTemporalPartsValue({ year, month, day } = {}) {
  if (![year, month, day].some((value) => asText(value))) return '';
  const y = normalizeIntegerPart(year, 'year');
  const m = normalizeIntegerPart(month, 'month');
  const d = normalizeIntegerPart(day, 'day');
  if (y === null || m === null || d === null) return [asText(year), asText(month), asText(day)].filter(Boolean).join(' ');
  return `${String(y).padStart(4, '0')}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

export function temporalAssertionMappingHasSource(mapping = {}) {
  return getTemporalAssertionSourceColumns([{ ...mapping, noteColumns: [] }]).length > 0;
}
