/*
 * Identity mapping controls for generalized table/workbook imports.
 *
 * Relations tells Peridot what participates in a row. Identity tells Peridot
 * how to recognize the same record or recurring person/place/thing when it
 * appears again. This UI stores user-declared recognition rules only; runtime
 * authority is a separate bounded pass after the interaction model is accepted.
 */

import React from 'react';
import { makeWorkbookColumnRef } from './peridotWorkbookMapping.js';

const INPUT_CLASS =
  'peridot-mapping-select w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]';

function SectionDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-2.5 w-2.5 rotate-45 border border-[var(--button-primary-active-border)] bg-[var(--button-primary-bg)] opacity-85" />
      <div className="h-px flex-1 bg-[var(--button-primary-bg)] opacity-85" />
    </div>
  );
}

function IdentityIntro() {
  return (
    <div className="peridot-mapping-intro-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Identity</div>
      <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">
        How should Peridot recognize the same records, people, places, or things when they appear again?
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        A name shown in your data does not always uniquely identify what it describes. Use this step to tell Peridot what makes one record distinct and what information it should compare when the same person, place, organization, object, or other thing appears in different rows or roles.
      </p>
    </div>
  );
}

function UsagePanel() {
  return (
    <aside className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Used for</div>
      <p className="mt-3">
        These choices help Peridot keep different people with the same name separate and recognize the same person, place, or thing when it appears in another row, column, role, or sheet.
      </p>
      <p className="mt-3">
        Your source names and labels stay exactly as you mapped them. You decide which fields Peridot may compare when deciding whether two appearances refer to the same thing.
      </p>
      <p className="mt-3">
        If you use several fields together, a different value in any selected field means Peridot will treat that combination as a different identity.
      </p>
    </aside>
  );
}

function RadioChoice({ name, value, checked, title, detail, onChange, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 py-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--button-primary-bg)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[var(--panel-card-text)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--panel-card-muted-text)]">{detail}</span>
      </span>
    </label>
  );
}

function SingleFieldSelect({ headers, value, onChange, placeholder = 'Choose a field' }) {
  return (
    <select value={value || ''} onChange={(event) => onChange?.(event.target.value)} className={INPUT_CLASS}>
      <option value="">{placeholder}</option>
      {headers.map((header) => (
        <option key={header} value={header}>{header}</option>
      ))}
    </select>
  );
}

function WorkbookFieldSelect({ workbookModel, currentRef = {}, onChange }) {
  const encoded = currentRef?.sheetName && currentRef?.columnName
    ? `${currentRef.sheetName}|||${currentRef.columnName}`
    : '';

  return (
    <select
      value={encoded}
      onChange={(event) => {
        const [sheetName = '', columnName = ''] = event.target.value.split('|||');
        onChange?.(makeWorkbookColumnRef(sheetName, columnName));
      }}
      className={INPUT_CLASS}
    >
      <option value="">Choose a field</option>
      {(workbookModel?.sheets || []).flatMap((sheet) =>
        (sheet.headers || []).map((header) => (
          <option key={`${sheet.sheetName}|||${header}`} value={`${sheet.sheetName}|||${header}`}>
            {sheet.sheetName} — {header}
          </option>
        ))
      )}
    </select>
  );
}

function RecordSection({ workbook = false, headers = [], workbookModel, workbookMapping = {}, value = {}, onChange }) {
  const defaultStrategy = workbook && workbookMapping?.primaryLetterIdColumn ? 'workbook-key' : 'row';
  const allowed = workbook ? ['workbook-key', 'row', 'field', 'composite'] : ['row', 'field', 'composite'];
  const strategy = allowed.includes(value?.strategy) ? value.strategy : defaultStrategy;
  const fields = workbook
    ? (Array.isArray(value?.refs) ? value.refs : [])
    : (Array.isArray(value?.columns) ? value.columns : []);

  const primary = workbookMapping?.primarySheetName && workbookMapping?.primaryLetterIdColumn
    ? `${workbookMapping.primarySheetName} — ${workbookMapping.primaryLetterIdColumn}`
    : '';

  const setStrategy = (next) => {
    if (workbook) {
      onChange?.({
        strategy: next,
        refs: ['row', 'workbook-key'].includes(next)
          ? []
          : (fields.length ? fields : [makeWorkbookColumnRef('', '')]),
      });
    } else {
      onChange?.({
        strategy: next,
        columns: next === 'row' ? [] : (fields.length ? fields : ['']),
      });
    }
  };

  const setField = (index, next) => {
    const updated = [...fields];
    updated[index] = next;
    onChange?.(workbook
      ? { ...value, strategy, refs: updated }
      : { ...value, strategy, columns: updated });
  };

  const removeField = (index) => {
    onChange?.(workbook
      ? { ...value, strategy, refs: fields.filter((_, itemIndex) => itemIndex !== index) }
      : { ...value, strategy, columns: fields.filter((_, itemIndex) => itemIndex !== index) });
  };

  const addField = () => {
    onChange?.(workbook
      ? { ...value, strategy, refs: [...fields, makeWorkbookColumnRef('', '')] }
      : { ...value, strategy, columns: [...fields, ''] });
  };

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/35 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">Records</div>
      <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">
        How should Peridot tell when two rows refer to the same record?
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        For example, each row might describe only one unique court case or letter, or the record might have a Unique ID that goes with it wherever that record appears.
      </p>

      <div className="my-4"><SectionDivider /></div>

      <div className="space-y-1">
        {workbook && (
          <RadioChoice
            name="record-identity"
            value="workbook-key"
            checked={strategy === 'workbook-key'}
            onChange={setStrategy}
            title="Use the record ID already chosen on Sheets"
            detail={primary ? `Currently: ${primary}` : 'Choose a primary unique ID on Sheets first.'}
          />
        )}
        <RadioChoice
          name="record-identity"
          value="row"
          checked={strategy === 'row'}
          onChange={setStrategy}
          title="Each row is its own record"
          detail="Choose this when every row intentionally describes a different record."
        />
        <RadioChoice
          name="record-identity"
          value="field"
          checked={strategy === 'field'}
          onChange={setStrategy}
          title="Use one field to identify the record"
          detail="Choose this when one ID, shelfmark, case number, or other field follows the same record wherever it appears."
        />
        <RadioChoice
          name="record-identity"
          value="composite"
          checked={strategy === 'composite'}
          onChange={setStrategy}
          title="Use several fields together to identify the record"
          detail="Choose this when no single field is enough, but a combination of fields identifies the record."
        />
      </div>

      {strategy === 'field' && (
        <div className="mt-4 max-w-2xl">
          <div className="mb-1 text-sm font-semibold text-[var(--panel-card-text)]">Which field identifies the record?</div>
          {workbook
            ? <WorkbookFieldSelect workbookModel={workbookModel} currentRef={fields[0]} onChange={(next) => setField(0, next)} />
            : <SingleFieldSelect headers={headers} value={fields[0]} onChange={(next) => setField(0, next)} placeholder="Choose the record ID field" />}
        </div>
      )}

      {strategy === 'composite' && (
        <div className="mt-4 max-w-2xl space-y-2">
          <div className="text-sm font-semibold text-[var(--panel-card-text)]">Which fields should Peridot use together?</div>
          {(fields.length ? fields : [workbook ? makeWorkbookColumnRef('', '') : '']).map((field, index) => (
            <div key={index} className="flex gap-2">
              {workbook
                ? <WorkbookFieldSelect workbookModel={workbookModel} currentRef={field} onChange={(next) => setField(index, next)} />
                : <SingleFieldSelect headers={headers} value={field} onChange={(next) => setField(index, next)} />}
              <button
                type="button"
                onClick={() => removeField(index)}
                className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] px-3 text-xs font-semibold text-[var(--panel-card-muted-text)]"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addField}
            className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)]"
          >
            + Add another field
          </button>
        </div>
      )}
    </section>
  );
}

function partSourceLabel(part = {}, workbook = false) {
  if (workbook) {
    return part?.participantRef?.sheetName && part?.participantRef?.columnName
      ? `${part.participantRef.sheetName} — ${part.participantRef.columnName}`
      : '';
  }
  return part?.participantColumn || '';
}

function findWorkbookColumn(workbookModel, sheetName, candidate) {
  const sheet = (workbookModel?.sheets || []).find((item) => item.sheetName === sheetName);
  if (!sheet) return '';
  const target = String(candidate || '').trim().toLowerCase();
  return (sheet.headers || []).find((header) => String(header).trim().toLowerCase() === target) || '';
}

function suggestedSingleField(headers, participantColumn, key) {
  const base = String(participantColumn || '').trim();
  const normalizedKey = String(key || '').trim();
  if (!base || !normalizedKey) return '';
  if (normalizedKey.toLowerCase() === 'name') return base;
  const candidate = `${base} ${normalizedKey}`;
  const exact = (headers || []).find((header) => String(header).trim().toLowerCase() === candidate.toLowerCase());
  return exact || '';
}

function suggestedWorkbookRef(workbookModel, participantRef, key) {
  const sheetName = participantRef?.sheetName || '';
  const base = participantRef?.columnName || '';
  const normalizedKey = String(key || '').trim();
  if (!sheetName || !base || !normalizedKey) return makeWorkbookColumnRef('', '');
  if (normalizedKey.toLowerCase() === 'name') return participantRef;
  const found = findWorkbookColumn(workbookModel, sheetName, `${base} ${normalizedKey}`);
  return found ? makeWorkbookColumnRef(sheetName, found) : makeWorkbookColumnRef('', '');
}

function relationshipAppearance(part = {}, index, workbook = false) {
  const sourceLabel = partSourceLabel(part, workbook);
  if (!sourceLabel) return null;
  return {
    id: `relationship:${index}`,
    kind: 'relationship',
    index,
    title: `Part ${String.fromCharCode(65 + index)}`,
    sourceLabel,
    source: workbook ? (part?.participantRef || makeWorkbookColumnRef('', '')) : (part?.participantColumn || ''),
  };
}

function placeSourceLabel(part = {}, workbook = false) {
  if (workbook) {
    return part?.placeRef?.sheetName && part?.placeRef?.columnName
      ? `${part.placeRef.sheetName} — ${part.placeRef.columnName}`
      : '';
  }
  return part?.placeColumn || '';
}

function placeAppearance(part = {}, index, workbook = false) {
  const sourceLabel = placeSourceLabel(part, workbook);
  if (!sourceLabel) return null;
  return {
    id: `place:${index}`,
    kind: 'place',
    index,
    title: `Place ${String.fromCharCode(65 + index)}`,
    sourceLabel,
    source: workbook ? (part?.placeRef || makeWorkbookColumnRef('', '')) : (part?.placeColumn || ''),
  };
}

function makeDefaultEntityGroups(relationshipAppearances = [], placeAppearances = []) {
  const groups = [];
  if (relationshipAppearances.length) {
    groups.push({
      id: 'identity-group-relationships',
      label: 'Relationship participants',
      appearanceIds: relationshipAppearances.map((item) => item.id),
      customAppearances: [],
      strategy: 'label',
      keys: ['Name'],
      mappings: {},
    });
  }
  if (placeAppearances.length) {
    groups.push({
      id: 'identity-group-places',
      label: 'Places',
      appearanceIds: placeAppearances.map((item) => item.id),
      customAppearances: [],
      strategy: 'label',
      keys: ['Name'],
      mappings: {},
    });
  }
  return groups;
}

function normalizeEntityGroup(group = {}, index = 0) {
  const strategy = ['label', 'field', 'composite', 'row'].includes(group?.strategy) ? group.strategy : 'label';
  let keys = Array.isArray(group?.keys) ? [...group.keys] : [];
  if (strategy === 'field' && !keys.length) keys = ['ID'];
  if (strategy === 'composite' && !keys.length) keys = ['Name'];
  if (strategy === 'label' && !keys.length) keys = ['Name'];
  return {
    id: group?.id || `identity-group-${index + 1}`,
    label: group?.label ?? '',
    appearanceIds: Array.isArray(group?.appearanceIds) ? [...group.appearanceIds] : [],
    customAppearances: Array.isArray(group?.customAppearances) ? group.customAppearances.map((item) => ({ ...item })) : [],
    strategy,
    keys,
    mappings: group?.mappings && typeof group.mappings === 'object' ? { ...group.mappings } : {},
  };
}

function customAppearanceSourceLabel(item = {}, workbook = false) {
  if (workbook) {
    return item?.ref?.sheetName && item?.ref?.columnName ? `${item.ref.sheetName} — ${item.ref.columnName}` : '';
  }
  return item?.column || '';
}

function suggestedFieldForAppearance({ workbook, workbookModel, headers, appearance, key }) {
  if (!appearance) return workbook ? makeWorkbookColumnRef('', '') : '';
  if (workbook) {
    const baseRef = appearance.source || makeWorkbookColumnRef('', '');
    return suggestedWorkbookRef(workbookModel, baseRef, key);
  }
  return suggestedSingleField(headers, appearance.source || '', key);
}

function EntityGroupCard({
  workbook = false,
  headers = [],
  workbookModel,
  group,
  groupIndex,
  mappedAppearances = [],
  onChange,
  onRemove,
}) {
  const appearanceById = new Map(mappedAppearances.map((item) => [item.id, item]));
  const customAppearances = group.customAppearances || [];
  for (const custom of customAppearances) {
    appearanceById.set(custom.id, {
      id: custom.id,
      kind: 'custom',
      title: custom.label || 'Another appearance',
      sourceLabel: customAppearanceSourceLabel(custom, workbook),
      source: workbook ? custom.ref : custom.column,
    });
  }

  const selectedAppearances = group.appearanceIds
    .map((id) => appearanceById.get(id))
    .filter(Boolean);

  const update = (patch) => onChange?.({ ...group, ...patch });

  const setStrategy = (strategy) => {
    let keys = [...(group.keys || [])];
    if (strategy === 'field') keys = [keys[0] || 'ID'];
    else if (strategy === 'composite') keys = keys.length ? keys : ['Name'];
    else if (strategy === 'label') keys = ['Name'];
    else keys = [];
    update({ strategy, keys });
  };

  const toggleAppearance = (appearanceId) => {
    const ids = new Set(group.appearanceIds || []);
    if (ids.has(appearanceId)) ids.delete(appearanceId);
    else ids.add(appearanceId);
    update({ appearanceIds: [...ids] });
  };

  const setKey = (keyIndex, value) => {
    const keys = [...(group.keys || [])];
    keys[keyIndex] = value;
    update({ keys });
  };

  const addKey = () => update({ keys: [...(group.keys || []), ''] });

  const removeKey = (keyIndex) => {
    const keys = (group.keys || []).filter((_, index) => index !== keyIndex);
    update({ keys: keys.length ? keys : ['Name'] });
  };

  const addCustomAppearance = () => {
    const id = `custom:${group.id}:${Date.now()}`;
    const custom = workbook
      ? { id, label: '', ref: makeWorkbookColumnRef('', '') }
      : { id, label: '', column: '' };
    update({
      customAppearances: [...customAppearances, custom],
      appearanceIds: [...(group.appearanceIds || []), id],
    });
  };

  const setCustomAppearance = (customIndex, patch) => {
    const next = customAppearances.map((item, index) => index === customIndex ? { ...item, ...patch } : item);
    update({ customAppearances: next });
  };

  const removeCustomAppearance = (customIndex) => {
    const target = customAppearances[customIndex];
    update({
      customAppearances: customAppearances.filter((_, index) => index !== customIndex),
      appearanceIds: (group.appearanceIds || []).filter((id) => id !== target?.id),
    });
  };

  const mappingFor = (appearance, keyIndex) => {
    const saved = group.mappings?.[appearance.id]?.[keyIndex];
    if (saved) return saved;
    const key = group.keys?.[keyIndex] || '';
    const suggestion = suggestedFieldForAppearance({ workbook, workbookModel, headers, appearance, key });
    return workbook ? { key, ref: suggestion } : { key, column: suggestion };
  };

  const setMapping = (appearance, keyIndex, nextValue) => {
    const mappings = { ...(group.mappings || {}) };
    const current = Array.isArray(mappings[appearance.id]) ? [...mappings[appearance.id]] : [];
    const key = group.keys?.[keyIndex] || '';
    current[keyIndex] = workbook ? { key, ref: nextValue } : { key, column: nextValue };
    mappings[appearance.id] = current;
    update({ mappings });
  };

  return (
    <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-bold text-[var(--panel-card-text)]">What kind of person, place, or thing are you tracking?</label>
          <input
            value={group.label}
            onChange={(event) => update({ label: event.target.value })}
            placeholder="e.g. People, Places, Manuscripts"
            className={`${INPUT_CLASS} mt-2 max-w-xl`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 py-2 text-xs font-semibold text-[var(--panel-card-muted-text)]"
        >
          Remove
        </button>
      </div>

      <div className="my-4"><SectionDivider /></div>

      <div className="text-sm font-bold text-[var(--panel-card-text)]">Where does this kind of thing appear in your data?</div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
        Select every mapped role or place that can refer to this same kind of thing. You can also add another column or sheet, such as a People Profiles sheet.
      </p>

      <div className="mt-3 space-y-1">
        {mappedAppearances.map((appearance) => (
          <label key={appearance.id} className="flex cursor-pointer items-start gap-3 py-1.5">
            <input
              type="checkbox"
              checked={(group.appearanceIds || []).includes(appearance.id)}
              onChange={() => toggleAppearance(appearance.id)}
              className="mt-1 h-4 w-4 accent-[var(--button-primary-bg)]"
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--panel-card-text)]">{appearance.title}</span>
              <span className="block text-xs text-[var(--panel-card-muted-text)]">{appearance.sourceLabel}</span>
            </span>
          </label>
        ))}
      </div>

      {customAppearances.length > 0 && (
        <div className="mt-3 space-y-2">
          {customAppearances.map((item, index) => (
            <div key={item.id} className="grid gap-2 rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/45 p-3 lg:grid-cols-[minmax(10rem,0.7fr)_minmax(16rem,1.3fr)_auto] lg:items-center">
              <input
                value={item.label || ''}
                onChange={(event) => setCustomAppearance(index, { label: event.target.value })}
                placeholder="e.g. People Profiles"
                className={INPUT_CLASS}
              />
              {workbook
                ? <WorkbookFieldSelect workbookModel={workbookModel} currentRef={item.ref} onChange={(ref) => setCustomAppearance(index, { ref })} />
                : <SingleFieldSelect headers={headers} value={item.column} onChange={(column) => setCustomAppearance(index, { column })} />}
              <button
                type="button"
                onClick={() => removeCustomAppearance(index)}
                className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 py-2 text-xs font-semibold text-[var(--panel-card-muted-text)]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addCustomAppearance}
        className="mt-3 rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)]"
      >
        + Add another place this appears in your data
      </button>

      <div className="my-4"><SectionDivider /></div>

      <div className="text-sm font-bold text-[var(--panel-card-text)]">
        How should Peridot tell when two appearances refer to the same {group.label?.trim() || 'person, place, or thing'}?
      </div>
      <div className="mt-2 space-y-1">
        <RadioChoice
          name={`entity-identity-${group.id}`}
          value="label"
          checked={group.strategy === 'label'}
          onChange={setStrategy}
          title="The displayed name or label is enough"
          detail="Matching labels will be treated as the same thing."
        />
        <RadioChoice
          name={`entity-identity-${group.id}`}
          value="field"
          checked={group.strategy === 'field'}
          onChange={setStrategy}
          title="Use one identifying field"
          detail="Use a stable ID, catalogue number, shelfmark, or another field that uniquely identifies it."
        />
        <RadioChoice
          name={`entity-identity-${group.id}`}
          value="composite"
          checked={group.strategy === 'composite'}
          onChange={setStrategy}
          title="Use several fields together"
          detail="Use a combination such as Name + Occupation or Name + Title to tell similar-looking entities apart."
        />
        <RadioChoice
          name={`entity-identity-${group.id}`}
          value="row"
          checked={group.strategy === 'row'}
          onChange={setStrategy}
          title="Each row refers to a different one"
          detail="Repeated names or labels will not be merged across rows."
        />
      </div>

      {['field', 'composite'].includes(group.strategy) && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/45 p-3">
            <div className="text-sm font-bold text-[var(--panel-card-text)]">
              {group.strategy === 'field'
                ? 'What identifying information should Peridot compare?'
                : 'What information should Peridot use together to tell them apart?'}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
              Name each kind of information in plain language. For example, Name + Title can be supplied by Source + Source Title in one role and Target + Target Title in another.
            </p>
            <div className="mt-3 max-w-xl space-y-2">
              {(group.keys || []).map((key, keyIndex) => (
                <div key={keyIndex} className="flex gap-2">
                  <input
                    value={key}
                    onChange={(event) => setKey(keyIndex, event.target.value)}
                    placeholder={group.strategy === 'field' ? 'e.g. Person ID' : 'e.g. Name'}
                    className={INPUT_CLASS}
                  />
                  {group.strategy === 'composite' && (
                    <button
                      type="button"
                      onClick={() => removeKey(keyIndex)}
                      className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)] px-3 text-xs font-semibold text-[var(--panel-card-muted-text)]"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {group.strategy === 'composite' && (
                <button
                  type="button"
                  onClick={addKey}
                  className="rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)]"
                >
                  + Add another kind of information
                </button>
              )}
            </div>
          </div>

          {selectedAppearances.length > 0 && (
            <div className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/45 p-3">
              <div className="text-sm font-bold text-[var(--panel-card-text)]">Where does that information appear?</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--panel-card-muted-text)]">
                Map the same kinds of identifying information for every role, column, or sheet where this kind of thing appears.
              </p>
              <div className="mt-3 space-y-3">
                {selectedAppearances.map((appearance) => (
                  <div key={appearance.id} className="rounded-xl border border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] p-3">
                    <div className="text-sm font-bold text-[var(--panel-card-text)]">{appearance.title}</div>
                    <div className="mt-0.5 text-xs text-[var(--panel-card-muted-text)]">Displayed from {appearance.sourceLabel || 'an unassigned field'}.</div>
                    <div className="mt-3 space-y-2">
                      {(group.keys || []).map((key, keyIndex) => {
                        const component = mappingFor(appearance, keyIndex);
                        return (
                          <div key={`${appearance.id}-${keyIndex}`} className="grid gap-2 sm:grid-cols-[minmax(8rem,0.45fr)_minmax(15rem,1.55fr)] sm:items-center">
                            <div className="text-sm font-semibold text-[var(--panel-card-text)]">{key || `Information ${keyIndex + 1}`}</div>
                            {workbook
                              ? <WorkbookFieldSelect workbookModel={workbookModel} currentRef={component.ref} onChange={(next) => setMapping(appearance, keyIndex, next)} />
                              : <SingleFieldSelect headers={headers} value={component.column} onChange={(next) => setMapping(appearance, keyIndex, next)} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntitySection({
  workbook = false,
  headers = [],
  workbookModel,
  relationshipParts = [],
  placeParts = [],
  identityMapping = {},
  onChange,
}) {
  const record = identityMapping?.record || {};
  const relationshipAppearances = relationshipParts
    .map((part, index) => relationshipAppearance(part, index, workbook))
    .filter(Boolean);
  const placeAppearances = placeParts
    .map((part, index) => placeAppearance(part, index, workbook))
    .filter(Boolean);
  const mappedAppearances = [...relationshipAppearances, ...placeAppearances];

  const savedGroups = Array.isArray(identityMapping?.entityGroups) ? identityMapping.entityGroups : [];
  const groups = savedGroups.length || identityMapping?.entityGroupsInitialized
    ? savedGroups.map(normalizeEntityGroup)
    : makeDefaultEntityGroups(relationshipAppearances, placeAppearances).map(normalizeEntityGroup);

  const saveGroups = (nextGroups) => onChange?.({
    ...identityMapping,
    record,
    entityGroupsInitialized: true,
    entityGroups: nextGroups,
  });

  const updateGroup = (groupIndex, nextGroup) => {
    const next = groups.map((group, index) => index === groupIndex ? normalizeEntityGroup(nextGroup, index) : group);
    saveGroups(next);
  };

  const removeGroup = (groupIndex) => saveGroups(groups.filter((_, index) => index !== groupIndex));

  const addGroup = () => saveGroups([
    ...groups,
    normalizeEntityGroup({
      id: `identity-group-${Date.now()}`,
      label: '',
      appearanceIds: [],
      customAppearances: [],
      strategy: 'label',
      keys: ['Name'],
      mappings: {},
    }, groups.length),
  ]);

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--input-bg)]/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-text)]">People, places, and other things</div>
      <div className="mt-1 text-lg font-bold text-[var(--panel-card-text)]">
        What unique people, places, or other things should Peridot keep track of?
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        Add one group for each kind of recurring thing you want to follow across the dataset—for example People and Places. Each group can have its own rule for deciding when two appearances refer to the same thing.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--panel-card-muted-text)]">
        For example, People might use Name + Title across sender, recipient, and profile columns, while Places might simply use the place name wherever it appears.
      </p>

      <div className="my-4"><SectionDivider /></div>

      <div className="space-y-4">
        {groups.map((group, groupIndex) => (
          <EntityGroupCard
            key={group.id}
            workbook={workbook}
            headers={headers}
            workbookModel={workbookModel}
            group={group}
            groupIndex={groupIndex}
            mappedAppearances={mappedAppearances}
            onChange={(next) => updateGroup(groupIndex, next)}
            onRemove={() => removeGroup(groupIndex)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addGroup}
        className="mt-4 rounded-xl border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--button-primary-text)]"
      >
        + Add another kind of person, place, or thing to track
      </button>
    </section>
  );
}
export function IdentityMappingPanel({ headers = [], relationshipParts = [], placeParts = [], identityMapping = {}, onChange }) {
  const record = identityMapping?.record || { strategy: 'row', columns: [] };
  const updateRecord = (next) => onChange?.({
    ...identityMapping,
    record: next,
    participants: Array.isArray(identityMapping?.participants) ? identityMapping.participants : [],
  });

  return (
    <div className="space-y-3">
      <IdentityIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            <RecordSection headers={headers} value={record} onChange={updateRecord} />
            <EntitySection headers={headers} relationshipParts={relationshipParts} placeParts={placeParts} identityMapping={identityMapping} onChange={onChange} />
          </div>
          <UsagePanel />
        </div>
      </div>
    </div>
  );
}

export function WorkbookIdentityMappingPanel({ workbookModel, workbookMapping = {}, identityMapping = {}, onChange }) {
  const record = identityMapping?.record || {};
  const updateRecord = (next) => onChange?.({
    ...identityMapping,
    record: next,
    participants: Array.isArray(identityMapping?.participants) ? identityMapping.participants : [],
  });
  const relationshipParts = Array.isArray(workbookMapping?.relationshipParts) ? workbookMapping.relationshipParts : [];
  const placeParts = Array.isArray(workbookMapping?.placeParts) ? workbookMapping.placeParts : [];

  return (
    <div className="space-y-3">
      <IdentityIntro />
      <div className="peridot-mapping-section-card rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-5">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(17rem,0.72fr)]">
          <div className="min-w-0 space-y-4">
            <RecordSection
              workbook
              workbookModel={workbookModel}
              workbookMapping={workbookMapping}
              value={record}
              onChange={updateRecord}
            />
            <EntitySection
              workbook
              workbookModel={workbookModel}
              relationshipParts={relationshipParts}
              placeParts={placeParts}
              identityMapping={identityMapping}
              onChange={onChange}
            />
          </div>
          <UsagePanel />
        </div>
      </div>
    </div>
  );
}
