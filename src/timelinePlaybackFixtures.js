import {
  buildPlaybackEntries,
  buildTimelineEntries,
  buildTimelineMonths,
  filterRowsByTimelineWindow,
  filterRowsForPlayback,
  getTimelineRangeSortBounds,
  PERIDOT_TIMELINE_PLAYBACK_MODES,
  getAvailableTemporalRoles,
  getRowPrimaryTemporalAssertion,
  getRowTemporalAssertions,
  getRowTemporalDateParts,
  getRowTemporalSortKey,
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
      id: 'short_life',
      temporalAssertions: [assertion({ role: 'Lifespan', start: 15900101, end: 16061231, shape: 'interval', display: '1590–1606' })],
    },
    {
      id: 'canonical_date_1610', date: '1610/05/02',
      temporalAssertions: [assertion({ role: 'Date', start: 16100502, display: '1610/05/02' })],
    },
    { id: 'raw_date_without_assertion', date: '1611/05/02' },
  ];

  const participantAndRecordRow = {
    id: 'mixed_subject_time',
    temporalAssertions: [
      { ...assertion({ role: 'Participant lifespan', start: 15000101, end: 15801231, shape: 'interval', display: '1500–1580' }), subjectParticipantIndex: 0, start: { year: 1500, month: null, day: null } },
      { ...assertion({ role: 'Record date', start: 16050304, display: '1605/03/04' }), subjectParticipantIndex: null, start: { year: 1605, month: 3, day: 4 } },
    ],
  };

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
  const rangeBounds = getTimelineRangeSortBounds(months, months.indexOf('1605'), months.indexOf('1610'));
  const cumulativePlaybackInRange = buildPlaybackEntries(windowRows, {
    windowStart: rangeBounds?.start,
    windowEnd: rangeBounds?.end,
    playbackMode: PERIDOT_TIMELINE_PLAYBACK_MODES.CUMULATIVE,
  });
  const coCurrentPlaybackInRange = buildPlaybackEntries(windowRows, {
    windowStart: rangeBounds?.start,
    windowEnd: rangeBounds?.end,
    playbackMode: PERIDOT_TIMELINE_PLAYBACK_MODES.CO_CURRENT,
  });
  const firstRangeMoment = cumulativePlaybackInRange[0]?.playbackSortKey;
  const lastCoCurrentIndex = coCurrentPlaybackInRange.length - 1;
  const lastCumulativeIndex = cumulativePlaybackInRange.length - 1;
  const coCurrentAtLastMoment = filterRowsForPlayback(windowRows, coCurrentPlaybackInRange, lastCoCurrentIndex, {
    playbackMode: PERIDOT_TIMELINE_PLAYBACK_MODES.CO_CURRENT,
  });
  const cumulativeAtLastMoment = filterRowsForPlayback(windowRows, cumulativePlaybackInRange, lastCumulativeIndex, {
    playbackMode: PERIDOT_TIMELINE_PLAYBACK_MODES.CUMULATIVE,
  });
  const hasAfterEndCheckpoint = coCurrentPlaybackInRange.some((entry) => entry.rowId === 'short_life' && entry.playbackBoundary === 'after-end');

  const checks = {
    canonicalAssertionsPreferred: getRowTemporalAssertions(rows[0]).length === 2,
    legacyParsedDateFallbackRetired: getRowTemporalAssertions(rows[5]).length === 0,
    rowLevelAssertionPreferredForConsumers: getRowPrimaryTemporalAssertion(participantAndRecordRow)?.role === 'Record date',
    canonicalConsumerSortKey: getRowTemporalSortKey(participantAndRecordRow) === 16050304,
    canonicalConsumerDateParts: getRowTemporalDateParts(participantAndRecordRow)?.year === 1605
      && getRowTemporalDateParts(participantAndRecordRow)?.month === 3
      && getRowTemporalDateParts(participantAndRecordRow)?.day === 4,
    multipleEntriesPerRow: entries.filter((entry) => entry.rowId === 'cardinal_1').length === 2,
    rolesDerived: roles.includes('Creation date') && roles.includes('Lifespan') && roles.includes('Date'),
    intervalBoundariesIncluded: months.includes('1562') && months.includes('1624'),
    inconsistentExcluded: !entries.some((entry) => entry.rowId === 'bad_range'),
    intervalIntersection: windowRows.some((row) => row.id === 'cardinal_1'),
    roleFilterReadyForT3: !creationOnlyWindowRows.some((row) => row.id === 'cardinal_1') && creationOnlyWindowRows.some((row) => row.id === 'cardinal_2'),
    playbackOrdersLifespanAtStart: playback[0]?.rowId === 'cardinal_1' && playback[0]?.role === 'Lifespan',
    playbackVisibilityDedupesRows: visibleAtFirstCardinal.filter((row) => row.id === 'cardinal_1').length === 1,
    selectedRangeClipsAlreadyActiveIntervals: firstRangeMoment === rangeBounds?.start,
    cumulativeModeRetainsEndedIntervals: cumulativeAtLastMoment.some((row) => row.id === 'short_life'),
    coCurrentModeRemovesEndedIntervals: !coCurrentAtLastMoment.some((row) => row.id === 'short_life'),
    coCurrentModeKeepsActiveIntervals: coCurrentAtLastMoment.some((row) => row.id === 'cardinal_1'),
    coCurrentPointIsMomentBounded: !coCurrentAtLastMoment.some((row) => row.id === 'cardinal_2'),
    coCurrentAddsPeriodEndCheckpoints: hasAfterEndCheckpoint,
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
