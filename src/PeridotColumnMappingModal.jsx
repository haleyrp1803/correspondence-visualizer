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
  buildInitialPeridotColumnMappingState,
  CUSTOM_INSPECTOR_FIELD_DEFAULTS,
  PERIDOT_CORE_FIELD_DEFINITIONS,
  validatePeridotColumnMapping,
} from './peridotColumnMapping.js';
import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { buildTemporalAssertionMappingsFromLegacy, deriveLegacyTemporalMapping, getTemporalAssertionSourceColumns, normalizeTemporalAssertionMappings, temporalAssertionMappingHasSource } from './peridotTemporalMapping.js';
import { normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';
import {
  buildPeridotRowsFromWorkbookMapping,
  buildWorkbookCustomFieldSelectionsForSheet,
  getLetterIdJoinMatchSummary,
  getUsableWorkbookSheets,
  getWorkbookMappingSummary,
  getWorkbookTemporalAssertionRefs,
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
  IdentityMappingPanel,
  WorkbookIdentityMappingPanel,
} from './PeridotIdentityMappingControls.jsx';
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

function TimeMappingStep({ headers, rows, temporalAssertions, relationshipParts, onTemporalAssertionsChange }) {
  return <TemporalMappingTable headers={headers} rows={rows} temporalAssertions={temporalAssertions} relationshipParts={relationshipParts} onAssertionsChange={onTemporalAssertionsChange} />;
}

function PlacesMappingStep({ headers, rows, placeParts, relationshipParts, onPlacePartsChange }) {
  return (
    <SpatialMappingPanel
      headers={headers}
      rows={rows}
      placeParts={placeParts}
      relationshipParts={relationshipParts}
      onPlacePartsChange={onPlacePartsChange}
    />
  );
}

function RelationshipsMappingStep({ headers, rows, relationshipParts, relationshipMetadataMapping, onRelationshipPartsChange, onMetadataChange }) {
  return (
    <RelationshipMappingPanel
      headers={headers}
      rows={rows}
      relationshipParts={relationshipParts}
      relationshipMetadataMapping={relationshipMetadataMapping}
      onRelationshipPartsChange={onRelationshipPartsChange}
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

  const temporalRefKeys = new Set(workbookTemporalAssertionRefs(workbookMapping.temporalAssertionMappings || []).map((ref) => `${ref.sheetName}::${ref.columnName}`));

  return selectedSheets.flatMap((sheetName) => {
    const suggestedSelections = buildWorkbookCustomFieldSelectionsForSheet(
      workbookModel,
      sheetName,
      workbookMapping.coreMappings || {},
      workbookMapping.temporalMappings || {},
      workbookMapping.pointMappings || {},
      workbookMapping.routeCoordinatePairMappings || {}
    );

    return suggestedSelections.filter((selection) => !temporalRefKeys.has(`${selection.sheetName}::${selection.sourceColumn}`)).map((selection) => {
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
  Object.freeze({ label: 'Map', key: 'mapReady' }),
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

function getReviewCapabilityCount(capabilityAudit, key, { mapReady = false, totalRows = 0 } = {}) {
  const counts = capabilityAudit?.dataset?.capabilityCounts || {};

  if (key === 'mapReady') {
    if (mapReady && totalRows > 0) return totalRows;
    return Math.max(counts.pointMapReady ?? 0, counts.routeMapReady ?? 0);
  }

  return counts[key] ?? 0;
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

function ReviewStatusPanel({ acceptedRecords = 0, warningCount = 0, capabilityAudit, mapReady = false, timelineReadyCount = null }) {
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
          const count = item.key === 'timelineReady' && Number.isFinite(timelineReadyCount)
            ? timelineReadyCount
            : getReviewCapabilityCount(capabilityAudit, item.key, { mapReady, totalRows });
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


const REVIEW_TEMPORAL_LABELS = Object.freeze({
  Date: 'Date',
  Date_Range: 'Date range / timespan',
  Date_Start: 'Beginning date',
  Date_End: 'Ending date',
});

function ReviewAssignmentIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="text-lg font-bold leading-tight text-[var(--panel-card-text)]">
        Here is how Peridot will use your data.
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Review these assignments before importing. If something looks wrong, return to any earlier step above to change the mapping.
      </p>
    </div>
  );
}

function ReviewAssignmentLine({ label, value, detail = '' }) {
  return (
    <div className="grid gap-1 border-t border-[var(--panel-card-border)] py-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(8rem,0.38fr)_minmax(0,0.62fr)]">
      <div className="text-sm font-semibold text-[var(--panel-card-text)]">{label}</div>
      <div className="min-w-0 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        <span className="font-semibold text-[var(--panel-card-text)]">{value || 'Unassigned'}</span>
        {detail ? <span> · {detail}</span> : null}
      </div>
    </div>
  );
}

function ReviewAssignmentSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">{title}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function getSingleTableStructuralColumnsForReview({
  coreMapping = {},
  temporalMapping = {},
  temporalAssertionsMapping = [],
  placeParts = [],
  relationshipParts = [],
  relationshipMetadataMapping = {},
}) {
  const columns = new Set([
    ...Object.values(coreMapping || {}),
    ...Object.values(temporalMapping || {}),
    ...Object.values(relationshipMetadataMapping || {}),
  ].filter(Boolean));

  for (const part of placeParts || []) {
    [
      part?.placeColumn,
      part?.roleMode === 'column' ? part?.roleColumn : '',
      part?.coordinateMode === 'pair' ? part?.coordinatePairColumn : '',
      part?.coordinateMode === 'separate' ? part?.latitudeColumn : '',
      part?.coordinateMode === 'separate' ? part?.longitudeColumn : '',
    ].filter(Boolean).forEach((column) => columns.add(column));
  }

  for (const part of relationshipParts || []) {
    [
      part?.participantColumn,
      part?.roleMode === 'column' ? part?.roleColumn : '',
    ].filter(Boolean).forEach((column) => columns.add(column));
  }

  return columns;
}

function summarizeEvidenceSelections(selections = [], structuralColumns = new Set()) {
  let included = 0;
  let ignored = 0;

  for (const selection of selections || []) {
    const structural = structuralColumns.has(selection?.sourceColumn);
    const action = structural
      ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
      : normalizeAction(selection?.action);

    if (action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore) ignored += 1;
    else included += 1;
  }

  return { included, ignored };
}

function formatSingleRole(part = {}) {
  if (part?.roleMode === 'column') {
    return part?.roleColumn ? `role from ${part.roleColumn}` : 'role column unassigned';
  }
  return part?.participantColumn ? 'role from column heading' : 'role unassigned';
}

function formatIdentityStrategy(strategy = '') {
  if (strategy === 'field') return 'One ID field';
  if (strategy === 'composite') return 'Several fields together';
  if (strategy === 'row') return 'Each row is distinct';
  if (strategy === 'workbook-key') return 'Primary workbook ID';
  return 'Displayed label';
}

function formatSingleIdentityComponents(identity = {}) {
  if (identity?.strategy === 'row' || identity?.strategy === 'label') return '';
  return (identity?.components || [])
    .filter((component) => component?.column)
    .map((component) => `${component?.key || 'Field'}: ${component.column}`)
    .join(' · ');
}

function formatWorkbookIdentityComponents(identity = {}) {
  if (identity?.strategy === 'row' || identity?.strategy === 'label' || identity?.strategy === 'workbook-key') return '';
  return (identity?.components || [])
    .filter((component) => workbookRefLabel(component?.ref))
    .map((component) => `${component?.key || 'Field'}: ${workbookRefLabel(component.ref)}`)
    .join(' · ');
}

function temporalMappingSourceSummary(mapping = {}, workbook = false) {
  const fmt = (value) => workbook ? workbookRefLabel(value) : String(value || '').trim();
  const parts = (prefix = '') => [
    ['year', mapping[prefix ? `${prefix}YearColumn` : 'yearColumn']],
    ['month', mapping[prefix ? `${prefix}MonthColumn` : 'monthColumn']],
    ['day', mapping[prefix ? `${prefix}DayColumn` : 'dayColumn']],
  ].filter(([, value]) => fmt(value)).map(([label, value]) => `${label}: ${fmt(value)}`).join(' · ');
  if (mapping.kind === 'period') {
    if (mapping.sourceMode === 'single') return fmt(mapping.column);
    const start = mapping.startMode === 'parts' ? parts('start') : fmt(mapping.startColumn);
    const end = mapping.endMode === 'parts' ? parts('end') : fmt(mapping.endColumn);
    return [start ? `Beginning ${start}` : '', end ? `Ending ${end}` : ''].filter(Boolean).join(' · ');
  }
  return mapping.sourceMode === 'parts' ? parts('') : fmt(mapping.column);
}

function singleTemporalSubjectDetail(mapping = {}, relationshipParts = []) {
  if (!Number.isInteger(mapping?.subjectParticipantIndex)) return 'This row / record as a whole';
  const part = relationshipParts[mapping.subjectParticipantIndex];
  return part?.participantColumn ? `Describes ${part.participantColumn}` : `Describes relationship part ${mapping.subjectParticipantIndex + 1}`;
}

function workbookTemporalSubjectDetail(mapping = {}, relationshipParts = []) {
  if (!Number.isInteger(mapping?.subjectParticipantIndex)) return 'This row / record as a whole';
  const part = relationshipParts[mapping.subjectParticipantIndex];
  const ref = part?.participantRef || {};
  return ref?.columnName ? `Describes ${ref.sheetName} — ${ref.columnName}` : `Describes relationship part ${mapping.subjectParticipantIndex + 1}`;
}

function SingleTableReviewAssignments({
  coreMapping = {},
  temporalMapping = {},
  temporalAssertionsMapping = [],
  placeParts = [],
  relationshipParts = [],
  relationshipMetadataMapping = {},
  identityMapping = {},
  customFieldSelections = [],
}) {
  const structuralColumns = getSingleTableStructuralColumnsForReview({
    coreMapping,
    temporalMapping,
    placeParts,
    relationshipParts,
    relationshipMetadataMapping,
  });
  const evidence = summarizeEvidenceSelections(customFieldSelections, structuralColumns);
  const assignedPlaces = (placeParts || []).filter((part) => part?.placeColumn);
  const assignedRelationships = (relationshipParts || []).filter((part) => part?.participantColumn);

  return (
    <div className="space-y-4">
      <ReviewAssignmentIntro />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewAssignmentSection title="Identity">
          <ReviewAssignmentLine
            label="Records"
            value={formatIdentityStrategy(identityMapping?.record?.strategy || 'row')}
            detail={(identityMapping?.record?.columns || []).filter(Boolean).join(' + ')}
          />
          {Array.isArray(identityMapping?.entityGroups) && identityMapping.entityGroups.length
            ? identityMapping.entityGroups.map((group, index) => (
                <ReviewAssignmentLine
                  key={group.id || `review-identity-group-${index}`}
                  label={group.label || `Tracked group ${index + 1}`}
                  value={formatIdentityStrategy(group.strategy || 'label')}
                  detail={[
                    ...(group.keys || []).filter(Boolean),
                    `${(group.appearanceIds || []).length} mapped appearance${(group.appearanceIds || []).length === 1 ? '' : 's'}`,
                  ].filter(Boolean).join(' · ')}
                />
              ))
            : assignedRelationships.map((part, index) => {
                const identity = identityMapping?.participants?.[index] || { strategy: 'label', components: [] };
                return (
                  <ReviewAssignmentLine
                    key={`review-identity-${index}`}
                    label={`Part ${String.fromCharCode(65 + index)}`}
                    value={formatIdentityStrategy(identity.strategy || 'label')}
                    detail={formatSingleIdentityComponents(identity)}
                  />
                );
              })}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Time">
          {(temporalAssertionsMapping || []).filter((mapping) => temporalMappingSourceSummary(mapping)).length
            ? (temporalAssertionsMapping || []).filter((mapping) => temporalMappingSourceSummary(mapping)).map((mapping, index) => <ReviewAssignmentLine key={mapping.id || index} label={mapping.role || `Time ${index + 1}`} value={temporalMappingSourceSummary(mapping)} detail={`${mapping.kind === 'period' ? 'Period / range' : 'Date'} · ${singleTemporalSubjectDetail(mapping, relationshipParts)}`} />)
            : <ReviewAssignmentLine label="Time" value="Unassigned" />}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Places">
          {assignedPlaces.length ? assignedPlaces.map((part, index) => {
            const letter = String.fromCharCode(65 + index);
            let coordinateDetail = '';
            if (part?.coordinateMode === 'pair' && part?.coordinatePairColumn) {
              coordinateDetail = `coordinates from ${part.coordinatePairColumn}`;
            } else if (part?.coordinateMode === 'separate' && (part?.latitudeColumn || part?.longitudeColumn)) {
              coordinateDetail = `coordinates from ${[part?.latitudeColumn, part?.longitudeColumn].filter(Boolean).join(' + ')}`;
            }

            return (
              <ReviewAssignmentLine
                key={`review-place-${index}`}
                label={`Place ${letter}`}
                value={part.placeColumn}
                detail={[part?.roleLabel ? `Named role: ${part.roleLabel}` : '', formatSingleRole({
                  participantColumn: part.placeColumn,
                  roleMode: part.roleMode,
                  roleColumn: part.roleColumn,
                }), coordinateDetail].filter(Boolean).join(' · ')}
              />
            );
          }) : (
            <p className="text-sm leading-relaxed text-[var(--panel-card-muted-text)]">No place assignments.</p>
          )}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Relations">
          {assignedRelationships.length ? assignedRelationships.map((part, index) => {
            const letter = String.fromCharCode(65 + index);
            return (
              <ReviewAssignmentLine
                key={`review-relation-${index}`}
                label={`Part ${letter}`}
                value={part.participantColumn}
                detail={formatSingleRole(part)}
              />
            );
          }) : (
            <p className="text-sm leading-relaxed text-[var(--panel-card-muted-text)]">No relationship assignments.</p>
          )}

          {relationshipMetadataMapping?.Relationship_Type ? (
            <ReviewAssignmentLine label="Relationship type" value={relationshipMetadataMapping.Relationship_Type} />
          ) : null}
          {relationshipMetadataMapping?.Relationship_Label ? (
            <ReviewAssignmentLine label="Relationship label" value={relationshipMetadataMapping.Relationship_Label} />
          ) : null}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Evidence">
          <ReviewAssignmentLine
            label="Additional fields"
            value={`${evidence.included} included`}
            detail={`${evidence.ignored} ignored`}
          />
        </ReviewAssignmentSection>
      </div>
    </div>
  );
}

function workbookRefLabel(ref = {}) {
  if (!ref?.sheetName || !ref?.columnName) return '';
  return `${ref.sheetName} — ${ref.columnName}`;
}

function workbookRefKey(ref = {}) {
  if (!ref?.sheetName || !ref?.columnName) return '';
  return `${ref.sheetName}::${ref.columnName}`;
}

function getWorkbookStructuralRefsForReview(workbookMapping = {}) {
  const refs = new Set();

  const add = (ref) => {
    const key = workbookRefKey(ref);
    if (key) refs.add(key);
  };

  [
    ...Object.values(workbookMapping.coreMappings || {}),
    ...Object.values(workbookMapping.temporalMappings || {}),
    ...Object.values(workbookMapping.relationshipMetadataMappings || {}),
    ...Object.values(workbookMapping.pointMappings || {}),
    ...Object.values(workbookMapping.routeCoordinatePairMappings || {}),
  ].forEach(add);

  for (const part of workbookMapping.placeParts || []) {
    [
      part?.placeRef,
      part?.roleMode === 'column' ? part?.roleRef : null,
      part?.coordinateMode === 'pair' ? part?.coordinatePairRef : null,
      part?.coordinateMode === 'separate' ? part?.latitudeRef : null,
      part?.coordinateMode === 'separate' ? part?.longitudeRef : null,
    ].forEach(add);
  }

  for (const part of workbookMapping.relationshipParts || []) {
    [
      part?.participantRef,
      part?.roleMode === 'column' ? part?.roleRef : null,
    ].forEach(add);
  }

  return refs;
}

function summarizeWorkbookEvidenceSelections(workbookMapping = {}) {
  const structuralRefs = getWorkbookStructuralRefsForReview(workbookMapping);
  let included = 0;
  let ignored = 0;

  for (const selection of workbookMapping.customFieldSelections || []) {
    const ref = getWorkbookSelectionRef(selection);
    const structural = structuralRefs.has(workbookRefKey(ref));
    const action = structural
      ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
      : normalizeAction(selection?.action);

    if (action === CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore) ignored += 1;
    else included += 1;
  }

  return { included, ignored };
}

function formatWorkbookRole(part = {}) {
  if (part?.roleMode === 'column') {
    const role = workbookRefLabel(part?.roleRef);
    return role ? `role from ${role}` : 'role column unassigned';
  }
  return workbookRefLabel(part?.participantRef) ? 'role from column heading' : 'role unassigned';
}

function WorkbookReviewAssignments({ workbookMapping = {} }) {
  const evidence = summarizeWorkbookEvidenceSelections(workbookMapping);
  const assignedPlaces = (workbookMapping.placeParts || []).filter((part) => workbookRefLabel(part?.placeRef));
  const assignedRelationships = (workbookMapping.relationshipParts || []).filter((part) => workbookRefLabel(part?.participantRef));
  const temporal = workbookMapping.temporalMappings || {};
  const relationshipMetadata = workbookMapping.relationshipMetadataMappings || {};

  return (
    <div className="space-y-4">
      <ReviewAssignmentIntro />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewAssignmentSection title="Identity">
          <ReviewAssignmentLine
            label="Records"
            value={formatIdentityStrategy(workbookMapping?.identityMapping?.record?.strategy || (workbookMapping?.primaryLetterIdColumn ? 'workbook-key' : 'row'))}
            detail={workbookMapping?.identityMapping?.record?.strategy === 'field' || workbookMapping?.identityMapping?.record?.strategy === 'composite'
              ? (workbookMapping?.identityMapping?.record?.refs || []).map(workbookRefLabel).filter(Boolean).join(' + ')
              : (workbookMapping?.primaryLetterIdColumn ? `${workbookMapping.primarySheetName} — ${workbookMapping.primaryLetterIdColumn}` : '')}
          />
          {Array.isArray(workbookMapping?.identityMapping?.entityGroups) && workbookMapping.identityMapping.entityGroups.length
            ? workbookMapping.identityMapping.entityGroups.map((group, index) => (
                <ReviewAssignmentLine
                  key={group.id || `workbook-review-identity-group-${index}`}
                  label={group.label || `Tracked group ${index + 1}`}
                  value={formatIdentityStrategy(group.strategy || 'label')}
                  detail={[
                    ...(group.keys || []).filter(Boolean),
                    `${(group.appearanceIds || []).length} mapped appearance${(group.appearanceIds || []).length === 1 ? '' : 's'}`,
                  ].filter(Boolean).join(' · ')}
                />
              ))
            : assignedRelationships.map((part, index) => {
                const identity = workbookMapping?.identityMapping?.participants?.[index] || { strategy: 'label', components: [] };
                return (
                  <ReviewAssignmentLine
                    key={`workbook-review-identity-${index}`}
                    label={`Part ${String.fromCharCode(65 + index)}`}
                    value={formatIdentityStrategy(identity.strategy || 'label')}
                    detail={formatWorkbookIdentityComponents(identity)}
                  />
                );
              })}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Time">
          {(workbookMapping.temporalAssertionMappings || []).filter((mapping) => temporalMappingSourceSummary(mapping, true)).length
            ? (workbookMapping.temporalAssertionMappings || []).filter((mapping) => temporalMappingSourceSummary(mapping, true)).map((mapping, index) => <ReviewAssignmentLine key={mapping.id || index} label={mapping.role || `Time ${index + 1}`} value={temporalMappingSourceSummary(mapping, true)} detail={`${mapping.kind === 'period' ? 'Period / range' : 'Date'} · ${workbookTemporalSubjectDetail(mapping, workbookMapping.relationshipParts || [])}`} />)
            : <ReviewAssignmentLine label="Time" value="Unassigned" />}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Places">
          {assignedPlaces.length ? assignedPlaces.map((part, index) => {
            const letter = String.fromCharCode(65 + index);
            let coordinateDetail = '';
            if (part?.coordinateMode === 'pair' && workbookRefLabel(part?.coordinatePairRef)) {
              coordinateDetail = `coordinates from ${workbookRefLabel(part.coordinatePairRef)}`;
            } else if (part?.coordinateMode === 'separate') {
              const refs = [workbookRefLabel(part?.latitudeRef), workbookRefLabel(part?.longitudeRef)].filter(Boolean);
              if (refs.length) coordinateDetail = `coordinates from ${refs.join(' + ')}`;
            }

            return (
              <ReviewAssignmentLine
                key={`workbook-review-place-${index}`}
                label={`Place ${letter}`}
                value={workbookRefLabel(part.placeRef)}
                detail={[part?.roleLabel ? `Named role: ${part.roleLabel}` : '', formatWorkbookRole({
                  participantRef: part.placeRef,
                  roleMode: part.roleMode,
                  roleRef: part.roleRef,
                }), coordinateDetail].filter(Boolean).join(' · ')}
              />
            );
          }) : (
            <p className="text-sm leading-relaxed text-[var(--panel-card-muted-text)]">No place assignments.</p>
          )}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Relations">
          {assignedRelationships.length ? assignedRelationships.map((part, index) => {
            const letter = String.fromCharCode(65 + index);
            return (
              <ReviewAssignmentLine
                key={`workbook-review-relation-${index}`}
                label={`Part ${letter}`}
                value={workbookRefLabel(part.participantRef)}
                detail={formatWorkbookRole(part)}
              />
            );
          }) : (
            <p className="text-sm leading-relaxed text-[var(--panel-card-muted-text)]">No relationship assignments.</p>
          )}

          {workbookRefLabel(relationshipMetadata?.Relationship_Type) ? (
            <ReviewAssignmentLine label="Relationship type" value={workbookRefLabel(relationshipMetadata.Relationship_Type)} />
          ) : null}
          {workbookRefLabel(relationshipMetadata?.Relationship_Label) ? (
            <ReviewAssignmentLine label="Relationship label" value={workbookRefLabel(relationshipMetadata.Relationship_Label)} />
          ) : null}
        </ReviewAssignmentSection>

        <ReviewAssignmentSection title="Evidence">
          <ReviewAssignmentLine
            label="Additional fields"
            value={`${evidence.included} included`}
            detail={`${evidence.ignored} ignored`}
          />
        </ReviewAssignmentSection>
      </div>
    </div>
  );
}

function hasAssignedSinglePlaceParts(placeParts = []) {
  return (placeParts || []).some((part) => Boolean(part?.placeColumn));
}

function hasAssignedSingleRelationshipParts(relationshipParts = []) {
  return (relationshipParts || []).some((part) => Boolean(part?.participantColumn));
}

function hasAssignedWorkbookPlaceParts(placeParts = []) {
  return (placeParts || []).some((part) => Boolean(part?.placeRef?.sheetName && part?.placeRef?.columnName));
}

function hasAssignedWorkbookRelationshipParts(relationshipParts = []) {
  return (relationshipParts || []).some((part) => Boolean(part?.participantRef?.sheetName && part?.participantRef?.columnName));
}

function filterLegacyMappingMessages(items = [], { hasPlaces = false, hasRelationships = false, hasTemporalAssertions = false } = {}) {
  return (items || []).filter((item) => {
    const message = String(item?.message || '');
    if (
      hasRelationships
      && (
        /Source_Name/i.test(message)
        || /Target_Name/i.test(message)
        || /source[- ]side.*target[- ]side.*relationship/i.test(message)
      )
    ) {
      return false;
    }

    if (
      hasPlaces
      && (
        /source[- ]side.*place/i.test(message)
        || /target[- ]side.*place/i.test(message)
      )
    ) {
      return false;
    }

    if (
      hasTemporalAssertions
      && (
        /missing Date values/i.test(message)
        || /have Date values/i.test(message)
        || /sortable dates or intervals/i.test(message)
      )
    ) {
      return false;
    }

    return true;
  });
}


function summarizeTemporalAssertionsForReview(rows = [], datasetId = 'temporal-review') {
  try {
    const canonical = normalizePeridotGeneralizedMappedRows(rows, { datasetId });
    const assertions = (canonical.records || []).flatMap((record) => record.temporalAssertions || (record.temporalAssertion ? [record.temporalAssertion] : []));
    const count = (predicate) => assertions.filter(predicate).length;
    const positionable = (item) => item.visualizationUsability?.timelinePositionable && item.parsingStatus !== 'unrecognized' && item.consistency !== 'backwards';
    const inconsistent = count((item) => item.consistency === 'backwards');
    const unrecognized = count((item) => item.parsingStatus === 'unrecognized');
    const positionableRecords = (canonical.records || []).filter((record) => (record.temporalAssertions || []).some(positionable)).length;
    const recordsWithTemporalEvidence = (canonical.records || []).filter((record) => (record.temporalAssertions || []).length > 0).length;
    const recordsWithoutTemporalEvidence = Math.max(0, (canonical.records || []).length - recordsWithTemporalEvidence);
    const warnings = [];
    if (recordsWithoutTemporalEvidence) warnings.push({ message: `${recordsWithoutTemporalEvidence} record${recordsWithoutTemporalEvidence === 1 ? '' : 's'} contain no mapped date or period. ${recordsWithoutTemporalEvidence === 1 ? 'It will not' : 'They will not'} participate in timeline playback or date-range filtering.` });
    if (inconsistent) warnings.push({ message: `${inconsistent} temporal value${inconsistent === 1 ? '' : 's'} contain a start after the end. Peridot preserved the source order and marked ${inconsistent === 1 ? 'it' : 'them'} unsafe for ordinary interval visualization.` });
    if (unrecognized) warnings.push({ message: `${unrecognized} temporal value${unrecognized === 1 ? '' : 's'} could not be interpreted safely. The original text will still be preserved in Inspector/export.` });
    return Object.freeze({
      total: assertions.length,
      recordCount: (canonical.records || []).length,
      positionableRecords,
      recordsWithTemporalEvidence,
      recordsWithoutTemporalEvidence,
      fullyPositionable: count(positionable),
      reducedPrecision: count((item) => item.parsingStatus === 'partial'),
      approximate: count((item) => String(item.temporalShape || '').startsWith('approximate')),
      openEnded: count((item) => item.temporalShape === 'openInterval'),
      noKnownYear: count((item) => item.parsingStatus !== 'unrecognized' && !item.visualizationUsability?.hasKnownYear),
      inconsistent, unrecognized, warnings: Object.freeze(warnings),
    });
  } catch (error) {
    return Object.freeze({ total: 0, fullyPositionable: 0, reducedPrecision: 0, approximate: 0, openEnded: 0, noKnownYear: 0, inconsistent: 0, unrecognized: 0, warnings: Object.freeze([]) });
  }
}

function TemporalReviewSummary({ summary }) {
  if (!summary?.total) return null;
  const items = [
    ['Temporal values', summary.total],
    ['Positionable', summary.fullyPositionable],
    ['Reduced precision', summary.reducedPrecision],
    ['Approximate', summary.approximate],
    ['Open-ended', summary.openEnded],
    ['No known year', summary.noKnownYear],
    ['Inconsistent', summary.inconsistent],
    ['Unrecognized', summary.unrecognized],
  ];
  return (
    <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
      <div className="text-sm font-semibold text-[var(--panel-card-text)]">Temporal interpretation</div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">Peridot preserves the original temporal text. These counts describe machine-readable structure and do not interpret researcher note columns as visualization rules.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--panel-card-border)] px-2 py-2"><div className="text-lg font-bold text-[var(--panel-card-text)]">{value}</div><div className="text-xs text-[var(--panel-card-muted-text)]">{label}</div></div>)}
      </div>
    </div>
  );
}

function ReviewStep({
  validation,
  summary,
  mappedPreviewRows,
  headers,
  capabilityAudit,
  coreMapping,
  temporalMapping,
  temporalAssertionsMapping,
  placeParts,
  relationshipParts,
  relationshipMetadataMapping,
  identityMapping,
  customFieldSelections,
  temporalReviewSummary,
}) {
  const generalizedState = {
    hasPlaces: hasAssignedSinglePlaceParts(placeParts),
    hasRelationships: hasAssignedSingleRelationshipParts(relationshipParts),
    hasTemporalAssertions: (temporalAssertionsMapping || []).some((mapping) => temporalAssertionMappingHasSource(mapping)),
  };
  const warnings = [...filterLegacyMappingMessages(summary?.warnings || [], generalizedState), ...(temporalReviewSummary?.warnings || [])];
  const acceptedRecords = summary?.acceptedRecordCount ?? mappedPreviewRows.length;
  const rawValidationIssues = validation?.isValid ? [] : (validation?.issues || []);
  const validationIssues = filterLegacyMappingMessages(rawValidationIssues, generalizedState);

  return (
    <div className="space-y-4">
      <SingleTableReviewAssignments
        coreMapping={coreMapping}
        temporalMapping={temporalMapping}
        temporalAssertionsMapping={temporalAssertionsMapping}
        placeParts={placeParts}
        relationshipParts={relationshipParts}
        relationshipMetadataMapping={relationshipMetadataMapping}
        identityMapping={identityMapping}
        customFieldSelections={customFieldSelections}
      />

      <TemporalReviewSummary summary={temporalReviewSummary} />

      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
        <div className="mb-4">
          <div className="text-lg font-bold text-[var(--panel-card-text)]">What Peridot can do with this mapping</div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            This check reports record acceptance, current tool availability, and any source values that may limit a visualization.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ReviewStatusPanel
            acceptedRecords={acceptedRecords}
            warningCount={getReviewWarningDisplayCount(warnings, validationIssues)}
            capabilityAudit={capabilityAudit}
            mapReady={generalizedState.hasPlaces}
            timelineReadyCount={temporalReviewSummary?.positionableRecords}
          />
          <ReviewWarningsCard warnings={warnings} validationIssues={validationIssues} />
        </div>
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

function WorkbookTimeMappingStep({ workbookModel, workbookMapping, onTemporalAssertionsChange }) {
  return <WorkbookTemporalMappingTable workbookModel={workbookModel} workbookMapping={workbookMapping} onAssertionsChange={onTemporalAssertionsChange} />;
}

function WorkbookPlacesMappingStep({ workbookModel, placeParts, relationshipParts, onPlacePartsChange }) {
  return (
    <WorkbookSpatialMappingPanel
      workbookModel={workbookModel}
      placeParts={placeParts}
      relationshipParts={relationshipParts}
      onPlacePartsChange={onPlacePartsChange}
    />
  );
}

function WorkbookRelationshipsMappingStep({ workbookModel, workbookMapping, onRelationshipPartsChange, onMetadataChange }) {
  return (
    <WorkbookRelationshipMappingPanel
      workbookModel={workbookModel}
      workbookMapping={workbookMapping}
      onRelationshipPartsChange={onRelationshipPartsChange}
      onMetadataChange={onMetadataChange}
    />
  );
}
function WorkbookReviewStep({ workbookModel, workbookMapping, validation, summary, previewRows, capabilityAudit, temporalReviewSummary }) {
  const generalizedState = {
    hasPlaces: hasAssignedWorkbookPlaceParts(workbookMapping.placeParts),
    hasRelationships: hasAssignedWorkbookRelationshipParts(workbookMapping.relationshipParts),
    hasTemporalAssertions: getWorkbookTemporalAssertionRefs(workbookMapping.temporalAssertionMappings || []).length > 0,
  };
  const rawIssues = validation?.issues || [];
  const filteredIssues = filterLegacyMappingMessages(rawIssues, generalizedState);
  const errors = filteredIssues.filter((issue) => issue.severity === 'error');
  const warnings = [...filteredIssues.filter((issue) => issue.severity !== 'error'), ...(temporalReviewSummary?.warnings || [])];
  const acceptedRecords = summary?.totalRows ?? capabilityAudit?.dataset?.totalRows ?? previewRows.length;
  const validationIssues = [...errors, ...warnings];

  return (
    <div className="space-y-4">
      <WorkbookReviewAssignments workbookMapping={workbookMapping} />

      <TemporalReviewSummary summary={temporalReviewSummary} />

      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
        <div className="mb-4">
          <div className="text-lg font-bold text-[var(--panel-card-text)]">What Peridot can do with this mapping</div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
            This check reports record acceptance, current tool availability, and any source values that may limit a visualization.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ReviewStatusPanel
            acceptedRecords={acceptedRecords}
            warningCount={getReviewWarningDisplayCount(warnings, validationIssues)}
            capabilityAudit={capabilityAudit}
            mapReady={generalizedState.hasPlaces}
            timelineReadyCount={temporalReviewSummary?.positionableRecords}
          />
          <ReviewWarningsCard warnings={warnings} validationIssues={validationIssues} />
        </div>
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


function buildInitialWorkbookTemporalAssertions(mappingState = {}) {
  if (Array.isArray(mappingState.temporalAssertionMappings) && mappingState.temporalAssertionMappings.length) {
    return mappingState.temporalAssertionMappings.map((mapping) => ({ ...mapping, noteColumns: [...(mapping.noteColumns || [])] }));
  }
  const temporal = mappingState.temporalMappings || {};
  const notes = mappingState.temporalNoteMappings || {};
  const result = [];
  if (temporal.Date?.sheetName && temporal.Date?.columnName) result.push({ id:'legacy-date', role:temporal.Date.columnName, kind:'date', sourceMode:'single', column:temporal.Date, noteColumns:notes.Date || [] });
  if (temporal.Date_Range?.sheetName && temporal.Date_Range?.columnName) result.push({ id:'legacy-range', role:temporal.Date_Range.columnName, kind:'period', sourceMode:'single', column:temporal.Date_Range, noteColumns:notes.Date_Range || [] });
  if ((temporal.Date_Start?.sheetName && temporal.Date_Start?.columnName) || (temporal.Date_End?.sheetName && temporal.Date_End?.columnName)) result.push({ id:'legacy-start-end', role:[temporal.Date_Start?.columnName,temporal.Date_End?.columnName].filter(Boolean).join(' / ') || 'Date interval', kind:'period', sourceMode:'endpoints', startMode:'single', startColumn:temporal.Date_Start || makeWorkbookColumnRef('',''), endMode:'single', endColumn:temporal.Date_End || makeWorkbookColumnRef('',''), noteColumns:[...(notes.Date_Start||[]),...(notes.Date_End||[])] });
  return result.length ? result : [{ id:'time-1', role:'', kind:'date', sourceMode:'single', column:makeWorkbookColumnRef('',''), noteColumns:[], subjectParticipantIndex:null }];
}

function workbookTemporalAssertionRefs(mappings = []) {
  const refs=[]; const add=(ref)=>{ if(ref?.sheetName&&ref?.columnName) refs.push(ref); };
  (mappings||[]).forEach((mapping)=>{ ['column','yearColumn','monthColumn','dayColumn','startColumn','startYearColumn','startMonthColumn','startDayColumn','endColumn','endYearColumn','endMonthColumn','endDayColumn'].forEach((key)=>add(mapping?.[key])); (mapping?.noteColumns||[]).forEach(add); });
  return refs;
}

function deriveWorkbookLegacyTemporalMappings(mappings = []) {
  const empty=()=>makeWorkbookColumnRef('','');
  const result={ Date:empty(), Date_Range:empty(), Date_Start:empty(), Date_End:empty(), Date_Display:empty() };
  (mappings||[]).forEach((mapping)=>{
    if(mapping.kind==='date' && mapping.sourceMode==='single' && !result.Date?.columnName && mapping.column?.columnName) result.Date=mapping.column;
    if(mapping.kind==='period' && mapping.sourceMode==='single' && !result.Date_Range?.columnName && mapping.column?.columnName) result.Date_Range=mapping.column;
    if(mapping.kind==='period' && mapping.sourceMode==='endpoints') {
      if(mapping.startMode==='single' && !result.Date_Start?.columnName && mapping.startColumn?.columnName) result.Date_Start=mapping.startColumn;
      if(mapping.endMode==='single' && !result.Date_End?.columnName && mapping.endColumn?.columnName) result.Date_End=mapping.endColumn;
    }
  });
  return result;
}

function buildInitialWorkbookPlaceParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.placeParts) ? mappingState.placeParts : [];
  if (saved.length && saved.some((part) => part?.placeRef || part?.coordinatePairRef || part?.latitudeRef || part?.longitudeRef)) {
    return saved.map((part) => ({ ...part, subjectParticipantIndex: Number.isInteger(part?.subjectParticipantIndex) ? part.subjectParticipantIndex : '' }));
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
      roleLabel: '',
      roleMode: 'heading',
      roleRef: emptyRef(),
      subjectParticipantIndex: '',
      coordinatePairRef: point.Point_Coordinates || emptyRef(),
      latitudeRef: point.Point_Latitude || emptyRef(),
      longitudeRef: point.Point_Longitude || emptyRef(),
    });
  }

  if (hasRef(core.Source_Location) || hasRef(routePairs.Source_Coordinates) || hasRef(core.Source_Latitude) || hasRef(core.Source_Longitude)) {
    parts.push({
      placeRef: core.Source_Location || emptyRef(),
      roleLabel: '',
      roleMode: 'heading',
      roleRef: emptyRef(),
      subjectParticipantIndex: 0,
      coordinatePairRef: routePairs.Source_Coordinates || emptyRef(),
      latitudeRef: core.Source_Latitude || emptyRef(),
      longitudeRef: core.Source_Longitude || emptyRef(),
    });
  }

  if (hasRef(core.Target_Location) || hasRef(routePairs.Target_Coordinates) || hasRef(core.Target_Latitude) || hasRef(core.Target_Longitude)) {
    parts.push({
      placeRef: core.Target_Location || emptyRef(),
      roleLabel: '',
      roleMode: 'heading',
      roleRef: emptyRef(),
      subjectParticipantIndex: 1,
      coordinatePairRef: routePairs.Target_Coordinates || emptyRef(),
      latitudeRef: core.Target_Latitude || emptyRef(),
      longitudeRef: core.Target_Longitude || emptyRef(),
    });
  }

  return parts.length ? parts : [{
    placeRef: emptyRef(),
    roleLabel: '',
    roleMode: 'heading',
    roleRef: emptyRef(),
    subjectParticipantIndex: '',
    coordinatePairRef: emptyRef(),
    latitudeRef: emptyRef(),
    longitudeRef: emptyRef(),
  }];
}

function buildInitialPlaceParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.placeParts) ? mappingState.placeParts : [];
  if (saved.length) return saved.map((part) => ({ ...part, subjectParticipantIndex: Number.isInteger(part?.subjectParticipantIndex) ? part.subjectParticipantIndex : '' }));

  const point = mappingState.pointMapping || {};
  const route = mappingState.coreMapping || {};
  const routePairs = mappingState.routeCoordinatePairMapping || {};
  const parts = [];

  if (point.Point_Place || point.Point_Coordinates || point.Point_Latitude || point.Point_Longitude) {
    parts.push({
      placeColumn: point.Point_Place || '',
      roleLabel: '',
      roleMode: 'heading',
      roleColumn: '',
      subjectParticipantIndex: '',
      coordinatePairColumn: point.Point_Coordinates || '',
      latitudeColumn: point.Point_Latitude || '',
      longitudeColumn: point.Point_Longitude || '',
    });
  }

  if (route.Source_Location || routePairs.Source_Coordinates || route.Source_Latitude || route.Source_Longitude) {
    parts.push({
      placeColumn: route.Source_Location || '',
      roleLabel: '',
      roleMode: 'heading',
      roleColumn: '',
      subjectParticipantIndex: 0,
      coordinatePairColumn: routePairs.Source_Coordinates || '',
      latitudeColumn: route.Source_Latitude || '',
      longitudeColumn: route.Source_Longitude || '',
    });
  }

  if (route.Target_Location || routePairs.Target_Coordinates || route.Target_Latitude || route.Target_Longitude) {
    parts.push({
      placeColumn: route.Target_Location || '',
      roleLabel: '',
      roleMode: 'heading',
      roleColumn: '',
      subjectParticipantIndex: 1,
      coordinatePairColumn: routePairs.Target_Coordinates || '',
      latitudeColumn: route.Target_Latitude || '',
      longitudeColumn: route.Target_Longitude || '',
    });
  }

  return parts.length ? parts : [{
    placeColumn: '',
    roleLabel: '',
    roleMode: 'heading',
    roleColumn: '',
    subjectParticipantIndex: '',
    coordinatePairColumn: '',
    latitudeColumn: '',
    longitudeColumn: '',
  }];
}


function buildInitialRelationshipParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.relationshipParts) ? mappingState.relationshipParts : [];
  if (saved.length >= 2) return saved.map((part) => ({ ...part }));

  const core = mappingState.coreMapping || {};
  const parts = [];

  if (core.Source_Name) {
    parts.push({
      participantColumn: core.Source_Name,
      roleMode: 'heading',
      roleColumn: '',
    });
  }

  if (core.Target_Name) {
    parts.push({
      participantColumn: core.Target_Name,
      roleMode: 'heading',
      roleColumn: '',
    });
  }

  while (parts.length < 2) {
    parts.push({
      participantColumn: '',
      roleMode: 'heading',
      roleColumn: '',
    });
  }

  return parts;
}


function buildInitialWorkbookRelationshipParts(mappingState = {}) {
  const saved = Array.isArray(mappingState.relationshipParts) ? mappingState.relationshipParts : [];
  if (saved.length >= 2) {
    return saved.map((part) => ({
      participantRef: part?.participantRef || makeWorkbookColumnRef('', ''),
      roleMode: part?.roleMode === 'column' ? 'column' : 'heading',
      roleRef: part?.roleRef || makeWorkbookColumnRef('', ''),
    }));
  }

  const coreMappings = mappingState.coreMappings || {};
  const parts = [];

  if (coreMappings.Source_Name?.sheetName && coreMappings.Source_Name?.columnName) {
    parts.push({
      participantRef: coreMappings.Source_Name,
      roleMode: 'heading',
      roleRef: makeWorkbookColumnRef('', ''),
    });
  }

  if (coreMappings.Target_Name?.sheetName && coreMappings.Target_Name?.columnName) {
    parts.push({
      participantRef: coreMappings.Target_Name,
      roleMode: 'heading',
      roleRef: makeWorkbookColumnRef('', ''),
    });
  }

  while (parts.length < 2) {
    parts.push({
      participantRef: makeWorkbookColumnRef('', ''),
      roleMode: 'heading',
      roleRef: makeWorkbookColumnRef('', ''),
    });
  }

  return parts;
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
  const [temporalNoteMappings, setTemporalNoteMappings] = useState(mappingState.temporalNoteMappings || {});
  const [temporalAssertionsMapping, setTemporalAssertionsMapping] = useState(() => normalizeTemporalAssertionMappings(mappingState.temporalAssertionMappings?.length ? mappingState.temporalAssertionMappings : buildTemporalAssertionMappingsFromLegacy(stripDisplayDateMapping(mappingState.temporalMapping || {}), mappingState.temporalNoteMappings || {}))); 
  const [pointMapping, setPointMapping] = useState(mappingState.pointMapping || {});
  const [routeCoordinatePairMapping, setRouteCoordinatePairMapping] = useState(mappingState.routeCoordinatePairMapping || {});
  const [placeParts, setPlaceParts] = useState(() => buildInitialPlaceParts(mappingState));
  const [relationshipParts, setRelationshipParts] = useState(() => buildInitialRelationshipParts(mappingState));
  const [identityMapping, setIdentityMapping] = useState(mappingState.identityMapping || { record: { strategy: 'row', columns: [] }, participants: [] });
  const [relationshipMetadataMapping, setRelationshipMetadataMapping] = useState(normalizeRelationshipMetadataMapping(mappingState.relationshipMetadataMapping || {}));
  const [customFieldSelections, setCustomFieldSelections] = useState(mappingState.customFieldSelections || []);
  const [workbookMapping, setWorkbookMapping] = useState(() => ({
    ...stripWorkbookDisplayDateMapping(mappingState),
    placeParts: buildInitialWorkbookPlaceParts(mappingState),
    relationshipParts: buildInitialWorkbookRelationshipParts(mappingState),
    identityMapping: mappingState.identityMapping || { record: {}, participants: [] },
    temporalAssertionMappings: buildInitialWorkbookTemporalAssertions(mappingState),
  }));
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
    setTemporalNoteMappings(mappingState.temporalNoteMappings || {});
    setTemporalAssertionsMapping(normalizeTemporalAssertionMappings(mappingState.temporalAssertionMappings?.length ? mappingState.temporalAssertionMappings : buildTemporalAssertionMappingsFromLegacy(stripDisplayDateMapping(mappingState.temporalMapping || {}), mappingState.temporalNoteMappings || {})));
    setPlaceParts(buildInitialPlaceParts(mappingState));
    setRelationshipParts(buildInitialRelationshipParts(mappingState));
    setIdentityMapping(mappingState.identityMapping || { record: { strategy: 'row', columns: [] }, participants: [] });
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
            relationshipParts: buildInitialWorkbookRelationshipParts(mappingState || {}),
            identityMapping: mappingState.identityMapping || { record: {}, participants: [] },
            temporalAssertionMappings: buildInitialWorkbookTemporalAssertions(mappingState || {}),
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
        : { ...stripWorkbookDisplayDateMapping(mappingState || {}), placeParts: buildInitialWorkbookPlaceParts(mappingState || {}), relationshipParts: buildInitialWorkbookRelationshipParts(mappingState || {}), identityMapping: mappingState.identityMapping || { record: {}, participants: [] }, temporalAssertionMappings: buildInitialWorkbookTemporalAssertions(mappingState || {}) }
    );
    setShowCancelConfirmation(false);
  }, [open, staging?.stagedAt]);

  useEffect(() => () => {
    stepTransitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    stepTransitionTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    setTemporalMapping(stripDisplayDateMapping(deriveLegacyTemporalMapping(temporalAssertionsMapping)));
    setTemporalNoteMappings({});
  }, [temporalAssertionsMapping]);

  const effectiveCustomSelections = useMemo(() => {
    const mappedCoreColumns = new Set([
      ...Object.values(coreMapping || {}),
      ...Object.values(stripDisplayDateMapping(temporalMapping || {})),
      ...Object.values(temporalNoteMappings || {}).flat(),
      ...getTemporalAssertionSourceColumns(temporalAssertionsMapping),
      ...Object.values(pointMapping || {}),
      ...Object.values(routeCoordinatePairMapping || {}),
      ...(placeParts || []).flatMap((part) => [
        part?.placeColumn,
        part?.roleMode === 'column' ? part?.roleColumn : '',
        part?.coordinatePairColumn,
        part?.latitudeColumn,
        part?.longitudeColumn,
      ]),
      ...(relationshipParts || []).flatMap((part) => [
        part?.participantColumn,
        part?.roleMode === 'column' ? part?.roleColumn : '',
      ]),
    ].filter(Boolean));
    const structuralSelections = customFieldSelections.map((selection) => (
      mappedCoreColumns.has(selection.sourceColumn)
        ? { ...selection, action: CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore }
        : selection
    ));
    return applyRelationshipMetadataSelections(structuralSelections, relationshipMetadataMapping);
  }, [coreMapping, temporalMapping, temporalNoteMappings, temporalAssertionsMapping, pointMapping, routeCoordinatePairMapping, placeParts, relationshipParts, relationshipMetadataMapping, customFieldSelections]);

  const validation = useMemo(
    () => validatePeridotColumnMapping(headers, {
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      temporalNoteMappings,
      temporalAssertionMappings: temporalAssertionsMapping,
      pointMapping,
      routeCoordinatePairMapping,
      relationshipMetadataMapping,
      customFieldSelections: effectiveCustomSelections,
    }),
    [headers, coreMapping, temporalMapping, temporalNoteMappings, temporalAssertionsMapping, pointMapping, routeCoordinatePairMapping, effectiveCustomSelections]
  );

  const mappedRows = useMemo(
    () => applyPeridotGeneralizedColumnMapping(rows, {
      tableOrientation,
      placeParts,
      relationshipParts,
      relationshipMetadataMapping,
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      temporalNoteMappings,
      temporalAssertionMappings: temporalAssertionsMapping,
      pointMapping,
      routeCoordinatePairMapping,
      customFieldSelections: effectiveCustomSelections,
    }),
    [rows, tableOrientation, placeParts, relationshipParts, relationshipMetadataMapping, coreMapping, temporalMapping, temporalNoteMappings, temporalAssertionsMapping, pointMapping, routeCoordinatePairMapping, effectiveCustomSelections]
  );

  const validationSummary = useMemo(
    () => buildPeridotCsvValidationSummary(mappedRows, Object.keys(mappedRows[0] || Object.fromEntries(PERIDOT_TEMPLATE_COLUMNS.map((column) => [column, ''])))),
    [mappedRows]
  );

  const temporalReviewSummary = useMemo(
    () => summarizeTemporalAssertionsForReview(mappedRows, 'single-table-temporal-review'),
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

  const workbookTemporalReviewSummary = useMemo(
    () => summarizeTemporalAssertionsForReview(workbookMappedRowsForAudit, 'workbook-temporal-review'),
    [workbookMappedRowsForAudit]
  );

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
    relationships: 'Relations',
    identity: 'Identity',
    time: 'Time',
    places: 'Places',
    evidence: 'Evidence',
    review: 'Review',
  };

  const workbookStepLabels = {
    'workbook-preview': 'Preview',
    'workbook-setup': 'Sheets',
    'workbook-relationships': 'Relations',
    'workbook-identity': 'Identity',
    'workbook-time': 'Time',
    'workbook-places': 'Places',
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
    setTemporalNoteMappings(nextInitialMapping.temporalNoteMappings || {});
    setTemporalAssertionsMapping(normalizeTemporalAssertionMappings(nextInitialMapping.temporalAssertionMappings?.length ? nextInitialMapping.temporalAssertionMappings : buildTemporalAssertionMappingsFromLegacy(stripDisplayDateMapping(nextInitialMapping.temporalMapping || {}), nextInitialMapping.temporalNoteMappings || {})));
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

  const handleTemporalNoteMappingChange = (field, noteIndex, sourceColumn) => {
    setTemporalNoteMappings((current) => {
      const next = [...(current?.[field] || [])];
      if (sourceColumn === '__ADD__') next.push('');
      else if (sourceColumn) next[noteIndex] = sourceColumn;
      else if (noteIndex < next.length) next.splice(noteIndex, 1);
      return { ...current, [field]: next };
    });
  };

  const handleTemporalAssertionsChange = (nextMappingsOrUpdater) => {
    setTemporalAssertionsMapping((currentMappings) => {
      const nextMappings = typeof nextMappingsOrUpdater === 'function'
        ? nextMappingsOrUpdater(currentMappings)
        : nextMappingsOrUpdater;
      return normalizeTemporalAssertionMappings(nextMappings);
    });
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
        temporalAssertionMappings: buildInitialWorkbookTemporalAssertions({ temporalMappings: nextTemporalMappings }),
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

  const handleWorkbookTemporalNoteMappingChange = (field, noteIndex, ref) => {
    setWorkbookMapping((current) => {
      const currentNotes = current.temporalNoteMappings || {};
      const next = [...(currentNotes[field] || [])];
      if (ref?.__add) next.push({});
      else if (ref?.sheetName && ref?.columnName) next[noteIndex] = ref;
      else if (noteIndex < next.length) next.splice(noteIndex, 1);
      return { ...current, temporalNoteMappings: { ...currentNotes, [field]: next } };
    });
  };

  const handleWorkbookTemporalAssertionsChange = (nextMappingsOrUpdater) => {
    setWorkbookMapping((current) => {
      const currentMappings = current.temporalAssertionMappings || [];
      const nextMappings = typeof nextMappingsOrUpdater === 'function'
        ? nextMappingsOrUpdater(currentMappings)
        : nextMappingsOrUpdater;
      const nextMapping = { ...current, temporalAssertionMappings: nextMappings, temporalMappings: deriveWorkbookLegacyTemporalMappings(nextMappings), temporalNoteMappings: {} };
      return { ...nextMapping, customFieldSelections: refreshWorkbookCustomSelections({ workbookModel, workbookMapping: nextMapping, previousSelections: current.customFieldSelections || [] }) };
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

  const handleWorkbookRelationshipPartsChange = (relationshipParts) => {
    setWorkbookMapping((current) => ({
      ...current,
      relationshipParts,
    }));
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
      relationshipParts,
      identityMapping,
      coreMapping,
      temporalMapping: stripDisplayDateMapping(temporalMapping),
      temporalNoteMappings,
      temporalAssertionMappings: temporalAssertionsMapping,
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

          {!isWorkbookMode && stepForRender === 'time' ? (
            <TimeMappingStep
              headers={headers}
              rows={rows}
              temporalAssertions={temporalAssertionsMapping}
              relationshipParts={relationshipParts}
              onTemporalAssertionsChange={handleTemporalAssertionsChange}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'places' ? (
            <PlacesMappingStep
              headers={headers}
              rows={rows}
              placeParts={placeParts}
              relationshipParts={relationshipParts}
              onPlacePartsChange={setPlaceParts}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'relationships' ? (
            <RelationshipsMappingStep
              headers={headers}
              rows={rows}
              relationshipParts={relationshipParts}
              relationshipMetadataMapping={relationshipMetadataMapping}
              onRelationshipPartsChange={setRelationshipParts}
              onMetadataChange={handleRelationshipMetadataMappingChange}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'identity' ? (
            <IdentityMappingPanel
              headers={headers}
              relationshipParts={relationshipParts}
              placeParts={placeParts}
              identityMapping={identityMapping}
              onChange={setIdentityMapping}
            />
          ) : null}

          {!isWorkbookMode && stepForRender === 'evidence' ? (
            <InspectorFieldsStep
              selections={effectiveCustomSelections}
              coreMapping={{ ...coreMapping, ...stripDisplayDateMapping(temporalMapping), ...pointMapping, ...routeCoordinatePairMapping }}
              rows={rows}
              placeParts={placeParts}
              relationshipParts={relationshipParts}
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
              coreMapping={coreMapping}
              temporalMapping={temporalMapping}
              temporalAssertionsMapping={temporalAssertionsMapping}
              placeParts={placeParts}
              relationshipParts={relationshipParts}
              relationshipMetadataMapping={relationshipMetadataMapping}
              identityMapping={identityMapping}
              customFieldSelections={effectiveCustomSelections}
              temporalReviewSummary={temporalReviewSummary}
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

          {isWorkbookMode && stepForRender === 'workbook-time' ? (
            <WorkbookTimeMappingStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              onTemporalAssertionsChange={handleWorkbookTemporalAssertionsChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-places' ? (
            <WorkbookPlacesMappingStep
              workbookModel={workbookModel}
              placeParts={workbookMapping.placeParts || []}
              relationshipParts={workbookMapping.relationshipParts || []}
              onPlacePartsChange={handleWorkbookPlacePartsChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-relationships' ? (
            <WorkbookRelationshipsMappingStep
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              onRelationshipPartsChange={handleWorkbookRelationshipPartsChange}
              onMetadataChange={handleWorkbookRelationshipMetadataMappingChange}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-identity' ? (
            <WorkbookIdentityMappingPanel
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              identityMapping={workbookMapping.identityMapping || { record: {}, participants: [] }}
              onChange={(nextIdentityMapping) => setWorkbookMapping((current) => ({ ...current, identityMapping: nextIdentityMapping }))}
            />
          ) : null}

          {isWorkbookMode && stepForRender === 'workbook-evidence' ? (
            <WorkbookInspectorFieldsStep
              workbookModel={workbookModel}
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
              temporalReviewSummary={workbookTemporalReviewSummary}
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
