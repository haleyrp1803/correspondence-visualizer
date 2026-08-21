/*
 * Runtime compiler for researcher-declared Identity mappings.
 *
 * Relations/Places define where an entity appears. Identity defines how those
 * appearances should be reconciled across rows and roles. This module compiles
 * that declared mapping into stable runtime IDs without changing display labels.
 */

function asText(value) {
  return String(value ?? '').trim();
}

function stablePart(value) {
  return encodeURIComponent(asText(value));
}

function appearanceId(kind, index) {
  return `${kind}:${index}`;
}

function findIdentityGroup(identityMapping = {}, kind = '', index = -1) {
  const id = appearanceId(kind, index);
  return (Array.isArray(identityMapping?.entityGroups) ? identityMapping.entityGroups : [])
    .find((group) => Array.isArray(group?.appearanceIds) && group.appearanceIds.includes(id)) || null;
}

function explicitComponentsForAppearance(group = {}, id = '') {
  const mappings = group?.mappings?.[id];
  return Array.isArray(mappings) ? mappings : [];
}

function sourceColumnForComponent(component = {}) {
  return asText(component?.column || component?.sourceColumn);
}

function resolveComponentValues(row = {}, group = {}, id = '') {
  const keys = Array.isArray(group?.keys) ? group.keys : [];
  const mappings = explicitComponentsForAppearance(group, id);
  return keys.map((key, index) => {
    const component = mappings[index] || {};
    const sourceColumn = sourceColumnForComponent(component);
    return {
      key: asText(component?.key || key || `Identity ${index + 1}`),
      sourceColumn,
      value: sourceColumn ? asText(row?.[sourceColumn]) : '',
    };
  });
}

function makeEntityId({ groupId, strategy, label, components, rowIndex, id }) {
  const namespace = stablePart(groupId || 'entity-group');
  if (strategy === 'row') {
    return `peridot-entity:${namespace}:row:${rowIndex}:appearance:${stablePart(id)}`;
  }
  if (strategy === 'label') {
    return label ? `peridot-entity:${namespace}:label:${stablePart(label)}` : '';
  }

  const values = (components || []).map((component) => asText(component?.value));
  const complete = values.length > 0 && values.every(Boolean);
  if (!complete) {
    // A researcher-selected ID/composite rule is authoritative. Missing
    // identifying data must not silently fall back to a display label and merge
    // two entities the researcher intended to keep distinct.
    return `peridot-entity:${namespace}:unresolved:${rowIndex}:appearance:${stablePart(id)}`;
  }
  return `peridot-entity:${namespace}:${strategy}:${values.map(stablePart).join('+')}`;
}


function findHeaderExact(headers = [], candidate = '') {
  const target = asText(candidate).toLowerCase();
  if (!target) return '';
  return (headers || []).find((header) => asText(header).toLowerCase() === target) || '';
}

function workbookSheetHeaders(workbookModel = {}, sheetName = '') {
  return (workbookModel?.sheets || []).find((sheet) => asText(sheet?.sheetName) === asText(sheetName))?.headers || [];
}

function suggestedSingleIdentityColumn(headers = [], sourceColumn = '', key = '') {
  const base = asText(sourceColumn);
  const identityKey = asText(key);
  if (!base || !identityKey) return '';
  if (identityKey.toLowerCase() === 'name') return base;
  return findHeaderExact(headers, `${base} ${identityKey}`);
}

function suggestedWorkbookIdentityRef(workbookModel = {}, sourceRef = {}, key = '') {
  const sheetName = asText(sourceRef?.sheetName);
  const base = asText(sourceRef?.columnName);
  const identityKey = asText(key);
  if (!sheetName || !base || !identityKey) return { sheetName: '', columnName: '' };
  if (identityKey.toLowerCase() === 'name') return { sheetName, columnName: base };
  const found = findHeaderExact(workbookSheetHeaders(workbookModel, sheetName), `${base} ${identityKey}`);
  return found ? { sheetName, columnName: found } : { sheetName: '', columnName: '' };
}

function identityAppearanceSources(relationshipParts = [], placeParts = [], workbook = false) {
  const sources = new Map();
  (relationshipParts || []).forEach((part, index) => {
    const source = workbook ? part?.participantRef : part?.participantColumn;
    if (workbook) {
      if (asText(source?.sheetName) && asText(source?.columnName)) sources.set(`relationship:${index}`, source);
    } else if (asText(source)) sources.set(`relationship:${index}`, source);
  });
  (placeParts || []).forEach((part, index) => {
    const source = workbook ? part?.placeRef : part?.placeColumn;
    if (workbook) {
      if (asText(source?.sheetName) && asText(source?.columnName)) sources.set(`place:${index}`, source);
    } else if (asText(source)) sources.set(`place:${index}`, source);
  });
  return sources;
}

export function resolvePeridotMappedEntityIdentity({
  row = {},
  rowIndex = 0,
  identityMapping = {},
  appearanceKind = '',
  appearanceIndex = -1,
  label = '',
} = {}) {
  const id = appearanceId(appearanceKind, appearanceIndex);
  const group = findIdentityGroup(identityMapping, appearanceKind, appearanceIndex);
  if (!group) {
    return Object.freeze({
      entityId: '',
      groupId: '',
      groupLabel: '',
      strategy: '',
      components: Object.freeze([]),
      complete: false,
      source: 'unmapped',
    });
  }

  const strategy = ['label', 'field', 'composite', 'row'].includes(group?.strategy)
    ? group.strategy
    : 'label';
  const components = ['field', 'composite'].includes(strategy)
    ? resolveComponentValues(row, group, id)
    : [];
  const complete = strategy === 'row'
    || (strategy === 'label' ? Boolean(asText(label)) : components.length > 0 && components.every((component) => Boolean(component.value)));

  return Object.freeze({
    entityId: makeEntityId({
      groupId: group.id,
      strategy,
      label: asText(label),
      components,
      rowIndex,
      id,
    }),
    groupId: asText(group.id),
    groupLabel: asText(group.label),
    strategy,
    components: Object.freeze(components.map((component) => Object.freeze({ ...component }))),
    complete,
    source: 'researcher-declared-identity',
  });
}

function recordIdentityFields(record = {}) {
  if (Array.isArray(record?.columns)) return record.columns.map(asText).filter(Boolean);
  return [];
}

export function resolvePeridotMappedRecordIdentity({ row = {}, rowIndex = 0, identityMapping = {} } = {}) {
  const record = identityMapping?.record || {};
  const strategy = ['row', 'field', 'composite', 'workbook-key'].includes(record?.strategy)
    ? record.strategy
    : 'row';
  const columns = recordIdentityFields(record);

  if (strategy === 'row') {
    return Object.freeze({
      recordId: `peridot-record:row:${rowIndex}`,
      strategy,
      components: Object.freeze([]),
      complete: true,
      source: 'researcher-declared-identity',
    });
  }

  const components = columns.map((sourceColumn, index) => Object.freeze({
    key: `Record identity ${index + 1}`,
    sourceColumn,
    value: asText(row?.[sourceColumn]),
  }));
  const complete = components.length > 0 && components.every((component) => Boolean(component.value));
  const values = components.map((component) => component.value);
  const recordId = complete
    ? `peridot-record:${strategy}:${values.map(stablePart).join('+')}`
    : `peridot-record:unresolved:${rowIndex}`;

  return Object.freeze({
    recordId,
    strategy,
    components: Object.freeze(components),
    complete,
    source: 'researcher-declared-identity',
  });
}

export function materializePeridotSingleTableIdentityMappingSuggestions({
  identityMapping = {},
  relationshipParts = [],
  placeParts = [],
  headers = [],
} = {}) {
  const sources = identityAppearanceSources(relationshipParts, placeParts, false);
  const entityGroups = (Array.isArray(identityMapping?.entityGroups) ? identityMapping.entityGroups : []).map((group) => {
    if (!['field', 'composite'].includes(group?.strategy)) return { ...group };
    const keys = Array.isArray(group?.keys) ? group.keys : [];
    const mappings = { ...(group?.mappings || {}) };
    (group?.appearanceIds || []).forEach((id) => {
      const sourceColumn = sources.get(id);
      if (!sourceColumn) return;
      const current = Array.isArray(mappings[id]) ? [...mappings[id]] : [];
      keys.forEach((key, index) => {
        // An undefined slot means the UI was displaying an untouched suggestion.
        // An explicit blank component means the researcher deliberately cleared
        // the field; preserve that choice instead of silently re-suggesting it.
        if (current[index] !== undefined) return;
        const suggested = suggestedSingleIdentityColumn(headers, sourceColumn, key);
        if (suggested) current[index] = { key: asText(key), column: suggested };
      });
      if (current.some(Boolean)) mappings[id] = current;
    });
    return { ...group, mappings };
  });
  return { ...identityMapping, entityGroups };
}

export function materializePeridotWorkbookIdentityMappingSuggestions({
  identityMapping = {},
  relationshipParts = [],
  placeParts = [],
  workbookModel = {},
} = {}) {
  const sources = identityAppearanceSources(relationshipParts, placeParts, true);
  const customSources = new Map();
  (identityMapping?.entityGroups || []).forEach((group) => {
    (group?.customAppearances || []).forEach((appearance) => {
      if (appearance?.id && asText(appearance?.ref?.sheetName) && asText(appearance?.ref?.columnName)) customSources.set(appearance.id, appearance.ref);
    });
  });
  const entityGroups = (Array.isArray(identityMapping?.entityGroups) ? identityMapping.entityGroups : []).map((group) => {
    if (!['field', 'composite'].includes(group?.strategy)) return { ...group };
    const keys = Array.isArray(group?.keys) ? group.keys : [];
    const mappings = { ...(group?.mappings || {}) };
    (group?.appearanceIds || []).forEach((id) => {
      const sourceRef = sources.get(id) || customSources.get(id);
      if (!sourceRef) return;
      const current = Array.isArray(mappings[id]) ? [...mappings[id]] : [];
      keys.forEach((key, index) => {
        // See the single-table branch above: only materialize a suggestion that
        // was never explicitly represented in saved state. A researcher-cleared
        // blank remains blank and therefore unresolved rather than being guessed.
        if (current[index] !== undefined) return;
        const suggested = suggestedWorkbookIdentityRef(workbookModel, sourceRef, key);
        if (asText(suggested.sheetName) && asText(suggested.columnName)) current[index] = { key: asText(key), ref: suggested };
      });
      if (current.some(Boolean)) mappings[id] = current;
    });
    return { ...group, mappings };
  });
  return { ...identityMapping, entityGroups };
}

export function convertWorkbookIdentityMappingToRuntime(identityMapping = {}, workbookRefRuntimeKey = () => '') {
  const record = identityMapping?.record || {};
  const runtimeRecord = {
    ...record,
    columns: (Array.isArray(record?.refs) ? record.refs : [])
      .map(workbookRefRuntimeKey)
      .filter(Boolean),
  };
  delete runtimeRecord.refs;

  const entityGroups = (Array.isArray(identityMapping?.entityGroups) ? identityMapping.entityGroups : []).map((group) => ({
    ...group,
    mappings: Object.fromEntries(
      Object.entries(group?.mappings || {}).map(([id, components]) => [
        id,
        (Array.isArray(components) ? components : []).map((component) => ({
          key: asText(component?.key),
          column: workbookRefRuntimeKey(component?.ref),
        })),
      ])
    ),
  }));

  return {
    ...identityMapping,
    record: runtimeRecord,
    entityGroups,
  };
}

export function getWorkbookIdentityRefs(identityMapping = {}) {
  const refs = [];
  (identityMapping?.record?.refs || []).forEach((ref) => refs.push(ref));
  (identityMapping?.entityGroups || []).forEach((group) => {
    Object.values(group?.mappings || {}).forEach((components) => {
      (Array.isArray(components) ? components : []).forEach((component) => {
        if (component?.ref) refs.push(component.ref);
      });
    });
  });
  return refs;
}

export function getPeridotIdentityRuntimeSourceColumns(identityMapping = {}) {
  const columns = new Set();
  (identityMapping?.record?.columns || []).forEach((column) => {
    const value = asText(column);
    if (value) columns.add(value);
  });
  (identityMapping?.entityGroups || []).forEach((group) => {
    Object.values(group?.mappings || {}).forEach((components) => {
      (Array.isArray(components) ? components : []).forEach((component) => {
        const column = sourceColumnForComponent(component);
        if (column) columns.add(column);
      });
    });
  });
  return [...columns];
}
