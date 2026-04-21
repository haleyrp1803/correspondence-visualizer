import React from 'react';
import {
  buildTimelineBoundaryOptions,
  resolveTimelineBoundaryIndex,
} from './timelinePlaybackHelpers';

export function TimelinePanelContent({
  showTimelinePanel,
  setShowTimelinePanel,
  currentRangeLabel,
  timelineMonths,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  currentPlaybackLabel,
  currentPlaybackSpeedLabel,
  playbackSpeedOptions,
  playbackSpeed,
  setPlaybackSpeed,
  isPlaying,
  setIsPlaying,
  playbackIndex,
  setPlaybackIndex,
  selectedRowsForPlayback,
  timelineMode,
  setTimelineMode,
  CollapsiblePanelSection,
  StepSlider,
  buttonClassName,
}) {
  const {
    timelineYears,
    startYear,
    startMonth,
    endYear,
    endMonth,
    startMonthsForYear,
    endMonthsForYear,
  } = buildTimelineBoundaryOptions(timelineMonths, rangeStart, rangeEnd);

  const constrainedEndYears = timelineYears.filter((year) => {
    if (!startYear) return true;
    return Number(year) >= Number(startYear);
  });

  const constrainedEndMonthsForYear =
    startYear && endYear === startYear
      ? endMonthsForYear.filter((monthKey) => {
          const month = monthKey.split('-')[1];
          return month >= (startMonth || '01');
        })
      : endMonthsForYear;

  const setTimelineBoundaryFromParts = (boundary, year, month) => {
    const resolvedIndex = resolveTimelineBoundaryIndex(
      timelineMonths,
      boundary,
      year,
      month
    );
    if (resolvedIndex < 0) return;

    setTimelineMode('range');

    if (boundary === 'start') {
      setRangeStart(resolvedIndex);
      if (resolvedIndex > rangeEnd) {
        setRangeEnd(resolvedIndex);
      }
      return;
    }

    const nextEndIndex = Math.max(resolvedIndex, rangeStart);
    setRangeEnd(nextEndIndex);
  };

  return (
    <CollapsiblePanelSection
      title="Timeline"
      open={showTimelinePanel}
      onToggle={() => setShowTimelinePanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-3">
        <div className="text-sm text-[var(--muted-text)]">
          Current window: {currentRangeLabel}
        </div>

        <div className="text-sm text-[var(--muted-text)]">
          Available month buckets:{' '}
          {timelineMonths.length
            ? `${timelineMonths[0]} to ${timelineMonths[timelineMonths.length - 1]}`
            : 'none detected'}
        </div>

        {timelineMonths.length ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-text)]">
                Start year
              </div>
              <select
                value={startYear || ''}
                onChange={(e) =>
                  setTimelineBoundaryFromParts(
                    'start',
                    e.target.value,
                    startMonth || '01'
                  )
                }
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {timelineYears.map((year) => (
                  <option key={`start-year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-text)]">
                Start month
              </div>
              <select
                value={startMonth || ''}
                onChange={(e) =>
                  setTimelineBoundaryFromParts('start', startYear, e.target.value)
                }
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {startMonthsForYear.map((monthKey) => {
                  const month = monthKey.split('-')[1];
                  return (
                    <option key={`start-month-${monthKey}`} value={month}>
                      {month}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-text)]">
                End year
              </div>
              <select
                value={endYear || ''}
                onChange={(e) =>
                  setTimelineBoundaryFromParts(
                    'end',
                    e.target.value,
                    endMonth || '12'
                  )
                }
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {constrainedEndYears.map((year) => (
                  <option key={`end-year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-text)]">
                End month
              </div>
              <select
                value={endMonth || ''}
                onChange={(e) =>
                  setTimelineBoundaryFromParts('end', endYear, e.target.value)
                }
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {constrainedEndMonthsForYear.map((monthKey) => {
                  const month = monthKey.split('-')[1];
                  return (
                    <option key={`end-month-${monthKey}`} value={month}>
                      {month}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--panel-bg)]/60 p-3">
          <div className="text-sm text-[var(--muted-text)]">
            Current animated letter date: {currentPlaybackLabel}
          </div>

          <div className="mt-2 text-sm text-[var(--muted-text)]">
            Playback speed: {currentPlaybackSpeedLabel}
          </div>

          <div className="mt-3">
            <StepSlider
              options={playbackSpeedOptions}
              value={playbackSpeed}
              onChange={setPlaybackSpeed}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedRowsForPlayback.length) return;
                setPlaybackIndex((current) => (current < 0 ? 0 : current));
                setIsPlaying(true);
              }}
              aria-label="Play animation"
              title="Play animation"
              className={buttonClassName({ active: isPlaying })}
            >
              ▶
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              aria-label="Pause animation"
              title="Pause animation"
              className={buttonClassName({
                active: !isPlaying && playbackIndex >= 0,
              })}
            >
              ❚❚
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIndex(-1);
              }}
              className={buttonClassName()}
            >
              Reset animation
            </button>
          </div>
        </div>
      </div>
    </CollapsiblePanelSection>
  );
}
