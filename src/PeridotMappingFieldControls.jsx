/*
 * Reusable mapping-field controls for the role-based column/workbook mapping modal.
 *
 * `PeridotColumnMappingModal.jsx` owns modal state, step routing, validation,
 * import/cancel behavior, and workbook mutation handlers. This file owns only
 * the repeated table UI used to assign Peridot roles to uploaded columns.
 *
 * The split is intentionally conservative:
 * - Single-table controls accept plain uploaded headers and string mappings.
 * - Workbook controls accept the workbook model and sheet/column refs.
 * - No state is stored here; all changes are reported through `onChange`.
 *
 * Maintenance relationship:
 * - Field definitions come from `peridotColumnMapping.js`.
 * - Workbook sheet helpers and column refs come from `peridotWorkbookMapping.js`.
 * - The modal composes these controls inside the relevant mapping steps.
 */

import React from 'react';
import {
  PERIDOT_CORE_FIELD_DEFINITIONS_BY_KEY,
  PERIDOT_POINT_FIELD_DEFINITIONS_BY_KEY,
  PERIDOT_TEMPORAL_FIELD_DEFINITIONS,
  PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS_BY_KEY,
} from './peridotColumnMapping.js';
import {
  getUsableWorkbookSheets,
  getWorkbookSheet,
  makeWorkbookColumnRef,
} from './peridotWorkbookMapping.js';

/*
 * Shared select styling used by the mapping tables. Keeping this class in one
 * file makes the extracted controls visually identical to their original modal
 * rendering while avoiding a global CSS dependency.
 */
const SOURCE_SELECT_CLASS =
  'peridot-mapping-select w-full min-w-[12rem] rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]';

const DISABLED_SOURCE_SELECT_CLASS = `${SOURCE_SELECT_CLASS} disabled:opacity-60`;

const SPATIAL_SELECT_CLASS =
  'peridot-mapping-select w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]';

const DISABLED_SPATIAL_SELECT_CLASS = `${SPATIAL_SELECT_CLASS} disabled:opacity-60`;

const VISIBLE_TEMPORAL_FIELD_DEFINITIONS = PERIDOT_TEMPORAL_FIELD_DEFINITIONS.filter(
  (definition) => definition.key !== 'Date_Display'
);

function UsedForBadges({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="peridot-mapping-used-for-row" aria-label="Used for">
      {items.map((item) => (
        <span key={item} className="peridot-mapping-mini-badge">{item}</span>
      ))}
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-2.5 w-2.5 rotate-45 border border-[var(--button-primary-active-border)] bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
    </div>
  );
}

function RoleCell({ definition }) {
  return (
    <div className="peridot-mapping-role-cell">
      <div className="font-semibold text-[var(--panel-card-text)]">{definition.label || definition.key}</div>
      <div className="mt-1 text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--panel-card-muted-text)]">{definition.key}</div>
      {definition.description ? (
        <p className="mt-2 max-w-[38rem] text-xs font-normal leading-relaxed text-[var(--panel-card-muted-text)]">
          {definition.description}
        </p>
      ) : null}
    </div>
  );
}

/*
 * Renders the single-table temporal role assignments.
 *
 * The Time step is intentionally not a dense reference table. It has only a few
 * visible decisions, so it uses a compact task-card layout: temporal roles on
 * the left, user column choices in the center, and one shared explanation panel
 * on the right. Date_Display is composed automatically from the selected single
 * date or interval and is intentionally not shown.
 */
export function getNonBlankExampleValues(rows = [], sourceColumn = '', limit = 3) {
  if (!sourceColumn) return [];
  const seen = new Set();
  const values = [];

  for (const row of rows || []) {
    const rawValue = row?.[sourceColumn];
    const text = String(rawValue ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    values.push(text);
    if (values.length >= limit) break;
  }

  return values;
}

function TemporalExamples({ values = [] }) {
  if (!values.length) return null;
  return (
    <div className="mt-2 break-words text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <span className="font-semibold text-[var(--panel-card-text)]">Examples from your data:</span>{' '}
      {values.map((value, index) => (
        <React.Fragment key={`${value}-${index}`}>
          {index ? ' · ' : ''}<span>{value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

const TEMPORAL_UI_COPY = Object.freeze({
  Date: Object.freeze({
    label: 'Date',
    description: 'A date associated with this row—for example a letter, transaction, observation, event, photograph, or court record.',
  }),
  Date_Range: Object.freeze({
    label: 'Date range / timespan',
    description: 'Both ends of a period in one column—for example 1600–1640, a lifespan, reign, appointment, journey, or another interval.',
  }),
  Date_Start: Object.freeze({
    label: 'Beginning date',
    description: 'When something begins—for example birth, inception, departure, opening, appointment, construction, or the beginning of a period.',
  }),
  Date_End: Object.freeze({
    label: 'Ending date',
    description: 'When something ends—for example death, dissolution, arrival, closing, termination, demolition, or the end of a period.',
  }),
});

function TemporalIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Time</div>
      <div className="mt-1 text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">When does the information in each row take place?</div>
      <p className="mt-2 text-sm leading-relaxed">
        Choose any columns that tell Peridot when a record, event, person, place, object, measurement, or other item belongs in time. Peridot reads the date or timespan itself and preserves partial, approximate, open-ended, and incomplete values whenever it can do so safely.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        <span className="font-semibold text-[var(--panel-card-text)]">Examples:</span> date on a letter, timeframe of a journey, publication date, lifespans, etc.
      </p>
    </div>
  );
}

export function TemporalMappingTable({ headers, rows = [], temporalMapping = {}, temporalNoteMappings = {}, onChange, onNoteChange }) {
  return (
    <div className="space-y-3">
      <TemporalIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0">
            <div className="grid grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.1fr)] gap-4 border-b border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-3 text-sm font-semibold text-[var(--panel-card-text)]">
              <div>When it happens</div>
              <div>Your column</div>
            </div>

            <div className="divide-y divide-[var(--panel-card-border)] rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35">
              {VISIBLE_TEMPORAL_FIELD_DEFINITIONS.map((definition) => {
                const uiCopy = TEMPORAL_UI_COPY[definition.key] || { label: definition.label || definition.key, description: definition.description || '' };
                const selectedColumn = temporalMapping[definition.key] || '';
                const examples = getNonBlankExampleValues(rows, selectedColumn, 3);
                return (
                  <div
                    key={definition.key}
                    className="grid grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.1fr)] gap-4 px-4 py-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">{uiCopy.label}</div>
                      <p className="mt-2 text-sm font-normal leading-relaxed text-[var(--panel-card-muted-text)]">{uiCopy.description}</p>
                    </div>
                    <div className="peridot-mapping-choice-cell min-w-0">
                      <select
                        value={selectedColumn}
                        onChange={(event) => onChange(definition.key, event.target.value)}
                        className={SOURCE_SELECT_CLASS}
                      >
                        <option value="">Unassigned</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                      <TemporalExamples values={examples} />
                      <div className="mt-3 border-t border-[var(--panel-card-border)] pt-3">
                        <div className="text-xs font-semibold text-[var(--muted-text)]">Related temporal notes (optional)</div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">Preserved with this temporal value without changing how Peridot interprets the date.</p>
                        {(temporalNoteMappings?.[definition.key] || []).map((noteColumn, noteIndex) => (
                          <div key={`${definition.key}-note-${noteIndex}`} className="mt-2 flex gap-2">
                            <select value={noteColumn || ''} onChange={(event) => onNoteChange?.(definition.key, noteIndex, event.target.value)} className={SOURCE_SELECT_CLASS}>
                              <option value="">Unassigned</option>
                              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                            </select>
                            <button type="button" onClick={() => onNoteChange?.(definition.key, noteIndex, '')} className="rounded-lg border border-[var(--input-border)] px-2 text-xs text-[var(--panel-card-muted-text)]">Remove</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => onNoteChange?.(definition.key, (temporalNoteMappings?.[definition.key] || []).length, '__ADD__')} className="mt-3 rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]">+ Add related note column</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <TemporalUsagePanel />
        </div>
      </div>
    </div>
  );
}

function TemporalUsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-3">
        Temporal information is used in Peridot’s timeline, search and filter, charts, Inspector, and export.
      </p>
      <p className="mt-3">
        Each mapped temporal field remains a separate temporal assertion. Optional note columns—such as certainty, completeness, transcription, or project-specific qualifiers—are preserved without being treated as commands about visualization.
      </p>
    </aside>
  );
}

/*
 * Renders a single-table mapping table for a caller-supplied set of Peridot
 * role definitions. The modal uses this generic control for relationship,
 * route-place, point-location, and route coordinate-pair sections.
 */
export function CoreRoleMappingTable({ title, description, guidanceLabel, guidanceText, definitions, headers, coreMapping, onChange }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">{title}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--panel-card-text)]">{description}</div>
        </div>
        {guidanceLabel ? <span className="peridot-mapping-priority-badge">{guidanceLabel}</span> : null}
      </div>
      {guidanceText ? <p className="mt-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">{guidanceText}</p> : null}

      <div className="peridot-mapping-table-wrap mt-4 overflow-x-auto rounded-xl border border-[var(--panel-card-border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--stat-card-bg)] text-[var(--panel-card-text)]">
            <tr>
              <th className="px-4 py-3">Field role</th>
              <th className="px-4 py-3">Your column</th>
              <th className="px-4 py-3">Used for</th>
            </tr>
          </thead>
          <tbody className="text-[var(--panel-card-muted-text)]">
            {definitions.map((definition) => (
              <tr key={definition.key} className="border-t border-[var(--panel-card-border)] align-top">
                <td className="px-4 py-3">
                  <RoleCell definition={definition} />
                </td>
                <td className="peridot-mapping-choice-cell px-4 py-3">
                  <select
                    value={coreMapping[definition.key] || ''}
                    onChange={(event) => onChange(definition.key, event.target.value)}
                    className={SOURCE_SELECT_CLASS}
                  >
                    <option value="">Unassigned</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <UsedForBadges items={definition.usedFor || []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


const SPATIAL_SINGLE_TABLE_ROWS = Object.freeze([
  Object.freeze({
    title: 'Single Location Points',
    subtitle: 'Use when each row has one primary place.',
    fields: Object.freeze([
      Object.freeze({ label: 'Location/name', key: 'Point_Place', mappingType: 'point' }),
      Object.freeze({ label: 'Coordinate pair', key: 'Point_Coordinates', mappingType: 'point' }),
      Object.freeze({ label: 'Latitude', key: 'Point_Latitude', mappingType: 'point' }),
      Object.freeze({ label: 'Longitude', key: 'Point_Longitude', mappingType: 'point' }),
    ]),
  }),
  Object.freeze({
    title: 'Connected Locations',
    subtitle: 'Use when each row connects two places.',
    fields: Object.freeze([]),
  }),
  Object.freeze({
    title: 'Source/Start Location',
    compact: true,
    fields: Object.freeze([
      Object.freeze({ label: 'Location/name', key: 'Source_Location', mappingType: 'route' }),
      Object.freeze({ label: 'Coordinate pair', key: 'Source_Coordinates', mappingType: 'routePair' }),
      Object.freeze({ label: 'Latitude', key: 'Source_Latitude', mappingType: 'route' }),
      Object.freeze({ label: 'Longitude', key: 'Source_Longitude', mappingType: 'route' }),
    ]),
  }),
  Object.freeze({
    title: 'Target/End Location',
    compact: true,
    fields: Object.freeze([
      Object.freeze({ label: 'Location/name', key: 'Target_Location', mappingType: 'route' }),
      Object.freeze({ label: 'Coordinate pair', key: 'Target_Coordinates', mappingType: 'routePair' }),
      Object.freeze({ label: 'Latitude', key: 'Target_Latitude', mappingType: 'route' }),
      Object.freeze({ label: 'Longitude', key: 'Target_Longitude', mappingType: 'route' }),
    ]),
  }),
]);

function getSpatialDefinition(field) {
  return (
    PERIDOT_POINT_FIELD_DEFINITIONS_BY_KEY[field.key]
    || PERIDOT_ROUTE_COORDINATE_PAIR_FIELD_DEFINITIONS_BY_KEY[field.key]
    || PERIDOT_CORE_FIELD_DEFINITIONS_BY_KEY[field.key]
    || { key: field.key, label: field.label }
  );
}

function SpatialUsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-2">
        Location information supports point maps, route maps, Inspector records, search and filter, charts, and export.
      </p>
      <p className="mt-2">
        Use Single Location Points when each row has one place. Use Connected Locations when each row links a source/start place to a target/end place.
      </p>
      <p className="mt-2">
        Choose either a coordinate pair or separate latitude and longitude fields.
      </p>
    </aside>
  );
}

function SpatialSelect({ value, onChange, headers }) {
  return (
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className={SPATIAL_SELECT_CLASS}
    >
      <option value="">Unassigned</option>
      {headers.map((header) => (
        <option key={header} value={header}>{header}</option>
      ))}
    </select>
  );
}

function makeWorkbookFieldValue(ref = {}) {
  return ref?.sheetName && ref?.columnName ? `${ref.sheetName}::${ref.columnName}` : '';
}

function parseWorkbookFieldValue(value = '') {
  const separatorIndex = String(value).indexOf('::');
  if (separatorIndex < 0) return makeWorkbookColumnRef('', '');
  return makeWorkbookColumnRef(
    String(value).slice(0, separatorIndex),
    String(value).slice(separatorIndex + 2)
  );
}

function WorkbookFieldSelect({ workbookModel, currentRef = {}, onChange }) {
  const usableSheets = getUsableWorkbookSheets(workbookModel);

  return (
    <select
      value={makeWorkbookFieldValue(currentRef)}
      onChange={(event) => onChange(parseWorkbookFieldValue(event.target.value))}
      className={SPATIAL_SELECT_CLASS}
    >
      <option value="">Unassigned</option>
      {usableSheets.map((sheet) => (
        <optgroup key={sheet.sheetName} label={sheet.sheetName}>
          {(sheet.headers || []).map((header) => (
            <option key={`${sheet.sheetName}::${header}`} value={`${sheet.sheetName}::${header}`}>
              {sheet.sheetName} — {header}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function SpatialWorkbookSelect({ workbookModel, currentRef = {}, onChange }) {
  return (
    <WorkbookFieldSelect
      workbookModel={workbookModel}
      currentRef={currentRef}
      onChange={onChange}
    />
  );
}

function SpatialFieldGrid({ children }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {children}
    </div>
  );
}

function SpatialFieldShell({ field, children }) {
  const definition = getSpatialDefinition(field);
  return (
    <label className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">{field.label}</div>
      {children}
      <div className="mt-1 truncate text-[11px] text-[var(--panel-card-muted-text)]" title={definition.label || definition.key}>
        {definition.key}
      </div>
    </label>
  );
}

function getSpatialMappingValue(field, { pointMapping, coreMapping, routeCoordinatePairMapping }) {
  if (field.mappingType === 'point') return pointMapping?.[field.key] || '';
  if (field.mappingType === 'routePair') return routeCoordinatePairMapping?.[field.key] || '';
  return coreMapping?.[field.key] || '';
}

function getSpatialWorkbookMappingValue(field, workbookMapping) {
  if (field.mappingType === 'point') return workbookMapping?.pointMappings?.[field.key] || {};
  if (field.mappingType === 'routePair') return workbookMapping?.routeCoordinatePairMappings?.[field.key] || {};
  return workbookMapping?.coreMappings?.[field.key] || {};
}

function handleSpatialMappingChange(field, value, { onPointChange, onRouteChange, onRoutePairChange }) {
  if (field.mappingType === 'point') {
    onPointChange(field.key, value);
    return;
  }
  if (field.mappingType === 'routePair') {
    onRoutePairChange(field.key, value);
    return;
  }
  onRouteChange(field.key, value);
}

const EMPTY_PLACE_PART = Object.freeze({
  placeColumn: '',
  roleMode: 'heading',
  roleColumn: '',
  subjectParticipantIndex: '',
  coordinatePairColumn: '',
  latitudeColumn: '',
  longitudeColumn: '',
});

function placePartLabel(index) {
  return index < 26 ? `Place ${String.fromCharCode(65 + index)}` : `Place ${index + 1}`;
}

function PlaceExamples({ rows = [], sourceColumn = '' }) {
  const values = getNonBlankExampleValues(rows, sourceColumn, 3);
  if (!values.length) return null;
  return (
    <div className="mt-1.5 break-words text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <span className="font-semibold text-[var(--panel-card-text)]">Examples from your data:</span>{' '}
      {values.map((value, index) => (
        <React.Fragment key={`${sourceColumn}-${value}-${index}`}>
          {index ? ' · ' : ''}<span>{value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

const EMPTY_WORKBOOK_PLACE_PART = Object.freeze({
  placeRef: makeWorkbookColumnRef('', ''),
  roleMode: 'heading',
  roleRef: makeWorkbookColumnRef('', ''),
  subjectParticipantIndex: '',
  coordinatePairRef: makeWorkbookColumnRef('', ''),
  latitudeRef: makeWorkbookColumnRef('', ''),
  longitudeRef: makeWorkbookColumnRef('', ''),
});

function WorkbookPlaceExamples({ workbookModel, sourceRef = {} }) {
  if (!sourceRef?.sheetName || !sourceRef?.columnName) return null;
  const sheet = getWorkbookSheet(workbookModel, sourceRef.sheetName);
  return (
    <PlaceExamples
      rows={sheet?.rows || []}
      sourceColumn={sourceRef.columnName}
    />
  );
}

function WorkbookPlacePartCard({ part, index, workbookModel, relationshipParts = [], onChange, onRemove }) {
  const label = placePartLabel(index);
  const placeRef = part?.placeRef || makeWorkbookColumnRef('', '');
  const roleMode = part?.roleMode === 'column' ? 'column' : 'heading';
  const roleRef = part?.roleRef || makeWorkbookColumnRef('', '');
  const subjectParticipantIndex = Number.isInteger(part?.subjectParticipantIndex) ? part.subjectParticipantIndex : '';
  const coordinatePairRef = part?.coordinatePairRef || makeWorkbookColumnRef('', '');
  const latitudeRef = part?.latitudeRef || makeWorkbookColumnRef('', '');
  const longitudeRef = part?.longitudeRef || makeWorkbookColumnRef('', '');
  const headingLabel = placeRef?.columnName
    ? `${placeRef.sheetName} — ${placeRef.columnName}`
    : '';

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[16px] font-bold leading-tight text-[var(--panel-card-text)]">{label}</div>
        {index > 0 ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--panel-card-muted-text)] hover:text-[var(--panel-card-text)]"
          >
            Remove place
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Which column contains the place?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Choose the column whose values name or identify this place.
          </p>
        </div>
        <div className="min-w-0">
          <WorkbookFieldSelect
            workbookModel={workbookModel}
            currentRef={placeRef}
            onChange={(ref) => onChange({ placeRef: ref })}
          />
          <WorkbookPlaceExamples workbookModel={workbookModel} sourceRef={placeRef} />
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Where is the role of this place recorded?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            The role explains how this place is connected to the row, such as birthplace, residence, origin, destination, court, or repository.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`workbook-place-role-${index}`}
              checked={roleMode === 'heading'}
              onChange={() => onChange({ roleMode: 'heading', roleRef: makeWorkbookColumnRef('', '') })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">In the column heading</span>
              {headingLabel ? <span className="text-[var(--panel-card-muted-text)]"> — {headingLabel}</span> : null}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`workbook-place-role-${index}`}
              checked={roleMode === 'column'}
              onChange={() => onChange({ roleMode: 'column' })}
              className="mt-0.5"
            />
            <span className="font-semibold">In another column</span>
          </label>
          {roleMode === 'column' ? (
            <div>
              <WorkbookFieldSelect
                workbookModel={workbookModel}
                currentRef={roleRef}
                onChange={(ref) => onChange({ roleRef: ref })}
              />
              <WorkbookPlaceExamples workbookModel={workbookModel} sourceRef={roleRef} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Who or what does this place describe?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Connect this place to a relationship participant when it describes that person or other participant. Leave it attached to the row when it describes the event, record, object, or observation as a whole.
          </p>
        </div>
        <div>
          <select
            value={subjectParticipantIndex}
            onChange={(event) => onChange({ subjectParticipantIndex: event.target.value === '' ? '' : Number(event.target.value) })}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">This row / record as a whole</option>
            {(relationshipParts || []).map((relationshipPart, participantIndex) => {
              const participantRef = relationshipPart?.participantRef || makeWorkbookColumnRef('', '');
              const participantLabel = participantRef?.columnName
                ? `${participantRef.sheetName} — ${participantRef.columnName}`
                : `Relationship part ${participantIndex + 1}`;
              return <option key={`workbook-place-subject-${participantIndex}`} value={participantIndex}>{participantLabel}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div>
        <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Coordinates for this place <span className="font-normal text-[var(--panel-card-muted-text)]">(optional)</span></div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          Choose a combined coordinate column, or separate latitude and longitude columns, if your source records them.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Coordinate pair</div>
            <WorkbookFieldSelect
              workbookModel={workbookModel}
              currentRef={coordinatePairRef}
              onChange={(ref) => onChange({ coordinatePairRef: ref })}
            />
            <WorkbookPlaceExamples workbookModel={workbookModel} sourceRef={coordinatePairRef} />
          </label>
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Latitude</div>
            <WorkbookFieldSelect
              workbookModel={workbookModel}
              currentRef={latitudeRef}
              onChange={(ref) => onChange({ latitudeRef: ref })}
            />
            <WorkbookPlaceExamples workbookModel={workbookModel} sourceRef={latitudeRef} />
          </label>
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Longitude</div>
            <WorkbookFieldSelect
              workbookModel={workbookModel}
              currentRef={longitudeRef}
              onChange={(ref) => onChange({ longitudeRef: ref })}
            />
            <WorkbookPlaceExamples workbookModel={workbookModel} sourceRef={longitudeRef} />
          </label>
        </div>
      </div>
    </section>
  );
}

function PlacesIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Places</div>
      <div className="mt-1 text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">
        Where are the people, events, objects, records, or other information in each row located?
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        Choose any columns that identify places connected to this row. Your data may use one place, several places, or no places at all.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        <span className="font-semibold text-[var(--panel-card-text)]">Examples:</span> birthplace, place a letter was sent from or to, residence, court, archive, event location, stops along a journey, excavation site, etc.
      </p>
    </div>
  );
}

function PlacesUsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-3">Place information supports maps, Inspector records, search and filter, charts, and export.</p>
      <p className="mt-3">Coordinates allow Peridot to place locations on maps.</p>
      <p className="mt-3">If one row contains several places, Peridot can preserve each place and its role separately.</p>
    </aside>
  );
}

function PlacePartCard({ part, index, headers, rows, relationshipParts = [], onChange, onRemove }) {
  const label = placePartLabel(index);
  const selectedPlaceColumn = part?.placeColumn || '';
  const roleMode = part?.roleMode === 'column' ? 'column' : 'heading';
  const roleColumn = part?.roleColumn || '';
  const subjectParticipantIndex = Number.isInteger(part?.subjectParticipantIndex) ? part.subjectParticipantIndex : '';
  const coordinatePairColumn = part?.coordinatePairColumn || '';
  const latitudeColumn = part?.latitudeColumn || '';
  const longitudeColumn = part?.longitudeColumn || '';

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[16px] font-bold leading-tight text-[var(--panel-card-text)]">{label}</div>
        {index > 0 ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--panel-card-muted-text)] hover:text-[var(--panel-card-text)]"
          >
            Remove place
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Which column contains the place?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Choose the column whose values name or identify this place.
          </p>
        </div>
        <div className="min-w-0">
          <select
            value={selectedPlaceColumn}
            onChange={(event) => onChange({ placeColumn: event.target.value })}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">Unassigned</option>
            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
          <PlaceExamples rows={rows} sourceColumn={selectedPlaceColumn} />
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Which column contains the place?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Choose the column whose values name or identify this place.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`place-role-${index}`}
              checked={roleMode === 'heading'}
              onChange={() => onChange({ roleMode: 'heading', roleColumn: '' })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">In the column heading</span>
              {selectedPlaceColumn ? <span className="text-[var(--panel-card-muted-text)]"> — {selectedPlaceColumn}</span> : null}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`place-role-${index}`}
              checked={roleMode === 'column'}
              onChange={() => onChange({ roleMode: 'column' })}
              className="mt-0.5"
            />
            <span className="font-semibold">In another column</span>
          </label>
          {roleMode === 'column' ? (
            <div>
              <select
                value={roleColumn}
                onChange={(event) => onChange({ roleColumn: event.target.value })}
                className={SOURCE_SELECT_CLASS}
              >
                <option value="">Choose a role column</option>
                {headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
              <PlaceExamples rows={rows} sourceColumn={roleColumn} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Who or what does this place describe?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Connect this place to a relationship participant when it describes that person or other participant. Leave it attached to the row when it describes the event, record, object, or observation as a whole.
          </p>
        </div>
        <div>
          <select
            value={subjectParticipantIndex}
            onChange={(event) => onChange({ subjectParticipantIndex: event.target.value === '' ? '' : Number(event.target.value) })}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">This row / record as a whole</option>
            {(relationshipParts || []).map((relationshipPart, participantIndex) => {
              const participantLabel = relationshipPart?.participantColumn || `Relationship part ${participantIndex + 1}`;
              return <option key={`place-subject-${participantIndex}`} value={participantIndex}>{participantLabel}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div>
        <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Coordinates for this place <span className="font-normal text-[var(--panel-card-muted-text)]">(optional)</span></div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          Choose a combined coordinate column, or separate latitude and longitude columns, if your source records them.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Coordinate pair</div>
            <select
              value={coordinatePairColumn}
              onChange={(event) => onChange({ coordinatePairColumn: event.target.value })}
              className={SPATIAL_SELECT_CLASS}
            >
              <option value="">Unassigned</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
            <PlaceExamples rows={rows} sourceColumn={coordinatePairColumn} />
          </label>
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Latitude</div>
            <select
              value={latitudeColumn}
              onChange={(event) => onChange({ latitudeColumn: event.target.value })}
              className={SPATIAL_SELECT_CLASS}
            >
              <option value="">Unassigned</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
            <PlaceExamples rows={rows} sourceColumn={latitudeColumn} />
          </label>
          <label className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-[var(--panel-card-text)]">Longitude</div>
            <select
              value={longitudeColumn}
              onChange={(event) => onChange({ longitudeColumn: event.target.value })}
              className={SPATIAL_SELECT_CLASS}
            >
              <option value="">Unassigned</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
            <PlaceExamples rows={rows} sourceColumn={longitudeColumn} />
          </label>
        </div>
      </div>
    </section>
  );
}

export function SpatialMappingPanel({ headers, rows = [], placeParts = [], relationshipParts = [], onPlacePartsChange }) {
  const effectiveParts = placeParts.length ? placeParts : [{ ...EMPTY_PLACE_PART }];

  const updatePart = (index, patch) => {
    onPlacePartsChange?.(
      effectiveParts.map((part, currentIndex) => currentIndex === index ? { ...part, ...patch } : part)
    );
  };

  const addPart = () => {
    onPlacePartsChange?.([...effectiveParts, { ...EMPTY_PLACE_PART }]);
  };

  const removePart = (index) => {
    const next = effectiveParts.filter((_, currentIndex) => currentIndex !== index);
    onPlacePartsChange?.(next.length ? next : [{ ...EMPTY_PLACE_PART }]);
  };

  return (
    <div className="space-y-3">
      <PlacesIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            {effectiveParts.map((part, index) => (
              <PlacePartCard
                key={`place-part-${index}`}
                part={part}
                index={index}
                headers={headers}
                rows={rows}
                relationshipParts={relationshipParts}
                onChange={(patch) => updatePart(index, patch)}
                onRemove={() => removePart(index)}
              />
            ))}
            <button
              type="button"
              onClick={addPart}
              className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]"
            >
              + Add another place
            </button>
          </div>
          <PlacesUsagePanel />
        </div>
      </div>
    </div>
  );
}

export function WorkbookSpatialMappingPanel({ workbookModel, placeParts = [], relationshipParts = [], onPlacePartsChange }) {
  const effectiveParts = placeParts.length ? placeParts : [{ ...EMPTY_WORKBOOK_PLACE_PART }];

  const updatePart = (index, patch) => {
    onPlacePartsChange?.(
      effectiveParts.map((part, currentIndex) => currentIndex === index ? { ...part, ...patch } : part)
    );
  };

  const addPart = () => {
    onPlacePartsChange?.([...effectiveParts, { ...EMPTY_WORKBOOK_PLACE_PART }]);
  };

  const removePart = (index) => {
    const next = effectiveParts.filter((_, currentIndex) => currentIndex !== index);
    onPlacePartsChange?.(next.length ? next : [{ ...EMPTY_WORKBOOK_PLACE_PART }]);
  };

  return (
    <div className="space-y-3">
      <PlacesIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            {effectiveParts.map((part, index) => (
              <WorkbookPlacePartCard
                key={`workbook-place-part-${index}`}
                part={part}
                index={index}
                workbookModel={workbookModel}
                relationshipParts={relationshipParts}
                onChange={(patch) => updatePart(index, patch)}
                onRemove={() => removePart(index)}
              />
            ))}
            <button
              type="button"
              onClick={addPart}
              className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]"
            >
              + Add another place
            </button>
          </div>
          <PlacesUsagePanel />
        </div>
      </div>
    </div>
  );
}



const EMPTY_RELATIONSHIP_PART = Object.freeze({
  participantColumn: '',
  roleMode: 'heading',
  roleColumn: '',
});

function RelationshipIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Relations</div>
      <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">What connections are recorded in each row?</div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Choose the columns that identify the people, places, organizations, objects, or other things connected by this row. A relationship can have two parts or many parts.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        <span className="font-semibold text-[var(--panel-card-text)]">Examples:</span> sender and recipient of a letter, parent and child, members of a family, origin and destination, people involved in a legal case, owner and object, organization and member, etc.
      </p>
    </div>
  );
}

function RelationshipExamples({ rows = [], sourceColumn = '' }) {
  if (!sourceColumn) return null;
  const examples = [];
  const seen = new Set();

  for (const row of rows) {
    const value = String(row?.[sourceColumn] ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    examples.push(value);
    if (examples.length >= 3) break;
  }

  if (!examples.length) return null;

  return (
    <div className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <span className="font-semibold text-[var(--panel-card-text)]">Examples from your data:</span>{' '}
      {examples.join(' · ')}
    </div>
  );
}

function RelationshipUsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-3">
        Relationship information supports network visualizations, Inspector records, search and filter, charts, and export.
      </p>
      <p className="mt-3">
        Each part of a relationship can have its own role.
      </p>
      <p className="mt-3">
        Relationships may include two participants or many participants.
      </p>
    </aside>
  );
}

function RelationshipPartCard({ part, index, headers, rows, onChange, onRemove, canRemove }) {
  const participantColumn = part?.participantColumn || '';
  const roleMode = part?.roleMode === 'column' ? 'column' : 'heading';
  const roleColumn = part?.roleColumn || '';
  const letter = String.fromCharCode(65 + index);

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-[var(--panel-card-text)]">Part {letter}</div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            {index === 0
              ? 'This might be the sender of a letter, the place of origin, a person on a family tree, an organization, an object, or another participant.'
              : index === 1
                ? 'This might be the recipient of a letter, the destination or a stop along a journey, a relative of Part A on a family tree, or another participant.'
                : 'Add another person, place, organization, object, or other participant in this relationship.'}
          </p>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--panel-card-muted-text)] hover:text-[var(--panel-card-text)]"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Which column contains this part of the relationship?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Choose the column whose values identify the person, place, organization, object, or other participant.
          </p>
        </div>
        <div>
          <select
            value={participantColumn}
            onChange={(event) => onChange({ participantColumn: event.target.value })}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">Unassigned</option>
            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
          <RelationshipExamples rows={rows} sourceColumn={participantColumn} />
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Where is this part&apos;s role recorded?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            The role explains how this participant takes part in the relationship, such as sender, recipient, mother, child, witness, owner, or member.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`relationship-role-${index}`}
              checked={roleMode === 'heading'}
              onChange={() => onChange({ roleMode: 'heading', roleColumn: '' })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">In the column heading</span>
              {participantColumn ? <span className="text-[var(--panel-card-muted-text)]"> — {participantColumn}</span> : null}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`relationship-role-${index}`}
              checked={roleMode === 'column'}
              onChange={() => onChange({ roleMode: 'column' })}
              className="mt-0.5"
            />
            <span className="font-semibold">In another column</span>
          </label>
          {roleMode === 'column' ? (
            <div>
              <select
                value={roleColumn}
                onChange={(event) => onChange({ roleColumn: event.target.value })}
                className={SOURCE_SELECT_CLASS}
              >
                <option value="">Choose a role column</option>
                {headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
              <RelationshipExamples rows={rows} sourceColumn={roleColumn} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RelationshipMetadataSection({
  headers,
  rows,
  relationshipMetadataMapping = {},
  onMetadataChange,
}) {
  const relationshipTypeColumn = relationshipMetadataMapping?.Relationship_Type || '';
  const relationshipLabelColumn = relationshipMetadataMapping?.Relationship_Label || '';

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 p-4">
      <div className="text-lg font-bold text-[var(--panel-card-text)]">Relationship information <span className="font-normal text-[var(--panel-card-muted-text)]">(optional)</span></div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Map columns that describe the relationship as a whole rather than one participant&apos;s role.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="min-w-0">
          <div className="mb-1 text-sm font-semibold text-[var(--panel-card-text)]">Relationship type</div>
          <select
            value={relationshipTypeColumn}
            onChange={(event) => onMetadataChange('Relationship_Type', event.target.value)}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">Unassigned</option>
            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
          <RelationshipExamples rows={rows} sourceColumn={relationshipTypeColumn} />
        </label>
        <label className="min-w-0">
          <div className="mb-1 text-sm font-semibold text-[var(--panel-card-text)]">Relationship label or description</div>
          <select
            value={relationshipLabelColumn}
            onChange={(event) => onMetadataChange('Relationship_Label', event.target.value)}
            className={SOURCE_SELECT_CLASS}
          >
            <option value="">Unassigned</option>
            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
          <RelationshipExamples rows={rows} sourceColumn={relationshipLabelColumn} />
        </label>
      </div>
    </section>
  );
}

export function RelationshipMappingPanel({
  headers,
  rows = [],
  relationshipParts = [],
  relationshipMetadataMapping = {},
  onRelationshipPartsChange,
  onMetadataChange,
}) {
  const effectiveParts = relationshipParts.length >= 2
    ? relationshipParts
    : [
        ...(relationshipParts || []),
        ...Array.from({ length: Math.max(0, 2 - (relationshipParts || []).length) }, () => ({ ...EMPTY_RELATIONSHIP_PART })),
      ];

  const updatePart = (index, patch) => {
    onRelationshipPartsChange?.(
      effectiveParts.map((part, currentIndex) => currentIndex === index ? { ...part, ...patch } : part)
    );
  };

  const addPart = () => {
    onRelationshipPartsChange?.([...effectiveParts, { ...EMPTY_RELATIONSHIP_PART }]);
  };

  const removePart = (index) => {
    const next = effectiveParts.filter((_, currentIndex) => currentIndex !== index);
    onRelationshipPartsChange?.(next.length >= 2 ? next : effectiveParts);
  };

  return (
    <div className="space-y-3">
      <RelationshipIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            {effectiveParts.map((part, index) => (
              <RelationshipPartCard
                key={`relationship-part-${index}`}
                part={part}
                index={index}
                headers={headers}
                rows={rows}
                onChange={(patch) => updatePart(index, patch)}
                onRemove={() => removePart(index)}
                canRemove={effectiveParts.length > 2}
              />
            ))}
            <button
              type="button"
              onClick={addPart}
              className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]"
            >
              + Add another part
            </button>
            <RelationshipMetadataSection
              headers={headers}
              rows={rows}
              relationshipMetadataMapping={relationshipMetadataMapping}
              onMetadataChange={onMetadataChange}
            />
          </div>
          <RelationshipUsagePanel />
        </div>
      </div>
    </div>
  );
}

function WorkbookRelationshipExamples({ workbookModel, sourceRef = {} }) {
  if (!sourceRef?.sheetName || !sourceRef?.columnName) return null;
  const sheet = getWorkbookSheet(workbookModel, sourceRef.sheetName);
  return <RelationshipExamples rows={sheet?.rows || []} sourceColumn={sourceRef.columnName} />;
}

const EMPTY_WORKBOOK_RELATIONSHIP_PART = Object.freeze({
  participantRef: makeWorkbookColumnRef('', ''),
  roleMode: 'heading',
  roleRef: makeWorkbookColumnRef('', ''),
});

function WorkbookRelationshipPartCard({ part, index, workbookModel, onChange, onRemove, canRemove }) {
  const participantRef = part?.participantRef || makeWorkbookColumnRef('', '');
  const roleMode = part?.roleMode === 'column' ? 'column' : 'heading';
  const roleRef = part?.roleRef || makeWorkbookColumnRef('', '');
  const letter = String.fromCharCode(65 + index);
  const headingLabel = participantRef?.columnName ? `${participantRef.sheetName} — ${participantRef.columnName}` : '';

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-[var(--panel-card-text)]">Part {letter}</div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            {index === 0
              ? 'This might be the sender of a letter, the place of origin, a person on a family tree, an organization, an object, or another participant.'
              : index === 1
                ? 'This might be the recipient of a letter, the destination or a stop along a journey, a relative of Part A on a family tree, or another participant.'
                : 'Add another person, place, organization, object, or other participant in this relationship.'}
          </p>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--panel-card-muted-text)] hover:text-[var(--panel-card-text)]"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Which column contains this part of the relationship?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Choose the sheet and column whose values identify the person, place, organization, object, or other participant.
          </p>
        </div>
        <div>
          <WorkbookFieldSelect
            workbookModel={workbookModel}
            currentRef={participantRef}
            onChange={(ref) => onChange({ participantRef: ref })}
          />
          <WorkbookRelationshipExamples workbookModel={workbookModel} sourceRef={participantRef} />
        </div>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(16rem,1.1fr)]">
        <div>
          <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Where is this part&apos;s role recorded?</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            The role explains how this participant takes part in the relationship, such as sender, recipient, mother, child, witness, owner, or member.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`workbook-relationship-role-${index}`}
              checked={roleMode === 'heading'}
              onChange={() => onChange({ roleMode: 'heading', roleRef: makeWorkbookColumnRef('', '') })}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">In the column heading</span>
              {headingLabel ? <span className="text-[var(--panel-card-muted-text)]"> — {headingLabel}</span> : null}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2.5 text-sm text-[var(--panel-card-text)]">
            <input
              type="radio"
              name={`workbook-relationship-role-${index}`}
              checked={roleMode === 'column'}
              onChange={() => onChange({ roleMode: 'column' })}
              className="mt-0.5"
            />
            <span className="font-semibold">In another column</span>
          </label>

          {roleMode === 'column' ? (
            <div>
              <WorkbookFieldSelect
                workbookModel={workbookModel}
                currentRef={roleRef}
                onChange={(ref) => onChange({ roleRef: ref })}
              />
              <WorkbookRelationshipExamples workbookModel={workbookModel} sourceRef={roleRef} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function WorkbookRelationshipMetadataSection({ workbookModel, relationshipMetadataMappings = {}, onMetadataChange }) {
  const relationshipTypeRef = relationshipMetadataMappings?.Relationship_Type || makeWorkbookColumnRef('', '');
  const relationshipLabelRef = relationshipMetadataMappings?.Relationship_Label || makeWorkbookColumnRef('', '');

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 p-4">
      <div className="text-lg font-bold text-[var(--panel-card-text)]">
        Relationship information <span className="font-normal text-[var(--panel-card-muted-text)]">(optional)</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Map columns that describe the relationship as a whole rather than one participant&apos;s role.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="min-w-0">
          <div className="mb-1 text-sm font-semibold text-[var(--panel-card-text)]">Relationship type</div>
          <WorkbookFieldSelect
            workbookModel={workbookModel}
            currentRef={relationshipTypeRef}
            onChange={(ref) => onMetadataChange('Relationship_Type', ref)}
          />
          <WorkbookRelationshipExamples workbookModel={workbookModel} sourceRef={relationshipTypeRef} />
        </label>

        <label className="min-w-0">
          <div className="mb-1 text-sm font-semibold text-[var(--panel-card-text)]">Relationship label or description</div>
          <WorkbookFieldSelect
            workbookModel={workbookModel}
            currentRef={relationshipLabelRef}
            onChange={(ref) => onMetadataChange('Relationship_Label', ref)}
          />
          <WorkbookRelationshipExamples workbookModel={workbookModel} sourceRef={relationshipLabelRef} />
        </label>
      </div>
    </section>
  );
}

export function WorkbookRelationshipMappingPanel({ workbookModel, workbookMapping = {}, onRelationshipPartsChange, onMetadataChange }) {
  const relationshipParts = Array.isArray(workbookMapping.relationshipParts) ? workbookMapping.relationshipParts : [];
  const effectiveParts = relationshipParts.length >= 2
    ? relationshipParts
    : [
        ...relationshipParts,
        ...Array.from({ length: Math.max(0, 2 - relationshipParts.length) }, () => ({ ...EMPTY_WORKBOOK_RELATIONSHIP_PART })),
      ];

  const updatePart = (index, patch) => {
    onRelationshipPartsChange?.(
      effectiveParts.map((part, currentIndex) => currentIndex === index ? { ...part, ...patch } : part)
    );
  };

  const addPart = () => {
    onRelationshipPartsChange?.([
      ...effectiveParts,
      { participantRef: makeWorkbookColumnRef('', ''), roleMode: 'heading', roleRef: makeWorkbookColumnRef('', '') },
    ]);
  };

  const removePart = (index) => {
    const next = effectiveParts.filter((_, currentIndex) => currentIndex !== index);
    onRelationshipPartsChange?.(next.length >= 2 ? next : effectiveParts);
  };

  return (
    <div className="space-y-3">
      <RelationshipIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            {effectiveParts.map((part, index) => (
              <WorkbookRelationshipPartCard
                key={`workbook-relationship-part-${index}`}
                part={part}
                index={index}
                workbookModel={workbookModel}
                onChange={(patch) => updatePart(index, patch)}
                onRemove={() => removePart(index)}
                canRemove={effectiveParts.length > 2}
              />
            ))}

            <button
              type="button"
              onClick={addPart}
              className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]"
            >
              + Add another part
            </button>

            <WorkbookRelationshipMetadataSection
              workbookModel={workbookModel}
              relationshipMetadataMappings={workbookMapping.relationshipMetadataMappings || {}}
              onMetadataChange={onMetadataChange}
            />
          </div>
          <RelationshipUsagePanel />
        </div>
      </div>
    </div>
  );
}

/*
 * Renders workbook temporal mappings. Workbook mappings differ from ordinary
 * table mappings because each role points to a sheet/column pair rather than a
 * single flat uploaded column name. The visual pattern mirrors the single-table
 * Time step with one shared usage note.
 */
export function WorkbookTemporalMappingTable({ workbookModel, workbookMapping, onChange, onNoteChange }) {
  const temporalMappings = workbookMapping.temporalMappings || {};

  return (
    <div className="space-y-3">
      <TemporalIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0">
            <div className="grid grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.1fr)] gap-4 border-b border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-3 text-sm font-semibold text-[var(--panel-card-text)]">
              <div>When it happens</div>
              <div>Your column</div>
            </div>

            <div className="divide-y divide-[var(--panel-card-border)] rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35">
              {VISIBLE_TEMPORAL_FIELD_DEFINITIONS.map((definition) => {
                const currentRef = temporalMappings[definition.key] || {};
                const uiCopy = TEMPORAL_UI_COPY[definition.key] || { label: definition.label || definition.key, description: definition.description || '' };
                const sourceSheet = currentRef?.sheetName ? getWorkbookSheet(workbookModel, currentRef.sheetName) : null;
                const examples = getNonBlankExampleValues(sourceSheet?.rows || [], currentRef?.columnName || '', 3);
                return (
                  <div
                    key={definition.key}
                    className="grid grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.1fr)] gap-4 px-4 py-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">{uiCopy.label}</div>
                      <p className="mt-2 text-sm font-normal leading-relaxed text-[var(--panel-card-muted-text)]">{uiCopy.description}</p>
                    </div>
                    <div className="peridot-mapping-choice-cell min-w-0">
                      <WorkbookFieldSelect
                        workbookModel={workbookModel}
                        currentRef={currentRef}
                        onChange={(ref) => onChange(definition.key, ref)}
                      />
                      <TemporalExamples values={examples} />
                      <div className="mt-3 border-t border-[var(--panel-card-border)] pt-3">
                        <div className="text-xs font-semibold text-[var(--muted-text)]">Related temporal notes (optional)</div>
                        {(workbookMapping.temporalNoteMappings?.[definition.key] || []).map((noteRef, noteIndex) => (
                          <div key={`${definition.key}-workbook-note-${noteIndex}`} className="mt-2 flex gap-2">
                            <WorkbookFieldSelect workbookModel={workbookModel} currentRef={noteRef || {}} onChange={(ref) => onNoteChange?.(definition.key, noteIndex, ref)} />
                            <button type="button" onClick={() => onNoteChange?.(definition.key, noteIndex, null)} className="rounded-lg border border-[var(--input-border)] px-2 text-xs text-[var(--panel-card-muted-text)]">Remove</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => onNoteChange?.(definition.key, (workbookMapping.temporalNoteMappings?.[definition.key] || []).length, { __add: true })} className="mt-3 rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]">+ Add related note column</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <TemporalUsagePanel />
        </div>
      </div>
    </div>
  );
}

/*
 * Renders workbook role mappings for caller-supplied role definitions. This is
 * the workbook counterpart to `CoreRoleMappingTable`: every mapping value is a
 * workbook column ref, and the modal remains responsible for updating the
 * workbook mapping state when a selection changes.
 */
export function WorkbookCoreRoleMappingTable({ title, description, guidanceLabel, guidanceText, definitions, workbookModel, workbookMapping, onChange }) {
  const coreMappings = workbookMapping.coreMappings || {};

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">{title}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--panel-card-text)]">{description}</div>
        </div>
        {guidanceLabel ? <span className="peridot-mapping-priority-badge">{guidanceLabel}</span> : null}
      </div>
      {guidanceText ? <p className="mt-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">{guidanceText}</p> : null}

      <div className="peridot-mapping-table-wrap mt-4 overflow-x-auto rounded-xl border border-[var(--panel-card-border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--stat-card-bg)] text-[var(--panel-card-text)]">
            <tr>
              <th className="px-4 py-3">Field role</th>
              <th className="px-4 py-3">Your column</th>
              <th className="px-4 py-3">Used for</th>
            </tr>
          </thead>
          <tbody className="text-[var(--panel-card-muted-text)]">
            {definitions.map((definition) => {
              const currentRef = coreMappings[definition.key] || {};
              return (
                <tr key={definition.key} className="border-t border-[var(--panel-card-border)] align-top">
                  <td className="px-4 py-3">
                    <RoleCell definition={definition} />
                  </td>
                  <td className="peridot-mapping-choice-cell px-4 py-3">
                    <WorkbookFieldSelect
                      workbookModel={workbookModel}
                      currentRef={currentRef}
                      onChange={(ref) => onChange(definition.key, ref)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UsedForBadges items={definition.usedFor || []} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
