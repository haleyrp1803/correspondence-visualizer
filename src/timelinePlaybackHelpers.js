/*
 * Pure timeline and playback helpers.
 *
 * Canonical runtime rows may carry multiple `temporalAssertions`. Timeline
 * derivation treats those assertions as the authoritative chronology and uses
 * legacy `parsedDate` only when a row has no canonical assertions (demo / old
 * compatibility paths).
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

function legacyAssertionFromRow(row) {
  const parsed = row?.parsedDate;
  if (!parsed?.isTimelineUsable || !Number.isFinite(parsed?.sortKey)) return null;
  const year = Number(parsed?.year) || yearFromSortKey(parsed.sortKey);
  if (!year) return null;
  return {
    id: `${row?.id || 'row'}__legacy-date`,
    role: DEFAULT_TEMPORAL_ROLE,
    sourceText: row?.date || parsed?.raw || '',
    display: row?.date || parsed?.label || parsed?.raw || String(year),
    temporalShape: 'point',
    consistency: 'valid',
    sortBounds: { start: parsed.sortKey, end: parsed.sortKey },
    visualizationUsability: {
      hasKnownYear: true,
      timelinePositionable: true,
      intervalSafe: false,
      yearFilterUsable: true,
    },
    __legacyProjection: true,
  };
}

export function getRowTemporalAssertions(row) {
  const canonical = asArray(row?.temporalAssertions).filter(Boolean);
  if (canonical.length) return canonical;
  const legacy = legacyAssertionFromRow(row);
  return legacy ? [legacy] : [];
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
  const canonical = asArray(row?.temporalAssertions).filter(Boolean);
  const assertions = canonical.length ? canonical : getRowTemporalAssertions(row);
  const positionableAssertions = assertions.filter(isAssertionChronologicallyUsable);
  const legacyEvidence = [row?.date, row?.displayDate, row?.dateDisplay, row?.Date, row?.['Date*']]
    .some((value) => String(value ?? '').trim());
  return {
    hasTemporalEvidence: canonical.length > 0 || legacyEvidence || Boolean(row?.parsedDate?.isKnown),
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
  const assertions = asArray(row?.temporalAssertions).length
    ? asArray(row.temporalAssertions)
    : getRowTemporalAssertions(row);
  assertions.forEach((assertion) => {
    const { start, end } = assertionWindowBounds(assertion);
    addYear(start);
    addYear(end);
  });
  if (!years.length && Number(row?.parsedDate?.year) > 0) years.push(String(row.parsedDate.year));
  return years;
}

export function getRowTemporalSearchValues(row) {
  const values = [];
  const add = (value) => {
    const text = String(value ?? '').trim();
    if (text && !values.includes(text)) values.push(text);
  };

  const assertions = asArray(row?.temporalAssertions).length
    ? asArray(row.temporalAssertions)
    : getRowTemporalAssertions(row);

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

  [row?.displayDate, row?.date, row?.Date, row?.['Date*'], row?.dateDisplay, row?.dateLabel, row?.parsedDate?.year, row?.parsedDate?.monthKey]
    .forEach(add);
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
