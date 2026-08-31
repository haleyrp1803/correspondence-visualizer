/*
 * Timeline UI components.
 *
 * This module renders both the older Timeline panel content and the current bottom Visualizations timeline scrubber. The scrubber provides dual-handle year range control, playback controls, speed selection, and playback-position scrubbing.
 *
 * Important relationships:
 * - `App.jsx` owns timeline state and filtered rows.
 * - `PeridotVisualizationsWorkspace.jsx` places the scrubber below the visualization stage.
 * - `timelinePlaybackHelpers.js` contains pure date/window derivation.
 *
 * Maintenance cautions:
 * - Timeline must respect the active Search & Filter date scope. Test Apply/Clear Filters, range dragging, playback, and reset together.
 *
 * State-flow contract:
 * - This file renders controls only; it does not own the canonical timeline
 *   state. `App.jsx` owns `timelineMode`, `rangeStart`, `rangeEnd`,
 *   `playbackIndex`, `isPlaying`, and `playbackSpeed`.
 * - The bottom scrubber changes the global visualization scope. It is not an
 *   Analytics-only chart range and should not be wired directly to chart-local
 *   state in `AnalyticsPanel.jsx`.
 * - `onResetTimeline` should restore both the selected range and playback
 *   progress because downstream graph/export rows depend on the resulting
 *   visible row scope.
 * - Range-thumb movement uses local preview state while the researcher is
 *   interacting. Canonical range state is committed only when the interaction
 *   finishes so expensive visualization derivations do not fight the pointer.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  buildTimelineBoundaryOptions,
  resolveTimelineBoundaryIndex,
} from './timelinePlaybackHelpers';

export function TimelineDateRangeControls({
  currentRangeLabel,
  timelineMonths,
  draftStartYear,
  setDraftStartYear,
  draftEndYear,
  setDraftEndYear,
}) {
  const {
    timelineYears,
  } = buildTimelineBoundaryOptions(
    timelineMonths,
    0,
    Math.max(timelineMonths.length - 1, 0)
  );
  const constrainedEndYears = timelineYears.filter((year) => {
    if (!draftStartYear) return true;
    return Number(year) >= Number(draftStartYear);
  });

  const handleStartYearChange = (nextStartYear) => {
    setDraftStartYear(nextStartYear);

    if (draftEndYear && Number(nextStartYear) > Number(draftEndYear)) {
      setDraftEndYear(nextStartYear);
    }
  };
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--muted-text)]">
        Current applied window: {currentRangeLabel}
      </div>

      <div className="text-sm text-[var(--muted-text)]">
        Available year range:{' '}
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
              value={draftStartYear || ''}
              onChange={(event) => handleStartYearChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
            >
              {timelineYears.map((year) => (
                <option key={`start-year-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-text)]">
              End year
            </div>
            <select
              value={draftEndYear || ''}
              onChange={(event) => setDraftEndYear(event.target.value)}
              className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
            >
              {constrainedEndYears.map((year) => (
                <option key={`end-year-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
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
        <div className="text-xs text-[var(--muted-text)]">
          Date range controls now live in Search & Filter. Timeline controls remain here for playback.
        </div>

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
              Play
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
              Pause
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
export function VisualizationTimelineScrubber({
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
  availableTemporalRoles = [],
  enabledTemporalRoles = [],
  setEnabledTemporalRoles,
  timelinePlaybackMode = 'cumulative',
  setTimelinePlaybackMode,
}) {
  const hasTimeline = Boolean(timelineMonths?.length);
  const lastTimelineIndex = Math.max((timelineMonths?.length || 1) - 1, 0);
  const committedStart = Math.min(rangeStart, rangeEnd);
  const committedEnd = Math.max(rangeStart, rangeEnd);
  const [previewRange, setPreviewRange] = useState(() => ({
    start: committedStart,
    end: committedEnd,
  }));
  const [isAdjustingRange, setIsAdjustingRange] = useState(false);
  const previewRangeRef = useRef(previewRange);
  const rangeInteractionRef = useRef(false);

  useEffect(() => {
    previewRangeRef.current = previewRange;
  }, [previewRange]);

  useEffect(() => {
    if (isAdjustingRange) return;
    const nextPreview = {
      start: Math.min(committedStart, lastTimelineIndex),
      end: Math.min(committedEnd, lastTimelineIndex),
    };
    previewRangeRef.current = nextPreview;
    setPreviewRange(nextPreview);
  }, [committedStart, committedEnd, lastTimelineIndex, isAdjustingRange]);

  const previewStart = Math.min(previewRange.start, previewRange.end);
  const previewEnd = Math.max(previewRange.start, previewRange.end);
  const startLabel = hasTimeline ? timelineMonths[previewStart] : '—';
  const endLabel = hasTimeline ? timelineMonths[previewEnd] : '—';
  const playbackLastIndex = Math.max((selectedRowsForPlayback?.length || 1) - 1, 0);
  const visiblePlaybackIndex = Math.max(0, playbackIndex);
  const playbackProgress = selectedRowsForPlayback?.length
    ? Math.round(((visiblePlaybackIndex + 1) / selectedRowsForPlayback.length) * 100)
    : 0;
  const startPercent = lastTimelineIndex ? (previewStart / lastTimelineIndex) * 100 : 0;
  const endPercent = lastTimelineIndex ? (previewEnd / lastTimelineIndex) * 100 : 100;
  const stopPlayback = () => {
    setIsPlaying(false);
    setPlaybackIndex(-1);
  };

  const beginRangeInteraction = () => {
    rangeInteractionRef.current = true;
    setIsAdjustingRange(true);
    // Pause an active animation immediately, but leave the visible playback
    // position intact until the new range is committed on release.
    setIsPlaying(false);
  };

  const beginKeyboardRangeInteraction = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
    beginRangeInteraction();
  };

  const commitKeyboardRangeInteraction = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
    commitPreviewRange();
  };

  const previewStartChange = (value) => {
    const nextStart = Math.min(Number(value), previewRangeRef.current.end);
    const nextPreview = {
      ...previewRangeRef.current,
      start: nextStart,
    };
    previewRangeRef.current = nextPreview;
    setPreviewRange(nextPreview);
    setIsAdjustingRange(true);
  };

  const previewEndChange = (value) => {
    const nextEnd = Math.max(Number(value), previewRangeRef.current.start);
    const nextPreview = {
      ...previewRangeRef.current,
      end: nextEnd,
    };
    previewRangeRef.current = nextPreview;
    setPreviewRange(nextPreview);
    setIsAdjustingRange(true);
  };

  function commitPreviewRange() {
    if (!rangeInteractionRef.current) return;
    const nextStart = Math.min(previewRangeRef.current.start, previewRangeRef.current.end);
    const nextEnd = Math.max(previewRangeRef.current.start, previewRangeRef.current.end);
    rangeInteractionRef.current = false;
    setIsAdjustingRange(false);
    setTimelineMode('range');
    setRangeStart(nextStart);
    setRangeEnd(nextEnd);
    stopPlayback();
  }

  const resetTimeline = () => {
    const nextPreview = { start: 0, end: lastTimelineIndex };
    previewRangeRef.current = nextPreview;
    setPreviewRange(nextPreview);
    rangeInteractionRef.current = false;
    setIsAdjustingRange(false);
    setTimelineMode('range');
    setRangeStart(0);
    setRangeEnd(lastTimelineIndex);
    stopPlayback();
  };

  const playTimeline = () => {
    if (!selectedRowsForPlayback?.length) return;
    setPlaybackIndex((current) => (current < 0 ? 0 : current));
    setIsPlaying(true);
  };
  const statusLabel = isPlaying ? 'Playing' : playbackIndex >= 0 ? 'Paused' : 'Ready';
  const enabledRoleSet = new Set(enabledTemporalRoles || []);
  const hasTemporalRoles = availableTemporalRoles.length > 0;
  const toggleTemporalRole = (role) => {
    if (!setEnabledTemporalRoles) return;
    setEnabledTemporalRoles((currentRoles) => {
      const nextRoles = new Set(currentRoles || []);
      if (nextRoles.has(role)) nextRoles.delete(role);
      else nextRoles.add(role);
      return availableTemporalRoles.filter((candidate) => nextRoles.has(candidate));
    });
    stopPlayback();
  };
  const enableAllTemporalRoles = () => {
    if (!setEnabledTemporalRoles) return;
    setEnabledTemporalRoles([...availableTemporalRoles]);
    stopPlayback();
  };
  return (
    <div className="shrink-0 rounded-[24px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[linear-gradient(135deg,var(--peridot-color-rgba-rgba-8-39-25-0-96),var(--peridot-color-rgba-rgba-5-29-19-0-98))] px-4 py-3 text-[var(--peridot-color-hex-fbf7ea)] shadow-[0_14px_34px_var(--peridot-color-rgba-rgba-0-0-0-0-28)]">
      <style>{`
        .peridot-dual-range input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 40px;
          pointer-events: none;
          position: absolute;
          inset: 0;
          touch-action: pan-y;
          width: 100%;
        }
        .peridot-dual-range input[type='range']::-webkit-slider-runnable-track {
          background: transparent;
          height: 4px;
        }
        .peridot-dual-range input[type='range']::-moz-range-track {
          background: transparent;
          height: 4px;
        }
        .peridot-dual-range input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: var(--peridot-color-hex-d6a36a);
          border: 2px solid var(--peridot-color-hex-fff8e8);
          border-radius: 9999px;
          box-shadow: 0 4px 12px var(--peridot-color-rgba-rgba-0-0-0-0-32);
          cursor: grab;
          height: 22px;
          margin-top: -9px;
          pointer-events: auto;
          width: 22px;
        }
        .peridot-dual-range input[type='range']::-moz-range-thumb {
          background: var(--peridot-color-hex-d6a36a);
          border: 2px solid var(--peridot-color-hex-fff8e8);
          border-radius: 9999px;
          box-shadow: 0 4px 12px var(--peridot-color-rgba-rgba-0-0-0-0-32);
          cursor: grab;
          height: 22px;
          pointer-events: auto;
          width: 22px;
        }
        .peridot-dual-range input[type='range']:active::-webkit-slider-thumb {
          cursor: grabbing;
        }
        .peridot-dual-range input[type='range']:active::-moz-range-thumb {
          cursor: grabbing;
        }
      `}</style>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--peridot-color-hex-dfe9c8-a20)] pb-3">
        {hasTemporalRoles ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--peridot-color-hex-dfe9c8)]">Time types</span>
            {availableTemporalRoles.map((role) => {
              const enabled = enabledRoleSet.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={enabled}
                  onClick={() => toggleTemporalRole(role)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    enabled
                      ? 'border-[var(--peridot-color-hex-d6a36a)] bg-[var(--peridot-color-hex-edf4df)] text-[var(--peridot-color-hex-203429)]'
                      : 'border-[var(--peridot-color-hex-dfe9c8-a35)] bg-[var(--peridot-color-hex-102c20)] text-[var(--peridot-color-hex-c8d7bd)] hover:bg-[var(--peridot-color-hex-214332)]',
                  ].join(' ')}
                >
                  <span aria-hidden="true" className="mr-1.5">{enabled ? '✓' : '○'}</span>
                  {role}
                </button>
              );
            })}
            {enabledTemporalRoles.length !== availableTemporalRoles.length ? (
              <button
                type="button"
                onClick={enableAllTemporalRoles}
                className="ml-1 text-xs font-semibold text-[var(--peridot-color-hex-d6a36a)] underline underline-offset-4 hover:text-[var(--peridot-color-hex-f5ecd2)]"
              >
                Select all
              </button>
            ) : null}
            {!enabledTemporalRoles.length ? (
              <span className="text-[11px] text-[var(--peridot-color-hex-c8d7bd)]">No time types selected; Timeline filtering and playback are paused.</span>
            ) : null}
          </div>
        ) : <div />}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--peridot-color-hex-dfe9c8)]">Event mode</span>
          <button
            type="button"
            aria-pressed={timelinePlaybackMode === 'cumulative'}
            title="Shows events and records once their date or period has begun or occurred, and keeps them visible as playback advances."
            onClick={() => {
              if (!setTimelinePlaybackMode) return;
              setTimelinePlaybackMode('cumulative');
              stopPlayback();
            }}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              timelinePlaybackMode === 'cumulative'
                ? 'border-[var(--peridot-color-hex-d6a36a)] bg-[var(--peridot-color-hex-edf4df)] text-[var(--peridot-color-hex-203429)]'
                : 'border-[var(--peridot-color-hex-dfe9c8-a35)] bg-[var(--peridot-color-hex-102c20)] text-[var(--peridot-color-hex-c8d7bd)] hover:bg-[var(--peridot-color-hex-214332)]',
            ].join(' ')}
          >
            Cumulative Events
          </button>
          <button
            type="button"
            aria-pressed={timelinePlaybackMode === 'co-current'}
            title="Shows only events and records whose date or period is active at the current point in time; records with periods disappear when those periods end."
            onClick={() => {
              if (!setTimelinePlaybackMode) return;
              setTimelinePlaybackMode('co-current');
              stopPlayback();
            }}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              timelinePlaybackMode === 'co-current'
                ? 'border-[var(--peridot-color-hex-d6a36a)] bg-[var(--peridot-color-hex-edf4df)] text-[var(--peridot-color-hex-203429)]'
                : 'border-[var(--peridot-color-hex-dfe9c8-a35)] bg-[var(--peridot-color-hex-102c20)] text-[var(--peridot-color-hex-c8d7bd)] hover:bg-[var(--peridot-color-hex-214332)]',
            ].join(' ')}
          >
            Co-current Events
          </button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[170px_minmax(260px,1fr)_minmax(410px,520px)] xl:items-center">
        <div className="min-w-0">
          <p className="peridot-kicker !mb-0 text-[10px] text-[var(--peridot-color-hex-dfe9c8)]">Timeline</p>
          <div className="mt-1 text-sm font-semibold text-[var(--peridot-color-hex-f5ecd2)]">
            {timelineMode === 'all' && !isAdjustingRange ? 'All dates' : `${startLabel}–${endLabel}`}
          </div>
          <div className="mt-1 text-[11px] text-[var(--peridot-color-hex-c8d7bd)]">
            {isAdjustingRange ? 'Previewing • release to apply' : `Applied: ${currentRangeLabel}`}
          </div>
        </div>
        {hasTimeline ? (
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--peridot-color-hex-dfe9c8)]">
              <span>{startLabel}</span>
              <span>{endLabel}</span>
            </div>
            <div className="peridot-dual-range relative h-10">
              <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--peridot-color-hex-dfe9c8-a25)]" />
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--peridot-color-hex-d6a36a)]"
                style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
              />
              <input
                type="range"
                min="0"
                max={lastTimelineIndex}
                value={previewStart}
                onPointerDown={beginRangeInteraction}
                onChange={(event) => previewStartChange(event.target.value)}
                onPointerUp={commitPreviewRange}
                onPointerCancel={commitPreviewRange}
                onKeyDown={beginKeyboardRangeInteraction}
                onKeyUp={commitKeyboardRangeInteraction}
                onBlur={commitPreviewRange}
                aria-label="Timeline start year"
                aria-valuetext={startLabel}
              />
              <input
                type="range"
                min="0"
                max={lastTimelineIndex}
                value={previewEnd}
                onPointerDown={beginRangeInteraction}
                onChange={(event) => previewEndChange(event.target.value)}
                onPointerUp={commitPreviewRange}
                onPointerCancel={commitPreviewRange}
                onKeyDown={beginKeyboardRangeInteraction}
                onKeyUp={commitKeyboardRangeInteraction}
                onBlur={commitPreviewRange}
                aria-label="Timeline end year"
                aria-valuetext={endLabel}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--peridot-color-hex-dfe9c8-a25)] bg-[var(--peridot-color-hex-dfe9c8-a10)] px-3 py-2 text-sm text-[var(--peridot-color-hex-dfe9c8)]">
            No usable dates are available for timeline playback.
          </div>
        )}
        <div className="grid gap-2 lg:grid-cols-[auto_150px_minmax(120px,1fr)] lg:items-center xl:justify-end">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={playTimeline}
              disabled={!selectedRowsForPlayback?.length}
              className="rounded-full border border-[var(--peridot-color-hex-dfe9c8-a40)] bg-[var(--peridot-color-hex-edf4df)] px-3 py-1.5 text-xs font-bold text-[var(--peridot-color-hex-203429)] transition hover:bg-[var(--peridot-color-hex-d6a36a)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="rounded-full border border-[var(--peridot-color-hex-dfe9c8-a40)] bg-[var(--peridot-color-hex-102c20)] px-3 py-1.5 text-xs font-bold text-[var(--peridot-color-hex-f5ecd2)] transition hover:bg-[var(--peridot-color-hex-214332)]"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={resetTimeline}
              className="rounded-full border border-[var(--peridot-color-hex-dfe9c8-a40)] bg-[var(--peridot-color-hex-102c20)] px-3 py-1.5 text-xs font-bold text-[var(--peridot-color-hex-f5ecd2)] transition hover:bg-[var(--peridot-color-hex-214332)]"
            >
              Reset
            </button>
          </div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--peridot-color-hex-dfe9c8)]">
            Speed
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--peridot-color-hex-dfe9c8-a35)] bg-[var(--peridot-color-hex-fbf8f1)] px-2 py-1.5 text-xs text-[var(--peridot-color-hex-203429)]"
            >
              {playbackSpeedOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--peridot-color-hex-dfe9c8)]">
            Playback
            <input
              type="range"
              min="0"
              max={playbackLastIndex}
              value={visiblePlaybackIndex}
              disabled={!selectedRowsForPlayback?.length}
              onChange={(event) => {
                setIsPlaying(false);
                setPlaybackIndex(Number(event.target.value));
              }}
              className="mt-1 w-full accent-[var(--peridot-color-hex-d6a36a)] disabled:opacity-50"
            />
            <span className="mt-0.5 block normal-case tracking-normal text-[var(--peridot-color-hex-f5ecd2)]">
              {statusLabel} • {currentPlaybackSpeedLabel} • {playbackProgress}%
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
