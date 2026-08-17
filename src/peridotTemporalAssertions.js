/*
 * Canonical temporal assertion helpers.
 *
 * Source text is always preserved. Machine-derived temporal structure is kept
 * separate from researcher-supplied temporal notes and is intentionally
 * conservative: Peridot does not invent missing calendar components or infer
 * the epistemic meaning of a user's note columns.
 */

export const PERIDOT_TEMPORAL_PRECISION = Object.freeze({
  DAY: 'day', MONTH: 'month', YEAR: 'year', PARTIAL: 'partial', RANGE: 'range', TEXT: 'text', UNKNOWN: 'unknown',
});

export const PERIDOT_TEMPORAL_QUALIFIER = Object.freeze({
  EXACT: 'exact', CIRCA: 'circa', BEFORE: 'before', AFTER: 'after', BETWEEN: 'between', UNCERTAIN: 'uncertain', UNKNOWN: 'unknown',
});

export const PERIDOT_TEMPORAL_SHAPE = Object.freeze({
  POINT: 'point', INTERVAL: 'interval', OPEN_INTERVAL: 'openInterval', PARTIAL_POINT: 'partialPoint', PARTIAL_INTERVAL: 'partialInterval',
  APPROXIMATE_POINT: 'approximatePoint', APPROXIMATE_INTERVAL: 'approximateInterval', UNKNOWN: 'unknown', INCONSISTENT: 'inconsistent',
});

export const PERIDOT_TEMPORAL_BOUNDEDNESS = Object.freeze({ CLOSED: 'closed', OPEN_START: 'openStart', OPEN_END: 'openEnd', ONGOING: 'ongoing' });
export const PERIDOT_TEMPORAL_CONSISTENCY = Object.freeze({ VALID: 'valid', BACKWARDS: 'backwards', INDETERMINATE: 'indeterminate' });
export const PERIDOT_TEMPORAL_PARSING_STATUS = Object.freeze({ PARSED: 'parsed', PARTIAL: 'partial', UNPOSITIONABLE: 'unpositionable', UNRECOGNIZED: 'unrecognized' });

function asText(value) { return String(value ?? '').trim(); }
function freezeArray(values = []) { return Object.freeze((Array.isArray(values) ? values : []).map((value) => Object.freeze({ ...value }))); }
function isLeapYear(year) { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function daysInMonth(year, month) { if (month === 2) return isLeapYear(year) ? 29 : 28; return [4, 6, 9, 11].includes(month) ? 30 : 31; }
function maxDayForUnknownYear(month) { if (month === 2) return 29; return [4, 6, 9, 11].includes(month) ? 30 : 31; }
function dateKey(year, month, day) { return year * 10000 + month * 100 + day; }
function stripOuterWrappers(value) {
  let text = asText(value);
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']];
  let changed = true;
  while (changed && text.length >= 2) {
    changed = false;
    for (const [open, close] of pairs) {
      if (text.startsWith(open) && text.endsWith(close)) { text = text.slice(1, -1).trim(); changed = true; break; }
    }
  }
  return text;
}

const MONTH_NAME_TO_NUMBER = Object.freeze({
  january:1, jan:1, february:2, feb:2, march:3, mar:3, april:4, apr:4, may:5, june:6, jun:6,
  july:7, jul:7, august:8, aug:8, september:9, sep:9, sept:9, october:10, oct:10, november:11, nov:11, december:12, dec:12,
});

function makeKnownComponents(year, month, day) {
  return Object.freeze({ year: year !== null, month: month !== null, day: day !== null });
}

function endpointPrecision(year, month, day) {
  if (year !== null && month !== null && day !== null) return PERIDOT_TEMPORAL_PRECISION.DAY;
  if (year !== null && month !== null && day === null) return PERIDOT_TEMPORAL_PRECISION.MONTH;
  if (year !== null && month === null && day === null) return PERIDOT_TEMPORAL_PRECISION.YEAR;
  return PERIDOT_TEMPORAL_PRECISION.PARTIAL;
}

function validPartialParts(year, month, day) {
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 9999)) return false;
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) return false;
  if (day !== null) {
    if (!Number.isInteger(day) || day < 1) return false;
    if (month === null && day > 31) return false;
    if (month !== null && day > (year !== null ? daysInMonth(year, month) : maxDayForUnknownYear(month))) return false;
  }
  return year !== null || month !== null || day !== null;
}

function endpointBounds(year, month, day) {
  if (year === null) return { start: null, end: null };
  if (month === null) return { start: dateKey(year, 1, 1), end: dateKey(year, 12, 31) };
  if (day === null) return { start: dateKey(year, month, 1), end: dateKey(year, month, daysInMonth(year, month)) };
  return { start: dateKey(year, month, day), end: dateKey(year, month, day) };
}

function makeEndpoint({ year = null, month = null, day = null, approximation = 'exact', sourceText = '' } = {}) {
  if (!validPartialParts(year, month, day)) return null;
  const bounds = endpointBounds(year, month, day);
  return Object.freeze({
    year, month, day,
    knownComponents: makeKnownComponents(year, month, day),
    precision: endpointPrecision(year, month, day),
    approximation,
    sourceText: asText(sourceText),
    sortBounds: Object.freeze(bounds),
  });
}

function parseApproximationPrefix(text) {
  const patterns = [
    [/^(?:circa|ca\.?|c\.?)\s*/i, 'circa'],
    [/^(?:approximately|approximate|approx\.?|probably|prob\.?)\s*/i, 'approximate'],
  ];
  for (const [pattern, approximation] of patterns) {
    if (pattern.test(text)) return { text: text.replace(pattern, '').trim(), approximation };
  }
  return { text, approximation: 'exact' };
}

function parseMachineEndpoint(value, approximation) {
  const raw = asText(value);
  let match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const rawYear = Number(match[1]); const rawMonth = Number(match[2]); const rawDay = Number(match[3]);
    const year = rawYear === 0 ? null : rawYear; const month = rawMonth === 0 ? null : rawMonth; const day = rawDay === 0 ? null : rawDay;
    return makeEndpoint({ year, month, day, approximation, sourceText: value });
  }
  match = raw.match(/^(\d{4})[/-](\d{1,2})$/);
  if (match) {
    const rawYear = Number(match[1]); const rawMonth = Number(match[2]);
    return makeEndpoint({ year: rawYear === 0 ? null : rawYear, month: rawMonth === 0 ? null : rawMonth, approximation, sourceText: value });
  }
  match = raw.match(/^(\d{1,4})$/);
  if (match) {
    const year = Number(match[1]);
    if (year === 0) return null;
    return makeEndpoint({ year, approximation, sourceText: value });
  }
  return null;
}

function parseNamedEndpoint(value, approximation) {
  const raw = asText(value).replace(/\s+/g, ' ').replace(/\bof\b/gi, ' ').replace(/\s+/g, ' ').trim();
  let match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})$/);
  if (match) {
    const month = MONTH_NAME_TO_NUMBER[match[2].toLowerCase()];
    if (month) return makeEndpoint({ year: Number(match[3]), month, day: Number(match[1]), approximation, sourceText: value });
  }
  match = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})$/i);
  if (match) {
    const month = MONTH_NAME_TO_NUMBER[match[1].toLowerCase()];
    if (month) return makeEndpoint({ year: Number(match[3]), month, day: Number(match[2]), approximation, sourceText: value });
  }
  match = raw.match(/^([A-Za-z]+)\s+(\d{4})$/i);
  if (match) {
    const month = MONTH_NAME_TO_NUMBER[match[1].toLowerCase()];
    if (month) return makeEndpoint({ year: Number(match[2]), month, approximation, sourceText: value });
  }
  return null;
}

function parseUnambiguousNumericEndpoint(value, approximation) {
  const match = asText(value).match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]); const second = Number(match[2]); const year = Number(match[3]);
  if (first > 12 && second <= 12) return makeEndpoint({ year, month: second, day: first, approximation, sourceText: value });
  if (second > 12 && first <= 12) return makeEndpoint({ year, month: first, day: second, approximation, sourceText: value });
  return null;
}

function parseEndpoint(value) {
  const wrapped = stripOuterWrappers(value);
  const { text, approximation } = parseApproximationPrefix(wrapped);
  const endpoint = parseMachineEndpoint(text, approximation) || parseNamedEndpoint(text, approximation) || parseUnambiguousNumericEndpoint(text, approximation);
  return endpoint ? Object.freeze({ ...endpoint, sourceText: asText(value) }) : null;
}

function isUnknownText(value) {
  return new Set(['unknown', 'undated', 'n.d.', 'n.d', 'indescipherable', 'indecipherable', '?', '']).has(asText(value).toLowerCase());
}
function isOngoingText(value) { return /^(?:present|ongoing|current)$/i.test(asText(value)); }

function inferPointShape(endpoint) {
  if (!endpoint) return PERIDOT_TEMPORAL_SHAPE.UNKNOWN;
  const partial = endpoint.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL;
  if (endpoint.approximation !== 'exact') return partial ? PERIDOT_TEMPORAL_SHAPE.PARTIAL_POINT : PERIDOT_TEMPORAL_SHAPE.APPROXIMATE_POINT;
  return partial ? PERIDOT_TEMPORAL_SHAPE.PARTIAL_POINT : PERIDOT_TEMPORAL_SHAPE.POINT;
}

function normalizedNotes(notes = []) {
  return freezeArray((Array.isArray(notes) ? notes : []).map((note) => ({
    label: asText(note?.label || note?.sourceColumn), sourceColumn: asText(note?.sourceColumn), value: note?.value ?? '',
  })).filter((note) => note.label || note.sourceColumn));
}

export function makePeridotTemporalAssertion({
  id = '', role = '', sourceText = '', display = '', temporalShape = PERIDOT_TEMPORAL_SHAPE.UNKNOWN,
  start = null, end = null, boundedness = PERIDOT_TEMPORAL_BOUNDEDNESS.CLOSED,
  consistency = PERIDOT_TEMPORAL_CONSISTENCY.INDETERMINATE, parsingStatus = PERIDOT_TEMPORAL_PARSING_STATUS.UNRECOGNIZED,
  precision = PERIDOT_TEMPORAL_PRECISION.UNKNOWN, qualifier = PERIDOT_TEMPORAL_QUALIFIER.UNKNOWN,
  certainty = 'not-specified', calendar = 'gregorian-or-source-unspecified', sortBounds = {},
  temporalNotes = [], originalValues = {}, parseWarnings = [], visualizationUsability = {}, subjectParticipantIndex = null,
} = {}) {
  const startSort = Number(sortBounds?.start); const endSort = Number(sortBounds?.end);
  const notes = normalizedNotes(temporalNotes);
  return Object.freeze({
    id: asText(id), role: asText(role), sourceText: sourceText === '' ? asText(display) : String(sourceText ?? ''),
    display: asText(display || sourceText), temporalShape,
    start: start ? Object.freeze({ ...start, knownComponents: Object.freeze({ ...(start.knownComponents || {}) }), sortBounds: Object.freeze({ ...(start.sortBounds || {}) }) }) : null,
    end: end ? Object.freeze({ ...end, knownComponents: Object.freeze({ ...(end.knownComponents || {}) }), sortBounds: Object.freeze({ ...(end.sortBounds || {}) }) }) : null,
    boundedness, consistency, parsingStatus, precision, qualifier,
    certainty: asText(certainty) || 'not-specified', calendar: asText(calendar) || 'gregorian-or-source-unspecified',
    sortBounds: Object.freeze({ start: Number.isFinite(startSort) ? startSort : null, end: Number.isFinite(endSort) ? endSort : null }),
    temporalNotes: notes,
    subjectParticipantIndex: Number.isInteger(subjectParticipantIndex) ? subjectParticipantIndex : null,
    originalValues: Object.freeze({ ...(originalValues && typeof originalValues === 'object' ? originalValues : {}) }),
    parseWarnings: Object.freeze((Array.isArray(parseWarnings) ? parseWarnings : []).map(asText).filter(Boolean)),
    visualizationUsability: Object.freeze({
      hasKnownYear: Boolean(visualizationUsability?.hasKnownYear),
      timelinePositionable: Boolean(visualizationUsability?.timelinePositionable),
      intervalSafe: Boolean(visualizationUsability?.intervalSafe),
      yearFilterUsable: Boolean(visualizationUsability?.yearFilterUsable),
    }),
  });
}

function assertionFromEndpoint(rawValue, endpoint, options = {}) {
  const qualifier = endpoint.approximation === 'circa' ? PERIDOT_TEMPORAL_QUALIFIER.CIRCA : endpoint.approximation === 'approximate' ? PERIDOT_TEMPORAL_QUALIFIER.CIRCA : PERIDOT_TEMPORAL_QUALIFIER.EXACT;
  const bounds = endpoint.sortBounds;
  const hasYear = endpoint.year !== null;
  const partial = endpoint.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL;
  return makePeridotTemporalAssertion({
    role: options.role, sourceText: String(rawValue ?? ''), display: asText(rawValue), temporalShape: inferPointShape(endpoint),
    start: endpoint, end: endpoint, boundedness: PERIDOT_TEMPORAL_BOUNDEDNESS.CLOSED, consistency: PERIDOT_TEMPORAL_CONSISTENCY.VALID,
    parsingStatus: partial ? PERIDOT_TEMPORAL_PARSING_STATUS.PARTIAL : PERIDOT_TEMPORAL_PARSING_STATUS.PARSED,
    precision: endpoint.precision, qualifier, calendar: options.calendar, sortBounds: bounds, temporalNotes: options.temporalNotes,
    originalValues: { raw: rawValue },
    visualizationUsability: { hasKnownYear: hasYear, timelinePositionable: hasYear, intervalSafe: false, yearFilterUsable: hasYear },
  });
}

export function parsePeridotTemporalValue(rawValue, options = {}) {
  const raw = asText(rawValue);
  const boundedMatch = stripOuterWrappers(raw).match(/^(before|pre|after|post)\s+(.+)$/i);
  if (boundedMatch) {
    const direction = boundedMatch[1].toLowerCase();
    const endpoint = parseEndpoint(boundedMatch[2]);
    if (endpoint) {
      const isBefore = direction === 'before' || direction === 'pre';
      const hasYear = endpoint.year !== null;
      return makePeridotTemporalAssertion({
        role: options.role, sourceText: String(rawValue ?? ''), display: raw, temporalShape: PERIDOT_TEMPORAL_SHAPE.OPEN_INTERVAL,
        start: isBefore ? null : endpoint, end: isBefore ? endpoint : null,
        boundedness: isBefore ? PERIDOT_TEMPORAL_BOUNDEDNESS.OPEN_START : PERIDOT_TEMPORAL_BOUNDEDNESS.OPEN_END,
        consistency: PERIDOT_TEMPORAL_CONSISTENCY.INDETERMINATE, parsingStatus: endpoint.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL ? PERIDOT_TEMPORAL_PARSING_STATUS.PARTIAL : PERIDOT_TEMPORAL_PARSING_STATUS.PARSED,
        precision: PERIDOT_TEMPORAL_PRECISION.RANGE, qualifier: isBefore ? PERIDOT_TEMPORAL_QUALIFIER.BEFORE : PERIDOT_TEMPORAL_QUALIFIER.AFTER,
        temporalNotes: options.temporalNotes, originalValues: { raw: rawValue },
        sortBounds: { start: isBefore ? null : endpoint.sortBounds.start, end: isBefore ? endpoint.sortBounds.end : null },
        visualizationUsability: { hasKnownYear: hasYear, timelinePositionable: hasYear, intervalSafe: false, yearFilterUsable: hasYear },
      });
    }
  }
  if (isUnknownText(raw) || raw === '0' || raw === '0000' || raw === '0000/00/00') {
    return makePeridotTemporalAssertion({
      role: options.role, sourceText: String(rawValue ?? ''), display: raw || 'Unknown date', temporalShape: PERIDOT_TEMPORAL_SHAPE.UNKNOWN,
      parsingStatus: PERIDOT_TEMPORAL_PARSING_STATUS.UNPOSITIONABLE, qualifier: PERIDOT_TEMPORAL_QUALIFIER.UNKNOWN,
      temporalNotes: options.temporalNotes, originalValues: { raw: rawValue ?? '' },
    });
  }
  const endpoint = parseEndpoint(raw);
  if (!endpoint) {
    return makePeridotTemporalAssertion({
      role: options.role, sourceText: String(rawValue ?? ''), display: raw, temporalShape: PERIDOT_TEMPORAL_SHAPE.UNKNOWN,
      precision: PERIDOT_TEMPORAL_PRECISION.TEXT, parsingStatus: PERIDOT_TEMPORAL_PARSING_STATUS.UNRECOGNIZED,
      temporalNotes: options.temporalNotes, originalValues: { raw: rawValue },
      parseWarnings: ['Temporal value was preserved because Peridot could not safely derive calendar structure from it.'],
    });
  }
  return assertionFromEndpoint(rawValue, endpoint, options);
}

const TEMPORAL_ENDPOINT_TOKEN = new RegExp(
  String.raw`(?:` +
    String.raw`(?:circa|ca\.?|c\.?|approximately|approximate|approx\.?|probably|prob\.?)\s*` +
  String.raw`)?(?:` +
    String.raw`\d{4}[/-]\d{1,2}[/-]\d{1,2}` +
    String.raw`|\d{1,2}[/.]\d{1,2}[/.]\d{4}` +
    String.raw`|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*\d{4}` +
    String.raw`|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4}` +
    String.raw`|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:of\s+)?\d{4}` +
    String.raw`|\d{1,4}[/-]\d{1,2}` +
    String.raw`|\d{4}` +
  String.raw`)`,
  'gi',
);

function scanTemporalEndpointCandidates(rawValue) {
  const raw = asText(rawValue);
  const candidates = [];
  const blocked = [];
  TEMPORAL_ENDPOINT_TOKEN.lastIndex = 0;
  let match;
  while ((match = TEMPORAL_ENDPOINT_TOKEN.exec(raw)) !== null) {
    const source = match[0].trim();
    const parsed = parseEndpoint(source);
    const leadingTrim = match[0].length - match[0].trimStart().length;
    const start = match.index + leadingTrim;
    const end = start + source.length;
    if (parsed) candidates.push({ text: source, parsed, start, end });
    else blocked.push({ text: source, start, end });
    if (TEMPORAL_ENDPOINT_TOKEN.lastIndex === match.index) TEMPORAL_ENDPOINT_TOKEN.lastIndex += 1;
  }
  return { candidates, blocked };
}

function hasOpenStartMarker(text) {
  return /(?:^|\s)(?:\?|unknown)(?:\s|[-–—:;,]|$)/i.test(asText(text));
}
function hasOpenEndMarker(text) {
  return /(?:^|\s)(?:\?|unknown|present|ongoing|current)(?:\s|[-–—:;,.)\]}]|$)/i.test(asText(text));
}
function openEndToken(text) {
  const match = asText(text).match(/(?:\?|unknown|present|ongoing|current)/i);
  return match ? match[0] : '?';
}

function splitPeridotTemporalSpan(rawValue) {
  const raw = stripOuterWrappers(rawValue);
  if (!raw) return null;

  const { candidates, blocked } = scanTemporalEndpointCandidates(raw);
  if (blocked.length) {
    return { unrecognizedReason: 'Temporal text contains a numeric date form whose day/month order is ambiguous or invalid.' };
  }
  if (candidates.length > 2) {
    return { unrecognizedReason: 'Temporal text contains more than two viable date expressions, so Peridot preserved the competing possibilities rather than collapsing them into one interval.' };
  }

  if (candidates.length === 2) {
    const [startCandidate, endCandidate] = candidates;
    return {
      startText: startCandidate.text,
      endText: endCandidate.text,
      delimiter: raw.slice(startCandidate.end, endCandidate.start),
      leadingText: raw.slice(0, startCandidate.start),
      trailingText: raw.slice(endCandidate.end),
    };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    const leadingText = raw.slice(0, candidate.start);
    const trailingText = raw.slice(candidate.end);
    if (hasOpenStartMarker(leadingText)) {
      return {
        startText: '?', endText: candidate.text, delimiter: leadingText,
        leadingText, trailingText, openStart: true,
      };
    }
    if (hasOpenEndMarker(trailingText)) {
      return {
        startText: candidate.text, endText: openEndToken(trailingText), delimiter: trailingText,
        leadingText, trailingText, openEnd: true,
      };
    }
    return { singletonText: candidate.text, leadingText, trailingText };
  }

  return null;
}

function intervalShape(start, end, boundedness, consistency) {
  if (consistency === PERIDOT_TEMPORAL_CONSISTENCY.BACKWARDS) return PERIDOT_TEMPORAL_SHAPE.INCONSISTENT;
  if (boundedness !== PERIDOT_TEMPORAL_BOUNDEDNESS.CLOSED) return PERIDOT_TEMPORAL_SHAPE.OPEN_INTERVAL;
  const approximate = start?.approximation !== 'exact' || end?.approximation !== 'exact';
  const partial = start?.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL || end?.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL;
  if (approximate) return PERIDOT_TEMPORAL_SHAPE.APPROXIMATE_INTERVAL;
  if (partial) return PERIDOT_TEMPORAL_SHAPE.PARTIAL_INTERVAL;
  return PERIDOT_TEMPORAL_SHAPE.INTERVAL;
}

export function parsePeridotTemporalRange({ startValue = '', endValue = '', displayValue = '', calendar, role = '', temporalNotes = [] } = {}) {
  const rawStart = asText(startValue); const rawEnd = asText(endValue);
  const startOpen = isUnknownText(rawStart); const endOngoing = isOngoingText(rawEnd); const endOpen = isUnknownText(rawEnd) || endOngoing;
  const start = startOpen ? null : parseEndpoint(rawStart); const end = endOpen ? null : parseEndpoint(rawEnd);
  const display = asText(displayValue) || (rawStart && rawEnd ? `${rawStart} – ${rawEnd}` : rawStart || rawEnd);
  if (!start && !end && !startOpen && !endOpen) {
    return makePeridotTemporalAssertion({ role, sourceText: display, display, temporalShape: PERIDOT_TEMPORAL_SHAPE.UNKNOWN, precision: display ? PERIDOT_TEMPORAL_PRECISION.TEXT : PERIDOT_TEMPORAL_PRECISION.UNKNOWN, parsingStatus: display ? PERIDOT_TEMPORAL_PARSING_STATUS.UNRECOGNIZED : PERIDOT_TEMPORAL_PARSING_STATUS.UNPOSITIONABLE, temporalNotes, originalValues: { startValue, endValue, displayValue }, parseWarnings: display ? ['Temporal range was preserved because Peridot could not safely derive either endpoint.'] : [] });
  }
  const boundedness = startOpen ? PERIDOT_TEMPORAL_BOUNDEDNESS.OPEN_START : endOngoing ? PERIDOT_TEMPORAL_BOUNDEDNESS.ONGOING : endOpen ? PERIDOT_TEMPORAL_BOUNDEDNESS.OPEN_END : PERIDOT_TEMPORAL_BOUNDEDNESS.CLOSED;
  const startBound = start?.sortBounds?.start ?? null; const endBound = end?.sortBounds?.end ?? null;
  let consistency = PERIDOT_TEMPORAL_CONSISTENCY.INDETERMINATE;
  if (start && end && Number.isFinite(startBound) && Number.isFinite(endBound)) consistency = startBound > endBound ? PERIDOT_TEMPORAL_CONSISTENCY.BACKWARDS : PERIDOT_TEMPORAL_CONSISTENCY.VALID;
  else if ((start || startOpen) && (end || endOpen)) consistency = PERIDOT_TEMPORAL_CONSISTENCY.INDETERMINATE;
  const warnings = [];
  if (!start && rawStart && !startOpen) warnings.push('Peridot could not safely parse the temporal range start.');
  if (!end && rawEnd && !endOpen) warnings.push('Peridot could not safely parse the temporal range end.');
  if (consistency === PERIDOT_TEMPORAL_CONSISTENCY.BACKWARDS) warnings.push('Temporal range start occurs after its end. Peridot preserved the source order and marked the interval unsafe for ordinary interval visualization.');
  const hasYear = Boolean(start?.year !== null || end?.year !== null);
  const partial = start?.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL || end?.precision === PERIDOT_TEMPORAL_PRECISION.PARTIAL;
  const shape = intervalShape(start, end, boundedness, consistency);
  const safeInterval = boundedness === PERIDOT_TEMPORAL_BOUNDEDNESS.CLOSED && consistency === PERIDOT_TEMPORAL_CONSISTENCY.VALID && Boolean(start && end);
  return makePeridotTemporalAssertion({
    role, sourceText: display, display, temporalShape: shape, start, end, boundedness, consistency,
    parsingStatus: partial ? PERIDOT_TEMPORAL_PARSING_STATUS.PARTIAL : (start || end ? PERIDOT_TEMPORAL_PARSING_STATUS.PARSED : PERIDOT_TEMPORAL_PARSING_STATUS.UNPOSITIONABLE),
    precision: PERIDOT_TEMPORAL_PRECISION.RANGE, qualifier: PERIDOT_TEMPORAL_QUALIFIER.BETWEEN, calendar,
    sortBounds: { start: startBound, end: endBound }, temporalNotes, originalValues: { startValue, endValue, displayValue }, parseWarnings: warnings,
    visualizationUsability: { hasKnownYear: hasYear, timelinePositionable: hasYear && consistency !== PERIDOT_TEMPORAL_CONSISTENCY.BACKWARDS, intervalSafe: safeInterval, yearFilterUsable: hasYear && consistency !== PERIDOT_TEMPORAL_CONSISTENCY.BACKWARDS },
  });
}

export function parsePeridotTemporalSpan(rawValue = '', options = {}) {
  const raw = asText(rawValue);
  if (!raw) return parsePeridotTemporalValue(rawValue, options);
  const split = splitPeridotTemporalSpan(raw);
  if (!split) {
    const singleton = parseEndpoint(stripOuterWrappers(raw));
    if (singleton) return assertionFromEndpoint(rawValue, singleton, options);
    return parsePeridotTemporalValue(rawValue, options);
  }
  if (split.unrecognizedReason) {
    return makePeridotTemporalAssertion({
      role: options.role, sourceText: String(rawValue ?? ''), display: raw, temporalShape: PERIDOT_TEMPORAL_SHAPE.UNKNOWN,
      precision: PERIDOT_TEMPORAL_PRECISION.TEXT, parsingStatus: PERIDOT_TEMPORAL_PARSING_STATUS.UNRECOGNIZED,
      temporalNotes: options.temporalNotes, originalValues: { raw: rawValue }, parseWarnings: [split.unrecognizedReason],
    });
  }
  if (split.singletonText) {
    const singleton = parseEndpoint(split.singletonText);
    if (singleton) {
      const assertion = assertionFromEndpoint(rawValue, singleton, options);
      return makePeridotTemporalAssertion({
        ...assertion,
        sourceText: String(rawValue ?? ''),
        originalValues: { raw: rawValue, pointValue: split.singletonText, leadingText: split.leadingText, trailingText: split.trailingText },
      });
    }
  }
  const parsed = parsePeridotTemporalRange({ startValue: split.startText, endValue: split.endText, displayValue: raw, calendar: options.calendar, role: options.role, temporalNotes: options.temporalNotes });
  return makePeridotTemporalAssertion({
    ...parsed,
    sourceText: String(rawValue ?? ''),
    originalValues: {
      raw: rawValue, startValue: split.startText, endValue: split.endText, delimiter: split.delimiter,
      leadingText: split.leadingText || '', trailingText: split.trailingText || '',
    },
  });
}

export function isPeridotTemporalSortable(assertion) {
  return Number.isFinite(assertion?.sortBounds?.start) || Number.isFinite(assertion?.sortBounds?.end);
}
