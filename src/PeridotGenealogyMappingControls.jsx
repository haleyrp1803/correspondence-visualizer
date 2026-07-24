/*
 * Editable genealogy mapping controls for Pass 3B.3.
 * Pure presentation: state and validation remain owned by the mapping modal.
 */
import React from 'react';
import {
  PERIDOT_GENEALOGY_DEFINITION_BY_KEY,
  PERIDOT_GENEALOGY_FIELD_GROUPS,
  PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS,
} from './peridotGenealogyMapping.js';

const SELECT_CLASS = 'peridot-mapping-select w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]';

function FieldSelect({ field, value, headers, onChange }) {
  const definition = PERIDOT_GENEALOGY_DEFINITION_BY_KEY[field];
  return (
    <label className="peridot-genealogy-field-control">
      <span className="peridot-genealogy-field-label">
        {definition?.label || field}{definition?.required ? ' *' : ''}
      </span>
      <select value={value || ''} onChange={(event) => onChange(field, event.target.value)} className={SELECT_CLASS}>
        <option value="">Unassigned</option>
        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
      </select>
      <span className="peridot-genealogy-field-key">{field}</span>
    </label>
  );
}

export function GenealogyFieldGroupPanel({ title, description, fields, headers, mapping, onChange }) {
  return (
    <section className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">{description}</p>
      <div className="peridot-genealogy-field-grid mt-4">
        {fields.map((field) => (
          <FieldSelect key={field} field={field} value={mapping?.[field]} headers={headers} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

export function GenealogyIdentityStep(props) {
  return <GenealogyFieldGroupPanel {...props} title="Person identity" description="Map a stable person ID and display name. Wikidata and image fields are optional." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.identity} />;
}
export function GenealogyParentsStep(props) {
  return <GenealogyFieldGroupPanel {...props} title="Parents" description="Parent-child relationships are created from stable mother and father IDs. Names are preserved only as recorded labels." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.parents} />;
}
export function GenealogyPartnersStep(props) {
  return <GenealogyFieldGroupPanel {...props} title="Partners" description="Map current and former partners, relationship type, and partnership dates. Reciprocal declarations will later be deduplicated canonically." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.partners} />;
}
export function GenealogyLifeEventsStep(props) {
  return (
    <div className="space-y-4">
      <GenealogyFieldGroupPanel {...props} title="Birth" description="Birth dates and places create a birth event; they do not imply movement." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.birth.slice(0,5)} />
      <GenealogyFieldGroupPanel {...props} title="Death" description="Death dates and places create a death event; they do not imply movement." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.death.slice(0,5)} />
    </div>
  );
}
export function GenealogyPlacesStep(props) {
  return (
    <div className="space-y-4">
      <GenealogyFieldGroupPanel {...props} title="Birth place" description="Map the recorded birth place and optional latitude-first coordinate pair." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.birth.slice(5)} />
      <GenealogyFieldGroupPanel {...props} title="Death place" description="Map the recorded death place and optional latitude-first coordinate pair." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.death.slice(5)} />
    </div>
  );
}
export function GenealogyAttributesStep(props) {
  return <GenealogyFieldGroupPanel {...props} title="Person attributes" description="Optional descriptive fields are preserved as person attributes and assertions." fields={PERIDOT_GENEALOGY_FIELD_GROUPS.attributes} />;
}

export function GenealogySupplementalRowsPanel({ supplementalRows, actions, onActionChange }) {
  if (!supplementalRows.length) return null;
  return (
    <section className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Supplemental rows</div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        These populated rows have no person ID. Resolve each explicitly; Peridot will not infer attachment from row order.
      </p>
      <div className="mt-4 space-y-3">
        {supplementalRows.map((item) => (
          <div key={item.rowIndex} className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--panel-card-text)]">Row {item.rowNumber}</div>
                <div className="mt-1 text-xs text-[var(--panel-card-muted-text)]">
                  Preceding person row: {item.previousPersonRowNumber || 'none'}
                </div>
              </div>
              <select
                value={actions?.[item.rowIndex] || PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.unresolved}
                onChange={(event) => onActionChange(item.rowIndex, event.target.value)}
                className={SELECT_CLASS}
              >
                <option value={PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.unresolved}>Decision required</option>
                <option value={PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.exclude}>Exclude from import</option>
                <option value={PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.attachPrevious} disabled={item.previousPersonRowIndex === null}>Attach to preceding person</option>
              </select>
            </div>
            <div className="mt-2 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
              {Object.entries(item.values).map(([key,value]) => `${key}: ${value}`).join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GenealogyReviewPanel({ validation, capabilitySummary, supplementalRows, actions, onActionChange }) {
  const issues = validation?.issues || [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-text)]">People</div><div className="mt-1 text-xl font-bold text-[var(--panel-card-text)]">{validation?.uniquePersonIdCount || 0}</div></div>
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-text)]">Errors</div><div className="mt-1 text-xl font-bold text-[var(--panel-card-text)]">{validation?.errorCount || 0}</div></div>
        <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-text)]">Warnings</div><div className="mt-1 text-xl font-bold text-[var(--panel-card-text)]">{validation?.warningCount || 0}</div></div>
      </div>
      <GenealogySupplementalRowsPanel supplementalRows={supplementalRows} actions={actions} onActionChange={onActionChange} />
      <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Capability preview</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(capabilitySummary || {}).map(([key,value]) => <div key={key} className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-sm text-[var(--panel-card-muted-text)]"><span className="font-semibold text-[var(--panel-card-text)]">{key.replace(/([A-Z])/g,' $1')}</span>: {typeof value==='boolean' ? (value?'Available':'Not detected') : value}</div>)}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Validation</div>
        <div className="mt-3 space-y-2">
          {issues.length ? issues.map((issue,index)=><div key={`${issue.code}-${index}`} className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 py-2 text-sm text-[var(--panel-card-muted-text)]"><span className="font-semibold text-[var(--panel-card-text)]">{issue.severity === 'error' ? 'Error' : 'Warning'}:</span> {issue.message}</div>) : <div className="text-sm text-[var(--panel-card-muted-text)]">No mapping issues detected.</div>}
        </div>
      </section>
    </div>
  );
}
