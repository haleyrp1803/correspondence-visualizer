export function museumShellClassName() {
  return 'h-screen w-full bg-[var(--shell-bg)] text-[var(--text-main)]';
}

export function sidebarSurfaceClassName() {
  return 'relative overflow-visible border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-sm transition-all duration-300';
}

export function groupCardClassName() {
  return 'mt-5 rounded-[28px] border border-[var(--group-border)] bg-[linear-gradient(180deg,var(--group-bg-top),var(--group-bg-bottom))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.42)]';
}

export function sectionCardClassName() {
  return 'overflow-hidden rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] shadow-[0_10px_28px_rgba(0,0,0,0.34)]';
}

export function floatingCardClassName() {
  return 'rounded-2xl border border-[var(--floating-border)] bg-[var(--floating-bg)] text-[var(--text-main)] shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur';
}

export function panelHeadingClassName() {
  return 'text-[32px] font-bold leading-tight tracking-[-0.02em] text-[var(--heading-text)]';
}

export function groupHeadingClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] mb-3 px-2 text-[14px] font-bold uppercase tracking-[0.14em] text-[var(--group-heading-text)]';
}

export function sectionTitleClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[17px] font-bold leading-tight tracking-[0.005em] text-[var(--heading-text)]';
}

export function detailLabelClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--detail-label-text)]';
}

export function serifHeadingClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] tracking-[-0.02em] text-[var(--heading-text)]';
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-[var(--section-border)]/80 py-2 last:border-b-0">
      <div className={detailLabelClassName()}>{label}</div>
      <div className="mt-1 break-words text-sm text-[var(--text-main)]">{value || '—'}</div>
    </div>
  );
}

// Reusable summary/diagnostic stat tile.
// Use this whenever a section needs the same small card pattern:
// muted label on top, large value below.
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-[var(--stat-card-bg)] p-3">
      <div className="text-[var(--panel-card-muted-text)]">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// Reusable linked-letter card used in both node and edge inspector views.
// This keeps the letter summary, expandable long-text sections, and metadata
// display consistent no matter how the user reached the inspector.
function LinkedLetterCard({
  letter,
  showAllLinkedLetters,
  isLetterSectionExpanded,
  onToggleLetterSection,
}) {
  const renderExpandableTextBlock = (sectionKey, heading, text, buttonLabel) => {
    if (!showAllLinkedLetters || !text) return null;
    const expanded = isLetterSectionExpanded(letter.id, sectionKey);
    const needsToggle = text.length > 350;
    return (
      <div className="mt-2 text-[var(--panel-card-text)]">
        <div className="font-medium text-[var(--panel-card-text)]">{heading}</div>
        <div>{expanded ? text : `${text.slice(0, 350)}${text.length > 350 ? '…' : ''}`}</div>
        {needsToggle ? (
          <button
            type="button"
            onClick={() => onToggleLetterSection(letter.id, sectionKey)}
            className="mt-1 text-xs font-medium text-[var(--panel-card-muted-text)] underline underline-offset-2 hover:text-[var(--panel-card-text)]"
          >
            {expanded ? `Show less ${buttonLabel}` : `Show full ${buttonLabel}`}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-[var(--stat-card-bg)] p-3 text-sm">
      <div className="font-medium text-[var(--panel-card-text)]">{letter.source} → {letter.target}</div>
      <div className="mt-1 text-[var(--panel-card-muted-text)]">{letter.archivalCollection}</div>
      <div className="text-[var(--panel-card-muted-text)]">Archival page: {letter.archivalPage || '—'} </div>
      <div className="text-[var(--panel-card-muted-text)]">Relationship: {letter.relationship || '—'} | Language: {letter.language || '—'}</div>
      {renderExpandableTextBlock('notes', 'Notes', letter.notes, 'notes')}
      {renderExpandableTextBlock('transcription', 'Transcription', letter.transcription, 'transcription')}
      {renderExpandableTextBlock('translation', 'Translation', letter.translation, 'translation')}
    </div>
  );
}

// Shared expand/collapse wrapper used throughout the side panels.
// This keeps section behavior consistent and makes future editing easier:
// title, optional header content, and expandable body all live in one place.
function CollapsiblePanelSection({
  title,
  open,
  onToggle,
  headerContent = null,
  children = null,
  className = '',
  bodyClassName = 'border-t border-[var(--panel-card-border)]/70 p-4 pt-3',
}) {
  return (
    <section className={`${sectionCardClassName()} ${className}`.trim()}>
      <button type="button" onClick={onToggle} className="w-full p-4 text-left transition-colors hover:bg-[var(--panel-card-hover)]">
        <div>
          <h2 className={sectionTitleClassName()}>{title}</h2>
          {headerContent ? <div className="mt-2">{headerContent}</div> : null}
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[15px] font-semibold text-[var(--panel-card-muted-text)]">{open ? '⌃' : '⌄'}</span>
        </div>
      </button>
      {open ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  );
}

// Reusable stepped slider.
// Internal guide:
// 1. drag and click logic
// 2. keyboard accessibility
// 3. label rendering
function StepSlider({ options, value, onChange, ariaLabelPrefix }) {
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampIndex = (index) => Math.max(0, Math.min(options.length - 1, index));

  const updateFromClientX = (clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const nextIndex = clampIndex(Math.round(ratio * (options.length - 1)));
    const nextOption = options[nextIndex];
    if (nextOption) onChange(nextOption.value);
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMove = (event) => {
      updateFromClientX(event.clientX);
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, options]);

  const thumbPercent = options.length > 1 ? (currentIndex / (options.length - 1)) * 100 : 0;
  const columnStyle = { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` };

  return (
    <div className="pt-1">
      <div
        ref={trackRef}
        className="relative mx-4 h-7 select-none"
        onMouseDown={(event) => {
          updateFromClientX(event.clientX);
          setIsDragging(true);
        }}
        role="slider"
        aria-label={ariaLabelPrefix}
        aria-valuemin={0}
        aria-valuemax={Math.max(options.length - 1, 0)}
        aria-valuenow={currentIndex}
        aria-valuetext={options[currentIndex]?.label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = clampIndex(currentIndex - 1);
            onChange(options[nextIndex].value);
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = clampIndex(currentIndex + 1);
            onChange(options[nextIndex].value);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            onChange(options[0].value);
          }
          if (event.key === 'End') {
            event.preventDefault();
            onChange(options[options.length - 1].value);
          }
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--slider-track-bg)]" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" style={{ width: `${thumbPercent}%` }} />
        <div className="absolute left-0 right-0 top-1/2 grid -translate-y-1/2" style={columnStyle}>
          {options.map((option, index) => {
            const active = index <= currentIndex;
            const selected = index === currentIndex;
            return (
              <div key={`${option.label}-${option.value}`} className="relative flex justify-center">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(option.value);
                  }}
                  className={`h-4 w-4 rounded-full border-2 transition-all ${active ? 'border-[var(--accent)] bg-[var(--slider-dot-bg)]' : 'border-[var(--slider-dot-border)] bg-[var(--slider-dot-bg)]'} ${selected ? 'scale-110 shadow-[0_0_0_4px_rgba(143,122,86,0.16)]' : ''}`}
                  aria-label={`${ariaLabelPrefix} ${option.label}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-x-1" style={columnStyle}>
        {options.map((option, index) => (
          <div
            key={`${option.label}-${option.value}-label`}
            className={`flex min-h-[2.5rem] items-start justify-center px-1 text-center text-[10px] leading-tight sm:text-[11px] ${index === currentIndex ? 'font-semibold text-[var(--slider-label-active)]' : 'text-[var(--slider-label-inactive)]'}`}
          >
            <span className="max-w-[4.75rem] whitespace-normal break-words">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styled file picker wrapper around the hidden native file input.
function FilePicker({ id, onChange }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3">
      <input id={id} type="file" accept=".csv,text/csv" onChange={onChange} className="hidden" />
      <label htmlFor={id} className={`${buttonClassName({ variant: 'secondary' })} cursor-pointer`}>
        Choose File
      </label>
    </div>
  );
}

// Small card wrapper for the three upload sources.
// This is intentionally presentation-only: it does not own any state,
// parsing, or upload logic. Keeping it this small reduces regression risk.
function DataSourceCard({ title, fileInputId, onFileChange, currentSource }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
      <div className="mb-2">
        <h2 className={sectionTitleClassName()}>{title}</h2>
      </div>
      <FilePicker id={fileInputId} onChange={onFileChange} />
      <div className="text-sm text-[var(--panel-card-muted-text)]">Current source: {currentSource}</div>
    </div>
  );
}

// Shared button styling helper used across the interface.
// Shared button helper.
// Important note: `active` means selected or toggled on, not merely hovered.
export function buttonClassName({ active = false, variant = 'secondary' } = {}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--shell-bg)]';
  const variants = {
    primary: 'border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)] shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
    secondary: 'border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]',
    ghost: 'bg-transparent text-[var(--muted-text)] hover:bg-[var(--ghost-hover)] hover:text-[var(--text-main)]',
  };

  if (active) {
    return `${base} border border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)] shadow-[0_10px_22px_rgba(0,0,0,0.3)] hover:bg-[var(--button-primary-active-hover)]`;
  }
  return `${base} ${variants[variant] || variants.secondary}`;
}
