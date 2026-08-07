/*
 * Role-based column and workbook mapping workspace.
 * 
 * This large component lets users map arbitrary CSV/TSV/Excel tables into Peridot's internal record model. It supports single-table mapping, workbook primary-sheet selection, user-configured unique-ID joins, field-role mapping, evidence/analysis include/ignore choices, and capability review before import.
 * 
 * Important relationships:
 * - Mapping constants and pure mapping logic live in `peridotColumnMapping.js` and `peridotWorkbookMapping.js`.
 * - Capability summaries come from `peridotDataCapabilityAudit.js`.
 * - `App.jsx` owns the staged upload/workbook state and receives the assembled Peridot rows.
 * 
 * Maintenance cautions:
 * - This file is a major structural pain point because UI flow, validation display, and mapping controls are concentrated here. Prefer extracting step components only in a dedicated structural pass.
 * - Preserve the distinction between correspondence-compatible roles and broader humanistic-data roles.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PERIDOT_TEMPLATE_COLUMNS } from './peridotCsvSchema.js';
import { getPeridotDatasetProfile, isPeridotGenealogyProfile } from './peridotDatasetProfiles.js';
import {
  applyPeridotGenealogySupplementalRowActions,
  buildPeridotGenealogyCapabilitySummary,
  getPeridotGenealogySupplementalRows,
  makePeridotGenealogyWorkbookColumnRef,
  validatePeridotGenealogyMappingWithRowActions,
} from './peridotGenealogyMapping.js';
import { buildPeridotCsvValidationSummary } from './peridotCsvValidation.js';
import {
  applyPeridotColumnMapping,
  buildInitialPeridotColumnMappingState,
  CUSTOM_INSPECTOR_FIELD_DEFAULTS,
  PERIDOT_CORE_FIELD_DEFINITIONS,
  validatePeridotColumnMapping,
} from './peridotColumnMapping.js';
import {
  buildPeridotRowsFromWorkbookMapping,
  buildWorkbookCustomFieldSelectionsForSheet,
  getLetterIdJoinMatchSummary,
  getUsableWorkbookSheets,
  getWorkbookMappingSummary,
  getWorkbookSheet,
  makeLetterIdJoin,
  makeWorkbookColumnRef,
  previewWorkbookCoreMappedRows,
  suggestDefaultLetterIdJoinForSheet,
  suggestSharedLetterIdJoins,
  suggestWorkbookCoreMappings,
  suggestWorkbookPointMappings,
  suggestWorkbookRouteCoordinatePairMappings,
  suggestWorkbookTemporalMappings,
  validatePeridotWorkbookMapping,
} from './peridotWorkbookMapping.js';
import { auditPeridotDataCapabilities } from './peridotDataCapabilityAudit.js';
import {
  CORE_FIELD_GROUPS,
  definitionsForFields,
  formatCapabilityName,
  formatRecordShapeName,
  GENEALOGY_STEP_KEYS,
  SINGLE_TABLE_STEP_KEYS,
  WORKBOOK_STEP_KEYS,
} from './peridotColumnMappingUiConfig.js';
import {
  CoreRoleMappingTable,
  RelationshipMappingPanel,
  SpatialMappingPanel,
  TemporalMappingTable,
  WorkbookCoreRoleMappingTable,
  WorkbookRelationshipMappingPanel,
  WorkbookSpatialMappingPanel,
  WorkbookTemporalMappingTable,
} from './PeridotMappingFieldControls.jsx';
import {
  GenealogyAttributesStep,
  GenealogyIdentityStep,
  GenealogyLifeEventsStep,
  GenealogyParentsStep,
  GenealogyPartnersStep,
  GenealogyPlacesStep,
  GenealogyReviewPanel,
} from './PeridotGenealogyMappingControls.jsx';
import {
  buildWorkbookSelectionLabel,
  getWorkbookSelectionRef,
  InspectorFieldsStep,
  makeWorkbookSelectionKey,
  WorkbookInspectorFieldsStep,
} from './PeridotEvidenceFieldControls.jsx';

function normalizeAction(action) {
  return action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
    ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
    : CUSTOM_INSPECTOR_FIELD_DEFAULTS.include;
}

function buttonClassName({ active = false, variant = 'secondary' } = {}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--shell-bg)]';
  const variants = {
    primary: 'border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)] shadow-[0_8px_18px_var(--peridot-color-rgba-rgba-0-0-0-0-28)] disabled:cursor-not-allowed disabled:opacity-50',
    secondary: 'border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-50',
    ghost: 'bg-[transparent] text-[var(--muted-text)] hover:bg-[var(--ghost-hover)] hover:text-[var(--text-main)]',
    danger: 'border border-[var(--peridot-role-status-danger-border)] bg-[var(--peridot-role-status-danger-bg)] text-[var(--peridot-role-status-danger-text)] hover:bg-[var(--peridot-role-status-danger-bg)]',
  };

  if (active) {
    return `${base} border border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)] shadow-[0_10px_22px_var(--peridot-color-rgba-rgba-0-0-0-0-3)] hover:bg-[var(--button-primary-active-hover)]`;
  }
  return `${base} ${variants[variant] || variants.secondary}`;
}

function StepButton({ active, label, index, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={[
        'peridot-mapping-step-button',
        active ? 'peridot-mapping-step-button-active' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--peridot-mapping-step-delay': `${760 + index * 170}ms` }}
      aria-current={active ? 'step' : undefined}
    >
      <span className="peridot-mapping-step-number">{index + 1}</span>
      <span className="peridot-mapping-step-label">{label}</span>
    </button>
  );
}

function formatPreviewCount(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : value;
}

function PreviewTable({ rows = [], headers = [], maxRows = 11, totalRows, sheetName }) {
  const displayHeaders = headers;
  const showAllRows = maxRows == null;
  const displayRows = showAllRows ? rows : rows.slice(0, maxRows);
  const effectiveTotalRows = totalRows ?? rows.length;
  const footerText = showAllRows
    ? sheetName
      ? `Showing all ${formatPreviewCount(effectiveTotalRows)} rows on sheet “${sheetName}.” Scroll to inspect the source data.`
      : `Showing all ${formatPreviewCount(effectiveTotalRows)} rows. Scroll to inspect the source data.`
    : sheetName
      ? `Showing ${formatPreviewCount(displayRows.length)} of ${formatPreviewCount(effectiveTotalRows)} rows on sheet “${sheetName}.”`
      : `Showing ${formatPreviewCount(displayRows.length)} of ${formatPreviewCount(effectiveTotalRows)} rows.`;

  if (!displayRows.length || !displayHeaders.length) {
    return (
      <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm text-[var(--panel-card-muted-text)]">
        No preview rows available.
      </div>
    );
  }

  return (
    <div className={[
      'peridot-mapping-table-wrap rounded-2xl border border-[var(--panel-card-border)]',
      showAllRows ? 'peridot-mapping-table-wrap-full-preview' : '',
    ].filter(Boolean).join(' ')}>
      <div className="peridot-mapping-table-scroll">
        <table className="min-w-full border-collapse text-left text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          <thead className="bg-[var(--stat-card-bg)] text-[var(--panel-card-text)]">
            <tr>
              {displayHeaders.map((header) => (
                <th key={header} className="max-w-[14rem] whitespace-nowrap px-3 py-2.5 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={`preview-${rowIndex}`} className="border-t border-[var(--panel-card-border)]">
                {displayHeaders.map((header) => (
                  <td key={`${rowIndex}-${header}`} className="max-w-[14rem] truncate px-3 py-2.5">{row?.[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="peridot-mapping-table-footer border-t border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-xs text-[var(--panel-card-muted-text)]">
        {footerText}
      </div>
    </div>
  );
}

function inferPreviewFileType(fileLabel = '', explicitFileType = '') {
  const explicit = String(explicitFileType || '').trim();
  if (explicit) return explicit.toUpperCase();

  const match = String(fileLabel || '').trim().match(/\.([^.]+)$/);
  return match?.[1] ? match[1].toUpperCase() : '';
}

function PreviewSummaryStrip({ fileLabel, fileType, rowCount, columnCount, sheetName, sheetCount }) {
  const resolvedFileType = inferPreviewFileType(fileLabel, fileType);
  const summaryParts = [
    fileLabel || 'Uploaded data',
    resolvedFileType ? `Type: ${resolvedFileType}` : '',
    sheetName ? `Sheet: ${sheetName}` : '',
    `${formatPreviewCount(rowCount)} row${Number(rowCount) === 1 ? '' : 's'}`,
    `${formatPreviewCount(columnCount)} column${Number(columnCount) === 1 ? '' : 's'}`,
    sheetCount ? `${formatPreviewCount(sheetCount)} sheet${Number(sheetCount) === 1 ? '' : 's'}` : '',
  ].filter(Boolean);

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-4 py-3">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">File preview</div>
      <div className="mt-1 text-base font-semibold leading-relaxed text-[var(--panel-card-text)]">
        {summaryParts.join(' · ')}
      </div>
    </div>
  );
}

function PreviewOrientationCard({ workbook = false, orientation = 'columns', onOrientationChange }) {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-4 text-[var(--panel-card-muted-text)]">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Preview</div>
      <div className="mt-1 text-base font-bold leading-relaxed text-[var(--panel-card-text)]">
        {workbook ? 'Make sure Peridot is reading your workbook correctly.' : 'Make sure Peridot is reading your file correctly.'}
      </div>
      <p className="mt-1 text-sm leading-relaxed">
        {workbook
          ? 'Review the sheets, columns, and source values below. You’ll describe what each sheet, row, and column means on the next pages.'
          : 'Review the columns and source values below. You’ll describe what the rows and columns mean on the next pages.'}
      </p>

      {!workbook && onOrientationChange ? (
        <fieldset className="mt-4">
          <legend className="text-base font-bold text-[var(--panel-card-text)]">How is this table arranged?</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-3 py-2 text-sm font-semibold text-[var(--panel-card-text)]">
              <input
                type="radio"
                name="peridot-table-orientation"
                value="columns"
                checked={orientation === 'columns'}
                onChange={() => onOrientationChange('columns')}
              />
              <span>Column headings run across the top</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-3 py-2 text-sm font-semibold text-[var(--panel-card-text)]">
              <input
                type="radio"
                name="peridot-table-orientation"
                value="rows"
                checked={orientation === 'rows'}
                onChange={() => onOrientationChange('rows')}
              />
              <span>Row headings run down the left side</span>
            </label>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

function transposeSingleTableFromLeftHeadings(headers = [], rows = []) {
  if (!headers.length || !rows.length) return { headers, rows };

  const cornerHeader = headers[0];
  const sourceValueHeaders = headers.slice(1);
  const generatedHeaders = [
    cornerHeader,
    ...rows.map((row, index) => {
      const candidate = String(row?.[cornerHeader] ?? '').trim();
      return candidate || `Row ${index + 1}`;
    }),
  ];

  const generatedRows = sourceValueHeaders.map((sourceHeader) => {
    const nextRow = { [cornerHeader]: sourceHeader };
    rows.forEach((row, index) => {
      nextRow[generatedHeaders[index + 1]] = row?.[sourceHeader] ?? '';
    });
    return nextRow;
  });

  return {
    headers: generatedHeaders,
    rows: generatedRows,
  };
}



function CapabilityAuditCard({ audit, note }) {
  const dataset = audit?.dataset;
  if (!dataset) return null;

  const totalRows = dataset.totalRows || 0;
  const counts = dataset.capabilityCounts || {};
  const shapes = Object.entries(dataset.recordShapes || {})
    .filter(([, enabled]) => enabled)
    .map(([shape]) => formatRecordShapeName(shape));
  const capabilityKeys = [
    'inspectorReady',
    'searchReady',
    'pointMapReady',
    'routeMapReady',
    'networkReady',
    'timelineReady',
    'chartReady',
    'exportReady',
  ];
  const numericFields = dataset.analytics?.numericMeasureFields || [];
  const categoricalFields = dataset.analytics?.categoricalFields || [];
  const temporalFields = dataset.analytics?.temporalFields || [];
  const temporalSummary = dataset.temporal || {};
  const temporalRoleFields = temporalSummary.temporalRoleFields || temporalFields;
  const intervalRows = temporalSummary.intervalRows ?? 0;
  const closedRangeRows = temporalSummary.closedRangeRows ?? 0;
  const openStartRows = temporalSummary.openStartRows ?? 0;
  const openEndRows = temporalSummary.openEndRows ?? 0;

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Tool availability audit</div>
          <div className="mt-1 text-sm font-semibold text-[var(--panel-card-text)]">
            Which Peridot tools this mapping can support.
          </div>
        </div>
        <div className="rounded-full border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-1 text-xs font-semibold text-[var(--panel-card-muted-text)]">
          {totalRows} row{totalRows === 1 ? '' : 's'} audited
        </div>
      </div>

      {note ? <p className="mt-3 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">{note}</p> : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Detected record shape(s)</div>
          <div className="mt-2 text-sm font-semibold text-[var(--panel-card-text)]">
            {shapes.length ? shapes.join(', ') : 'No dominant shape detected'}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Detected fields</div>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
            <div><span className="font-semibold text-[var(--panel-card-text)]">Numeric:</span> {numericFields.length ? numericFields.slice(0, 5).join(', ') : 'none detected'}</div>
            <div><span className="font-semibold text-[var(--panel-card-text)]">Categorical:</span> {categoricalFields.length ? categoricalFields.slice(0, 5).join(', ') : 'none detected'}</div>
            <div><span className="font-semibold text-[var(--panel-card-text)]">Temporal:</span> {temporalFields.length ? temporalFields.slice(0, 5).join(', ') : 'none detected'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Temporal intervals</div>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
            <div><span className="font-semibold text-[var(--panel-card-text)]">Fields:</span> {temporalRoleFields.length ? temporalRoleFields.slice(0, 5).join(', ') : 'none detected'}</div>
            <div><span className="font-semibold text-[var(--panel-card-text)]">Timeline available:</span> {counts.timelineReady ?? 0} of {totalRows}</div>
            <div><span className="font-semibold text-[var(--panel-card-text)]">Intervals:</span> {intervalRows} of {totalRows}</div>
            <div className="text-[11px]">{closedRangeRows} closed range{closedRangeRows === 1 ? '' : 's'} · {openStartRows} start-only · {openEndRows} end-only</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {capabilityKeys.map((capability) => {
          const count = counts[capability] ?? 0;
          const enabled = count > 0;
          return (
            <div
              key={capability}
              className={[
                'rounded-xl border px-3 py-2 text-sm',
                enabled
                  ? 'border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)]'
                  : 'border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] text-[var(--panel-card-muted-text)]',
              ].join(' ')}
            >
              <div className="font-semibold">{formatCapabilityName(capability)}</div>
              <div className="mt-1 text-xs opacity-85">{count} of {totalRows}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function MappingIntroCard({ eyebrow, title, children }) {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">{eyebrow}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--panel-card-text)]">{title}</div>
      {children ? <div className="mt-1 text-xs leading-relaxed">{children}</div> : null}
    </div>
  );
}

function ReviewSummaryStrip({ items = [] }) {
  return (
    <div className="peridot-mapping-review-strip rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="peridot-mapping-review-strip-item">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">{item.label}</div>
          <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function IdentifyRecordsStep({ staging, previewRows, headers }) {
  return (
    <div className="space-y-4">
      <MappingIntroCard eyebrow="Identify records" title="Confirm the table shape before assigning roles.">
        A row may represent a letter, site, event, object, observation, catalogue entry, or other evidence record.
      </MappingIntroCard>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Current file</div>
          <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">{staging?.fileLabel || 'Staged data'}</div>
          <div className="mt-1 text-sm text-[var(--panel-card-muted-text)]">{staging?.rowCount || 0} rows · {staging?.columnCount || headers.length || 0} columns</div>
        </div>
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Good candidates</div>
          <div className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Record labels, IDs, source/citation fields, links, titles, notes, and descriptions.
          </div>
        </div>
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Not required</div>
          <div className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            Records do not have to contain networks, routes, coordinates, or exact dates to remain useful as evidence.
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-[var(--panel-card-text)]">Record preview</div>
        <PreviewTable rows={previewRows} headers={headers} maxRows={3} />
      </div>
    </div>
  );
}

function TimeMappingStep({ headers, rows, temporalMapping, onTemporalChange }) {
  return (
    <TemporalMappingTable headers={headers} rows={rows} temporalMapping={temporalMapping} onChange={onTemporalChange} />
  );
}

function PlacesMappingStep({ headers, rows, placeParts, onPlacePartsChange }) {
  return (
    <SpatialMappingPanel
      headers={headers}
      rows={rows}
      placeParts={placeParts}
      onPlacePartsChange={onPlacePartsChange}
    />
  );
}

function RelationshipsMappingStep({ headers, coreMapping, relationshipMetadataMapping, onChange, onMetadataChange }) {
  return (
    <RelationshipMappingPanel
      headers={headers}
      coreMapping={coreMapping}
      relationshipMetadataMapping={relationshipMetadataMapping}
      onCoreChange={onChange}
      onMetadataChange={onMetadataChange}
    />
  );
}



function refreshWorkbookCustomSelections({ workbookModel, workbookMapping, previousSelections = [] }) {
  if (!workbookModel || !workbookMapping?.primarySheetName) return [];

  const selectedSheets = [
    workbookMapping.primarySheetName,
    ...(workbookMapping.letterLevelJoins || []).map((join) => join?.to?.sheetName).filter(Boolean),
  ].filter((sheetName, index, all) => sheetName && all.indexOf(sheetName) === index);

  const previousByKey = new Map(
    previousSelections.map((selection) => [makeWorkbookSelectionKey(selection), selection])
  );

  return selectedSheets.flatMap((sheetName) => {
    const suggestedSelections = buildWorkbookCustomFieldSelectionsForSheet(
      workbookModel,
      sheetName,
      workbookMapping.coreMappings || {},
      workbookMapping.temporalMappings || {},
      workbookMapping.pointMappings || {},
      workbookMapping.routeCoordinatePairMappings || {}
    );

    return suggestedSelections.map((selection) => {
      const key = makeWorkbookSelectionKey(selection);
      const previous = previousByKey.get(key);
      const nextSelection = previous
        ? {
            ...selection,
            action: previous.action,
            label: previous.label || selection.label,
            analyticsEligible: selection.analyticsEligible,
          }
        : {
            ...selection,
            label: buildWorkbookSelectionLabel(selection, workbookMapping.primarySheetName),
          };

      return {
        ...nextSelection,
        sheetName,
        sourceRef: selection.sourceRef || makeWorkbookColumnRef(sheetName, selection.sourceColumn),
      };
    });
  });
}


const REVIEW_CAPABILITY_ITEMS = Object.freeze([
  Object.freeze({ label: 'Inspector', key: 'inspectorReady' }),
  Object.freeze({ label: 'Search', key: 'searchReady' }),
  Object.freeze({ label: 'Point map', key: 'pointMapReady' }),
  Object.freeze({ label: 'Route map', key: 'routeMapReady' }),
  Object.freeze({ label: 'Network', key: 'networkReady' }),
  Object.freeze({ label: 'Timeline', key: 'timelineReady' }),
  Object.freeze({ label: 'Charts', key: 'chartReady' }),
  Object.freeze({ label: 'Export', key: 'exportReady' }),
]);

function GoldDiamondDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-2.5 w-2.5 rotate-45 border border-[var(--button-primary-active-border)] bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
    </div>
  );
}

function getReviewTotalRows(capabilityAudit, fallbackTotal = 0) {
  return capabilityAudit?.dataset?.totalRows || fallbackTotal || 0;
}

function getReviewCapabilityCount(capabilityAudit, key) {
  return capabilityAudit?.dataset?.capabilityCounts?.[key] ?? 0;
}

function getReviewCapabilityStatus(count, totalRows) {
  if (!totalRows || count <= 0) return 'Unavailable';
  if (count >= totalRows) return 'Available';
  return 'Partial';
}

function getReviewCapabilityClass(status) {
  if (status === 'Available') {
    return 'border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)]';
  }
  if (status === 'Partial') {
    return 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)]/75 text-[var(--button-primary-text)]';
  }
  return 'border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 text-[var(--panel-card-muted-text)]';
}

function estimateWarningRowCount(message = '') {
  const rowListMatch = message.match(/Rows?\s+(.+?)\s+(?:do|does|are|is|include|includes|have|has|will|cannot)/i);
  const moreMatch = message.match(/and\s+(\d+)\s+more/i);
  let explicitRows = 0;

  if (rowListMatch?.[1]) {
    explicitRows = (rowListMatch[1].match(/\d+/g) || []).length;
  }

  return explicitRows + (moreMatch ? Number(moreMatch[1]) : 0);
}

function simplifyReviewWarningText(message = '') {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*They will be available for search, Inspector, charts, and export (?:if|when|where) otherwise accepted, but they will /gi, ' They will ')
    .replace(/\s*They will be available for search, Inspector, charts, and export (?:if|when|where) otherwise accepted, but they cannot /gi, ' They cannot ')
    .replace(/\s*They will be available for Inspector, Advanced Search, charts, and export (?:if|when|where) otherwise accepted\.\s*/gi, ' ')
    .replace(/\s*They will be available for search and inspection features (?:if|when|where) otherwise accepted\.\s*/gi, ' ')
    .replace(/\s*They will remain available for search and inspection features (?:if|when|where) otherwise accepted\.\s*/gi, ' ')
    .replace(/\s*Data mapped for unavailable visualizations will still remain available for search and inspection (?:if|when|where) otherwise accepted\.\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getReviewWarningLabel(message = '', fallbackIndex = 0) {
  if (/coordinate|latitude|longitude|map rendering/i.test(message)) return 'Coordinates';
  if (/date|timeline|date-range/i.test(message)) return 'Dates';
  if (/sheet|join|id|mapping|place information/i.test(message)) return 'Mapping';
  if (/record|row|source_name|target_name/i.test(message)) return 'Records';
  return `Warning ${fallbackIndex + 1}`;
}

function getReviewWarningRowsPhrase(message = '') {
  const match = String(message || '').match(/Rows?\s+(.+?)\s+(?:do|does|are|is|include|includes|have|has|will|cannot|may)/i);
  return match?.[1] ? `Rows ${match[1].trim()}` : 'Some rows';
}

function buildConsolidatedCoordinateWarning(coordinateWarnings = []) {
  if (!coordinateWarnings.length) return null;

  const rowsPhrase = getReviewWarningRowsPhrase(coordinateWarnings[0].text);
  return {
    label: 'Coordinates',
    text: `${rowsPhrase} have missing, incomplete, invalid, or out-of-range coordinates. They may not appear in map-based visualizations.`,
  };
}

function buildReviewWarningItems(warnings = []) {
  const coordinateWarnings = [];
  const otherWarnings = [];

  warnings.forEach((warning, index) => {
    const message = simplifyReviewWarningText(warning?.message || '');
    if (!message) return;

    const label = getReviewWarningLabel(message, index);
    const item = { label, text: message };

    if (label === 'Coordinates') {
      coordinateWarnings.push(item);
      return;
    }

    otherWarnings.push(item);
  });

  const consolidatedCoordinates = buildConsolidatedCoordinateWarning(coordinateWarnings);
  const orderedItems = [];
  const firstCoordinateIndex = warnings.findIndex((warning) => {
    const message = simplifyReviewWarningText(warning?.message || '');
    return getReviewWarningLabel(message) === 'Coordinates';
  });

  otherWarnings.forEach((item, index) => {
    if (consolidatedCoordinates && index === firstCoordinateIndex) {
      orderedItems.push(consolidatedCoordinates);
    }
    orderedItems.push(item);
  });

  if (consolidatedCoordinates && !orderedItems.includes(consolidatedCoordinates)) {
    orderedItems.push(consolidatedCoordinates);
  }

  return orderedItems;
}

function getReviewWarningDisplayCount(warnings = [], validationIssues = []) {
  return buildReviewWarningItems(warnings).length + validationIssues.length;
}


function ReviewImportSummaryStrip({ acceptedRecords = 0, warningCount = 0 }) {
  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Review import</div>
      <div className="mt-1 text-sm font-semibold text-[var(--panel-card-text)]">
        {formatPreviewCount(acceptedRecords)} record{Number(acceptedRecords) === 1 ? '' : 's'} · {formatPreviewCount(warningCount)} warning{Number(warningCount) === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function ReviewStatusPanel({ acceptedRecords = 0, warningCount = 0, capabilityAudit }) {
  const totalRows = getReviewTotalRows(capabilityAudit, acceptedRecords);

  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Import status</div>
      <div className="mt-1.5 grid gap-1.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-3 py-1.5">
          <span className="font-semibold text-[var(--panel-card-text)]">Accepted records</span>
          <span>{formatPreviewCount(acceptedRecords)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-3 py-1.5">
          <span className="font-semibold text-[var(--panel-card-text)]">Warnings</span>
          <span>{formatPreviewCount(warningCount)}</span>
        </div>
      </div>

      <div className="my-2">
        <GoldDiamondDivider />
      </div>

      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Tool availability</div>
      <div className="mt-1.5 grid gap-1.5">
        {REVIEW_CAPABILITY_ITEMS.map((item) => {
          const count = getReviewCapabilityCount(capabilityAudit, item.key);
          const status = getReviewCapabilityStatus(count, totalRows);
          return (
            <div
              key={item.key}
              className={[
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 text-xs',
                getReviewCapabilityClass(status),
              ].join(' ')}
            >
              <span className="font-semibold">{item.label}</span>
              <span>{status}{totalRows ? ` · ${formatPreviewCount(count)} / ${formatPreviewCount(totalRows)}` : ''}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ReviewWarningsCard({ warnings = [], validationIssues = [] }) {
  const warningItems = buildReviewWarningItems(warnings);
  const hasValidationIssues = validationIssues.length > 0;

  if (!warningItems.length && !hasValidationIssues) {
    return (
      <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Warnings to review</div>
        <p className="mt-2">No warnings detected.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-snug text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Warnings to review</div>
      <div className="mt-3 grid gap-2">
        {warningItems.map((warning, index) => (
          <div key={`${warning.label}-${index}`} className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            <span className="font-semibold text-[var(--panel-card-text)]">{warning.label}:</span> {warning.text}
          </div>
        ))}
        {hasValidationIssues ? (
          <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            <span className="font-semibold text-[var(--panel-card-text)]">Mapping issues:</span> {validationIssues.map((issue) => issue.message).join(' ')}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--panel-card-text)]">
        Data that cannot be used in one or more visualizations will still be available for search and inspection features.
      </p>
    </aside>
  );
}


function ReviewStep({ validation, summary, mappedPreviewRows, headers, capabilityAudit }) {
  const warnings = summary?.warnings || [];
  const acceptedRecords = summary?.acceptedRecordCount ?? mappedPreviewRows.length;
  const validationIssues = validation?.isValid ? [] : (validation?.issues || []);

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ReviewStatusPanel
          acceptedRecords={acceptedRecords}
          warningCount={getReviewWarningDisplayCount(warnings, validationIssues)}
          capabilityAudit={capabilityAudit}
        />
        <ReviewWarningsCard warnings={warnings} validationIssues={validationIssues} />
      </div>
    </div>
  );
}

function WorkbookOverviewStep({ staging, workbookModel, workbookSummary }) {
  const previewSheets = workbookModel?.sheets || staging?.sheets || [];
  const fallbackSheet = previewSheets[0] || null;
  const [previewSheetName, setPreviewSheetName] = useState(fallbackSheet?.sheetName || '');

  useEffect(() => {
    const availableNames = new Set(previewSheets.map((sheet) => sheet.sheetName));
    if (previewSheetName && availableNames.has(previewSheetName)) return;
    setPreviewSheetName(fallbackSheet?.sheetName || '');
  }, [fallbackSheet?.sheetName, previewSheetName, previewSheets]);

  const previewSheet = previewSheets.find((sheet) => sheet.sheetName === previewSheetName) || fallbackSheet;
  const previewRows = previewSheet?.rows || [];
  const previewHeaders = previewSheet?.headers || [];
  const rowCount = previewSheet?.rowCount ?? previewRows.length ?? 0;
  const columnCount = previewSheet?.columnCount ?? previewHeaders.length ?? 0;
  const sheetCount = workbookModel?.sheets?.length || staging.sheetCount || workbookSummary?.sheets?.length || 0;

  return (
    <div className="space-y-3">
      <PreviewOrientationCard workbook />
      <PreviewSummaryStrip
        fileLabel={staging.fileLabel}
        fileType={staging.fileType}
        rowCount={rowCount}
        columnCount={columnCount}
        sheetName={previewSheet?.sheetName}
        sheetCount={sheetCount}
      />
      {previewSheets.length > 1 ? (
        <div className="peridot-mapping-section-card flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-4 py-3">
          <label className="min-w-[16rem] flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Sheet to preview</div>
            <select
              value={previewSheet?.sheetName || ''}
              onChange={(event) => setPreviewSheetName(event.target.value)}
              className="peridot-mapping-select mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)]"
            >
              {previewSheets.map((sheet) => (
                <option key={sheet.sheetName} value={sheet.sheetName}>
                  {sheet.sheetName} — {formatPreviewCount(sheet.rowCount)} rows · {formatPreviewCount(sheet.columnCount)} columns
                </option>
              ))}
            </select>
          </label>
          <p className="max-w-xl text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
            Switch between sheets to inspect the workbook only. Choosing a sheet here does not assign its meaning or role.
          </p>
        </div>
      ) : null}
      <PreviewTable
        rows={previewRows}
        headers={previewHeaders}
        totalRows={rowCount}
        sheetName={previewSheet?.sheetName}
        maxRows={null}
      />
    </div>
  );
}

function WorkbookSetupStep({
  workbookModel,
  workbookMapping,
  onPrimarySheetChange,
  onLetterIdChange,
  onAddJoin,
  onRemoveJoin,
  onJoinSheetChange,
  onJoinPrimaryColumnChange,
  onJoinTargetColumnChange,
}) {
  const usableSheets = getUsableWorkbookSheets(workbookModel);
  const selectedSheet = getWorkbookSheet(workbookModel, workbookMapping.primarySheetName);
  const headers = selectedSheet?.headers || [];
  const suggestions = workbookMapping.primaryRecordSheetSuggestions || [];
  const likelyPrimarySuggestion = suggestions[0] || null;
  const joins = workbookMapping.letterLevelJoins || [];
  const joinedSheetNames = new Set(joins.map((join) => join?.to?.sheetName).filter(Boolean));
  const availableJoinSheets = usableSheets.filter(
    (sheet) => sheet.sheetName !== workbookMapping.primarySheetName && !joinedSheetNames.has(sheet.sheetName)
  );

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          <div className="rounded-t-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-card-text)]">
            Workbook assembly
          </div>
          <div className="rounded-b-xl border-x border-b border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Primary record sheet</div>
                <select
                  value={workbookMapping.primarySheetName || ''}
                  onChange={(event) => onPrimarySheetChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                >
                  {usableSheets.map((sheet) => (
                    <option key={sheet.sheetName} value={sheet.sheetName}>
                      {sheet.sheetName} — {sheet.rowCount} rows
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Primary unique ID column</div>
                <select
                  value={workbookMapping.primaryLetterIdColumn || ''}
                  onChange={(event) => onLetterIdChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                >
                  <option value="">Select a unique ID column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
              Choose the sheet whose rows become Peridot records. If data spans sheets, select the shared ID column and add joined sheets below.
            </p>

            <div className="flex items-center gap-3 py-3" aria-hidden="true">
              <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
              <div className="h-2.5 w-2.5 rotate-45 border border-[var(--button-primary-active-border)] bg-[var(--button-primary-bg)] opacity-85" />
              <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-bold leading-tight text-[var(--panel-card-text)]">Joined sheets</div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
                  Add sheets only when record-level information needs to be joined to the primary record sheet.
                </p>
              </div>
              <button
                type="button"
                onClick={onAddJoin}
                disabled={!workbookMapping.primarySheetName || !availableJoinSheets.length}
                className={buttonClassName({ variant: 'primary' })}
              >
                + Add sheet
              </button>
            </div>

            {joins.length ? (
              <div className="mt-3 space-y-3">
                {joins.map((join, index) => {
                  const joinedSheet = getWorkbookSheet(workbookModel, join?.to?.sheetName);
                  const joinedHeaders = joinedSheet?.headers || [];
                  const matchSummary = getLetterIdJoinMatchSummary(workbookModel, join);
                  return (
                    <div key={`${join?.to?.sheetName || 'join'}-${index}`} className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
                      <div className="grid gap-2 lg:grid-cols-[1.1fr_1fr_1fr_auto]">
                        <label className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Joined sheet</div>
                          <select
                            value={join?.to?.sheetName || ''}
                            onChange={(event) => onJoinSheetChange(index, event.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                          >
                            <option value="">Select sheet</option>
                            {usableSheets
                              .filter((sheet) => sheet.sheetName !== workbookMapping.primarySheetName)
                              .map((sheet) => (
                                <option key={sheet.sheetName} value={sheet.sheetName}>{sheet.sheetName}</option>
                              ))}
                          </select>
                        </label>

                        <label className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Primary ID column</div>
                          <select
                            value={join?.from?.columnName || ''}
                            onChange={(event) => onJoinPrimaryColumnChange(index, event.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                          >
                            <option value="">Select column</option>
                            {headers.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>

                        <label className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Joined ID column</div>
                          <select
                            value={join?.to?.columnName || ''}
                            onChange={(event) => onJoinTargetColumnChange(index, event.target.value)}
                            disabled={!join?.to?.sheetName}
                            className="mt-1 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)] disabled:opacity-60"
                          >
                            <option value="">Select column</option>
                            {joinedHeaders.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>

                        <div className="flex items-end">
                          <button type="button" onClick={() => onRemoveJoin(index)} className={buttonClassName({ variant: 'secondary' })}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
                        <span className="font-semibold text-[var(--panel-card-text)]">Match check:</span> {matchSummary.message}
                        {matchSummary.isConfigured ? (
                          <span> Primary blanks: {matchSummary.primaryBlankIdCount}; joined-sheet blanks: {matchSummary.joinedBlankIdCount}; primary duplicate IDs: {matchSummary.primaryDuplicateIdCount}; joined-sheet duplicate IDs: {matchSummary.joinedDuplicateIdCount}.</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-sm text-[var(--panel-card-muted-text)]">
                No joined sheets configured yet.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
          <p className="mt-2">
            The primary record sheet determines which workbook rows become Peridot records.
          </p>
          <p className="mt-2">
            Use joined sheets only when record-level data is spread across multiple sheets.
          </p>
          <p className="mt-2">
            ID-column names do not need to match; the values need to match.
          </p>
          {likelyPrimarySuggestion ? (
            <div className="mt-3 rounded-xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
              <div className="font-semibold text-[var(--panel-card-text)]">Likely primary sheet</div>
              <div className="mt-1">{likelyPrimarySuggestion.sheetName} · {likelyPrimarySuggestion.rowCount} rows</div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function WorkbookIdentifyRecordsStep({ workbookModel, workbookMapping }) {
  const selectedSheet = getWorkbookSheet(workbookModel, workbookMapping.primarySheetName);

  return (
    <div className="space-y-4">
      <MappingIntroCard eyebrow="Identify records" title="Confirm the sheet whose rows become records.">
        Joined sheets may supply additional fields through configured unique-ID matches.
      </MappingIntroCard>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Primary record sheet</div>
          <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">{workbookMapping.primarySheetName || '—'}</div>
          <div className="mt-1 text-sm text-[var(--panel-card-muted-text)]">{selectedSheet?.rowCount || 0} rows · {selectedSheet?.columnCount || 0} columns</div>
        </div>
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Joins</div>
          <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">{(workbookMapping.letterLevelJoins || []).length}</div>
          <div className="mt-1 text-sm text-[var(--panel-card-muted-text)]">Configured joined sheet(s)</div>
        </div>
        <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">Evidence fields</div>
          <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">{(workbookMapping.customFieldSelections || []).length}</div>
          <div className="mt-1 text-sm text-[var(--panel-card-muted-text)]">Candidates preserved in the Evidence step</div>
        </div>
      </div>

      {selectedSheet ? (
        <div>
          <div className="mb-2 text-sm font-semibold text-[var(--panel-card-text)]">Primary-sheet preview</div>
          <PreviewTable rows={selectedSheet.rows || []} headers={selectedSheet.headers || []} maxRows={3} />
        </div>
      ) : null}
    </div>
  );
}

function WorkbookTimeMappingStep({ workbookModel, workbookMapping, onTemporalChange }) {
  return (
    <WorkbookTemporalMappingTable
      workbookModel={workbookModel}
      workbookMapping={workbookMapping}
      onChange={onTemporalChange}
    />
  );
}

function WorkbookPlacesMappingStep({ workbookModel, placeParts, onPlacePartsChange }) {
  return (
    <WorkbookSpatialMappingPanel
      workbookModel={workbookModel}
      placeParts={placeParts}
      onPlacePartsChange={onPlacePartsChange}
    />
  );
}

function WorkbookRelationshipsMappingStep({ workbookModel, workbookMapping, onChange, onMetadataChange }) {
  return (
    <WorkbookRelationshipMappingPanel
      workbookModel={workbookModel}
      workbookMapping={workbookMapping}
      onCoreChange={onChange}
      onMetadataChange={onMetadataChange}
    />
  );
}
function WorkbookReviewStep({ workbookModel, workbookMapping, validation, summary, previewRows, capabilityAudit }) {
  const issues = validation?.issues || [];
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity !== 'error');
  const acceptedRecords = summary?.totalRows ?? capabilityAudit?.dataset?.totalRows ?? previewRows.length;
  const validationIssues = [...errors, ...warnings];

  return (
    <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ReviewStatusPanel
          acceptedRecords={acceptedRecords}
          warningCount={getReviewWarningDisplayCount(warnings, validationIssues)}
          capabilityAudit={capabilityAudit}
        />
        <ReviewWarningsCard warnings={warnings} validationIssues={validationIssues} />
      </div>
    </div>
  );
}

const RELATIONSHIP_METADATA_LABELS = Object.freeze({
  Relationship_Type: 'Relationship type',
  Relationship_Label: 'Label/Note',
});

function normalizeRelationshipMetadataMapping(mapping = {}) {
  return Object.freeze({
    Relationship_Type: mapping.Relationship_Type || '',
    Relationship_Label: mapping.Relationship_Label || '',
  });
}

function applyRelationshipMetadataSelections(selections = [], relationshipMetadataMapping = {}) {
  const selectedMetadata = Object.entries(RELATIONSHIP_METADATA_LABELS)
    .map(([field, label]) => ({
      field,
      label,
      sourceColumn: relationshipMetadataMapping?.[field] || '',
    }))
    .filter((item) => item.sourceColumn);

  if (!selectedMetadata.length) return selections;

  const nextSelections = selections.map((selection) => ({ ...selection }));
  selectedMetadata.forEach((metadata) => {
    const existingIndex = nextSelections.findIndex((selection) => selection.sourceColumn === metadata.sourceColumn);
    const nextSelection = {
      sourceColumn: metadata.sourceColumn,
      label: metadata.label,
      action: CUSTOM_INSPECTOR_FIELD_DEFAULTS.include,
      suggested: true,
      analyticsEligible: true,
      reason: 'Selected as relationship metadata.',
    };

    if (existingIndex >= 0) {
      nextSelections[existingIndex] = {
        ...nextSelections[existingIndex],
        ...nextSelection,
      };
    } else {
      nextSelections.push(nextSelection);
    }
  });

  return nextSelections;
}

function normalizeWorkbookRelationshipMetadataMappings(mapping = {}) {
  return Object.freeze({
    Relationship_Type: mapping.Relationship_Type || makeWorkbookColumnRef('', ''),
    Relationship_Label: mapping.Relationship_Label || makeWorkbookColumnRef('', ''),
  });
}

function getWorkbookRelationshipMetadataKey(ref = {}) {
  return `${ref.sheetName || ''}::${ref.columnName || ''}`;
}

function applyWorkbookRelationshipMetadataSelections(selections = [], relationshipMetadataMappings = {}) {
  const selectedMetadata = Object.entries(RELATIONSHIP_METADATA_LABELS)
    .map(([field, label]) => ({
      field,
      label,
      sourceRef: relationshipMetadataMappings?.[field] || makeWorkbookColumnRef('', ''),
    }))
    .filter((item) => item.sourceRef?.sheetName && item.sourceRef?.columnName);

  if (!selectedMetadata.length) return selections;

  const nextSelections = selections.map((selection) => ({ ...selection }));
  selectedMetadata.forEach((metadata) => {
    const metadataKey = getWorkbookRelationshipMetadataKey(metadata.sourceRef);
    const existingIndex = nextSelections.findIndex((selection) => {
      const ref = selection.sourceRef || makeWorkbookColumnRef(selection.sheetName, selection.sourceColumn);
      return getWorkbookRelationshipMetadataKey(ref) === metadataKey;
    });
    const nextSelection = {
      key: metadata.sourceRef.columnName,
      sheetName: metadata.sourceRef.sheetName,
      sourceColumn: metadata.sourceRef.columnName,
      sourceRef: metadata.sourceRef,
      label: metadata.label,
      action: CUSTOM_INSPECTOR_FIELD_DEFAULTS.include,
      suggested: true,
      analyticsEligible: true,
      reason: 'Selected as relationship metadata.',
    };

    if (existingIndex >= 0) {
      nextSelections[existingIndex] = {
        ...nextSelections[existingIndex],
        ...nextSelection,
      };
    } else {
      nextSelections.push(nextSelection);
    }
  });

  return nextSelections;
}

function stripDisplayDateMapping(mapping = {}) {
  return {
    ...(mapping || {}),
    Date_Display: '',
  };
}

function stripWorkbookDisplayDateMapping(workbookMapping = {}) {
  return {
    ...(workbookMapping || {}),
    temporalMappings: {
      ...((workbookMapping || {}).temporalMappings || {}),
      Date_Display: makeWorkbookColumnRef('', ''),
    },
    relationshipMetadataMappings: normalizeWorkbookRelationshipMetadataMappings((workbookMapping || {}).relationshipMetadataMappings || {}),
  };
}


function buildInitialWorkbookPlaceParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.placeParts) ? mappingState.placeParts : [];
  if (saved.length && saved.some((part) => part?.placeRef || part?.coordinatePairRef || part?.latitudeRef || part?.longitudeRef)) {
    return saved.map((part) => ({ ...part }));
  }

  const point = mappingState.pointMappings || {};
  const core = mappingState.coreMappings || {};
  const routePairs = mappingState.routeCoordinatePairMappings || {};
  const emptyRef = () => makeWorkbookColumnRef('', '');
  const parts = [];

  const hasRef = (ref) => Boolean(ref?.sheetName && ref?.columnName);

  if (hasRef(point.Point_Place) || hasRef(point.Point_Coordinates) || hasRef(point.Point_Latitude) || hasRef(point.Point_Longitude)) {
    parts.push({
      placeRef: point.Point_Place || emptyRef(),
      roleMode: 'heading',
      roleRef: emptyRef(),
      coordinatePairRef: point.Point_Coordinates || emptyRef(),
      latitudeRef: point.Point_Latitude || emptyRef(),
      longitudeRef: point.Point_Longitude || emptyRef(),
    });
  }

  if (hasRef(core.Source_Location) || hasRef(routePairs.Source_Coordinates) || hasRef(core.Source_Latitude) || hasRef(core.Source_Longitude)) {
    parts.push({
      placeRef: core.Source_Location || emptyRef(),
      roleMode: 'heading',
      roleRef: emptyRef(),
      coordinatePairRef: routePairs.Source_Coordinates || emptyRef(),
      latitudeRef: core.Source_Latitude || emptyRef(),
      longitudeRef: core.Source_Longitude || emptyRef(),
    });
  }

  if (hasRef(core.Target_Location) || hasRef(routePairs.Target_Coordinates) || hasRef(core.Target_Latitude) || hasRef(core.Target_Longitude)) {
    parts.push({
      placeRef: core.Target_Location || emptyRef(),
      roleMode: 'heading',
      roleRef: emptyRef(),
      coordinatePairRef: routePairs.Target_Coordinates || emptyRef(),
      latitudeRef: core.Target_Latitude || emptyRef(),
      longitudeRef: core.Target_Longitude || emptyRef(),
    });
  }

  return parts.length ? parts : [{
    placeRef: emptyRef(),
    roleMode: 'heading',
    roleRef: emptyRef(),
    coordinatePairRef: emptyRef(),
    latitudeRef: emptyRef(),
    longitudeRef: emptyRef(),
  }];
}

function buildInitialPlaceParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.placeParts) ? mappingState.placeParts : [];
  if (saved.length) return saved.map((part) => ({ ...part }));

  const point = mappingState.pointMapping || {};
  const route = mappingState.coreMapping || {};
  const routePairs = mappingState.routeCoordinatePairMapping || {};
  const parts = [];

  if (point.Point_Place || point.Point_Coordinates || point.Point_Latitude || point.Point_Longitude) {
    parts.push({
      placeColumn: point.Point_Place || '',
      roleMode: 'heading',
      roleColumn: '',
      coordinatePairColumn: point.Point_Coordinates || '',
      latitudeColumn: point.Point_Latitude || '',
      longitudeColumn: point.Point_Longitude || '',
    });
  }

  if (route.Source_Location || routePairs.Source_Coordinates || route.Source_Latitude || route.Source_Longitude) {
    parts.push({
      placeColumn: route.Source_Location || '',
      roleMode: 'heading',
      roleColumn: '',
      coordinatePairColumn: routePairs.Source_Coordinates || '',
      latitudeColumn: route.Source_Latitude || '',
      longitudeColumn: route.Source_Longitude || '',
    });
  }

  if (route.Target_Location || routePairs.Target_Coordinates || route.Target_Latitude || route.Target_Longitude) {
    parts.push({
      placeColumn: route.Target_Location || '',
      roleMode: 'heading',
      roleColumn: '',
      coordinatePairColumn: routePairs.Target_Coordinates || '',
      latitudeColumn: route.Target_Latitude || '',
      longitudeColumn: route.Target_Longitude || '',
    });
  }

  return parts.length ? parts : [{
    placeColumn: '',
    roleMode: 'heading',
    roleColumn: '',
    coordinatePairColumn: '',
    latitudeColumn: '',
    longitudeColumn: '',
  }];
}


export function PeridotColumnMappingModal({
  open,
  staging,
  onClose,
  onSaveMapping,
  onConfirmImport,
}) {
  const mappingState = staging?.mappingState || {};
  const datasetProfile = getPeridotDatasetProfile(
    staging?.datasetProfileId || mappingState?.datasetProfileId
  );
  const isGenealogyProfile = isPeridotGenealogyProfile(datasetProfile.id);
  const isWorkbookMode = staging?.mappingMode === 'workbook' || Boolean(staging?.workbookMappingRequired);
  const workbookModel = staging?.workbookModel || null;
  const workbookSummary = staging?.workbookSummary || null;

  const definitions = mappingState.coreFieldDefinitions || [];
  const sourceHeaders = staging?.headers || [];
  const sourceRows = staging?.rows || staging?.rawRows || staging?.previewRows || [];
  const [tableOrientation, setTableOrientation] = useState(mappingState.tableOrientation === 'rows' ? 'rows' : 'columns');
  const orientedSingleTableData = useMemo(
    () => (
      !isWorkbookMode && tableOrientation === 'rows'
        ? transposeSingleTableFromLeftHeadings(sourceHeaders, sourceRows)
        : { headers: sourceHeaders, rows: sourceRows }
    ),
    [isWorkbookMode, sourceHeaders, sourceRows, tableOrientation]
  );
  const headers = orientedSingleTableData.headers;
  const rows = orientedSingleTableData.rows;
  const previewRows = rows.slice(0, 5);
  const stepKeys = isGenealogyProfile ? GENEALOGY_STEP_KEYS : (isWorkbookMode ? WORKBOOK_STEP_KEYS : SINGLE_TABLE_STEP_KEYS);

  const [activeStep, setActiveStep] = useState(stepKeys[0]);
  const [coreMapping, setCoreMapping] = useState(mappingState.coreMapping || {});
  const [temporalMapping, setTemporalMapping] = useState(stripDisplayDateMapping(mappingState.temporalMapping || {}));
  const [pointMapping, setPointMapping] = useState(mappingState.pointMapping || {});
  const [routeCoordinatePairMapping, setRouteCoordinatePairMapping] = useState(mappingState.routeCoordinatePairMapping || {});
  const [placeParts, setPlaceParts] = useState(() => buildInitialPlaceParts(mappingState));
  const [relationshipMetadataMapping, setRelationshipMetadataMapping] = useState(normalizeRelationshipMetadataMapping(mappingState.relationshipMetadataMapping || {}));
  const [customFieldSelections, setCustomFieldSelections] = useState(mappingState.customFieldSelections || []);
  const [workbookMapping, setWorkbookMapping] = useState(() => ({ ...stripWorkbookDisplayDateMapping(mappingState), placeParts: buildInitialWorkbookPlaceParts(mappingState) }));
  const [genealogyFieldMapping, setGenealogyFieldMapping] = useState(
    isWorkbookMode
      ? Object.fromEntries(Object.entries(mappingState.fieldMappings || {}).map(([field, ref]) => [field, ref?.columnName || '']))
      : (mappingState.fieldMapping || {})
  );
  const [genealogySupplementalRowActions, setGenealogySupplementalRowActions] = useState(
    mappingState.supplementalRowActions || {}
  );
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [renderedStep, setRenderedStep] = useState(stepKeys[0]);
  const [stepTransitionPhase, setStepTransitionPhase] = useState('idle');
  const stepTransitionTimeoutsRef = useRef([]);

  useEffect(() => {
    if (!open || !staging) return;
    const nextIsWorkbookMode = staging?.mappingMode === 'workbook' || Boolean(staging?.workbookMappingRequired);
    const firstStep = isGenealogyProfile ? GENEALOGY_STEP_KEYS[0] : (nextIsWorkbookMode ? WORKBOOK_STEP_KEYS[0] : SINGLE_TABLE_STEP_KEYS[0]);
    stepTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    stepTransitionTimeoutsRef.current = [];
    setActiveStep(firstStep);
    setTableOrientation(mappingState.tableOrientation === 'rows' ? 'rows' : 'columns');
    setRenderedStep(firstStep);
    setStepTransitionPhase('idle');
    setCoreMapping(mappingState.coreMapping || {});
    setTemporalMapping(stripDisplayDateMapping(mappingState.temporalMapping || {}));
    setPlaceParts(buildInitialPlaceParts(mappingState));
    setRelationshipMetadataMapping(normalizeRelationshipMetadataMapping(mappingState.relationshipMetadataMapping || {}));
    setCustomFieldSelections(mappingState.customFieldSelections || []);
    setGenealogyFieldMapping(
      nextIsWorkbookMode
        ? Object.fromEntries(Object.entries(mappingState.fieldMappings || {}).map(([field, ref]) => [field, ref?.columnName || '']))
        : (mappingState.fieldMapping || {})
    );
    setGenealogySupplementalRowActions(mappingState.supplementalRowActions || {});
    setWorkbookMapping(
      nextIsWorkbookMode && staging?.workbookModel
        ? {
            ...stripWorkbookDisplayDateMapping(mappingState || {}),
            placeParts: buildInitialWorkbookPlaceParts(mappingState || {}),
            relationshipMetadataMappings: normalizeWorkbookRelationshipMetadataMappings(mappingState.relationshipMetadataMappings || {}),
            customFieldSelections: applyWorkbookRelationshipMetadataSelections(
              refreshWorkbookCustomSelections({
                workbookModel: staging.workbookModel,
                workbookMapping: mappingState || {},
                previousSelections: mappingState.customFieldSelections || [],
              }),
              normalizeWorkbookRelationshipMetadataMappings(mappingState.relationshipMetadataMappings || {})
            ),
          }
        : { ...stripWorkbookDisplayDateMapping(mappingState || {}), placeParts: buildInitialWorkbookPlaceParts(mappingState || {}) }
    );
    setShowCancelConfirmation(false);
  }, [open, staging?.stagedAt]);

  useEffect(() => () => {
    stepTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    stepTransitionTimeoutsRef.current = [];
  }, []);

  const effectiveCustomSelections = useMemo(() => {
    const mappedCoreColumns = new Set([
      ...Object.values(coreMapping || {}),
      ...Object.values(stripDisplayDateMapping(temporalMapping || {})),
      ...Object.values(pointMapping || {}),
      ...Object.values(routeCoordinatePairMapping || {}),
    ].filter(Boolean));
    const structuralSelections = customFieldSelections.map((selection) => (
      mappedCoreColumns.has(selection.sourceColumn)
        ? { ...selection, action: CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore }
        : selection
    ));
    return applyRelationshipMetadataSelections(structuralSelections, relationshipMetadataMapping);
  }, [coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping, relationshipMetadataMapping, customFieldSelections]);

  const validation = useMemo(
    () => validatePeridotColumnMapping(headers, {
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      pointMapping,
      routeCoordinatePairMapping,
      relationshipMetadataMapping,
      customFieldSelections: effectiveCustomSelections,
    }),
    [headers, coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping, effectiveCustomSelections]
  );

  const mappedRows = useMemo(
    () => applyPeridotColumnMapping(rows, {
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      pointMapping,
      routeCoordinatePairMapping,
      relationshipMetadataMapping,
      customFieldSelections: effectiveCustomSelections,
    }),
    [rows, coreMapping, temporalMapping, pointMapping, routeCoordinatePairMapping, effectiveCustomSelections]
  );

  const validationSummary = useMemo(
    () => buildPeridotCsvValidationSummary(mappedRows, Object.keys(mappedRows[0] || Object.fromEntries(PERIDOT_TEMPLATE_COLUMNS.map((column) => [column, ''])))),
    [mappedRows]
  );

  const workbookValidation = useMemo(
    () => (isWorkbookMode && workbookModel ? validatePeridotWorkbookMapping(workbookModel, workbookMapping) : null),
    [isWorkbookMode, workbookModel, workbookMapping]
  );

  const workbookMappingSummary = useMemo(
    () => (isWorkbookMode && workbookModel ? getWorkbookMappingSummary(workbookModel, workbookMapping) : null),
    [isWorkbookMode, workbookModel, workbookMapping]
  );

  const workbookMappedPreviewRows = useMemo(
    () => (isWorkbookMode && workbookModel ? previewWorkbookCoreMappedRows(workbookModel, workbookMapping, 5) : []),
    [isWorkbookMode, workbookModel, workbookMapping]
  );

  const workbookMappedRowsForAudit = useMemo(() => {
    if (!isWorkbookMode || !workbookModel || activeStep !== 'workbook-review') return [];
    try {
      return buildPeridotRowsFromWorkbookMapping(workbookModel, workbookMapping);
    } catch (error) {
      return [];
    }
  }, [activeStep, isWorkbookMode, workbookModel, workbookMapping]);

  const mappedRowsCapabilityAudit = useMemo(() => {
    if (isWorkbookMode || activeStep !== 'review') return null;
    try {
      return auditPeridotDataCapabilities(mappedRows, { headers: Object.keys(mappedRows[0] || {}) });
    } catch (error) {
      return null;
    }
  }, [activeStep, isWorkbookMode, mappedRows]);

  const workbookCapabilityAudit = useMemo(() => {
    if (!isWorkbookMode || activeStep !== 'workbook-review') return null;
    try {
      return auditPeridotDataCapabilities(workbookMappedRowsForAudit, { headers: Object.keys(workbookMappedRowsForAudit[0] || {}) });
    } catch (error) {
      return null;
    }
  }, [activeStep, isWorkbookMode, workbookMappedRowsForAudit]);


  const genealogySourceSheet = useMemo(() => (
    isWorkbookMode
      ? (workbookModel?.sheets || []).find((sheet) => sheet.sheetName === mappingState.primarySheetName)
      : null
  ), [isWorkbookMode, workbookModel, mappingState.primarySheetName]);

  const genealogyHeaders = isWorkbookMode ? (genealogySourceSheet?.headers || []) : headers;
  const genealogyRows = isWorkbookMode ? (genealogySourceSheet?.rows || []) : rows;

  const genealogySupplementalRows = useMemo(
    () => getPeridotGenealogySupplementalRows(genealogyRows, genealogyFieldMapping),
    [genealogyRows, genealogyFieldMapping]
  );

  const genealogyValidation = useMemo(
    () => validatePeridotGenealogyMappingWithRowActions(
      genealogyHeaders,
      genealogyRows,
      genealogyFieldMapping,
      genealogySupplementalRowActions,
    ),
    [genealogyHeaders, genealogyRows, genealogyFieldMapping, genealogySupplementalRowActions]
  );

  const genealogyResolvedRows = genealogyValidation?.supplementalResolution?.rows || genealogyRows;
  const genealogyCapabilitySummary = useMemo(
    () => buildPeridotGenealogyCapabilitySummary(
      genealogyResolvedRows,
      genealogyFieldMapping,
      genealogyValidation,
    ),
    [genealogyResolvedRows, genealogyFieldMapping, genealogyValidation]
  );

  if (!open || !staging || staging.status !== 'ready') return null;

  const singleStepLabels = {
    preview: 'Preview',
    time: 'Time',
    places: 'Places',
    relationships: 'Relations',
    evidence: 'Evidence',
    review: 'Review',
  };

  const workbookStepLabels = {
    'workbook-preview': 'Preview',
    'workbook-setup': 'Sheets',
    'workbook-time': 'Time',
    'workbook-places': 'Places',
    'workbook-relationships': 'Relations',
    'workbook-evidence': 'Evidence',
    'workbook-review': 'Review',
  };

  const genealogyStepLabels = {
    'genealogy-preview': 'Preview',
    'genealogy-identity': 'Identity',
    'genealogy-parents': 'Parents',
    'genealogy-partners': 'Partners',
    'genealogy-life-events': 'Life events',
    'genealogy-places': 'Places',
    'genealogy-attributes': 'Attributes',
    'genealogy-review': 'Review',
  };

  const stepLabels = isGenealogyProfile
    ? genealogyStepLabels
    : (isWorkbookMode ? workbookStepLabels : singleStepLabels);
  const activeStepIndex = stepKeys.indexOf(activeStep);

  const moveToStep = (nextStep) => {
    const nextIndex = stepKeys.indexOf(nextStep);
    if (nextIndex < 0 || nextStep === activeStep) return;

    stepTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    stepTransitionTimeoutsRef.current = [];

    setActiveStep(nextStep);
    setStepTransitionPhase('fade-out');

    const swapTimeout = window.setTimeout(() => {
      setRenderedStep(nextStep);
      setStepTransitionPhase('fade-in');
    }, 520);

    const settleTimeout = window.setTimeout(() => {
      setStepTransitionPhase('idle');
      stepTransitionTimeoutsRef.current = [];
    }, 1480);

    stepTransitionTimeoutsRef.current = [swapTimeout, settleTimeout];
  };

  const handleTableOrientationChange = (nextOrientation) => {
    if (nextOrientation === tableOrientation || isWorkbookMode) return;

    const nextData = nextOrientation === 'rows'
      ? transposeSingleTableFromLeftHeadings(sourceHeaders, sourceRows)
      : { headers: sourceHeaders, rows: sourceRows };
    const nextInitialMapping = buildInitialPeridotColumnMappingState(
      nextData.headers,
      nextData.rows,
      { datasetProfileId: datasetProfile.id }
    );

    setTableOrientation(nextOrientation);
    setCoreMapping(nextInitialMapping.coreMapping || {});
    setTemporalMapping(stripDisplayDateMapping(nextInitialMapping.temporalMapping || {}));
    setPointMapping(nextInitialMapping.pointMapping || {});
    setRouteCoordinatePairMapping(nextInitialMapping.routeCoordinatePairMapping || {});
    setRelationshipMetadataMapping(normalizeRelationshipMetadataMapping({}));
    setCustomFieldSelections(nextInitialMapping.customFieldSelections || []);
  };

  const handleCoreMappingChange = (field, sourceColumn) => {
    setCoreMapping((current) => ({
      ...current,
      [field]: sourceColumn,
    }));
    if (field === 'Date') {
      setTemporalMapping((current) => ({
        ...current,
        Date: current.Date || sourceColumn,
      }));
    }
  };

  const handleTemporalMappingChange = (field, sourceColumn) => {
    if (field === 'Date_Display') return;
    setTemporalMapping((current) => stripDisplayDateMapping({
      ...current,
      [field]: sourceColumn,
    }));
  };

  const handlePointMappingChange = (field, sourceColumn) => {
    setPointMapping((current) => ({
      ...current,
      [field]: sourceColumn,
    }));
  };

  const handleRouteCoordinatePairMappingChange = (field, sourceColumn) => {
    setRouteCoordinatePairMapping((current) => ({
      ...current,
      [field]: sourceColumn,
    }));
  };

  const handleRelationshipMetadataMappingChange = (field, sourceColumn) => {
    setRelationshipMetadataMapping((current) => normalizeRelationshipMetadataMapping({
      ...current,
      [field]: sourceColumn,
    }));
  };

  const handleWorkbookPrimarySheetChange = (primarySheetName) => {
    const nextCoreMappings = suggestWorkbookCoreMappings(workbookModel, primarySheetName);
    const nextTemporalMappings = suggestWorkbookTemporalMappings(workbookModel, primarySheetName, nextCoreMappings);
    const nextPointMappings = suggestWorkbookPointMappings(workbookModel, primarySheetName, nextCoreMappings, nextTemporalMappings);
    const nextRouteCoordinatePairMappings = suggestWorkbookRouteCoordinatePairMappings(workbookModel, primarySheetName, nextCoreMappings, nextTemporalMappings, nextPointMappings);
    const suggestedJoins = suggestSharedLetterIdJoins(workbookModel, primarySheetName, '');
    const suggestedPrimaryId = suggestedJoins[0]?.from?.columnName || '';
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        primarySheetName,
        primaryLetterIdColumn: suggestedPrimaryId,
        coreMappings: nextCoreMappings,
        temporalMappings: nextTemporalMappings,
        pointMappings: nextPointMappings,
        routeCoordinatePairMappings: nextRouteCoordinatePairMappings,
        relationshipMetadataMappings: normalizeWorkbookRelationshipMetadataMappings({}),
        letterLevelJoins: suggestedJoins,
        letterLevelJoinSuggestions: suggestedJoins,
      };
      return {
        ...nextMapping,
        customFieldSelections: refreshWorkbookCustomSelections({
          workbookModel,
          workbookMapping: nextMapping,
          previousSelections: [],
        }),
      };
    });
  };

  const handleWorkbookLetterIdChange = (primaryLetterIdColumn) => {
    setWorkbookMapping((current) => ({
      ...current,
      primaryLetterIdColumn,
      letterLevelJoins: (current.letterLevelJoins || []).map((join) => makeLetterIdJoin({
        fromSheetName: current.primarySheetName,
        fromColumnName: primaryLetterIdColumn,
        toSheetName: join?.to?.sheetName || '',
        toColumnName: join?.to?.columnName || '',
      })),
    }));
  };

  const handleAddWorkbookJoin = () => {
    setWorkbookMapping((current) => {
      const usableSheets = getUsableWorkbookSheets(workbookModel);
      const alreadyJoined = new Set((current.letterLevelJoins || []).map((join) => join?.to?.sheetName).filter(Boolean));
      const nextSheet = usableSheets.find((sheet) => sheet.sheetName !== current.primarySheetName && !alreadyJoined.has(sheet.sheetName));
      if (!nextSheet) return current;
      const nextJoin = suggestDefaultLetterIdJoinForSheet(
        workbookModel,
        current.primarySheetName,
        nextSheet.sheetName,
        current.primaryLetterIdColumn
      );
      if (!nextJoin) return current;
      const nextMapping = {
        ...current,
        primaryLetterIdColumn: current.primaryLetterIdColumn || nextJoin.from.columnName,
        letterLevelJoins: [...(current.letterLevelJoins || []), nextJoin],
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleRemoveWorkbookJoin = (index) => {
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        letterLevelJoins: (current.letterLevelJoins || []).filter((_, currentIndex) => currentIndex !== index),
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookJoinSheetChange = (index, joinedSheetName) => {
    setWorkbookMapping((current) => {
      const nextJoin = suggestDefaultLetterIdJoinForSheet(
        workbookModel,
        current.primarySheetName,
        joinedSheetName,
        current.primaryLetterIdColumn
      );
      const nextMapping = {
        ...current,
        primaryLetterIdColumn: current.primaryLetterIdColumn || nextJoin?.from?.columnName || '',
        letterLevelJoins: (current.letterLevelJoins || []).map((join, currentIndex) => (
          currentIndex === index && nextJoin ? nextJoin : join
        )),
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookJoinPrimaryColumnChange = (index, columnName) => {
    setWorkbookMapping((current) => ({
      ...current,
      primaryLetterIdColumn: current.primaryLetterIdColumn || columnName,
      letterLevelJoins: (current.letterLevelJoins || []).map((join, currentIndex) => (
        currentIndex === index
          ? makeLetterIdJoin({
              fromSheetName: current.primarySheetName,
              fromColumnName: columnName,
              toSheetName: join?.to?.sheetName || '',
              toColumnName: join?.to?.columnName || '',
            })
          : join
      )),
    }));
  };

  const handleWorkbookJoinTargetColumnChange = (index, columnName) => {
    setWorkbookMapping((current) => ({
      ...current,
      letterLevelJoins: (current.letterLevelJoins || []).map((join, currentIndex) => (
        currentIndex === index
          ? makeLetterIdJoin({
              fromSheetName: join?.from?.sheetName || current.primarySheetName,
              fromColumnName: join?.from?.columnName || current.primaryLetterIdColumn || '',
              toSheetName: join?.to?.sheetName || '',
              toColumnName: columnName,
            })
          : join
      )),
    }));
  };

  const handleWorkbookCoreMappingChange = (field, ref) => {
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        coreMappings: {
          ...(current.coreMappings || {}),
          [field]: ref,
        },
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookTemporalMappingChange = (field, ref) => {
    if (field === 'Date_Display') return;
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        temporalMappings: {
          ...(current.temporalMappings || {}),
          [field]: ref,
          Date_Display: makeWorkbookColumnRef('', ''),
        },
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookPlacePartsChange = (placeParts) => {
    setWorkbookMapping((current) => ({
      ...current,
      placeParts,
    }));
  };

  const handleWorkbookPointMappingChange = (field, ref) => {
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        pointMappings: {
          ...(current.pointMappings || {}),
          [field]: ref,
        },
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookRouteCoordinatePairMappingChange = (field, ref) => {
    setWorkbookMapping((current) => {
      const nextMapping = {
        ...current,
        routeCoordinatePairMappings: {
          ...(current.routeCoordinatePairMappings || {}),
          [field]: ref,
        },
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextMapping.relationshipMetadataMappings || {}
        ),
      };
    });
  };

  const handleWorkbookRelationshipMetadataMappingChange = (field, ref) => {
    setWorkbookMapping((current) => {
      const nextRelationshipMetadataMappings = normalizeWorkbookRelationshipMetadataMappings({
        ...(current.relationshipMetadataMappings || {}),
        [field]: ref,
      });
      const nextMapping = {
        ...current,
        relationshipMetadataMappings: nextRelationshipMetadataMappings,
      };
      return {
        ...nextMapping,
        customFieldSelections: applyWorkbookRelationshipMetadataSelections(
          refreshWorkbookCustomSelections({
            workbookModel,
            workbookMapping: nextMapping,
            previousSelections: current.customFieldSelections || [],
          }),
          nextRelationshipMetadataMappings
        ),
      };
    });
  };

  const handleWorkbookCustomActionChange = (index, action) => {
    setWorkbookMapping((current) => ({
      ...current,
      customFieldSelections: (current.customFieldSelections || []).map((selection, currentIndex) => (
        currentIndex === index
          ? { ...selection, action: normalizeAction(action) }
          : selection
      )),
    }));
  };

  const handleWorkbookCustomLabelChange = (index, label) => {
    setWorkbookMapping((current) => ({
      ...current,
      customFieldSelections: (current.customFieldSelections || []).map((selection, currentIndex) => (
        currentIndex === index
          ? { ...selection, label }
          : selection
      )),
    }));
  };

  const handleCustomActionChange = (index, action) => {
    setCustomFieldSelections((current) => current.map((selection, currentIndex) => (
      currentIndex === index
        ? { ...selection, action: normalizeAction(action) }
        : selection
    )));
  };

  const handleCustomLabelChange = (index, label) => {
    setCustomFieldSelections((current) => current.map((selection, currentIndex) => (
      currentIndex === index
        ? { ...selection, label }
        : selection
    )));
  };


  const handleGenealogyFieldMappingChange = (field, sourceColumn) => {
    setGenealogyFieldMapping((current) => ({ ...current, [field]: sourceColumn }));
  };

  const handleGenealogySupplementalActionChange = (rowIndex, action) => {
    setGenealogySupplementalRowActions((current) => ({ ...current, [rowIndex]: action }));
  };

  const buildCurrentMappingPayload = () => {
    if (isGenealogyProfile) {
      const supplementalResolution = applyPeridotGenealogySupplementalRowActions(
        genealogyRows,
        genealogyFieldMapping,
        genealogySupplementalRowActions,
      );
      return {
        datasetProfileId: datasetProfile.id,
        genealogyMappingState: isWorkbookMode
          ? {
              ...mappingState,
              fieldMappings: Object.fromEntries(
                Object.entries(genealogyFieldMapping).map(([field, columnName]) => [
                  field,
                  columnName
                    ? makePeridotGenealogyWorkbookColumnRef(mappingState.primarySheetName, columnName)
                    : makePeridotGenealogyWorkbookColumnRef('', ''),
                ])
              ),
              supplementalRowActions: genealogySupplementalRowActions,
              validation: genealogyValidation,
              capabilitySummary: genealogyCapabilitySummary,
            }
          : {
              ...mappingState,
              fieldMapping: genealogyFieldMapping,
              supplementalRowActions: genealogySupplementalRowActions,
              validation: genealogyValidation,
              capabilitySummary: genealogyCapabilitySummary,
            },
        supplementalResolution,
      };
    }
    if (isWorkbookMode) {
      return {
        datasetProfileId: datasetProfile.id,
        workbookMappingState: {
          ...stripWorkbookDisplayDateMapping(workbookMapping),
          datasetProfileId: datasetProfile.id,
        },
        workbookValidation,
        workbookSummary: workbookMappingSummary,
      };
    }

    return {
      datasetProfileId: datasetProfile.id,
      tableOrientation,
      placeParts,
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      pointMapping,
      routeCoordinatePairMapping,
      relationshipMetadataMapping,
      customFieldSelections: effectiveCustomSelections,
      validationSummary,
    };
  };

  const handleRequestCancel = () => {
    setShowCancelConfirmation(true);
  };

  const handleReturnToWorkspace = () => {
    setShowCancelConfirmation(false);
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    onClose?.();
  };

  const handleConfirmImport = () => {
    if (!datasetProfile.canConfirmImport) return;
    if (isGenealogyProfile && !genealogyValidation?.isValid) return;
    if (!isGenealogyProfile && isWorkbookMode && !workbookValidation?.isValid) return;
    const payload = buildCurrentMappingPayload();
    onSaveMapping?.(payload);
    onConfirmImport?.(payload);
  };

  const goNext = () => {
    const nextIndex = Math.min(stepKeys.length - 1, activeStepIndex + 1);
    moveToStep(stepKeys[nextIndex]);
  };

  const goBack = () => {
    const nextIndex = Math.max(0, activeStepIndex - 1);
    moveToStep(stepKeys[nextIndex]);
  };

  const footerHelper = isGenealogyProfile
    ? 'Confirm import activates this validated canonical genealogy dataset. Geographic routes remain unavailable unless the source explicitly records routes.'
    : !datasetProfile.canConfirmImport
      ? `${datasetProfile.label} is routed correctly.`
      : isWorkbookMode
      ? 'Confirm import replaces the active dataset with assembled workbook rows.'
      : 'Confirm import replaces the active dataset with this mapped table.';

  const renderStepContent = (stepForRender) => (
    <>
          {isGenealogyProfile ? (
            <div className="space-y-4">
              {stepForRender === 'genealogy-preview' ? (
                <>
                  <PreviewOrientationCard workbook={isWorkbookMode} />
                  <PreviewSummaryStrip
                    fileLabel={staging.fileLabel}
                    fileType={staging.fileType}
                    rowCount={genealogyRows.length}
                    columnCount={genealogyHeaders.length}
                    sheetName={isWorkbookMode ? mappingState.primarySheetName : ''}
                    sheetCount={isWorkbookMode ? staging.sheetCount : undefined}
                  />
                  <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Genealogy profile</div>
                    <h3 className="mt-2 text-xl font-bold text-[var(--panel-card-text)]">One row should represent one person.</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--panel-card-muted-text)]">
                      Assign stable person IDs, family references, life events, places, and optional attributes. Birth and death places remain event locations and are never converted into movement routes.
                    </p>
                  </div>
                  <PreviewTable rows={genealogyRows} headers={genealogyHeaders} totalRows={genealogyRows.length} maxRows={null} />
                </>
              ) : null}

              {stepForRender === 'genealogy-identity' ? <GenealogyIdentityStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-parents' ? <GenealogyParentsStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-partners' ? <GenealogyPartnersStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-life-events' ? <GenealogyLifeEventsStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-places' ? <GenealogyPlacesStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-attributes' ? <GenealogyAttributesStep headers={genealogyHeaders} mapping={genealogyFieldMapping} onChange={handleGenealogyFieldMappingChange} /> : null}
              {stepForRender === 'genealogy-review' ? (
                <GenealogyReviewPanel
                  validation={genealogyValidation}
                  capabilitySummary={genealogyCapabilitySummary}
                  supplementalRows={genealogySupplementalRows}
                  actions={genealogySupplementalRowActions}
                  onActionChange={handleGenealogySupplementalActionChange}
                />
              ) : null}
            </div>
          ) : null}

          {!isGenealogyProfile ? (<>

          {!isWorkbookMode && stepForRender === 'preview' ? (
            <div className="space-y-3">
              <PreviewOrientationCard orientation={tableOrientation} onOrientationChange={handleTableOrientationChange} />
              <PreviewSummaryStrip
                fileLabel={staging.fileLabel}
                fileType={staging.fileType}
                rowCount={sourceRows.length}
                columnCount={sourceHeaders.length}
              />
              <PreviewTable
                rows={sourceRows}
                headers={sourceHeaders}
                totalRows={sourceRows.length}
                maxRows={null}
              />
            </div>
          ) : null}

          {!isWorkbookMode && stepForRender === 'identify' ? (
            <IdentifyRecordsStep
              staging={staging}
              previewRows={previewRows}
              headers={headers}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'time' ? (
            <TimeMappingStep
              headers={headers}
              rows={rows}
              temporalMapping={stripDisplayDateMapping(temporalMapping)}
              onTemporalChange={handleTemporalMappingChange}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'places' ? (
            <PlacesMappingStep
              headers={headers}
              rows={rows}
              placeParts={placeParts}
              onPlacePartsChange={setPlaceParts}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'relationships' ? (
            <RelationshipsMappingStep
              headers={headers}
              coreMapping={coreMapping}
              relationshipMetadataMapping={relationshipMetadataMapping}
              onChange={handleCoreMappingChange}
              onMetadataChange={handleRelationshipMetadataMappingChange}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'evidence' ? (
            <InspectorFieldsStep
              selections={effectiveCustomSelections}
              coreMapping={{ ...coreMapping, ...stripDisplayDateMapping(temporalMapping), ...pointMapping, ...routeCoordinatePairMapping }}
              onActionChange={handleCustomActionChange}
              onLabelChange={handleCustomLabelChange}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'review' ? (
            <ReviewStep
              validation={validation}
              summary={validationSummary}
              mappedPreviewRows={mappedRows.slice(0, 5)}
              headers={PERIDOT_TEMPLATE_COLUMNS}
              capabilityAudit={mappedRowsCapabilityAudit}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-preview' ? (
            <WorkbookOverviewStep staging={staging} workbookModel={workbookModel} workbookSummary={workbookSummary} />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-setup' ? (
            <WorkbookSetupStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              onPrimarySheetChange={handleWorkbookPrimarySheetChange}
              onLetterIdChange={handleWorkbookLetterIdChange}
              onAddJoin={handleAddWorkbookJoin}
              onRemoveJoin={handleRemoveWorkbookJoin}
              onJoinSheetChange={handleWorkbookJoinSheetChange}
              onJoinPrimaryColumnChange={handleWorkbookJoinPrimaryColumnChange}
              onJoinTargetColumnChange={handleWorkbookJoinTargetColumnChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-identify' ? (
            <WorkbookIdentifyRecordsStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-time' ? (
            <WorkbookTimeMappingStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              onTemporalChange={handleWorkbookTemporalMappingChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-places' ? (
            <WorkbookPlacesMappingStep
              workbookModel={workbookModel}
              placeParts={workbookMapping.placeParts || []}
              onPlacePartsChange={handleWorkbookPlacePartsChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-relationships' ? (
            <WorkbookRelationshipsMappingStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              onChange={handleWorkbookCoreMappingChange}
              onMetadataChange={handleWorkbookRelationshipMetadataMappingChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-evidence' ? (
            <WorkbookInspectorFieldsStep
              workbookMapping={workbookMapping}
              selections={workbookMapping.customFieldSelections || []}
              onActionChange={handleWorkbookCustomActionChange}
              onLabelChange={handleWorkbookCustomLabelChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-review' ? (
            <WorkbookReviewStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              validation={workbookValidation}
              summary={workbookMappingSummary}
              previewRows={workbookMappedPreviewRows}
              capabilityAudit={workbookCapabilityAudit}
            />
          ) : null}
          </>) : null}
    </>
  );

  return (
    <div className="peridot-mapping-modal fixed inset-0 z-[80] flex items-center justify-center bg-[var(--peridot-role-interface-scrim-strong)] p-4 backdrop-blur-sm">
      <div className="peridot-mapping-modal-shell peridot-mapping-modal-enter-shell flex flex-col overflow-hidden rounded-[30px] border border-[var(--panel-card-border)] bg-[var(--sidebar-bg)] text-[var(--text-main)] shadow-[0_28px_80px_var(--peridot-color-rgba-rgba-0-0-0-0-55)]">
        <div className="peridot-mapping-modal-header peridot-mapping-modal-enter-header flex flex-wrap items-center justify-between gap-4 border-b border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 text-sm font-semibold text-[var(--muted-text)]">
              {staging.fileLabel || 'Uploaded data'}
            </div>
            <h2 className="[font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-2xl font-bold leading-tight text-[var(--heading-text)]">
              {isGenealogyProfile
                ? 'Genealogy import profile'
                : isWorkbookMode
                  ? 'Assign workbook data roles for Peridot'
                  : 'Assign data roles for Peridot'}
            </h2>
          </div>
          <button type="button" onClick={handleRequestCancel} className={buttonClassName({ variant: 'secondary' })}>
            Close
          </button>
        </div>

        <div className="peridot-mapping-progress peridot-mapping-modal-enter-progress border-b border-[var(--panel-card-border)] bg-[var(--section-bg)] px-6 py-3">
          {stepKeys.map((step, index) => (
            <StepButton
              key={step}
              active={activeStep === step}
              label={stepLabels[step]}
              index={index}
              onClick={() => moveToStep(step)}
            />
          ))}
        </div>

        <div className={`peridot-mapping-modal-body peridot-mapping-modal-enter-body peridot-mapping-step-soft-shell peridot-mapping-step-soft-shell-${stepTransitionPhase} min-h-0 flex-1 overflow-y-auto px-6 py-5`}>
          <div
            key={`step-${renderedStep}`}
            className={`peridot-mapping-step-soft-panel peridot-mapping-step-soft-panel-${stepTransitionPhase}`}
          >
            {renderStepContent(renderedStep)}
          </div>
        </div>

        <div className="peridot-mapping-modal-footer peridot-mapping-modal-enter-footer flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-6 py-3">
          <p className="max-w-2xl text-sm text-[var(--panel-card-muted-text)]">{footerHelper}</p>
          <div className="flex flex-wrap gap-2">
            {isGenealogyProfile ? (
              <>
                <button type="button" onClick={goBack} disabled={activeStepIndex <= 0} className={buttonClassName({ variant: 'secondary' })}>Back</button>
                {activeStepIndex < stepKeys.length - 1 ? (
                  <button type="button" onClick={goNext} className={buttonClassName({ variant: 'primary' })}>Next</button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!genealogyValidation?.isValid}
                    className={buttonClassName({ variant: 'primary' })}
                  >
                    Confirm import
                  </button>
                )}
                <button type="button" onClick={handleRequestCancel} className={buttonClassName({ variant: 'secondary' })}>Cancel</button>
              </>
            ) : (
              <>
                <button type="button" onClick={goBack} disabled={activeStepIndex <= 0} className={buttonClassName({ variant: 'secondary' })}>
                  Back
                </button>
                {activeStepIndex < stepKeys.length - 1 ? (
                  <button type="button" onClick={goNext} className={buttonClassName({ variant: 'primary' })}>
                    Next
                  </button>
                ) : isWorkbookMode ? (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!workbookValidation?.isValid}
                    className={buttonClassName({ variant: 'primary' })}
                  >
                    Confirm import
                  </button>
                ) : (
                  <button type="button" onClick={handleConfirmImport} className={buttonClassName({ variant: 'primary' })}>
                    Confirm import
                  </button>
                )}
                <button type="button" onClick={handleRequestCancel} className={buttonClassName({ variant: 'secondary' })}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showCancelConfirmation ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--peridot-role-interface-scrim)] p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--panel-card-border)] bg-[var(--sidebar-bg)] p-5 shadow-[0_24px_60px_var(--peridot-color-rgba-rgba-0-0-0-0-55)]">
            <h3 className="text-lg font-bold text-[var(--heading-text)]">Discard this upload?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
              This will discard the uploaded file from the mapping workspace. The active dataset will not change.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={handleReturnToWorkspace} className={buttonClassName({ variant: 'secondary' })}>
                Keep mapping
              </button>
              <button type="button" onClick={handleConfirmCancel} className={buttonClassName({ variant: 'danger' })}>
                Discard upload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
