/*
 * Pure timeline and playback helpers.
 *
 * Canonical runtime rows may carry multiple `temporalAssertions`. Timeline
 * derivation treats those assertions as the sole authoritative chronology.
 * Legacy parsed-date projections were retired after active consumers migrated.
 *
 * Scope contract:
 * - timeline boundaries derive from all positionable temporal assertions;
 * - range filtering keeps a row when at least one enabled assertion intersects
 *   the selected chronological window;
 * - playback is assertion-level, so one row may contribute multiple temporal
 *   entries, while visualization visibility is deduplicated back to rows;
 * - this module never reparses source temporal strings.
 */

const DEFAULT_TEMPORAL_ROLE = 'Date';

export const PERIDOT_TIMELINE_PLAYBACK_MODES = Object.freeze({
  CUMULATIVE: 'cumulative',
  CO_CURRENT: 'co-current',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function yearFromSortKey(sortKey) {
  if (!Number.isFinite(sortKey)) return null;
  const year = Math.floor(Math.abs(sortKey) / 10000);
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function getRowTemporalAssertions(row) {
  return asArray(row?.temporalAssertions).filter(Boolean);
}


// Active consumers outside Timeline still need a single chronological anchor
// for row-level sorting and chart axes. Prefer a usable assertion that describes
// the record itself; participant-attached assertions (for example a person's
// lifespan attached to Part A of a relationship) are secondary when a row-level
// event/date is also available. This preserves the richer plural model without
// forcing legacy consumers to guess among unrelated dates.
export function getRowPrimaryTemporalAssertion(row) {
  const usable = getRowTemporalAssertions(row).filter(isAssertionChronologicallyUsable);
  if (!usable.length) return null;
  const rowLevel = usable.find((assertion) => !Number.isInteger(assertion?.subjectParticipantIndex));
  return rowLevel || usable[0];
}

export function getRowTemporalSortKey(row) {
  const assertion = getRowPrimaryTemporalAssertion(row);
  if (!assertion) return null;
  return assertionPlaybackSortKey(assertion);
}

export function getRowTemporalSortBounds(row) {
  const assertion = getRowPrimaryTemporalAssertion(row);
  if (!assertion) return { start: null, end: null };
  return assertionWindowBounds(assertion);
}

function datePartsFromSortKey(sortKey) {
  if (!Number.isFinite(sortKey)) return null;
  const absolute = Math.abs(Math.trunc(sortKey));
  const year = Math.floor(absolute / 10000);
  const month = Math.floor((absolute % 10000) / 100);
  const day = absolute % 100;
  if (!year) return null;
  return {
    year,
    month: month >= 1 && month <= 12 ? month : 1,
    day: day >= 1 && day <= 31 ? day : 1,
  };
}

export function getRowTemporalDateParts(row) {
  const assertion = getRowPrimaryTemporalAssertion(row);
  if (!assertion) return null;
  const endpoint = assertion?.start || assertion?.end || null;
  const sortKey = assertionPlaybackSortKey(assertion);
  const fallback = datePartsFromSortKey(sortKey);
  const year = Number(endpoint?.year) || fallback?.year || null;
  if (!year) return null;
  const month = Number(endpoint?.month);
  const day = Number(endpoint?.day);
  const knownMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const knownDay = Number.isInteger(day) && day >= 1 && day <= 31;
  return {
    year,
    month: knownMonth ? month : 1,
    day: knownDay ? day : 1,
    precision: knownDay ? 'day' : knownMonth ? 'month' : 'year',
    sort: year * 372 + ((knownMonth ? month : 1) - 1) * 31 + ((knownDay ? day : 1) - 1),
  };
}

export function getRowPrimaryTemporalDisplay(row) {
  const assertion = getRowPrimaryTemporalAssertion(row);
  const canonical = String(assertion?.display || assertion?.sourceText || '').trim();
  if (canonical) return canonical;
  return String(row?.displayDate || row?.date || row?.Date || row?.dateDisplay || row?.dateLabel || '').trim();
}

function isAssertionChronologicallyUsable(assertion) {
  if (!assertion) return false;
  if (assertion?.consistency === 'backwards' || assertion?.temporalShape === 'inconsistent') return false;
  if (!assertion?.visualizationUsability?.timelinePositionable) return false;
  return Number.isFinite(assertion?.sortBounds?.start) || Number.isFinite(assertion?.sortBounds?.end);
}

function assertionRole(assertion) {
  const role = String(assertion?.role ?? '').trim();
  return role || DEFAULT_TEMPORAL_ROLE;
}

function roleEnabled(assertion, enabledRoles) {
  if (!enabledRoles) return true;
  const roles = enabledRoles instanceof Set ? enabledRoles : new Set(asArray(enabledRoles));
  if (!roles.size) return false;
  return roles.has(assertionRole(assertion));
}

function assertionWindowBounds(assertion) {
  const rawStart = assertion?.sortBounds?.start;
  const rawEnd = assertion?.sortBounds?.end;
  const start = Number.isFinite(rawStart) ? rawStart : null;
  const end = Number.isFinite(rawEnd) ? rawEnd : null;
  return { start, end };
}

function assertionPlaybackSortKey(assertion) {
  const { start, end } = assertionWindowBounds(assertion);
  // Closed and open-end intervals enter playback at their known beginning.
  // Open-start assertions have no defensible beginning, so use their known end.
  return start ?? end ?? null;
}

function assertionIntersectsWindow(assertion, windowStart, windowEnd) {
  if (!isAssertionChronologicallyUsable(assertion)) return false;
  const { start, end } = assertionWindowBounds(assertion);
  if (start === null && end === null) return false;
  if (start === null) return end >= windowStart;
  if (end === null) return start <= windowEnd;
  return start <= windowEnd && end >= windowStart;
}


export function getRowTimelineCapability(row) {
  const assertions = getRowTemporalAssertions(row);
  const positionableAssertions = assertions.filter(isAssertionChronologicallyUsable);
  return {
    hasTemporalEvidence: assertions.length > 0,
    timelineReady: positionableAssertions.length > 0,
    positionableAssertionCount: positionableAssertions.length,
    temporalAssertionCount: assertions.length,
  };
}

export function getRowTemporalDisplayLabels(row) {
  const labels = [];
  const add = (value) => {
    const text = String(value ?? '').trim();
    if (text && !labels.includes(text)) labels.push(text);
  };
  const canonical = asArray(row?.temporalAssertions).filter(Boolean);
  if (canonical.length) {
    canonical.forEach((assertion) => {
      const role = assertionRole(assertion);
      const value = assertion?.display || assertion?.sourceText || '';
      if (value) add(`${role}: ${value}`);
    });
    return labels;
  }
  add(row?.displayDate || row?.date || row?.Date || row?.dateDisplay || row?.dateLabel);
  return labels;
}

export function getRowTemporalYears(row) {
  const years = [];
  const addYear = (sortKey) => {
    const year = yearFromSortKey(sortKey);
    if (year && !years.includes(String(year))) years.push(String(year));
  };
  const assertions = getRowTemporalAssertions(row);
  assertions.forEach((assertion) => {
    const { start, end } = assertionWindowBounds(assertion);
    addYear(start);
    addYear(end);
  });
  return years;
}

export function getRowTemporalSearchValues(row) {
  const values = [];
  const add = (value) => {
    const text = String(value ?? '').trim();
    if (text && !values.includes(text)) values.push(text);
  };

  const assertions = getRowTemporalAssertions(row);

  assertions.forEach((assertion) => {
    add(assertion?.role);
    add(assertion?.display);
    add(assertion?.sourceText);
    const { start, end } = assertionWindowBounds(assertion);
    const startYear = yearFromSortKey(start);
    const endYear = yearFromSortKey(end);
    if (startYear) add(startYear);
    if (endYear) add(endYear);
  });

  return values;
}

export function getAvailableTemporalRoles(rows) {
  const roles = new Set();
  asArray(rows).forEach((row) => {
    getRowTemporalAssertions(row).forEach((assertion) => {
      if (isAssertionChronologicallyUsable(assertion)) roles.add(assertionRole(assertion));
    });
  });
  return Array.from(roles).sort((a, b) => a.localeCompare(b));
}

export function buildTimelineEntries(rows, { enabledRoles = null } = {}) {
  const entries = [];
  asArray(rows).forEach((row) => {
    getRowTemporalAssertions(row).forEach((assertion, assertionIndex) => {
      if (!isAssertionChronologicallyUsable(assertion) || !roleEnabled(assertion, enabledRoles)) return;
      const playbackSortKey = assertionPlaybackSortKey(assertion);
      if (!Number.isFinite(playbackSortKey)) return;
      const { start, end } = assertionWindowBounds(assertion);
      entries.push({
        id: `${row?.id || 'row'}__temporal_${assertion?.id || assertionIndex}`,
        row,
        rowId: row?.id,
        assertion,
        role: assertionRole(assertion),
        displayLabel: assertion?.display || assertion?.sourceText || row?.date || '',
        playbackSortKey,
        windowStart: start,
        windowEnd: end,
      });
    });
  });
  return entries;
}

export function buildTimelineMonths(rows, options = {}) {
  const years = new Set();
  buildTimelineEntries(rows, options).forEach((entry) => {
    const startYear = yearFromSortKey(entry.windowStart);
    const endYear = yearFromSortKey(entry.windowEnd);
    if (startYear) years.add(String(startYear));
    if (endYear) years.add(String(endYear));
  });
  return Array.from(years).sort((a, b) => Number(a) - Number(b));
}

export function getTimelineRangeSortBounds(timelineMonths, rangeStart, rangeEnd) {
  if (!Array.isArray(timelineMonths) || !timelineMonths.length) return null;
  const startIndex = Math.min(rangeStart, rangeEnd);
  const endIndex = Math.max(rangeStart, rangeEnd);
  const startYear = timelineMonths[startIndex];
  const endYear = timelineMonths[endIndex];
  return yearWindowSortBounds(startYear, endYear);
}

function yearWindowSortBounds(startYear, endYear) {
  const start = Number(startYear);
  const end = Number(endYear);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  return {
    start: Math.min(start, end) * 10000 + 101,
    end: Math.max(start, end) * 10000 + 1231,
  };
}

// Apply the global timeline range to a candidate row set. A row survives when
// at least one enabled canonical temporal assertion intersects the year window.
export function filterRowsByTimelineWindow(rows, timelineMode, timelineMonths, rangeStart, rangeEnd, options = {}) {
  if (timelineMode === 'all' || !timelineMonths.length) return rows;

  const bounds = getTimelineRangeSortBounds(timelineMonths, rangeStart, rangeEnd);
  if (!bounds) return rows;

  return asArray(rows).filter((row) => getRowTemporalAssertions(row).some((assertion) => (
    roleEnabled(assertion, options.enabledRoles)
    && assertionIntersectsWindow(assertion, bounds.start, bounds.end)
  )));
}

function playbackSortKeyInsideWindow(entry, windowStart) {
  const original = entry?.playbackSortKey;
  if (!Number.isFinite(original) || !Number.isFinite(windowStart)) return original;
  const entryStart = entry?.windowStart;
  const entryEnd = entry?.windowEnd;
  const activeAtWindowStart = (entryStart === null || entryStart <= windowStart)
    && (entryEnd === null || entryEnd >= windowStart);
  return activeAtWindowStart && original < windowStart ? windowStart : original;
}

function coCurrentBoundaryEntries(entries) {
  const result = [];
  entries.forEach((entry) => {
    result.push(entry);
    const end = Number.isFinite(entry?.windowEnd) ? entry.windowEnd : null;
    const start = Number.isFinite(entry?.windowStart) ? entry.windowStart : null;
    const hasDuration = end !== null && (start === null || end > start);
    if (!hasDuration) return;
    result.push({
      ...entry,
      id: `${entry.id}__after-end`,
      playbackSortKey: end + 0.5,
      playbackBoundary: 'after-end',
      displayLabel: `${entry.role} ends · ${entry.displayLabel || ''}`.trim(),
    });
  });
  return result;
}

export function buildPlaybackEntries(rowsInWindow, options = {}) {
  const windowStart = Number.isFinite(options?.windowStart) ? options.windowStart : null;
  const windowEnd = Number.isFinite(options?.windowEnd) ? options.windowEnd : null;
  const playbackMode = options?.playbackMode || PERIDOT_TIMELINE_PLAYBACK_MODES.CUMULATIVE;

  const clippedEntries = buildTimelineEntries(rowsInWindow, options)
    .map((entry) => ({
      ...entry,
      playbackSortKey: playbackSortKeyInsideWindow(entry, windowStart),
    }));

  const playbackEntries = playbackMode === PERIDOT_TIMELINE_PLAYBACK_MODES.CO_CURRENT
    ? coCurrentBoundaryEntries(clippedEntries)
    : clippedEntries;

  return playbackEntries
    .filter((entry) => {
      if (windowStart !== null && entry.playbackSortKey < windowStart) return false;
      if (windowEnd !== null && entry.playbackSortKey > windowEnd) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.playbackSortKey !== b.playbackSortKey) return a.playbackSortKey - b.playbackSortKey;
      const roleOrder = a.role.localeCompare(b.role);
      if (roleOrder !== 0) return roleOrder;
      const labelOrder = String(a.displayLabel || '').localeCompare(String(b.displayLabel || ''));
      if (labelOrder !== 0) return labelOrder;
      return String(a.rowId || '').localeCompare(String(b.rowId || ''));
    });
}

// Compatibility export retained while App.jsx migrates nomenclature. The
// returned collection is now assertion-level timeline entries, not bare rows.
export function buildPlaybackRows(rowsInWindow, options = {}) {
  return buildPlaybackEntries(rowsInWindow, options);
}

// Restrict an already-filtered row set to rows whose first eligible temporal
// entry has become active. Multiple active assertions for one row never
// duplicate that row in downstream visualization scope.
function entryIsActiveAtMoment(entry, momentSortKey) {
  if (!entry || !Number.isFinite(momentSortKey)) return false;
  const start = Number.isFinite(entry.windowStart) ? entry.windowStart : null;
  const end = Number.isFinite(entry.windowEnd) ? entry.windowEnd : null;
  if (start === null && end === null) return false;
  if (start === null) return momentSortKey <= end;
  if (end === null) return momentSortKey >= start;
  return start <= momentSortKey && end >= momentSortKey;
}

export function filterRowsForPlayback(baseRows, playbackEntries, playbackIndex, {
  playbackMode = PERIDOT_TIMELINE_PLAYBACK_MODES.CUMULATIVE,
} = {}) {
  if (!playbackEntries.length || playbackIndex < 0) return baseRows;

  const visibleIds = new Set();
  if (playbackMode === PERIDOT_TIMELINE_PLAYBACK_MODES.CO_CURRENT) {
    const currentMoment = playbackEntries[playbackIndex]?.playbackSortKey;
    playbackEntries.forEach((entry) => {
      if (!entryIsActiveAtMoment(entry, currentMoment)) return;
      const id = entry?.rowId ?? entry?.row?.id ?? entry?.id;
      if (id) visibleIds.add(id);
    });
  } else {
    playbackEntries
      .slice(0, playbackIndex + 1)
      .forEach((entry) => {
        const id = entry?.rowId ?? entry?.row?.id ?? entry?.id;
        if (id) visibleIds.add(id);
      });
  }

  return baseRows.filter((row) => visibleIds.has(row.id));
}

export function buildTimelineBoundaryOptions(timelineMonths, rangeStart, rangeEnd) {
  const timelineYears = [...timelineMonths];
  const startYear = timelineMonths[rangeStart] || '';
  const endYear = timelineMonths[rangeEnd] || '';

  return { timelineYears, startYear, endYear };
}

export function resolveTimelineBoundaryIndex(timelineMonths, boundary, year) {
  if (!year) return -1;
  return timelineMonths.indexOf(year);
}
