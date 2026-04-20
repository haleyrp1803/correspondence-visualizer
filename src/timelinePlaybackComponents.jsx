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

  const setTimelineBoundaryFromParts = (boundary, year, month) => {
    const resolvedIndex = resolveTimelineBoundaryIndex(timelineMonths, boundary, year, month);
    if (resolvedIndex < 0) return;
    setTimelineMode('range');
    if (boundary === 'start') setRangeStart(resolvedIndex);
    if (boundary === 'end') setRangeEnd(resolvedIndex);
  };

  return (
    <CollapsiblePanelSection
      title="Timeline"
      open={showTimelinePanel}
      onToggle={() => setShowTimelinePanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-3 text-[14px] leading-6 text-[var(--panel-card-muted-text)]">
        <div>Current window: {currentRangeLabel}</div>
        <div>
          Available month buckets:{' '}
          {timelineMonths.length ? `${timelineMonths[0]} to ${timelineMonths[timelineMonths.length - 1]}` : 'none detected'}
        </div>

        {timelineMonths.length ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium">Start year</label>
              <select
                value={startYear}
                onChange={(e) => setTimelineBoundaryFromParts('start', e.target.value, startMonth || '01')}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {timelineYears.map((year) => (
                  <option key={`start-year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">Start month</label>
              <select
                value={startMonth}
                onChange={(e) => setTimelineBoundaryFromParts('start', startYear, e.target.value)}
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

            <div>
              <label className="mb-1 block font-medium">End year</label>
              <select
                value={endYear}
                onChange={(e) => setTimelineBoundaryFromParts('end', e.target.value, endMonth || '12')}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {timelineYears.map((year) => (
                  <option key={`end-year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">End month</label>
              <select
                value={endMonth}
                onChange={(e) => setTimelineBoundaryFromParts('end', endYear, e.target.value)}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {endMonthsForYear.map((monthKey) => {
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

        <div>Current animated letter date: {currentPlaybackLabel}</div>

        <div>
          <label className="mb-1 block font-medium">Playback speed: {currentPlaybackSpeedLabel}</label>
          <StepSlider
            options={playbackSpeedOptions}
            value={playbackSpeed}
            onChange={setPlaybackSpeed}
            ariaLabelPrefix="Set playback speed to"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
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
            onClick={() => setIsPlaying(false)}
            aria-label="Pause animation"
            title="Pause animation"
            className={buttonClassName({ active: !isPlaying && playbackIndex >= 0 })}
          >
            ❚❚
          </button>

          <button
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
    </CollapsiblePanelSection>
  );
}
