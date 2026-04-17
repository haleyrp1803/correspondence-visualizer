import React from 'react';

export function MapLegendOverlay({ nodes, edges, clusterPluralLabel, floatingCardClassName }) {
  return (
    <div className={`pointer-events-none absolute bottom-4 left-4 p-3 text-xs ${floatingCardClassName()}`}>
      <div className="mb-2 text-[var(--muted-text)]">Nodes: {nodes.length} | Routes: {edges.length}</div>
      <div className="mb-1 font-semibold text-[var(--text-main)]">Legend</div>
      <div className="space-y-1 text-[var(--muted-text)]">
        <div><span className="font-medium">Primary circles</span>: {clusterPluralLabel}</div>
        <div><span className="font-medium">Cluster circles</span>: low-zoom {clusterPluralLabel} clusters</div>
        <div><span className="font-medium">Curved paths</span>: aggregated {clusterPluralLabel === 'places' ? 'geographic routes' : 'person-to-person connections'}</div>
        <div><span className="font-medium">Thicker line</span>: more letters on that route</div>
        <div><span className="font-medium">Mouse wheel</span>: zoom</div>
        <div><span className="font-medium">Drag</span>: pan</div>
      </div>
    </div>
  );
}

export function MapControlsOverlay({
  floatingCardClassName,
  buttonClassName,
  onPanUp,
  onPanLeft,
  onPanDown,
  onPanRight,
  onZoomIn,
  onZoomOut,
  onStop,
  onReset,
}) {
  return (
    <div className={`absolute bottom-4 right-4 p-3 ${floatingCardClassName()}`}>
      <div className="mb-2 px-1 [font-family:Georgia,&quot;Palatino_Linotype&quot;,&quot;Book_Antiqua&quot;,Palatino,serif] text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--group-heading-text)]">Map controls</div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-center">
          <button onMouseDown={onPanUp} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanUp} onTouchEnd={onStop} aria-label="Pan up" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>↑</button>
        </div>
        <div className="flex gap-2">
          <button onMouseDown={onPanLeft} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanLeft} onTouchEnd={onStop} aria-label="Pan left" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>←</button>
          <button onMouseDown={onPanDown} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanDown} onTouchEnd={onStop} aria-label="Pan down" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>↓</button>
          <button onMouseDown={onPanRight} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanRight} onTouchEnd={onStop} aria-label="Pan right" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>→</button>
        </div>
        <div className="flex gap-2">
          <button onMouseDown={onZoomIn} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onZoomIn} onTouchEnd={onStop} aria-label="Zoom in" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>+</button>
          <button onMouseDown={onZoomOut} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onZoomOut} onTouchEnd={onStop} aria-label="Zoom out" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>−</button>
          <button onClick={onReset} aria-label="Reset map view" className={`${buttonClassName()} shadow-sm`}>Reset</button>
        </div>
      </div>
    </div>
  );
}

export function HoverCardOverlay({ hoverCard, mapViewportSize }) {
  if (!hoverCard) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[320px] rounded-2xl border border-[var(--overlay-card-border)] bg-[var(--overlay-card-bg)] px-4 py-3 text-sm shadow-[0_16px_36px_rgba(0,0,0,0.26)]"
      style={{
        left: Math.min(hoverCard.x + 18, Math.max(16, mapViewportSize.width - 340)),
        top: Math.max(16, hoverCard.y + 18),
      }}
    >
      <div className="font-semibold text-[var(--overlay-card-text)]">{hoverCard.title}</div>
      <div className="mt-1 text-[var(--overlay-card-muted-text)]">{hoverCard.subtitle}</div>
    </div>
  );
}

export function MapTitleBar({ pageTitle, setPageTitle }) {
  return (
    <div className="border-b border-[var(--section-border)] bg-[var(--title-bar-bg)] px-6 py-4">
      <input
        value={pageTitle}
        onChange={(e) => setPageTitle(e.target.value)}
        className="w-full rounded-xl border border-[var(--title-input-border)] bg-[var(--title-input-bg)] px-4 py-3 text-lg font-semibold text-[var(--title-display-text)] placeholder:text-[var(--title-placeholder)]"
        placeholder="Map title"
      />
    </div>
  );
}
