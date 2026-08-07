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
 * The Time step is intentionally not a dense reference table. It has only three
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
        Choose any columns that tell Peridot when a record, event, person, place, object, measurement, or other item belongs in time. Your data may use one, several, or none of these.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        <span className="font-semibold text-[var(--panel-card-text)]">Examples:</span> date on a letter, timeframe of a journey, publication date, lifespans, etc.
      </p>
    </div>
  );
}

export function TemporalMappingTable({ headers, rows = [], temporalMapping = {}, onChange }) {
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
        Peridot will display the selected single date, or compose a date span from Date start and Date end.
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

export function SpatialMappingPanel({ headers, pointMapping = {}, coreMapping = {}, routeCoordinatePairMapping = {}, onPointChange, onRouteChange, onRoutePairChange }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          <div className="rounded-t-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-card-text)]">
            Location Role
          </div>
          <div className="rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-4 py-2">
            {SPATIAL_SINGLE_TABLE_ROWS.map((row, rowIndex) => {
              const isSourceRow = row.title === 'Source/Start Location';
              const isTargetRow = row.title === 'Target/End Location';

              if (!row.fields.length) {
                return (
                  <div key={row.title} className="pb-0 pt-2">
                    <SectionDivider />
                    <div className="pt-1 text-[16px] font-bold leading-tight text-[var(--panel-card-text)]">{row.title}</div>
                  </div>
                );
              }

              return (
                <section
                  key={row.title}
                  className={[
                    'space-y-2 py-2.5',
                    rowIndex === 0 ? 'pt-1' : '',
                    isSourceRow ? 'pt-2' : '',
                    isTargetRow ? 'pt-2' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">{row.title}</div>
                  <SpatialFieldGrid>
                    {row.fields.map((field) => (
                      <SpatialFieldShell key={field.key} field={field}>
                        <SpatialSelect
                          headers={headers}
                          value={getSpatialMappingValue(field, { pointMapping, coreMapping, routeCoordinatePairMapping })}
                          onChange={(value) => handleSpatialMappingChange(field, value, { onPointChange, onRouteChange, onRoutePairChange })}
                        />
                      </SpatialFieldShell>
                    ))}
                  </SpatialFieldGrid>
                </section>
              );
            })}
          </div>
        </div>
        <SpatialUsagePanel />
      </div>
    </div>
  );
}

export function WorkbookSpatialMappingPanel({ workbookModel, workbookMapping = {}, onPointChange, onRouteChange, onRoutePairChange }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          <div className="rounded-t-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-card-text)]">
            Location Role
          </div>
          <div className="rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-4 py-2">
            {SPATIAL_SINGLE_TABLE_ROWS.map((row, rowIndex) => {
              const isSourceRow = row.title === 'Source/Start Location';
              const isTargetRow = row.title === 'Target/End Location';

              if (!row.fields.length) {
                return (
                  <div key={row.title} className="pb-0 pt-2">
                    <SectionDivider />
                    <div className="pt-1 text-[16px] font-bold leading-tight text-[var(--panel-card-text)]">{row.title}</div>
                  </div>
                );
              }

              return (
                <section
                  key={row.title}
                  className={[
                    'space-y-2 py-2.5',
                    rowIndex === 0 ? 'pt-1' : '',
                    isSourceRow ? 'pt-2' : '',
                    isTargetRow ? 'pt-2' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">{row.title}</div>
                  <SpatialFieldGrid>
                    {row.fields.map((field) => (
                      <SpatialFieldShell key={field.key} field={field}>
                        <SpatialWorkbookSelect
                          workbookModel={workbookModel}
                          workbookMapping={workbookMapping}
                          currentRef={getSpatialWorkbookMappingValue(field, workbookMapping)}
                          onChange={(value) => handleSpatialMappingChange(field, value, { onPointChange, onRouteChange, onRoutePairChange })}
                        />
                      </SpatialFieldShell>
                    ))}
                  </SpatialFieldGrid>
                </section>
              );
            })}
          </div>
        </div>
        <SpatialUsagePanel />
      </div>
    </div>
  );
}


const RELATIONSHIP_SINGLE_TABLE_FIELDS = Object.freeze([
  Object.freeze({ label: 'Source entity', key: 'Source_Name', mappingType: 'core' }),
  Object.freeze({ label: 'Target entity', key: 'Target_Name', mappingType: 'core' }),
  Object.freeze({ label: 'Relationship type', key: 'Relationship_Type', mappingType: 'metadata' }),
  Object.freeze({ label: 'Label/Note', key: 'Relationship_Label', mappingType: 'metadata' }),
]);

const RELATIONSHIP_METADATA_DEFINITIONS = Object.freeze({
  Relationship_Type: Object.freeze({ key: 'Relationship_Type', label: 'Relationship type' }),
  Relationship_Label: Object.freeze({ key: 'Relationship_Label', label: 'Label/Note' }),
});

function getRelationshipDefinition(field) {
  return (
    PERIDOT_CORE_FIELD_DEFINITIONS_BY_KEY[field.key]
    || RELATIONSHIP_METADATA_DEFINITIONS[field.key]
    || { key: field.key, label: field.label }
  );
}

function RelationshipUsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-2">
        Relationship information supports network graphs, connected-correspondent views, Inspector records, search and filter, charts, and export.
      </p>
      <p className="mt-2">
        Use this step when each row links one entity to another.
      </p>
      <p className="mt-2">
        Point/site datasets can leave these fields unassigned.
      </p>
    </aside>
  );
}

function RelationshipFieldGrid({ children }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {children}
    </div>
  );
}

function RelationshipFieldShell({ field, children }) {
  const definition = getRelationshipDefinition(field);
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

function getRelationshipMappingValue(field, { coreMapping, relationshipMetadataMapping }) {
  if (field.mappingType === 'metadata') return relationshipMetadataMapping?.[field.key] || '';
  return coreMapping?.[field.key] || '';
}

function getRelationshipWorkbookMappingValue(field, workbookMapping) {
  if (field.mappingType === 'metadata') return workbookMapping?.relationshipMetadataMappings?.[field.key] || {};
  return workbookMapping?.coreMappings?.[field.key] || {};
}

function handleRelationshipMappingChange(field, value, { onCoreChange, onMetadataChange }) {
  if (field.mappingType === 'metadata') {
    onMetadataChange(field.key, value);
    return;
  }
  onCoreChange(field.key, value);
}

export function RelationshipMappingPanel({ headers, coreMapping = {}, relationshipMetadataMapping = {}, onCoreChange, onMetadataChange }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          <div className="rounded-t-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-card-text)]">
            Relationship Role
          </div>
          <div className="rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-4 py-3">
            <section className="space-y-2">
              <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Connected Entities</div>
              <RelationshipFieldGrid>
                {RELATIONSHIP_SINGLE_TABLE_FIELDS.map((field) => (
                  <RelationshipFieldShell key={field.key} field={field}>
                    <SpatialSelect
                      headers={headers}
                      value={getRelationshipMappingValue(field, { coreMapping, relationshipMetadataMapping })}
                      onChange={(value) => handleRelationshipMappingChange(field, value, { onCoreChange, onMetadataChange })}
                    />
                  </RelationshipFieldShell>
                ))}
              </RelationshipFieldGrid>
            </section>
          </div>
        </div>
        <RelationshipUsagePanel />
      </div>
    </div>
  );
}

export function WorkbookRelationshipMappingPanel({ workbookModel, workbookMapping = {}, onCoreChange, onMetadataChange }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          <div className="rounded-t-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-card-text)]">
            Relationship Role
          </div>
          <div className="rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-4 py-3">
            <section className="space-y-2">
              <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Connected Entities</div>
              <RelationshipFieldGrid>
                {RELATIONSHIP_SINGLE_TABLE_FIELDS.map((field) => (
                  <RelationshipFieldShell key={field.key} field={field}>
                    <SpatialWorkbookSelect
                      workbookModel={workbookModel}
                      workbookMapping={workbookMapping}
                      currentRef={getRelationshipWorkbookMappingValue(field, workbookMapping)}
                      onChange={(value) => handleRelationshipMappingChange(field, value, { onCoreChange, onMetadataChange })}
                    />
                  </RelationshipFieldShell>
                ))}
              </RelationshipFieldGrid>
            </section>
          </div>
        </div>
        <RelationshipUsagePanel />
      </div>
    </div>
  );
}

/*
 * Renders workbook temporal mappings. Workbook mappings differ from ordinary
 * table mappings because each role points to a sheet/column pair rather than a
 * single flat uploaded column name. The visual pattern mirrors the single-table
 * Time step: three visible date decisions plus one shared usage note.
 */
export function WorkbookTemporalMappingTable({ workbookModel, workbookMapping, onChange }) {
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
