export function buildTimelineMonths(rows) {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.parsedDate?.isTimelineUsable)
        .map((row) => row.parsedDate.monthKey)
        .filter(Boolean)
    )
  ).sort();
}

export function filterRowsByTimelineWindow(rows, timelineMode, timelineMonths, rangeStart, rangeEnd) {
  if (timelineMode === 'all' || !timelineMonths.length) return rows;

  const startIndex = Math.min(rangeStart, rangeEnd);
  const endIndex = Math.max(rangeStart, rangeEnd);
  const startKey = timelineMonths[startIndex];
  const endKey = timelineMonths[endIndex];

  return rows.filter((row) => {
    if (!row.parsedDate?.isTimelineUsable || !row.parsedDate.monthKey) return false;
    return row.parsedDate.monthKey >= startKey && row.parsedDate.monthKey <= endKey;
  });
}

export function buildPlaybackRows(rowsInWindow) {
  return rowsInWindow
    .filter((row) => row.parsedDate?.isTimelineUsable)
    .slice()
    .sort((a, b) => {
      const aSort = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      const bSort = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
      return a.date.localeCompare(b.date);
    });
}

export function filterRowsForPlayback(baseRows, playbackRows, playbackIndex) {
  if (!playbackRows.length || playbackIndex < 0) return baseRows;
  const visibleIds = new Set(playbackRows.slice(0, playbackIndex + 1).map((row) => row.id));
  return baseRows.filter((row) => visibleIds.has(row.id));
}

export function buildTimelineBoundaryOptions(timelineMonths, rangeStart, rangeEnd) {
  const timelineYears = Array.from(new Set(timelineMonths.map((monthKey) => monthKey.split('-')[0]))).sort();
  const startMonthKey = timelineMonths[rangeStart] || '';
  const endMonthKey = timelineMonths[rangeEnd] || '';
  const startYear = startMonthKey ? startMonthKey.split('-')[0] : '';
  const startMonth = startMonthKey ? startMonthKey.split('-')[1] : '';
  const endYear = endMonthKey ? endMonthKey.split('-')[0] : '';
  const endMonth = endMonthKey ? endMonthKey.split('-')[1] : '';
  const startMonthsForYear = timelineMonths.filter((monthKey) => monthKey.startsWith(`${startYear}-`));
  const endMonthsForYear = timelineMonths.filter((monthKey) => monthKey.startsWith(`${endYear}-`));

  return {
    timelineYears,
    startYear,
    startMonth,
    endYear,
    endMonth,
    startMonthsForYear,
    endMonthsForYear,
  };
}

export function resolveTimelineBoundaryIndex(timelineMonths, boundary, year, month) {
  const matchingMonths = timelineMonths.filter((monthKey) => monthKey.startsWith(`${year}-`));
  if (!matchingMonths.length) return -1;

  const fallbackMonthKey = boundary === 'start'
    ? matchingMonths[0]
    : matchingMonths[matchingMonths.length - 1];
  const targetMonthKey = `${year}-${month}`;
  const resolvedMonthKey = timelineMonths.includes(targetMonthKey)
    ? targetMonthKey
    : fallbackMonthKey;

  return timelineMonths.indexOf(resolvedMonthKey);
}
