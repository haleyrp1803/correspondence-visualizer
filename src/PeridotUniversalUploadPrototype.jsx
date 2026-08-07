/*
 * Standalone Phase 2.2 universal-upload prototype.
 *
 * This component is intentionally NOT wired into App.jsx or the active mapping
 * modal. It exists so the complicated interaction model can be tested and
 * simplified before production integration.
 */

import React, { useMemo, useState } from 'react';
import {
  PERIDOT_FIELD_ASSIGNMENT_STATUS,
  PERIDOT_SHEET_PURPOSES,
  PERIDOT_VARIABLE_KINDS,
} from './peridotUniversalMappingModel.js';
import {
  PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_PURPOSE_OPTIONS,
  PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEP_LABELS,
  PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEPS,
  PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_VARIABLE_KIND_OPTIONS,
  acceptPrototypeFieldSuggestion,
  addPrototypeRepeatedHeadingGroup,
  addPrototypeSavedVariable,
  addPrototypeTableConnection,
  assignPrototypeField,
  buildPeridotUniversalUploadPrototypeResult,
  dismissPrototypeFieldSuggestion,
  getPrototypeFieldSuggestions,
  getPrototypeTablesForStep,
  makePeridotUniversalUploadPrototypeState,
  removePrototypeRepeatedHeadingGroup,
  removePrototypeTableConnection,
  setPrototypeFieldIgnored,
  setPrototypeSheetPurpose,
} from './peridotUniversalUploadPrototype.js';
import {
  PERIDOT_UNIVERSAL_NAMED_THING_KIND_OPTIONS,
  buildPeridotUniversalSheetPurposeReview,
  getPeridotUniversalSheetPurposePolicy,
} from './peridotUniversalSheetPurposePolicy.js';

function Select({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-lg border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--panel-card-text)] ${className}`}
    >
      {children}
    </select>
  );
}

function PrototypeCard({ title, eyebrow, children }) {
  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4">
      {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">{eyebrow}</div> : null}
      <h3 className="mt-1 text-base font-bold text-[var(--panel-card-text)]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SourceStep({ state }) {
  const tables = state.sourceManifest?.sourceTables || [];
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {tables.map((table) => (
        <PrototypeCard key={table.id} eyebrow="Source table" title={table.label || table.sheetName || table.id}>
          <p className="text-sm text-[var(--panel-card-muted-text)]">{table.rowCount || 0} rows · {(table.fields || []).length} columns</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(table.fields || []).slice(0, 12).map((field) => (
              <span key={field.id} className="rounded-full border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-2 py-1 text-xs text-[var(--panel-card-muted-text)]">{field.name}</span>
            ))}
            {(table.fields || []).length > 12 ? <span className="text-xs text-[var(--muted-text)]">+{(table.fields || []).length - 12} more</span> : null}
          </div>
        </PrototypeCard>
      ))}
    </div>
  );
}

function PurposeStep({ state, update }) {
  const review = useMemo(() => buildPeridotUniversalSheetPurposeReview(state), [state]);
  return (
    <div className="space-y-3">
      <PrototypeCard eyebrow="Why this matters" title="Sheet purpose controls which later questions Peridot asks">
        <p className="text-sm leading-relaxed text-[var(--panel-card-muted-text)]">You are describing the role of each sheet. Peridot will not infer that role from its contents. Sheets marked as data remain available for variable mapping; reference, maintenance, ignored, and still-unsure sheets are withheld from later mapping until their purpose changes.</p>
        <div className="mt-3 text-xs text-[var(--panel-card-muted-text)]">{review.ready ? 'Every sheet has enough information to continue.' : `${review.unresolvedCount} sheet(s) are still unsure; ${review.namedThingKindNeededCount} named-thing sheet(s) still need a type.`}</div>
      </PrototypeCard>
      {(state.sourceManifest?.sourceTables || []).map((table) => {
        const assignment = state.sheetPurposes.find((item) => item.sourceTableId === table.id);
        const current = assignment?.purpose || PERIDOT_SHEET_PURPOSES.UNSURE;
        const namedThingKind = assignment?.namedThingKind || '';
        const policy = getPeridotUniversalSheetPurposePolicy(current);
        return (
          <PrototypeCard key={table.id} eyebrow="Sheet purpose" title={table.label || table.sheetName || table.id}>
            <p className="mb-3 text-sm text-[var(--panel-card-muted-text)]">What does this sheet mainly contain?</p>
            <div className="grid gap-3 lg:grid-cols-2 lg:items-end">
              <Select value={current} onChange={(purpose) => update(setPrototypeSheetPurpose(state, { sourceTableId: table.id, purpose, namedThingKind: purpose === PERIDOT_SHEET_PURPOSES.NAMED_THINGS ? namedThingKind : '' }))}>
                {PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_PURPOSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              {current === PERIDOT_SHEET_PURPOSES.NAMED_THINGS ? (
                <label className="text-xs text-[var(--panel-card-muted-text)]">What kind of things does each row describe?
                  <Select value={namedThingKind} onChange={(value) => update(setPrototypeSheetPurpose(state, { sourceTableId: table.id, purpose: current, namedThingKind: value }))} className="mt-1 w-full">
                    <option value="">Choose one</option>
                    {PERIDOT_UNIVERSAL_NAMED_THING_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </label>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
              {policy.explanation}
              <div className="mt-1 font-semibold">Later mapping: {policy.exposesFields ? 'fields available' : 'fields withheld'} · {policy.allowsRepeatedHeadings ? 'repeated columns available' : 'no repeated-column setup'} · {policy.allowsConnections ? 'sheet connections available' : 'no sheet connections'}</div>
            </div>
          </PrototypeCard>
        );
      })}
    </div>
  );
}

function FieldSuggestion({ suggestion, state, update }) {
  const [label, setLabel] = useState(suggestion.suggestedLabel);
  const [kind, setKind] = useState(suggestion.suggestedKind);

  return (
    <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-text)]">Peridot noticed a possible mapping</div>
      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(15rem,1fr)_auto_auto] lg:items-end">
        <label className="text-xs text-[var(--panel-card-muted-text)]">Variable name
          <input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--panel-card-text)]" />
        </label>
        <label className="text-xs text-[var(--panel-card-muted-text)]">What kind of information is this?
          <Select value={kind} onChange={setKind} className="mt-1 w-full">
            {PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_VARIABLE_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label>
        <button type="button" disabled={!label.trim()} onClick={() => update(acceptPrototypeFieldSuggestion(state, { suggestionId: suggestion.id, label, kind }))} className="rounded-lg border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-xs font-semibold text-[var(--button-primary-text)] disabled:opacity-50">Use suggestion</button>
        <button type="button" onClick={() => update(dismissPrototypeFieldSuggestion(state, suggestion.id))} className="rounded-lg border border-[var(--panel-card-border)] px-3 py-2 text-xs font-semibold text-[var(--panel-card-muted-text)]">Dismiss</button>
      </div>
      <div className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
        {suggestion.basis.map((reason) => <div key={reason}>{reason}</div>)}
        {suggestion.sampleValues.length ? <div>Examples seen: {suggestion.sampleValues.join(' · ')}</div> : null}
      </div>
    </div>
  );
}

function VariableStep({ state, update }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState(PERIDOT_VARIABLE_KINDS.OTHER);
  const variables = state.savedVariables;
  const tables = useMemo(() => getPrototypeTablesForStep(state, 'fields'), [state]);
  const allTables = state.sourceManifest?.sourceTables || [];
  const suggestions = useMemo(() => getPrototypeFieldSuggestions(state), [state]);
  const suggestionsByField = useMemo(() => new Map(suggestions.map((suggestion) => [suggestion.sourceFieldId, suggestion])), [suggestions]);

  return (
    <div className="space-y-4">
      <PrototypeCard eyebrow="Saved variables" title="Name the things you want Peridot to remember">
        <div className="flex flex-wrap gap-2">
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Variable name" className="min-w-[16rem] flex-1 rounded-lg border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--panel-card-text)]" />
          <Select value={kind} onChange={setKind}>
            {PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_VARIABLE_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <button type="button" disabled={!label.trim()} onClick={() => { update(addPrototypeSavedVariable(state, { label, kind })); setLabel(''); }} className="rounded-lg border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-text)] disabled:opacity-50">Add variable</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {variables.map((variable) => <span key={variable.id} className="rounded-full border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)]/70 px-3 py-1 text-xs font-semibold text-[var(--button-primary-text)]">{variable.label} · {variable.kind}</span>)}
        </div>
      </PrototypeCard>

      {tables.length === 0 ? <PrototypeCard eyebrow="No data sheets available" title="Classify a sheet before assigning variables"><p className="text-sm text-[var(--panel-card-muted-text)]">Return to What each sheet contains and classify at least one sheet as records, named things, or summary/totals.</p></PrototypeCard> : null}
      {allTables.length > tables.length ? <div className="text-xs text-[var(--muted-text)]">{allTables.length - tables.length} sheet(s) are intentionally withheld from variable mapping by their current purpose.</div> : null}
      {tables.map((table) => (
        <PrototypeCard key={table.id} eyebrow="Assign columns" title={table.label || table.sheetName || table.id}>
          <div className="space-y-2">
            {(table.fields || []).map((field) => {
              const assignment = state.fieldAssignments.find((item) => item.sourceFieldId === field.id);
              const value = assignment?.status === PERIDOT_FIELD_ASSIGNMENT_STATUS.IGNORED ? '__ignore__' : (assignment?.variableId || '');
              return (
                <div key={field.id} className="space-y-2 rounded-xl border border-transparent py-1">
                  <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1.2fr)] md:items-center">
                    <div className="text-sm font-semibold text-[var(--panel-card-text)]">{field.name}</div>
                    <Select value={value} onChange={(next) => {
                      if (next === '__ignore__') update(setPrototypeFieldIgnored(state, { sourceTableId: table.id, sourceFieldId: field.id }));
                      else update(assignPrototypeField(state, { sourceTableId: table.id, sourceFieldId: field.id, variableId: next, status: next ? PERIDOT_FIELD_ASSIGNMENT_STATUS.ACTIVE : PERIDOT_FIELD_ASSIGNMENT_STATUS.UNASSIGNED }));
                    }}>
                      <option value="">Not assigned yet</option>
                      {variables.map((variable) => <option key={variable.id} value={variable.id}>{variable.label}</option>)}
                      <option value="__ignore__">Ignore this column</option>
                    </Select>
                  </div>
                  {suggestionsByField.get(field.id) ? <FieldSuggestion key={suggestionsByField.get(field.id).id} suggestion={suggestionsByField.get(field.id)} state={state} update={update} /> : null}
                </div>
              );
            })}
          </div>
        </PrototypeCard>
      ))}
    </div>
  );
}

function RepeatedHeadingsStep({ state, update }) {
  const tables = getPrototypeTablesForStep(state, 'repeated-headings');
  const [tableId, setTableId] = useState(tables[0]?.id || '');
  const [selected, setSelected] = useState([]);
  const [headingVariableId, setHeadingVariableId] = useState('');
  const [cellVariableId, setCellVariableId] = useState('');
  const [transposeFirst, setTransposeFirst] = useState(false);
  const table = tables.find((item) => item.id === tableId);

  const toggleField = (fieldId) => setSelected((current) => current.includes(fieldId) ? current.filter((id) => id !== fieldId) : [...current, fieldId]);

  return (
    <div className="space-y-4">
      {tables.length === 0 ? <PrototypeCard eyebrow="No eligible sheets" title="Repeated columns are not available yet"><p className="text-sm text-[var(--panel-card-muted-text)]">Classify a data-bearing sheet first. Reference, maintenance, ignored, and unsure sheets do not enter repeated-column setup.</p></PrototypeCard> : null}
      {tables.length > 0 ? <PrototypeCard eyebrow="Repeated columns" title="Tell Peridot when several headings represent comparable things">
        <p className="mb-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">Example: five company headings can become one Organization variable, while the cells beneath them become one Stock price variable. This prototype asks rather than inferring.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-sm text-[var(--panel-card-muted-text)]">Table<Select value={tableId} onChange={(value) => { setTableId(value); setSelected([]); }} className="mt-1 w-full">{tables.map((item) => <option key={item.id} value={item.id}>{item.label || item.sheetName}</option>)}</Select></label>
          <label className="flex items-center gap-2 text-sm text-[var(--panel-card-muted-text)]"><input type="checkbox" checked={transposeFirst} onChange={(event) => setTransposeFirst(event.target.checked)} />The source needs to be turned before interpreting these headings</label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(table?.fields || []).map((field) => <button key={field.id} type="button" onClick={() => toggleField(field.id)} className={`rounded-full border px-3 py-1 text-xs ${selected.includes(field.id) ? 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]' : 'border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] text-[var(--panel-card-muted-text)]'}`}>{field.name}</button>)}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="text-sm text-[var(--panel-card-muted-text)]">What do the selected headings represent?<Select value={headingVariableId} onChange={setHeadingVariableId} className="mt-1 w-full"><option value="">Choose a saved variable</option>{state.savedVariables.map((variable) => <option key={variable.id} value={variable.id}>{variable.label}</option>)}</Select></label>
          <label className="text-sm text-[var(--panel-card-muted-text)]">What do the cells contain?<Select value={cellVariableId} onChange={setCellVariableId} className="mt-1 w-full"><option value="">Choose a saved variable</option>{state.savedVariables.map((variable) => <option key={variable.id} value={variable.id}>{variable.label}</option>)}</Select></label>
        </div>
        <button type="button" disabled={!tableId || selected.length < 2 || !headingVariableId || !cellVariableId} onClick={() => { update(addPrototypeRepeatedHeadingGroup(state, { sourceTableId: tableId, sourceFieldIds: selected, headingVariableId, cellVariableId, transposeFirst })); setSelected([]); }} className="mt-3 rounded-lg border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-text)] disabled:opacity-50">Save repeated-column rule</button>
      </PrototypeCard> : null}

      {state.repeatedHeadingGroups.map((group) => (
        <PrototypeCard key={group.id} eyebrow="Saved rule" title={group.id}>
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--panel-card-muted-text)]"><span>{group.sourceFieldIds.length} headings · {group.generatedVariableSource}</span><button type="button" onClick={() => update(removePrototypeRepeatedHeadingGroup(state, group.id))} className="text-xs font-semibold underline">Remove</button></div>
        </PrototypeCard>
      ))}
    </div>
  );
}

function ConnectionsStep({ state, update }) {
  const tables = getPrototypeTablesForStep(state, 'connections');
  const [fromTableId, setFromTableId] = useState(tables[0]?.id || '');
  const [toTableId, setToTableId] = useState(tables[1]?.id || tables[0]?.id || '');
  const [fromFieldId, setFromFieldId] = useState('');
  const [toFieldId, setToFieldId] = useState('');
  const fromFields = tables.find((item) => item.id === fromTableId)?.fields || [];
  const toFields = tables.find((item) => item.id === toTableId)?.fields || [];

  return (
    <div className="space-y-4">
      {tables.length < 2 ? <PrototypeCard eyebrow="No connection needed yet" title="At least two eligible data sheets are required"><p className="text-sm text-[var(--panel-card-muted-text)]">Only sheets classified as records, named things, or summary/totals participate in field-to-field connections.</p></PrototypeCard> : null}
      {tables.length >= 2 ? <PrototypeCard eyebrow="Connect sheets" title="Choose fields whose values should match">
        <p className="mb-3 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">Peridot will later report whether each row has no match, one match, or several matches. This prototype does not assume that several matches are an error.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2"><Select value={fromTableId} onChange={(value) => { setFromTableId(value); setFromFieldId(''); }} className="w-full">{tables.map((table) => <option key={table.id} value={table.id}>{table.label || table.sheetName}</option>)}</Select><Select value={fromFieldId} onChange={setFromFieldId} className="w-full"><option value="">Field to match</option>{fromFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></div>
          <div className="space-y-2"><Select value={toTableId} onChange={(value) => { setToTableId(value); setToFieldId(''); }} className="w-full">{tables.map((table) => <option key={table.id} value={table.id}>{table.label || table.sheetName}</option>)}</Select><Select value={toFieldId} onChange={setToFieldId} className="w-full"><option value="">Field to match</option>{toFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></div>
        </div>
        <button type="button" disabled={!fromFieldId || !toFieldId || fromTableId === toTableId} onClick={() => update(addPrototypeTableConnection(state, { fromTableId, fromFieldId, toTableId, toFieldId }))} className="mt-3 rounded-lg border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-text)] disabled:opacity-50">Save connection</button>
      </PrototypeCard> : null}

      {state.tableConnections.map((connection) => (
        <PrototypeCard key={connection.id} eyebrow="Saved connection" title={connection.label || connection.id}>
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--panel-card-muted-text)]"><span>{connection.fromTableId} → {connection.toTableId}</span><button type="button" onClick={() => update(removePrototypeTableConnection(state, connection.id))} className="text-xs font-semibold underline">Remove</button></div>
        </PrototypeCard>
      ))}
    </div>
  );
}

function ReviewStep({ state }) {
  const result = useMemo(() => buildPeridotUniversalUploadPrototypeResult(state), [state]);
  const summary = result.summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Source tables', summary.sourceTables],
          ['Data-bearing sheets', summary.mappingEligibleTables],
          ['Reference sheets', summary.referenceTables],
          ['Unresolved purposes', summary.unresolvedSheetPurposes + summary.namedThingKindsNeeded],
          ['Saved variables', summary.savedVariables],
          ['Assigned fields', summary.assignedFields],
          ['Unassigned fields', summary.unassignedFields],
          ['Repeated-column rules', summary.repeatedHeadingGroups],
          ['Sheet connections', summary.tableConnections],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-text)]">{label}</div><div className="mt-2 text-2xl font-bold text-[var(--panel-card-text)]">{value}</div></div>)}
      </div>
      <PrototypeCard eyebrow="Sheet-purpose review" title={result.sheetPurposeReview.ready ? 'Every sheet has an operational purpose' : 'Some sheet purposes still need attention'}>
        <div className="space-y-2">
          {result.sheetPurposeReview.rows.map((row) => <div key={row.sourceTableId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3 text-xs text-[var(--panel-card-muted-text)]"><span><strong className="text-[var(--panel-card-text)]">{row.label}</strong> · {row.purposeLabel}{row.namedThingKind ? ` · ${row.namedThingKind}` : ''}</span><span>{row.ready ? row.mappingMode : row.unresolvedPurpose ? 'choose a purpose' : 'choose what kind of named thing'}</span></div>)}
        </div>
      </PrototypeCard>
      <PrototypeCard eyebrow="Prototype interpretation" title="What Peridot would save">
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)] p-3 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">{JSON.stringify({ savedVariables: result.savedVariables, universalMapping: result.universalMapping }, null, 2)}</pre>
      </PrototypeCard>
    </div>
  );
}

export function PeridotUniversalUploadPrototype({ sourceManifest, sourceRowsByTableId = {}, initialMapping, initialSavedVariables = [], onChange }) {
  const [step, setStep] = useState(PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEPS[0]);
  const [state, setState] = useState(() => makePeridotUniversalUploadPrototypeState({ sourceManifest, sourceRowsByTableId, mapping: initialMapping, savedVariables: initialSavedVariables }));

  const update = (next) => {
    setState(next);
    onChange?.(buildPeridotUniversalUploadPrototypeResult(next));
  };

  return (
    <div className="rounded-[2rem] border border-[var(--panel-card-border)] bg-[var(--panel-bg)] p-5 shadow-xl">
      <header className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-text)]">Phase 2.3 prototype</div>
        <h2 className="mt-1 text-2xl font-bold text-[var(--panel-card-text)]">Describe how your data is organized</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--panel-card-muted-text)]">This deliberately detailed prototype now makes sheet purpose operational. Your classifications control which sheets appear in later mapping steps, while Peridot’s conservative field suggestions remain editable and never become mappings until you accept them.</p>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Universal upload prototype steps">
        {PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEPS.map((key, index) => <button key={key} type="button" onClick={() => setStep(key)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${step === key ? 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]' : 'border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] text-[var(--panel-card-muted-text)]'}`}>{index + 1}. {PERIDOT_UNIVERSAL_UPLOAD_PROTOTYPE_STEP_LABELS[key]}</button>)}
      </nav>

      {step === 'sources' ? <SourceStep state={state} /> : null}
      {step === 'purposes' ? <PurposeStep state={state} update={update} /> : null}
      {step === 'variables' ? <VariableStep state={state} update={update} /> : null}
      {step === 'repeated-headings' ? <RepeatedHeadingsStep state={state} update={update} /> : null}
      {step === 'connections' ? <ConnectionsStep state={state} update={update} /> : null}
      {step === 'review' ? <ReviewStep state={state} /> : null}
    </div>
  );
}
