/*
 * Explore-direct routing pass.
 *
 * Main visualization workspace.
 * 
 * This component coordinates the visualization header, visualization-category menus, map/network/chart stage, capability-unavailable states, header Export menu, collapsible header, and bottom Timeline scrubber.
 * 
 * Important relationships:
 * - `App.jsx` owns the current data, selected visualization, map stage, export handlers, and timeline state passed here.
 * - `AnalyticsPanel.jsx` owns chart controls/rendering but registers chart export with the shared header export menu.
 * - `timelinePlaybackComponents.jsx` renders the bottom scrubber used here.
 * 
 * Maintenance cautions:
 * - This is now a key workspace-coordination file. Keep behavior changes narrow and test maps, networks, charts, timeline, and export after edits.
 * - Header Export should be the single export surface for visualization contexts.
 *
 * Scope contract:
 * - This component does not derive the visible dataset. It receives already-
 *   scoped graph/map/chart props from `App.jsx`.
 * - The bottom timeline scrubber changes global App state; those changes flow
 *   back through graph derivation before this workspace renders the next view.
 * - Header Export should export the same scoped visualization state that is
 *   currently rendered. Do not point export actions at raw uploaded rows unless
 *   adding a separate, explicitly labeled full-dataset export.
 * - Chart export is registered by `AnalyticsPanel.jsx`; map/network export is
 *   passed from App. The header menu switches between those contexts.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AnalyticsPanelContent } from './AnalyticsPanel.jsx';
import { VisualizationTimelineScrubber } from './timelinePlaybackComponents.jsx';
import { ANALYTICS_CHART_DEFINITIONS } from './analyticsConfig.js';

const VISUALIZATION_TOOLS = Object.freeze({
  LOCATION_MAP: 'location-map',
  ENTITY_NETWORK: 'entity-network',
  FORCE_NETWORK: 'force-network',
  CHART_WORKSPACE: 'chart-workspace',
  CAPABILITY_SUMMARY: 'capability-summary',
});

/*
 * Chart menu bridge
 * -----------------
 * Visualizations exposes each Analytics chart as a top-header menu item, while
 * `AnalyticsPanel.jsx` owns the actual chart controls and render stage. The
 * `chart:<type>` tool key keeps the workspace menu decoupled from Analytics
 * internals but still lets a selected menu item open the correct chart type.
 */
function chartToolKey(chartType) {
  return `chart:${chartType}`;
}

function chartTypeFromToolKey(toolKey) {
  return String(toolKey || '').startsWith('chart:') ? String(toolKey).slice(6) : null;
}

function numberLabel(value) {
  return Number.isFinite(value) ? String(value) : '0';
}




function FloatingOrnamentArrowToggle({
  anchorRef,
  placement = 'bottom',
  expanded,
  onClick,
  expandedLabel,
  collapsedLabel,
  expandedArrow,
  collapsedArrow,
}) {
  const [anchorRect, setAnchorRect] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = null;
    const updateRect = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const node = anchorRef?.current;
        setAnchorRect(node ? node.getBoundingClientRect() : null);
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [anchorRef, expanded]);

  if (typeof document === 'undefined' || !anchorRect) return null;

  const top = placement === 'top' ? anchorRect.top : anchorRect.bottom;
  const left = anchorRect.left + anchorRect.width / 2;
  const label = expanded ? expandedLabel : collapsedLabel;
  const displayLabel = label
    .replace('visualization header', 'header')
    .replace('Visualization header', 'Header');

  const emergeClass = placement === 'top'
    ? 'peridot-visualization-toggle-emerge-from-below'
    : 'peridot-visualization-toggle-emerge-from-above';
  const emergeDelay = placement === 'top' ? '1080ms' : '620ms';

  /*
   * These portal-mounted controls must sit above the map/chart stage but below
   * global dialogs. Keep this at the Visualizations workspace layer instead of
   * treating header/timeline toggles as universal top-layer UI.
   */
  return createPortal(
    <div
      className={`${emergeClass} pointer-events-auto fixed z-[400]`}
      style={{ left, top, '--peridot-toggle-emerge-delay': emergeDelay }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex h-7 min-w-[8.5rem] items-center justify-center gap-2 rounded-full border border-[var(--peridot-role-ornament-line-muted)] bg-[color-mix(in_srgb,var(--peridot-role-interface-panel-background-strong)_78%,transparent)] px-3 text-[var(--peridot-role-interface-text-on-dark)] shadow-[0_7px_16px_rgba(0,0,0,0.28)] backdrop-blur-[1px] transition duration-150 hover:scale-[1.02] hover:border-[var(--peridot-role-ornament-line)] hover:bg-[color-mix(in_srgb,var(--peridot-role-interface-panel-background-strong)_88%,transparent)] hover:text-[var(--peridot-role-ornament-sparkle)] focus:outline-none focus:ring-2 focus:ring-[var(--peridot-role-interface-text-on-dark)]"
        aria-label={label}
      >
        <span aria-hidden="true" className="h-px w-5 bg-gradient-to-r from-transparent to-[var(--peridot-role-ornament-line)] opacity-80" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
          {displayLabel}
        </span>
        <span aria-hidden="true" className="h-px w-5 bg-gradient-to-l from-transparent to-[var(--peridot-role-ornament-line)] opacity-80" />
      </button>
    </div>,
    document.body
  );
}

function FloatingVisualizationMenu({
  anchorRect,
  isOpen,
  children,
  width = 300,
  onMouseEnter,
  onMouseLeave,
  onFocus,
}) {
  if (!isOpen || typeof document === 'undefined' || !anchorRect) return null;

  const margin = 12;
  const top = Math.max(margin, anchorRect.bottom + 10);
  const left = Math.max(
    margin,
    Math.min(window.innerWidth - width - margin, anchorRect.right - width)
  );
  const bridgeLeft = Math.max(margin, anchorRect.left);
  const bridgeWidth = Math.max(32, Math.min(anchorRect.width, window.innerWidth - bridgeLeft - margin));

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed z-[9998]"
        style={{
          left: bridgeLeft,
          top: anchorRect.bottom,
          width: bridgeWidth,
          height: 14,
        }}
        onMouseEnter={onMouseEnter}
      />
      <div
        className="fixed z-[9999] rounded-2xl border border-[var(--peridot-color-hex-bfa46d)] bg-[var(--peridot-color-hex-fffaf0)] p-2 text-[var(--peridot-color-hex-203429)] shadow-[0_18px_38px_var(--peridot-color-rgba-rgba-0-0-0-0-36)]"
        style={{ left, top, width }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function CompatibilityStatusPill({ available, light = false }) {
  return (
    <span
      className={[
        'shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]',
        light
          ? available
            ? 'border-[var(--peridot-color-hex-5f7f4f)] bg-[var(--peridot-color-hex-dfe9c8)] text-[var(--peridot-color-hex-173120)]'
            : 'border-[var(--peridot-color-hex-9b6f2f)] bg-[var(--peridot-color-hex-f0d9a8)] text-[var(--peridot-color-hex-4c3216)]'
          : available
            ? 'border-[var(--peridot-color-hex-dfe9c8-a80)] bg-[var(--peridot-color-hex-dfe9c8-a30)] text-[var(--peridot-color-hex-fff8e8)]'
            : 'border-[var(--peridot-color-hex-e7c27d)] bg-[var(--peridot-color-hex-b58b42-a35)] text-[var(--peridot-color-hex-fff2cf)]',
      ].join(' ')}
    >
      {available ? 'Available' : 'Limited'}
    </span>
  );
}

function UnavailableVisualizationState({
  title,
  why,
  availableInstead = [],
  counts = [],
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-[28px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[var(--peridot-color-hex-071f16)] p-5 shadow-[0_20px_54px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]">
      <div className="w-full max-w-4xl rounded-[28px] border border-[var(--peridot-color-hex-dfe9c8-a50)] bg-[var(--peridot-color-hex-f8f4e6)] p-6 text-[var(--peridot-color-hex-24382d)] shadow-[0_18px_46px_var(--peridot-color-rgba-rgba-0-0-0-0-22)]">
        <p className="peridot-kicker text-[11px] text-[var(--peridot-color-hex-66815b)]">Tool availability</p>
        <h2 className="[font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-3xl font-bold tracking-[-0.035em] text-[var(--peridot-color-hex-132a20)]">
          {title}
        </h2>
        <div className="mt-4 rounded-2xl border border-[var(--peridot-color-hex-d5c7a8)] bg-[var(--peridot-color-hex-f3ecd9)] p-4">
          <h3 className="text-sm font-bold text-[var(--peridot-color-hex-25382d)]">What is missing</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--peridot-color-hex-4b5c50)]">{why}</p>
        </div>
        {availableInstead.length ? (
          <div className="mt-4 rounded-2xl border border-[var(--peridot-color-hex-cbdab2)] bg-[var(--peridot-color-hex-edf4df)] p-4">
            <h3 className="text-sm font-bold text-[var(--peridot-color-hex-25382d)]">Still available</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableInstead.map((item) => (
                <span key={item} className="rounded-full border border-[var(--peridot-color-hex-8aa36d-a50)] bg-[var(--peridot-color-hex-dfe9c8)] px-3 py-1 text-sm font-semibold text-[var(--peridot-color-hex-26382b)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {counts.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {counts.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--peridot-color-hex-d5c7a8)] bg-[var(--peridot-color-hex-fffdf6)] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--peridot-color-hex-6a7b65)]">{item.label}</div>
                <div className="mt-1 text-xl font-bold text-[var(--peridot-color-hex-172b20)]">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CapabilitySummaryWorkspace({ availability, onOpenSearch }) {
  const rows = [
    {
      label: 'Point map',
      value: availability.hasPointMap ? `${numberLabel(availability.pointCount)} mapped places` : 'Not available',
      ready: availability.hasPointMap,
      note: availability.hasPointMap
        ? 'One-location records have mapped point-place or point-coordinate roles and can be explored through the map.'
        : 'No point-place or point-coordinate roles are available in the current scope.',
    },
    {
      label: 'Route map',
      value: availability.hasRouteMap ? `${numberLabel(availability.routeCount)} routes` : 'Not available',
      ready: availability.hasRouteMap,
      note: availability.hasRouteMap
        ? 'Source-target place records have route/place roles and can be explored as routes.'
        : 'No mapped source-target place or coordinate-pair routes are available in the current scope.',
    },
    {
      label: 'Network views',
      value: availability.hasNetwork ? `${numberLabel(availability.networkEdgeCount)} relationships` : 'Not available',
      ready: availability.hasNetwork,
      note: availability.hasNetwork
        ? 'Explicitly mapped entity relationships are available and can be explored as networks.'
        : 'No explicitly mapped entity relationships are available in the current scope.',
    },
    {
      label: 'Charts',
      value: availability.hasCharts ? `${numberLabel(availability.rowCount)} records` : 'Not available',
      ready: availability.hasCharts,
      note: availability.hasCharts
        ? 'The active records can be sent to Chart Visualizations where usable categorical, numeric, date, or evidence fields are available.'
        : 'No active records or chartable fields are available for charting in the current scope.',
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-[28px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[var(--peridot-color-hex-071f16)] p-4 shadow-[0_20px_54px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]">
      <div className="rounded-[28px] border border-[var(--peridot-color-hex-dfe9c8-a50)] bg-[var(--peridot-color-hex-f8f4e6)] p-5 text-[var(--peridot-color-hex-24382d)]">
        <p className="peridot-kicker text-[11px] text-[var(--peridot-color-hex-66815b)]">Explore your data</p>
        <h2 className="[font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-3xl font-bold tracking-[-0.035em] text-[var(--peridot-color-hex-132a20)]">
          Dataset tool availability
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--peridot-color-hex-52675a)]">
          Peridot preserves useful records first, then reports which tools the mapped fields can support. Some datasets support maps, some support networks, some support charts, and some are best explored as searchable evidence records.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <div
              key={row.label}
              className={[
                'rounded-2xl border p-4',
                row.ready
                  ? 'border-[var(--peridot-color-hex-8aa36d-a60)] bg-[var(--peridot-color-hex-dfe9c8)]'
                  : 'border-[var(--peridot-color-hex-d5c7a8)] bg-[var(--peridot-color-hex-f3ecd9)]',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-[var(--peridot-color-hex-172b20)]">{row.label}</h3>
                <CompatibilityStatusPill available={row.ready} />
              </div>
              <div className="mt-3 text-xl font-bold text-[var(--peridot-color-hex-172b20)]">{row.value}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--peridot-color-hex-4e6255)]">{row.note}</p>
            </div>
          ))}
        </div>
        {onOpenSearch ? (
          <button
            type="button"
            onClick={onOpenSearch}
            className="mt-5 rounded-full border border-[var(--peridot-color-hex-8aa36d-a60)] bg-[var(--peridot-color-hex-edf4df)] px-4 py-2 text-sm font-bold text-[var(--peridot-color-hex-203429)] transition hover:border-[var(--peridot-color-hex-f5ecd2-a90)] hover:bg-[var(--peridot-color-hex-b58b42)] hover:text-[var(--peridot-color-hex-fff8e8)] focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]"
          >
            Open Search & Filter
          </button>
        ) : null}
      </div>
    </div>
  );
}

function VisualizationExportMenu({ exportControls, activeVisualizationLabel, compact = false }) {
  const peridotVisualizationTitle = `My Peridot ${activeVisualizationLabel || 'Visualization'}`;
  const upstreamDefaultTitle = exportControls?.defaultExportTitle || '';
  const defaultPngExportTitle = upstreamDefaultTitle && upstreamDefaultTitle !== 'Correspondence Visualizer'
    ? upstreamDefaultTitle
    : peridotVisualizationTitle;
  const [isOpen, setIsOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [activeExportPanel, setActiveExportPanel] = useState('actions');
  const [pngExportTitle, setPngExportTitle] = useState(defaultPngExportTitle);
  const [includePngTitle, setIncludePngTitle] = useState(false);
  const [includePngDateRange, setIncludePngDateRange] = useState(false);
  const [includePngActiveFilters, setIncludePngActiveFilters] = useState(false);
  const [includePngResultCounts, setIncludePngResultCounts] = useState(false);
  const menuAnchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const lastAutoPngExportTitleRef = useRef(defaultPngExportTitle);

  useEffect(() => {
    /*
     * Keep the PNG title behaving like a live default rather than a stale
     * one-time initialization. If the field still contains the previous
     * generated title, update it when the active visualization changes; if a
     * user has typed a custom title, preserve their edit.
     */
    setPngExportTitle((currentTitle) => {
      const trimmedCurrentTitle = String(currentTitle || '').trim();
      const previousAutoTitle = lastAutoPngExportTitleRef.current;
      const shouldUseFreshDefault = !trimmedCurrentTitle
        || trimmedCurrentTitle === previousAutoTitle
        || trimmedCurrentTitle === 'Correspondence Visualizer';

      lastAutoPngExportTitleRef.current = defaultPngExportTitle;

      return shouldUseFreshDefault ? defaultPngExportTitle : currentTitle;
    });
  }, [defaultPngExportTitle]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  if (!exportControls) return null;

  const {
    exportStatus,
    handleExportSvg,
    handleExportPng,
    handleExportNodesCsv,
    handleExportEdgesCsv,
    handleExportChartPng,
    graph,
    chartRowCount,
  } = exportControls;

  const nodeCount = Number.isFinite(graph?.nodes?.length) ? graph.nodes.length : 0;
  const edgeCount = Number.isFinite(graph?.edges?.length) ? graph.edges.length : 0;
  const chartCount = Number.isFinite(chartRowCount) ? chartRowCount : null;
  const canExportSvg = typeof handleExportSvg === 'function';
  const canExportPng = typeof handleExportPng === 'function';
  const canExportNodes = typeof handleExportNodesCsv === 'function' && nodeCount > 0;
  const canExportEdges = typeof handleExportEdgesCsv === 'function' && edgeCount > 0;
  const canExportChartPng = typeof handleExportChartPng === 'function';
  const isChartExportMenu = canExportChartPng && !canExportSvg && !canExportPng && !handleExportNodesCsv && !handleExportEdgesCsv;
  const isPngOptionsPanel = activeExportPanel === 'png-options' && canExportPng;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    if (menuAnchorRef.current) {
      setMenuAnchorRect(menuAnchorRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
  };

  const closeMenu = () => {
    clearCloseTimer();
    setIsOpen(false);
    setMenuAnchorRect(null);
    setActiveExportPanel('actions');
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setMenuAnchorRect(null);
      setActiveExportPanel('actions');
      closeTimerRef.current = null;
    }, 260);
  };

  const buttonClass = compact
    ? [
      'inline-flex h-10 w-[144px] items-center justify-center rounded-full border px-3 text-center text-[11px] font-extrabold uppercase tracking-[0.15em] transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
      isOpen
        ? 'border-[var(--peridot-role-ornament-line)] bg-[var(--peridot-color-hex-b58b42-a55)] text-[var(--peridot-color-hex-fff8e8)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a24),0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-20)]'
        : 'border-[var(--peridot-color-hex-dfe9c8-a36)] bg-[var(--peridot-color-hex-dfe9c8-a08)] text-[var(--peridot-color-hex-f5ecd2)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a10)] hover:border-[var(--peridot-role-ornament-line)] hover:bg-[var(--peridot-color-hex-b58b42-a30)] hover:text-[var(--peridot-color-hex-fff8e8)] hover:shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a20),0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-18)]',
    ].join(' ')
    : [
      'w-full rounded-2xl border px-3 py-2 text-left text-[var(--peridot-color-hex-fbf7ea)] transition focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
      isOpen
        ? 'border-[var(--peridot-color-hex-f5ecd2-a90)] bg-[var(--peridot-color-hex-b58b42-a75)] shadow-[0_12px_28px_var(--peridot-color-rgba-rgba-0-0-0-0-26)]'
        : 'border-[var(--peridot-color-hex-dfe9c8-a40)] bg-[var(--peridot-color-hex-dfe9c8-a10)] hover:border-[var(--peridot-color-hex-f5ecd2-a80)] hover:bg-[var(--peridot-color-hex-b58b42-a70)]',
    ].join(' ');

  const actionButtonClass = (enabled = true) => [
    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
    enabled
      ? 'text-[var(--peridot-color-hex-1d3326)] hover:bg-[var(--peridot-color-hex-dfe9c8)]'
      : 'cursor-not-allowed text-[var(--peridot-color-hex-6f6554)] hover:bg-[var(--peridot-color-hex-f3e4bf)]',
  ].join(' ');

  const primaryActionButtonClass = (enabled = true) => [
    'mt-3 flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-extrabold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
    enabled
      ? 'border-[var(--peridot-role-ornament-line)] bg-[var(--peridot-color-hex-b58b42)] text-[var(--peridot-color-hex-fff8e8)] hover:bg-[var(--peridot-color-hex-9b6f2f)]'
      : 'cursor-not-allowed border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-f3e4bf)] text-[var(--peridot-color-hex-6f6554)]',
  ].join(' ');

  const buildPngExportOptions = () => ({
    title: pngExportTitle,
    includeTitle: includePngTitle,
    includeDateRange: includePngDateRange,
    includeActiveFilters: includePngActiveFilters,
    includeResultCounts: includePngResultCounts,
  });

  const runAction = (handler) => {
    closeMenu();
    if (typeof handler === 'function') {
      handler();
    }
  };

  const openPngOptions = () => {
    clearCloseTimer();
    setActiveExportPanel('png-options');
  };

  return (
    <div
      ref={menuAnchorRef}
      className={compact ? 'relative z-[950]' : 'relative z-[900] min-w-[160px]'}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocus={openMenu}
    >
      <button
        type="button"
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className={buttonClass}
        aria-expanded={isOpen}
        aria-label={`Export ${activeVisualizationLabel}`}
      >
        {compact ? (
          'Export'
        ) : (
          <>
            <span className="block text-sm font-bold">Export</span>
            <span className="mt-1 block text-[11px] leading-snug text-[var(--peridot-color-hex-dfe9c8)]">
              {isChartExportMenu ? 'PNG export' : 'SVG, PNG, and CSV'}
            </span>
          </>
        )}
      </button>

      {isOpen ? (
        <FloatingVisualizationMenu
          anchorRect={menuAnchorRect}
          isOpen={isOpen}
          width={360}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
        >
          {isPngOptionsPanel ? (
            <div>
              <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--peridot-color-hex-6f6554)]">
                  PNG export options
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExportPanel('actions')}
                  className="rounded-full border border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-f5ecd2)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--peridot-color-hex-6f6554)] transition hover:bg-[var(--peridot-color-hex-dfe9c8)] focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]"
                >
                  Back
                </button>
              </div>

              <div className="mx-1 rounded-2xl border border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-fbf7ea)] p-3 text-[var(--peridot-color-hex-26382b)]">
                <label className="block text-xs font-bold text-[var(--peridot-color-hex-1d3326)]">
                  Optional title
                  <input
                    type="text"
                    value={pngExportTitle}
                    onChange={(event) => setPngExportTitle(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--peridot-color-hex-cbdab2)] bg-[var(--peridot-color-hex-f8f5e8)] px-3 py-2 text-sm font-semibold text-[var(--peridot-color-hex-1d3326)] outline-none focus:border-[var(--peridot-role-ornament-line)] focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a35)]"
                    placeholder={defaultPngExportTitle || 'Map title'}
                  />
                </label>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-[var(--peridot-color-hex-26382b)]">
                  {[
                    ['include-title', 'Show title at top', includePngTitle, setIncludePngTitle],
                    ['include-date-range', 'Show visible date range at bottom', includePngDateRange, setIncludePngDateRange],
                    ['include-active-filters', 'Show active filters at bottom', includePngActiveFilters, setIncludePngActiveFilters],
                    ['include-result-counts', 'Show result counts at bottom', includePngResultCounts, setIncludePngResultCounts],
                  ].map(([id, label, checked, setChecked]) => (
                    <label key={id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                        className="h-4 w-4 rounded border-[var(--peridot-color-hex-cbdab2)]"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-[var(--peridot-color-hex-6f6554)]">
                  With all options unchecked, the PNG export contains only the visualization.
                </div>
                <button
                  type="button"
                  onClick={() => runAction(() => handleExportPng(buildPngExportOptions()))}
                  className={primaryActionButtonClass(canExportPng)}
                  disabled={!canExportPng}
                >
                  Download PNG
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--peridot-color-hex-6f6554)]">
                Export {activeVisualizationLabel}
              </div>

              <div className="grid gap-1">
                {canExportChartPng ? (
                  <button
                    type="button"
                    onClick={() => runAction(handleExportChartPng)}
                    className={actionButtonClass(canExportChartPng)}
                    disabled={!canExportChartPng}
                  >
                    <span>Export chart PNG</span>
                    {chartCount !== null ? (
                      <span className="shrink-0 rounded-full border border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-f5ecd2)] px-2 py-0.5 text-[10px] font-bold text-[var(--peridot-color-hex-6f6554)]">
                        {chartCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {canExportSvg ? (
                  <button
                    type="button"
                    onClick={() => runAction(handleExportSvg)}
                    className={actionButtonClass(canExportSvg)}
                    disabled={!canExportSvg}
                  >
                    <span>Export visualization SVG</span>
                  </button>
                ) : null}
                {canExportPng ? (
                  <button
                    type="button"
                    onClick={openPngOptions}
                    className={actionButtonClass(canExportPng)}
                    disabled={!canExportPng}
                  >
                    <span>Export visualization PNG</span>
                  </button>
                ) : null}
                {typeof handleExportNodesCsv === 'function' ? (
                  <button
                    type="button"
                    onClick={() => runAction(handleExportNodesCsv)}
                    className={actionButtonClass(canExportNodes)}
                    disabled={!canExportNodes}
                  >
                    <span>Export nodes CSV</span>
                    <span className="shrink-0 rounded-full border border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-f5ecd2)] px-2 py-0.5 text-[10px] font-bold text-[var(--peridot-color-hex-6f6554)]">
                      {nodeCount}
                    </span>
                  </button>
                ) : null}
                {typeof handleExportEdgesCsv === 'function' ? (
                  <button
                    type="button"
                    onClick={() => runAction(handleExportEdgesCsv)}
                    className={actionButtonClass(canExportEdges)}
                    disabled={!canExportEdges}
                  >
                    <span>Export routes / edges CSV</span>
                    <span className="shrink-0 rounded-full border border-[var(--peridot-color-hex-d8c79a)] bg-[var(--peridot-color-hex-f5ecd2)] px-2 py-0.5 text-[10px] font-bold text-[var(--peridot-color-hex-6f6554)]">
                      {edgeCount}
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          )}

          {exportStatus?.message ? (
            <div
              className={[
                'mx-1 mt-3 rounded-xl border p-3 text-xs leading-relaxed',
                exportStatus.kind === 'error'
                  ? 'border-[var(--peridot-role-status-danger-border)] bg-[var(--peridot-role-status-danger-text)] text-[var(--peridot-role-status-danger-bg)]'
                  : 'border-[var(--peridot-color-hex-cbdab2)] bg-[var(--peridot-color-hex-edf4df)] text-[var(--peridot-color-hex-26382b)]',
              ].join(' ')}
            >
              {exportStatus.message}
              {exportStatus.filename ? (
                <div className="mt-1 font-semibold">{exportStatus.filename}</div>
              ) : null}
            </div>
          ) : null}
        </FloatingVisualizationMenu>
      ) : null}
    </div>
  );
}

export function PeridotVisualizationsWorkspace({
  pageTitle,
  setPageTitle,
  mapStageProps,
  MapStageComponent,
  viewMode,
  personLayoutMode,
  visualizationsWorkspacePanel,
  analyticsWorkspaceProps,
  visualizationAvailability,
  onSelectPlaceMap,
  onSelectPeopleNetwork,
  onSelectForceDirected,
  onOpenAnalytics,
  onOpenChartVisualization,
  onOpenSearch,
  onOpenExplore,
  timelineControlsProps,
  exportControls,
  suppressFloatingFrameToggles = false,
}) {
  const availability = {
    rowCount: 0,
    pointCount: 0,
    routeCount: 0,
    networkNodeCount: 0,
    networkEdgeCount: 0,
    geographicNetworkNodeCount: 0,
    geographicNetworkEdgeCount: 0,
    chartFieldCount: 0,
    hasPointMap: false,
    hasRouteMap: false,
    hasNetwork: false,
    hasForceNetwork: false,
    hasEntityNetwork: false,
    hasCharts: false,
    hasExploreData: false,
    ...(visualizationAvailability || {}),
  };

  const initialTool = visualizationsWorkspacePanel === 'analytics'
    ? VISUALIZATION_TOOLS.CHART_WORKSPACE
    : viewMode === 'geographic'
      ? VISUALIZATION_TOOLS.LOCATION_MAP
      : personLayoutMode === 'force'
        ? VISUALIZATION_TOOLS.FORCE_NETWORK
        : VISUALIZATION_TOOLS.ENTITY_NETWORK;

  const [selectedTool, setSelectedTool] = useState(initialTool);
  const [openMenuCategory, setOpenMenuCategory] = useState(null);
  const [openMenuAnchorRect, setOpenMenuAnchorRect] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);
  const headerToggleAnchorRef = useRef(null);
  const timelineToggleAnchorRef = useRef(null);
  const [chartExportControls, setChartExportControls] = useState(null);
  const [isStageSwitching, setIsStageSwitching] = useState(false);
  const [stageRenderKey, setStageRenderKey] = useState(0);
  const menuCloseTimerRef = useRef(null);
  const stageSwitchTimerRef = useRef(null);
  const stageRevealFrameRef = useRef(null);
  const headerEntranceTimerRef = useRef(null);
  const [hasHeaderEntranceSettled, setHasHeaderEntranceSettled] = useState(false);

  /*
   * The Visualizations header has a one-time, right-to-left arrival sequence:
   * Export, Explore, Charts, Network, then Mapping. Once that sequence has
   * finished, these controls must remain fully visible. Visualization-stage
   * switches re-render the header while the map/chart body transitions through
   * its green veil, so replaying the generic opacity-zero entrance class here
   * would make active controls disappear. Keep the mount-only timer independent
   * from selected-tool and stage-switch state.
   */
  useEffect(() => {
    headerEntranceTimerRef.current = window.setTimeout(() => {
      headerEntranceTimerRef.current = null;
      setHasHeaderEntranceSettled(true);
    }, 2280);

    return () => {
      if (headerEntranceTimerRef.current) {
        window.clearTimeout(headerEntranceTimerRef.current);
        headerEntranceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (visualizationsWorkspacePanel === 'analytics') {
      setSelectedTool(VISUALIZATION_TOOLS.CHART_WORKSPACE);
    }
  }, [visualizationsWorkspacePanel]);

  useEffect(() => () => {
    if (menuCloseTimerRef.current) {
      window.clearTimeout(menuCloseTimerRef.current);
    }
    if (stageSwitchTimerRef.current) {
      window.clearTimeout(stageSwitchTimerRef.current);
    }
    if (stageRevealFrameRef.current) {
      window.cancelAnimationFrame(stageRevealFrameRef.current);
      stageRevealFrameRef.current = null;
    }
  }, []);

  const cancelMenuClose = () => {
    if (menuCloseTimerRef.current) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  };

  const openMenu = (categoryLabel, anchorElement = null) => {
    cancelMenuClose();
    if (anchorElement && typeof anchorElement.getBoundingClientRect === 'function') {
      setOpenMenuAnchorRect(anchorElement.getBoundingClientRect());
    }
    setOpenMenuCategory(categoryLabel);
  };

  const closeMenu = () => {
    cancelMenuClose();
    setOpenMenuCategory(null);
    setOpenMenuAnchorRect(null);
  };

  const scheduleMenuClose = () => {
    cancelMenuClose();
    menuCloseTimerRef.current = window.setTimeout(() => {
      setOpenMenuCategory(null);
      setOpenMenuAnchorRect(null);
      menuCloseTimerRef.current = null;
    }, 260);
  };

  /*
   * Build the active visualization-menu registry.
   *
   * Map/network entries are handwritten because they switch App-owned view modes.
   * Chart entries are derived from `ANALYTICS_CHART_DEFINITIONS` so adding a
   * chart in the Analytics registry automatically surfaces it in the
   * Visualizations header, provided the derivation and renderer branches also
   * exist.
   */
  const toolDefinitions = useMemo(() => ({
    /*
     * User-facing map language is intentionally broader than the renderer branch.
     * Point and route maps share the same geographic map stage, so the header
     * exposes one "Map by Location" choice and lets the capability audit decide
     * whether the current rows contribute points, routes, or both.
     */
    [VISUALIZATION_TOOLS.LOCATION_MAP]: {
      label: 'Map by Location',
      category: 'Mapping Visualizations',
      available: availability.hasPointMap || availability.hasRouteMap,
      action: onSelectPlaceMap,
      unavailableTitle: 'Map by Location is not available for this dataset.',
      why: 'This dataset does not contain mapped point-place, point-coordinate, source-target place, or source-target coordinate-pair roles in the current scope. Records may still be valid for networks, charts, search, Inspector, or export.',
      availableInstead: [
        availability.hasEntityNetwork ? 'Map by Person / Entity' : null,
        availability.hasCharts ? 'Chart Visualizations' : null,
        availability.hasExploreData ? 'Explore Your Data' : null,
      ].filter(Boolean),
    },
    [VISUALIZATION_TOOLS.ENTITY_NETWORK]: {
      label: 'Map by Person / Entity',
      category: 'Network Visualizations',
      available: availability.hasEntityNetwork,
      action: onSelectPeopleNetwork,
      unavailableTitle: 'Map by Person / Entity is not available for this dataset.',
      why: availability.hasNetwork
        ? 'This dataset contains entity relationships, but no relationship currently has usable mapped geographic anchors for both connected entities. Use the Force-Directed Network to explore the relationships without geographic positioning.'
        : 'This dataset does not contain explicitly mapped entity relationships in the current scope. That is expected for point/site, catalogue, and time-series datasets, which may still be valid for location maps, charts, search, Inspector, and export.',
      availableInstead: [
        availability.hasPointMap || availability.hasRouteMap ? 'Map by Location' : null,
        availability.hasCharts ? 'Chart Visualizations' : null,
        availability.hasExploreData ? 'Explore Your Data' : null,
      ].filter(Boolean),
    },
    [VISUALIZATION_TOOLS.FORCE_NETWORK]: {
      label: 'Force-Directed Network',
      category: 'Network Visualizations',
      available: availability.hasForceNetwork,
      action: onSelectForceDirected,
      unavailableTitle: 'Force-Directed Network is not available for this dataset.',
      why: 'Force-directed layouts require explicitly mapped entity relationships. This dataset can still be valid for location maps, charts, search, Inspector, and export even when it does not contain network data.',
      availableInstead: [
        availability.hasPointMap || availability.hasRouteMap ? 'Map by Location' : null,
        availability.hasCharts ? 'Chart Visualizations' : null,
        availability.hasExploreData ? 'Explore Your Data' : null,
      ].filter(Boolean),
    },
    [VISUALIZATION_TOOLS.CHART_WORKSPACE]: {
      label: 'Chart Visualizations',
      category: 'Chart Visualizations',
      available: availability.hasCharts,
      action: onOpenAnalytics,
      unavailableTitle: 'Chart Visualizations are not available for this dataset.',
      why: 'No active records or chartable fields are available for charting in the current scope.',
      availableInstead: [
        availability.hasPointMap || availability.hasRouteMap ? 'Map by Location' : null,
        availability.hasEntityNetwork ? 'Map by Person / Entity' : null,
        availability.hasExploreData ? 'Explore Your Data' : null,
      ].filter(Boolean),
    },
    [VISUALIZATION_TOOLS.CAPABILITY_SUMMARY]: {
      label: 'Tool Availability',
      category: 'Explore Your Data',
      available: true,
      action: onOpenExplore,
      unavailableTitle: '',
      why: '',
      availableInstead: [],
    },
  }), [availability.hasCharts, availability.hasEntityNetwork, availability.hasExploreData, availability.hasForceNetwork, availability.hasNetwork, availability.hasPointMap, availability.hasRouteMap, onOpenAnalytics, onOpenExplore, onSelectForceDirected, onSelectPeopleNetwork, onSelectPlaceMap]);

  const selectedDefinition = toolDefinitions[selectedTool] || toolDefinitions[VISUALIZATION_TOOLS.CAPABILITY_SUMMARY];
  const activeVisualizationLabel = selectedDefinition.label;

  const categories = [
    {
      label: 'Mapping Visualizations',
      description: 'Location and entity maps',
      tools: [VISUALIZATION_TOOLS.LOCATION_MAP, VISUALIZATION_TOOLS.ENTITY_NETWORK],
      selectionTools: [VISUALIZATION_TOOLS.LOCATION_MAP],
    },
    {
      label: 'Network Visualizations',
      description: 'Entity relationship views',
      tools: [VISUALIZATION_TOOLS.ENTITY_NETWORK, VISUALIZATION_TOOLS.FORCE_NETWORK],
      selectionTools: [VISUALIZATION_TOOLS.ENTITY_NETWORK, VISUALIZATION_TOOLS.FORCE_NETWORK],
    },
    {
      label: 'Chart Visualizations',
      description: 'Choose a chart type',
      tools: [VISUALIZATION_TOOLS.CHART_WORKSPACE],
    },
    {
      label: 'Explore Your Data',
      description: 'Advanced search and capabilities',
      tools: [VISUALIZATION_TOOLS.CAPABILITY_SUMMARY],
      directAction: onOpenExplore,
    },
  ];

  const selectTool = (toolKey) => {
    const tool = toolDefinitions[toolKey];
    closeMenu();

    if (stageSwitchTimerRef.current) {
      window.clearTimeout(stageSwitchTimerRef.current);
    }
    if (stageRevealFrameRef.current) {
      window.cancelAnimationFrame(stageRevealFrameRef.current);
      stageRevealFrameRef.current = null;
    }

    if (toolKey === selectedTool) {
      if (tool?.available && typeof tool.action === 'function') {
        tool.action();
      }
      return;
    }

    /*
     * View-switch choreography: fade through a fully opaque, solid dark-green
     * field instead of swapping map/network/chart stages abruptly. The current
     * visualization fades out for about one second; once the green field covers
     * the stage, the next visualization mounts and starts fading in on the
     * next animation frame. This avoids a fixed green hold while still giving
     * React one paint cycle to mount the new stage under cover.
     */
    setIsStageSwitching(true);
    stageSwitchTimerRef.current = window.setTimeout(() => {
      setSelectedTool(toolKey);
      if (tool?.available && typeof tool.action === 'function') {
        tool.action();
      }
      setStageRenderKey((value) => value + 1);
      stageRevealFrameRef.current = window.requestAnimationFrame(() => {
        stageRevealFrameRef.current = null;
        setIsStageSwitching(false);
      });
    }, 1000);
  };

  const isCategorySelected = (category) => (category.selectionTools || category.tools).some((toolKey) => {
    if (toolKey === VISUALIZATION_TOOLS.CHART_WORKSPACE) {
      return selectedTool === VISUALIZATION_TOOLS.CHART_WORKSPACE || Boolean(chartTypeFromToolKey(selectedTool));
    }
    return selectedTool === toolKey;
  });

  const headerTabBaseClass = [
    'inline-flex h-10 w-[144px] items-center justify-center rounded-full border px-3 text-center',
    'text-[11px] font-extrabold uppercase tracking-[0.15em] transition duration-150',
    'focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
  ].join(' ');

  const headerEntranceClass = () => (hasHeaderEntranceSettled ? '' : 'peridot-appear-fade');
  const headerEntranceStyle = (delay) => (hasHeaderEntranceSettled ? undefined : { '--peridot-appear-delay': delay });
  const categoryClass = () => ['relative rounded-full', headerEntranceClass()].filter(Boolean).join(' ');

  const headerTabStateClass = (open, selected) => [
    selected
      ? 'border-[var(--peridot-role-ornament-line)] bg-[var(--peridot-color-hex-b58b42)] text-[var(--peridot-color-hex-fff8e8)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a40),0_10px_24px_var(--peridot-color-rgba-rgba-0-0-0-0-28),0_0_0_1px_var(--peridot-color-hex-d6a36a-a35)]'
      : open
        ? 'border-[var(--peridot-role-ornament-line)] bg-[var(--peridot-color-hex-b58b42-a55)] text-[var(--peridot-color-hex-fff8e8)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a24),0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-20)]'
        : 'border-[var(--peridot-color-hex-dfe9c8-a36)] bg-[var(--peridot-color-hex-dfe9c8-a08)] text-[var(--peridot-color-hex-f5ecd2)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a10)] hover:border-[var(--peridot-role-ornament-line)] hover:bg-[var(--peridot-color-hex-b58b42-a30)] hover:text-[var(--peridot-color-hex-fff8e8)] hover:shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a20),0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-18)]',
  ].join(' ');

  const headerActionClass = [
    headerTabBaseClass,
    'border-[var(--peridot-color-hex-dfe9c8-a36)] bg-[var(--peridot-color-hex-dfe9c8-a08)]',
    'text-[var(--peridot-color-hex-f5ecd2)] shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a10)]',
    'hover:border-[var(--peridot-role-ornament-line)] hover:bg-[var(--peridot-color-hex-b58b42-a30)] hover:text-[var(--peridot-color-hex-fff8e8)] hover:shadow-[inset_0_1px_0_var(--peridot-color-hex-fff8e8-a20),0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-18)]',
  ].join(' ');

  const headerRowDecalClass = 'hidden h-5 w-5 shrink-0 text-[var(--peridot-role-ornament-line)] opacity-80 xl:block';

  const menuItemClass = (active, available) => [
    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-hex-d6a36a-a60)]',
    active
      ? 'bg-[var(--peridot-color-hex-b58b42)] font-bold text-[var(--peridot-color-hex-fff8e8)] shadow-inner'
      : available
        ? 'text-[var(--peridot-color-hex-1d3326)] hover:bg-[var(--peridot-color-hex-dfe9c8)]'
        : 'text-[var(--peridot-color-hex-4f4330)] hover:bg-[var(--peridot-color-hex-f3e4bf)]',
  ].join(' ');

  const counts = [
    { label: 'Point places', value: numberLabel(availability.pointCount) },
    { label: 'Routes', value: numberLabel(availability.routeCount) },
    { label: 'Network edges', value: numberLabel(availability.networkEdgeCount) },
    { label: 'Rows', value: numberLabel(availability.rowCount) },
  ];

  const isChartWorkspaceActive = selectedTool === VISUALIZATION_TOOLS.CHART_WORKSPACE || Boolean(chartTypeFromToolKey(selectedTool));
  const activeExportControls = isChartWorkspaceActive ? chartExportControls : exportControls;

  const renderWorkspaceBody = () => {
    if (selectedTool === VISUALIZATION_TOOLS.CAPABILITY_SUMMARY) {
      return <CapabilitySummaryWorkspace availability={availability} onOpenSearch={onOpenSearch} />;
    }

    if (!selectedDefinition.available) {
      return (
        <UnavailableVisualizationState
          title={selectedDefinition.unavailableTitle}
          why={selectedDefinition.why}
          availableInstead={selectedDefinition.availableInstead}
          counts={counts}
        />
      );
    }

    if (selectedTool === VISUALIZATION_TOOLS.CHART_WORKSPACE || chartTypeFromToolKey(selectedTool)) {
      return (
        <div className="peridot-analytics-workspace peridot-illuminated-panel min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[var(--peridot-color-rgba-rgba-8-39-25-0-9)] p-2 shadow-[0_20px_54px_var(--peridot-color-rgba-rgba-0-0-0-0-34)] backdrop-blur-sm md:p-3">
          <AnalyticsPanelContent
            analyticsState={analyticsWorkspaceProps.analyticsState}
            onChartExportControlsChange={setChartExportControls}
          />
        </div>
      );
    }

    return (
      <div className="peridot-map-plate flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[var(--map-water)] shadow-[0_20px_54px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]">
        <MapStageComponent {...mapStageProps} />
      </div>
    );
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--peridot-color-hex-04160f)] text-[var(--peridot-color-hex-fbf7ea)]">
      <div className="peridot-workspace-field flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
          <div
            ref={headerToggleAnchorRef}
            className={[
              'peridot-appear-rise peridot-appear-delay-0 peridot-illuminated-panel relative z-[850] shrink-0 rounded-[28px] border border-[var(--peridot-color-hex-c4e0ef-a70)] bg-[linear-gradient(135deg,var(--peridot-color-rgba-rgba-8-39-25-0-95),var(--peridot-color-rgba-rgba-5-29-19-0-96))] pl-[76px] shadow-[0_18px_46px_var(--peridot-color-rgba-rgba-0-0-0-0-34)] backdrop-blur-sm sm:pl-[80px]',
              isHeaderExpanded ? 'px-4 pb-4 pt-3' : 'px-4 py-2',
            ].join(' ')}
          >
            {isHeaderExpanded ? (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="peridot-kicker !mb-0 text-[10px]">Visualization workspace</p>
                  <h1 className="mt-1 truncate [font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-2xl font-bold tracking-[-0.035em] text-[var(--peridot-color-hex-f5ecd2)] md:text-3xl">
                    {activeVisualizationLabel}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className={[headerEntranceClass(), headerRowDecalClass].filter(Boolean).join(' ')} style={headerEntranceStyle('1120ms')} fill="none">
                    <path d="M10 2.5C8.6 6.1 6.1 8.6 2.5 10C6.1 11.4 8.6 13.9 10 17.5C11.4 13.9 13.9 11.4 17.5 10C13.9 8.6 11.4 6.1 10 2.5Z" fill="currentColor" />
                    <path d="M5.2 10H14.8" stroke="var(--peridot-role-interface-panel-background-strong)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                  </svg>
                  {categories.filter((category) => !category.directAction).map((category) => {
                    const isOpen = openMenuCategory === category.label;
                    const selected = isCategorySelected(category);
                    const handleCategoryClick = (event) => {
                      if (isOpen) {
                        closeMenu();
                      } else {
                        openMenu(category.label, event.currentTarget.closest('[data-visualization-menu-anchor]'));
                      }
                    };
                    return (
                      <div
                        key={category.label}
                        data-visualization-menu-anchor="true"
                        /* Initial header entrance is deliberately mount-only. Once settled, the
                         * category wrapper carries no opacity-zero animation class, so stage changes
                         * cannot make Charts, Network, or Mapping disappear during a body transition.
                         */
                        className={categoryClass()}
                        style={headerEntranceStyle({
                          'Mapping Visualizations': '1040ms',
                          'Network Visualizations': '920ms',
                          'Chart Visualizations': '800ms',
                        }[category.label])}
                        onMouseEnter={(event) => openMenu(category.label, event.currentTarget)}
                        onMouseLeave={scheduleMenuClose}
                        onFocus={(event) => openMenu(category.label, event.currentTarget)}
                      >
                        <button
                          type="button"
                          className={`${headerTabBaseClass} ${headerTabStateClass(isOpen, selected)} focus:outline-none`}
                          onClick={handleCategoryClick}
                          aria-expanded={isOpen}
                          aria-current={selected ? 'page' : undefined}
                        >
                          {category.label.replace(' Visualizations', '').replace('Chart', 'Charts')}
                        </button>
                        {isOpen ? (
                          <FloatingVisualizationMenu
                            anchorRect={openMenuAnchorRect}
                            isOpen={isOpen}
                            width={280}
                            onMouseEnter={() => openMenu(category.label)}
                            onMouseLeave={scheduleMenuClose}
                            onFocus={() => openMenu(category.label)}
                          >
                            {category.tools.map((toolKey) => {
                              const tool = toolDefinitions[toolKey];
                              const isActiveTool = selectedTool === toolKey || (toolKey === VISUALIZATION_TOOLS.CHART_WORKSPACE && Boolean(chartTypeFromToolKey(selectedTool)));
                              return (
                                <button
                                  key={toolKey}
                                  type="button"
                                  onClick={() => selectTool(toolKey)}
                                  className={menuItemClass(isActiveTool, tool.available)}
                                >
                                  <span className="pr-2 leading-snug">{tool.label}</span>
                                  <CompatibilityStatusPill available={tool.available} light />
                                </button>
                              );
                            })}
                          </FloatingVisualizationMenu>
                        ) : null}
                      </div>
                    );
                  })}
                  {categories.filter((category) => category.directAction).map((category) => (
                    <button
                      key={category.label}
                      type="button"
                      className={[headerEntranceClass(), headerActionClass].filter(Boolean).join(' ')}
                      style={headerEntranceStyle('680ms')}
                      onClick={() => {
                        closeMenu();
                        category.directAction();
                      }}
                    >
                      Explore
                    </button>
                  ))}
                  <div className={headerEntranceClass()} style={headerEntranceStyle('560ms')}>
                    <VisualizationExportMenu
                      exportControls={activeExportControls}
                      activeVisualizationLabel={activeVisualizationLabel}
                      compact
                    />
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className={[headerEntranceClass(), headerRowDecalClass, 'scale-x-[-1]'].filter(Boolean).join(' ')} style={headerEntranceStyle('460ms')} fill="none">
                    <path d="M10 2.5C8.6 6.1 6.1 8.6 2.5 10C6.1 11.4 8.6 13.9 10 17.5C11.4 13.9 13.9 11.4 17.5 10C13.9 8.6 11.4 6.1 10 2.5Z" fill="currentColor" />
                    <path d="M5.2 10H14.8" stroke="var(--peridot-role-interface-panel-background-strong)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex h-8 items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="peridot-kicker !mb-0 mr-3 inline text-[9px] text-[var(--peridot-color-hex-dfe9c8)]">Visualization workspace</span>
                  <span className="truncate text-sm font-bold text-[var(--peridot-color-hex-f5ecd2)]">{activeVisualizationLabel}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className={headerEntranceClass()} style={headerEntranceStyle('560ms')}>
                    <VisualizationExportMenu
                      exportControls={activeExportControls}
                      activeVisualizationLabel={activeVisualizationLabel}
                      compact
                    />
                  </div>
                  <span className={[headerEntranceClass(), 'rounded-full border border-[var(--peridot-color-hex-dfe9c8-a35)] bg-[var(--peridot-color-hex-dfe9c8-a10)] px-3 py-1 text-[11px] font-semibold text-[var(--peridot-color-hex-dfe9c8)]'].filter(Boolean).join(' ')} style={headerEntranceStyle('720ms')}>
                    Navigation minimized
                  </span>
                </div>
              </div>
            )}
            {!suppressFloatingFrameToggles ? (
              <FloatingOrnamentArrowToggle
                anchorRef={headerToggleAnchorRef}
                placement="bottom"
                expanded={isHeaderExpanded}
                onClick={() => setIsHeaderExpanded((value) => !value)}
                expandedLabel="Hide visualization header"
                collapsedLabel="Show visualization header"
                expandedArrow="⌃"
                collapsedArrow="⌄"
              />
            ) : null}
          </div>

          <div className="relative z-[20] flex min-h-0 flex-1 flex-col gap-3" onMouseEnter={scheduleMenuClose}>
            <div
              className={[
                'peridot-appear-soft peridot-appear-delay-5 peridot-visualization-stage-transition-shell min-h-0 flex flex-1',
                isStageSwitching ? 'peridot-visualization-stage-transition-active' : '',
              ].join(' ')}
            >
              <div key={stageRenderKey} className="peridot-visualization-stage-transition-content min-h-0 flex flex-1">
                {renderWorkspaceBody()}
              </div>
            </div>
            {timelineControlsProps ? (
              <div ref={timelineToggleAnchorRef} className="peridot-appear-rise peridot-appear-delay-3 relative shrink-0 pt-2">
                {!suppressFloatingFrameToggles ? (
                  <FloatingOrnamentArrowToggle
                    anchorRef={timelineToggleAnchorRef}
                    placement="top"
                    expanded={isTimelineExpanded}
                    onClick={() => setIsTimelineExpanded((value) => !value)}
                    expandedLabel="Hide timeline"
                    collapsedLabel="Show timeline"
                    expandedArrow="⌄"
                    collapsedArrow="⌃"
                  />
                ) : null}
                {isTimelineExpanded ? (
                  <div className="peridot-visualization-timeline-sequence">
                    <VisualizationTimelineScrubber {...timelineControlsProps} />
                  </div>
                ) : (
                  <div className="peridot-visualization-timeline-sequence flex h-10 items-center justify-between rounded-[24px] border border-[var(--peridot-color-hex-c4e0ef-a50)] bg-[linear-gradient(135deg,var(--peridot-color-rgba-rgba-8-39-25-0-96),var(--peridot-color-rgba-rgba-5-29-19-0-98))] px-5 text-[var(--peridot-color-hex-fbf7ea)] shadow-[0_12px_32px_var(--peridot-color-rgba-rgba-0-0-0-0-26)]">
                    <span className="peridot-visualization-timeline-step peridot-kicker !mb-0 text-[10px] text-[var(--peridot-color-hex-dfe9c8)]">Timeline</span>
                    <span className="peridot-visualization-timeline-step text-sm font-semibold text-[var(--peridot-color-hex-f5ecd2)]">{timelineControlsProps.currentRangeLabel}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
