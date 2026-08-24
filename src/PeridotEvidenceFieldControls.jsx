/*
 * Evidence-field controls for the role-based column/workbook mapping modal.
 *
 * `PeridotColumnMappingModal.jsx` owns mapping state and import behavior. This
 * component file owns the repeated evidence field UI: Include/Ignore choices,
 * display-label editing, analytics-readiness labels, source examples, and
 * workbook sheet grouping.
 */

import React from 'react';
import PeridotValueHandlingControl from './PeridotValueHandlingControl.jsx';
import { CUSTOM_INSPECTOR_FIELD_DEFAULTS } from './peridotColumnMapping.js';
import { getWorkbookSheet, makeWorkbookColumnRef } from './peridotWorkbookMapping.js';

function normalizeAction(value) {
  return value === CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
    ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
    : CUSTOM_INSPECTOR_FIELD_DEFAULTS.include;
}

function IncludeIgnoreCheckboxPair({ action, disabled = false, onChange }) {
  const resolvedAction = disabled ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore : normalizeAction(action);
  const isIncluded = resolvedAction === CUSTOM_INSPECTOR_FIELD_DEFAULTS.include;
  const isIgnored = resolvedAction === CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore;

  return (
    <div className="peridot-mapping-evidence-toggle" aria-label="Evidence field inclusion">
      <label className={['peridot-mapping-evidence-choice', isIncluded ? 'peridot-mapping-evidence-choice-active' : '', disabled ? 'peridot-mapping-evidence-choice-disabled' : ''].filter(Boolean).join(' ')}>
        <input
          type="checkbox"
          checked={isIncluded}
          disabled={disabled}
          onChange={(event) => onChange(
            event.target.checked
              ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.include
              : CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore,
          )}
        />
        <span>Include</span>
      </label>
      <label className={['peridot-mapping-evidence-choice', isIgnored ? 'peridot-mapping-evidence-choice-active' : '', disabled ? 'peridot-mapping-evidence-choice-disabled' : ''].filter(Boolean).join(' ')}>
        <input
          type="checkbox"
          checked={isIgnored}
          disabled={disabled}
          onChange={(event) => onChange(
            event.target.checked
              ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore
              : CUSTOM_INSPECTOR_FIELD_DEFAULTS.include,
          )}
        />
        <span>Ignore</span>
      </label>
    </div>
  );
}

export function makeWorkbookSelectionKey(selection = {}) {
  const ref = selection.sourceRef || makeWorkbookColumnRef(selection.sheetName, selection.sourceColumn);
  return `${ref.sheetName || selection.sheetName || ''}::${ref.columnName || selection.sourceColumn || selection.key || selection.label || ''}`;
}

export function getWorkbookSelectionRef(selection = {}) {
  return selection.sourceRef || makeWorkbookColumnRef(selection.sheetName, selection.sourceColumn || selection.key || selection.label);
}

export function buildWorkbookSelectionLabel(selection = {}, primarySheetName = '') {
  return selection.label || selection.sourceColumn || selection.key || selection.sourceRef?.columnName || '';
}

function collectExamples(rows = [], sourceColumn = '') {
  if (!sourceColumn) return [];
  const examples = [];
  const seen = new Set();

  for (const row of rows || []) {
    const value = String(row?.[sourceColumn] ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    examples.push(value);
    if (examples.length >= 3) break;
  }

  return examples;
}

function EvidenceExamples({ rows = [], sourceColumn = '' }) {
  const examples = collectExamples(rows, sourceColumn);
  if (!examples.length) return null;

  return (
    <div className="mt-2 max-w-[24rem] text-sm font-normal leading-relaxed text-[var(--panel-card-muted-text)]">
      <span className="font-semibold text-[var(--panel-card-text)]">Examples from your data:</span>{' '}
      {examples.join(' · ')}
    </div>
  );
}

function EvidenceIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="text-lg font-bold leading-tight text-[var(--panel-card-text)]">
        What other information should Peridot keep with each record?
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Choose which remaining columns should stay attached to the record. These can include descriptive information, identifiers, citations, categories, measurements, links, notes, or anything else you want to preserve.
      </p>
    </div>
  );
}

function singleTableStructuralColumns(coreMapping = {}, placeParts = [], relationshipParts = []) {
  const columns = new Set(Object.values(coreMapping || {}).filter(Boolean));

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

function addWorkbookRef(set, ref) {
  if (ref?.sheetName && ref?.columnName) {
    set.add(`${ref.sheetName}::${ref.columnName}`);
  }
}

function workbookStructuralRefs(workbookMapping = {}) {
  const refs = new Set();

  [
    ...Object.values(workbookMapping.coreMappings || {}),
    ...Object.values(workbookMapping.temporalMappings || {}),
    ...Object.values(workbookMapping.pointMappings || {}),
    ...Object.values(workbookMapping.routeCoordinatePairMappings || {}),
    ...Object.values(workbookMapping.relationshipMetadataMappings || {}),
  ].forEach((ref) => addWorkbookRef(refs, ref));

  for (const part of workbookMapping.placeParts || []) {
    [
      part?.placeRef,
      part?.roleMode === 'column' ? part?.roleRef : null,
      part?.coordinateMode === 'pair' ? part?.coordinatePairRef : null,
      part?.coordinateMode === 'separate' ? part?.latitudeRef : null,
      part?.coordinateMode === 'separate' ? part?.longitudeRef : null,
    ].forEach((ref) => addWorkbookRef(refs, ref));
  }

  for (const part of workbookMapping.relationshipParts || []) {
    [
      part?.participantRef,
      part?.roleMode === 'column' ? part?.roleRef : null,
    ].forEach((ref) => addWorkbookRef(refs, ref));
  }

  return refs;
}

export function InspectorFieldsStep({
  selections,
  coreMapping,
  rows = [],
  placeParts = [],
  relationshipParts = [],
  onActionChange,
  onLabelChange,
  onValueHandlingChange,
}) {
  const mappedCoreColumns = singleTableStructuralColumns(coreMapping, placeParts, relationshipParts);

  return (
    <div className="space-y-4">
      <EvidenceIntro />

      <div className="peridot-mapping-table-wrap overflow-x-auto rounded-2xl border border-[var(--panel-card-border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--stat-card-bg)] text-[var(--panel-card-text)]">
            <tr>
              <th className="px-4 py-3">Uploaded column</th>
              <th className="px-4 py-3">Use as evidence?</th>
              <th className="px-4 py-3">Display label</th>
              <th className="px-4 py-3">Values in one cell</th>
              <th className="px-4 py-3">Chart/filter readiness</th>
            </tr>
          </thead>
          <tbody className="text-[var(--panel-card-muted-text)]">
            {selections.map((selection, index) => {
              const isMappedCore = mappedCoreColumns.has(selection.sourceColumn);
              const action = isMappedCore ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore : normalizeAction(selection.action);
              return (
                <tr key={`${selection.sourceColumn}-${index}`} className="border-t border-[var(--panel-card-border)] align-top">
                  <td className="px-4 py-4 font-semibold text-[var(--panel-card-text)]">
                    {selection.sourceColumn}
                    {isMappedCore ? (
                      <div className="mt-1 text-sm font-normal leading-relaxed text-[var(--panel-card-muted-text)]">
                        Already used on an earlier mapping page.
                      </div>
                    ) : null}
                    <EvidenceExamples rows={rows} sourceColumn={selection.sourceColumn} />
                  </td>
                  <td className="px-4 py-4">
                    <IncludeIgnoreCheckboxPair
                      action={action}
                      disabled={isMappedCore}
                      onChange={(nextAction) => onActionChange(index, nextAction)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="text"
                      value={selection.label || selection.sourceColumn}
                      onChange={(event) => onLabelChange(index, event.target.value)}
                      className="peridot-mapping-input w-full min-w-[12rem] rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                    />
                  </td>
                  <td className="px-4 py-4 min-w-[22rem]">
                    <PeridotValueHandlingControl
                      valueHandling={selection.valueHandling}
                      onChange={(valueHandling) => onValueHandlingChange?.(index, valueHandling)}
                      disabled={isMappedCore || action !== CUSTOM_INSPECTOR_FIELD_DEFAULTS.include}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className={selection.analyticsEligible ? 'peridot-mapping-readiness-badge peridot-mapping-readiness-badge-chart' : 'peridot-mapping-readiness-badge'}>
                      {selection.analyticsEligible ? 'Likely chart/filter field' : 'Evidence only'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!selections.length ? (
        <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          No additional evidence fields are available.
        </div>
      ) : null}
    </div>
  );
}

export function WorkbookInspectorFieldsStep({
  workbookModel,
  workbookMapping,
  selections,
  onActionChange,
  onLabelChange,
  onValueHandlingChange,
}) {
  const mappedCoreRefs = workbookStructuralRefs(workbookMapping);

  const groupedSelections = selections.reduce((groups, selection, index) => {
    const ref = getWorkbookSelectionRef(selection);
    const sheetName = ref.sheetName || selection.sheetName || workbookMapping.primarySheetName || 'Workbook';
    if (!groups.has(sheetName)) groups.set(sheetName, []);
    groups.get(sheetName).push({ selection, index, ref });
    return groups;
  }, new Map());

  return (
    <div className="space-y-4">
      <EvidenceIntro />

      {Array.from(groupedSelections.entries()).map(([sheetName, sheetSelections]) => {
        const sourceSheet = getWorkbookSheet(workbookModel, sheetName);
        const sourceRows = sourceSheet?.rows || [];

        return (
          <div key={sheetName} className="peridot-mapping-table-wrap overflow-x-auto rounded-2xl border border-[var(--panel-card-border)]">
            <div className="border-b border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-4 py-4">
              <div className="text-lg font-bold text-[var(--panel-card-text)]">{sheetName}</div>
              <div className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
                {sheetName === workbookMapping.primarySheetName ? 'Primary record sheet' : 'Joined sheet'}
              </div>
            </div>

            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--section-bg)] text-[var(--panel-card-text)]">
                <tr>
                  <th className="px-4 py-3">Workbook column</th>
                  <th className="px-4 py-3">Use as evidence?</th>
                  <th className="px-4 py-3">Display label</th>
                  <th className="px-4 py-3">Values in one cell</th>
                  <th className="px-4 py-3">Chart/filter readiness</th>
                </tr>
              </thead>
              <tbody className="text-[var(--panel-card-muted-text)]">
                {sheetSelections.map(({ selection, index, ref }) => {
                  const refKey = `${ref.sheetName}::${ref.columnName}`;
                  const isMappedCore = mappedCoreRefs.has(refKey);
                  const action = isMappedCore ? CUSTOM_INSPECTOR_FIELD_DEFAULTS.ignore : normalizeAction(selection.action);
                  const sourceColumn = ref.columnName || selection.sourceColumn;

                  return (
                    <tr key={`${refKey}-${index}`} className="border-t border-[var(--panel-card-border)] align-top">
                      <td className="px-4 py-4 font-semibold text-[var(--panel-card-text)]">
                        {sourceColumn}
                        {isMappedCore ? (
                          <div className="mt-1 text-sm font-normal leading-relaxed text-[var(--panel-card-muted-text)]">
                            Already used on an earlier mapping page.
                          </div>
                        ) : null}
                        <EvidenceExamples rows={sourceRows} sourceColumn={sourceColumn} />
                      </td>
                      <td className="px-4 py-4">
                        <IncludeIgnoreCheckboxPair
                          action={action}
                          disabled={isMappedCore}
                          onChange={(nextAction) => onActionChange(index, nextAction)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          value={selection.label || buildWorkbookSelectionLabel(selection, workbookMapping.primarySheetName)}
                          onChange={(event) => onLabelChange(index, event.target.value)}
                          className="peridot-mapping-input w-full min-w-[12rem] rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
                        />
                      </td>
                      <td className="px-4 py-4 min-w-[22rem]">
                        <PeridotValueHandlingControl
                          valueHandling={selection.valueHandling}
                          onChange={(valueHandling) => onValueHandlingChange?.(index, valueHandling)}
                          disabled={isMappedCore || action !== CUSTOM_INSPECTOR_FIELD_DEFAULTS.include}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className={selection.analyticsEligible ? 'peridot-mapping-readiness-badge peridot-mapping-readiness-badge-chart' : 'peridot-mapping-readiness-badge'}>
                          {selection.analyticsEligible ? 'Likely chart/filter field' : 'Evidence only'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {!selections.length ? (
        <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
          No additional evidence fields are available from the configured workbook sheets.
        </div>
      ) : null}
    </div>
  );
}
