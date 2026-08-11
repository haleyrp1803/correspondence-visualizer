import {
  buildPlaybackEntries,
  buildTimelineEntries,
  buildTimelineMonths,
  filterRowsByTimelineWindow,
  filterRowsForPlayback,
  getAvailableTemporalRoles,
  getRowTemporalAssertions,
} from './timelinePlaybackHelpers.js';

function assertion({ role, start, end = start, positionable = true, consistency = 'valid', shape = 'point', display = '' }) {
  return {
    role,
    display,
    temporalShape: shape,
    consistency,
    sortBounds: { start, end },
    visualizationUsability: { timelinePositionable: positionable },
  };
}

export function runTimelinePlaybackAudit() {
  const rows = [
    {
      id: 'cardinal_1', date: '1583',
      temporalAssertions: [
        assertion({ role: 'Creation date', start: 15830101, display: '1583' }),
        assertion({ role: 'Lifespan', start: 15620101, end: 16241231, shape: 'interval', display: '1562–1624' }),
      ],
    },
    {
      id: 'cardinal_2', date: '1605',
      temporalAssertions: [assertion({ role: 'Creation date', start: 16050101, display: '1605' })],
    },
    {
      id: 'bad_range',
      temporalAssertions: [assertion({ role: 'Lifespan', start: 16200101, end: 16100101, consistency: 'backwards', shape: 'inconsistent' })],
    },
    {
      id: 'legacy_1', date: '1610/05/02',
      parsedDate: { isTimelineUsable: true, sortKey: 16100502, year: 1610, raw: '1610/05/02', label: '1610/05/02' },
    },
  ];

  const entries = buildTimelineEntries(rows);
  const roles = getAvailableTemporalRoles(rows);
  const months = buildTimelineMonths(rows);
  const windowRows = filterRowsByTimelineWindow(rows, 'range', months, months.indexOf('1605'), months.indexOf('1610'));
  const creationOnlyWindowRows = filterRowsByTimelineWindow(
    rows, 'range', months, months.indexOf('1605'), months.indexOf('1610'),
    { enabledRoles: new Set(['Creation date']) },
  );
  const playback = buildPlaybackEntries(rows);
  const firstCardinalIndex = playback.findIndex((entry) => entry.rowId === 'cardinal_1');
  const visibleAtFirstCardinal = filterRowsForPlayback(rows, playback, firstCardinalIndex);

  const checks = {
    canonicalAssertionsPreferred: getRowTemporalAssertions(rows[0]).length === 2,
    legacyFallbackAvailable: getRowTemporalAssertions(rows[3]).length === 1 && getRowTemporalAssertions(rows[3])[0].__legacyProjection === true,
    multipleEntriesPerRow: entries.filter((entry) => entry.rowId === 'cardinal_1').length === 2,
    rolesDerived: roles.includes('Creation date') && roles.includes('Lifespan') && roles.includes('Date'),
    intervalBoundariesIncluded: months.includes('1562') && months.includes('1624'),
    inconsistentExcluded: !entries.some((entry) => entry.rowId === 'bad_range'),
    intervalIntersection: windowRows.some((row) => row.id === 'cardinal_1'),
    roleFilterReadyForT3: !creationOnlyWindowRows.some((row) => row.id === 'cardinal_1') && creationOnlyWindowRows.some((row) => row.id === 'cardinal_2'),
    playbackOrdersLifespanAtStart: playback[0]?.rowId === 'cardinal_1' && playback[0]?.role === 'Lifespan',
    playbackVisibilityDedupesRows: visibleAtFirstCardinal.filter((row) => row.id === 'cardinal_1').length === 1,
  };

  return {
    pass: Object.values(checks).every(Boolean),
    checks,
    summary: { entries: entries.length, roles, timelineYears: months, playbackEntries: playback.length },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runTimelinePlaybackAudit();
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}
