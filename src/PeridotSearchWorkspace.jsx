/*
 * Search & Filter workspace.
 *
 * This component renders the global active-dataset filtering surface. It separates
 * draft filter input from applied filter state so expensive graph/data
 * recomputation only happens when the user chooses Apply Filters.
 *
 * Important relationships:
 * - `App.jsx` owns draft/applied filter state and recomputation status.
 * - Visualizations, Timeline, Analytics, Inspector, and Export should consume the
 *   active filtered dataset defined here.
 *
 * Maintenance cautions:
 * - Do not make text inputs recompute data on every keystroke.
 * - Predictive suggestions should fill draft fields only; Apply Filters should
 *   commit global state.
 * - This file is allowed to organize Search UI, but it should not introduce new
 *   filtering semantics unless the App-level search pipeline is updated in the
 *   same bounded behavior pass.
 *
 * Scope contract:
 * - Text/entity inputs here update draft state only. They must not recompute
 *   graph data while the user is typing.
 * - Apply commits Search & Filter fields and resets playback so the next
 *   visual/export scope starts at the beginning of the newly filtered row set.
 * - Clear resets Search & Filter fields and timeline boundaries together,
 *   because the global visible dataset is the intersection of timeline window
 *   and committed Search & Filter criteria.
 *
 * Search green compact tabbed layout pass:
 * - Converts the dense three-column Advanced Search layout into a tabbed
 *   workflow: Build Search, Results, and Refine / Inspect.
 * - Harmonizes the palette with the rest of Peridot's layered light-green, sage, moss, and
 *   gold workspace system used in the Data mapping modal and Visualizations
 *   header, while retaining clear hover, active, and keyboard-focus feedback.
 * - This is a visual/UX-architecture pass. The green compact pass keeps the existing capability
 *   filters, facets, result cards, and Inspector handoff semantics intact.
 *
 * Results sizing/layout pass:
 * - Condenses only the Results tab and result-card presentation.
 * - Does not alter Apply/Clear handlers, tab state, App-level filtering, facet behavior,
 *   result derivation, or Inspector handoff semantics.
 *
 * Structured criteria pass:
 * - Adds a small fielded criteria builder inside Build Search.
 * - Keeps criteria draft-only until Apply Filters commits them through App.jsx.
 * - Uses plain Boolean connectors: the first rule starts the structured search, and later rules use AND, OR, or EXCLUDING.
 * - Limits the builder to five rows so OR/Exclude searches have room without
 *   recreating the dense UI this workspace was simplified to avoid.
 *
 * Structured criteria predictive suggestions pass:
 * - Reuses the existing predictive suggestion component for structured value inputs
 *   when a criterion field maps cleanly to person, place, route, date, capability,
 *   or evidence-field values.
 * - Suggestions still update draft criteria only; Apply Filters remains the only
 *   global recomputation trigger.
 *
 * Browse indexes pass:
 * - Adds a dataset-wide Browse tab for people, places, routes, and evidence fields.
 * - Browse entries populate draft criteria and return to Build Search; Apply Filters
 *   remains the only global recomputation trigger.
 *
 * Moss contrast pass:
 * - Uses the sampled moss green from the user's reference swatch as a mid-tone
 *   card background for browse/facet sections.
 * - Keeps light greens for the workspace shell, mid greens for section cards and
 *   feedback chips, and dark greens for action/emphasis controls.
 *
 * Boolean structured criteria terminology pass:
 * - Renames structured-criteria operators so the first rule starts the search and later rules read as AND, OR, and EXCLUDING.
 * - Keeps the logic deliberately non-nested: all AND rows must match, at least one
 *   OR row must match when any are present, and EXCLUDING rows remove
 *   matching records.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CAPABILITY_FILTER_OPTIONS,
  buildPeridotMetadataFacetGroups,
  buildPeridotSearchFacets,
  buildPeridotSearchResults,
  getCapabilityFilterLabel,
  getSearchableEvidenceFieldEntries,
} from './peridotSearchResultHelpers.js';
import { getPeridotRowEntityParticipants, getPeridotRowEntityRelationshipLabels, rowHasPeridotEntityRelationship } from './peridotEntityNetwork.js';

const SHELL_CLASS = 'peridot-search-folio-shell';
const CARD_CLASS = 'peridot-search-tab-card';
const PANEL_INSET_CLASS = 'peridot-search-panel peridot-search-panel-inset peridot-search-panel-cream';
const FIELD_LABEL_CLASS = 'peridot-search-field-label block text-[0.62rem] font-black uppercase tracking-[0.14em]';
const MUTED_TEXT_CLASS = 'peridot-search-helper-text text-sm leading-5';
const PRIMARY_BUTTON_CLASS =
  'peridot-search-button peridot-search-button-primary rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition duration-150 active:translate-y-[1px] focus-visible:outline-none';
const SECONDARY_BUTTON_CLASS =
  'peridot-search-button peridot-search-button-secondary rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition duration-150 active:translate-y-[1px] focus-visible:outline-none';
const DARK_BUTTON_CLASS =
  'peridot-search-button peridot-search-button-dark rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition duration-150 active:translate-y-[1px] focus-visible:outline-none';
const CHIP_BUTTON_CLASS =
  'peridot-search-chip-button rounded-full border px-2.5 py-1 text-[0.72rem] font-bold transition duration-150 active:translate-y-[1px] focus-visible:outline-none';
const INPUT_CLASS =
  'peridot-search-input mt-1.5 w-full rounded-xl border px-3 py-2 text-sm shadow-inner transition duration-150 focus:outline-none';


const STRUCTURED_FIELD_OPTIONS = Object.freeze([
  { id: 'any', label: 'Any record text', placeholder: 'Search across all visible record fields' },
  { id: 'person', label: 'Person / entity', placeholder: 'Person or entity name' },
  { id: 'place', label: 'Place', placeholder: 'Place name' },
  { id: 'routePlace', label: 'Route place', placeholder: 'Rome, Florence, or Rome → Florence' },
  { id: 'routePeople', label: 'Entity relationship', placeholder: 'Person A — Person B, Person A → Person B, or either entity' },
  { id: 'entityPair', label: 'Connected entity pair', placeholder: 'Two distinct connected entities' },
  { id: 'date', label: 'Date', placeholder: 'Year or date label' },
  { id: 'metadataValue', label: 'Metadata value', placeholder: 'Italian, Medici, ambassador, or another metadata value' },
  { id: 'metadataFieldPresent', label: 'Metadata field is present', placeholder: 'Language, Notes, Archival collection, or a custom field' },
  { id: 'capability', label: 'Capability', placeholder: 'Choose a capability' },
]);

const STRUCTURED_OPERATOR_OPTIONS = Object.freeze([
  { id: 'must', label: 'AND', shortLabel: 'AND', description: 'Keep records that match the previous criteria and this rule.' },
  { id: 'should', label: 'OR', shortLabel: 'OR', description: 'Keep records that match the previous criteria or this rule.' },
  { id: 'exclude', label: 'EXCLUDING', shortLabel: 'EXCLUDING', description: 'Remove records that match this rule.' },
]);

const STRUCTURED_GROUP_OPTIONS = Object.freeze([
  {
    id: 'must',
    title: 'Required conditions',
    description: 'Every condition in this group must match.',
    emptyLabel: 'No required conditions yet.',
    addLabel: '+ Add required condition',
  },
  {
    id: 'should',
    title: 'Any of these conditions',
    description: 'At least one condition in this group must match. Leave empty to make this group optional.',
    emptyLabel: 'No alternative conditions yet.',
    addLabel: '+ Add alternative',
  },
  {
    id: 'exclude',
    title: 'Excluded conditions',
    description: 'Records matching any condition in this group are removed.',
    emptyLabel: 'No excluded conditions yet.',
    addLabel: '+ Add exclusion',
  },
]);

const STRUCTURED_MATCH_MODE_OPTIONS = Object.freeze([
  { id: 'contains', label: 'contains', needsValue: true },
  { id: 'exact', label: 'exactly matches', needsValue: true },
  { id: 'startsWith', label: 'starts with', needsValue: true },
  { id: 'isEmpty', label: 'is empty', needsValue: false },
  { id: 'isNotEmpty', label: 'is not empty', needsValue: false },
]);

const MAX_STRUCTURED_CRITERIA = 5;

const BROWSE_PANEL_VISIBLE_LIMIT = 4;
const BROWSE_SOURCE_PERSON_FIELDS = ['sourcePerson', 'Source', 'Source_Person', 'Source_Entity', 'sender', 'Sender'];
const BROWSE_TARGET_PERSON_FIELDS = ['targetPerson', 'Target', 'Target_Person', 'Target_Entity', 'recipient', 'Recipient'];
const BROWSE_SOURCE_PLACE_FIELDS = ['sourcePlaceLabel', 'sourcePlace', 'sourceLoc', 'Source_Loc', 'Source_Place', 'sourceLocation'];
const BROWSE_TARGET_PLACE_FIELDS = ['targetPlaceLabel', 'targetPlace', 'targetLoc', 'Target_Inferred_Loc', 'Target_Loc', 'Target_Place', 'targetLocation'];
/*
 * Browse evidence fields are derived through the shared search-helper inventory
 * so Browse, Refine, and structured evidence-field criteria use the same
 * researcher-facing vocabulary.
 */

function browseText(value) {
  return String(value ?? '').trim();
}

function firstBrowseText(row, fields) {
  for (const field of fields) {
    const value = browseText(row?.[field]);
    if (value) return value;
  }
  return '';
}

function addBrowseCount(map, value, detail = {}) {
  const label = browseText(value);
  if (!label) return;
  const existing = map.get(label) || {
    value: label,
    label,
    count: 0,
    sourceCount: 0,
    targetCount: 0,
    examples: [],
  };
  existing.count += 1;
  if (detail.source) existing.sourceCount += 1;
  if (detail.target) existing.targetCount += 1;
  if (detail.example) {
    const example = browseText(detail.example);
    if (example && !existing.examples.includes(example) && existing.examples.length < 3) {
      existing.examples.push(example);
    }
  }
  map.set(label, existing);
}

/*
 * Browse must retain the complete loaded-data vocabulary. Compact panels and
 * panel-local search handle presentation density after this point; applying a
 * construction-time alphabetic cap makes later entries undiscoverable.
 */
function sortBrowseItems(map) {
  return Array.from(map.values())
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeBrowsePairValue(value) {
  return browseText(value).toLowerCase();
}

function hasMeaningfulBrowsePair(sourceValue, targetValue) {
  const source = normalizeBrowsePairValue(sourceValue);
  const target = normalizeBrowsePairValue(targetValue);
  return Boolean(source && target && source !== target);
}

function buildBrowseIndexGroups(rows = [], evidenceRows = rows) {
  const people = new Map();
  const places = new Map();
  const routes = new Map();
  const relationships = new Map();
  const evidenceFields = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sourcePlace = firstBrowseText(row, BROWSE_SOURCE_PLACE_FIELDS);
    const targetPlace = firstBrowseText(row, BROWSE_TARGET_PLACE_FIELDS);

    getPeridotRowEntityParticipants(row).forEach((participant) => {
      addBrowseCount(people, participant);
    });
    getPeridotRowEntityRelationshipLabels(row).forEach((relationshipLabel) => {
      addBrowseCount(relationships, relationshipLabel, { example: relationshipLabel });
    });
    addBrowseCount(places, sourcePlace, { source: true });
    addBrowseCount(places, targetPlace, { target: true });

    if (hasMeaningfulBrowsePair(sourcePlace, targetPlace)) {
      const routeLabel = `${sourcePlace} → ${targetPlace}`;
      addBrowseCount(routes, routeLabel, { example: routeLabel });
    }
  });

  /*
   * Linked-record rows preserve the evidence vocabulary that the geographic
   * map rows do not carry. Keep entity/place/route Browse anchored to the
   * geographic dataset, but build the Evidence fields index from this separate
   * researcher-facing record collection.
   */
  (Array.isArray(evidenceRows) ? evidenceRows : []).forEach((row) => {
    getSearchableEvidenceFieldEntries(row).forEach((entry) => {
      addBrowseCount(evidenceFields, entry.label);
    });
  });

  const routeItems = sortBrowseItems(routes);
  const relationshipItems = sortBrowseItems(relationships);
  const hasRoutes = routeItems.length > 0;
  const hasRelationships = relationshipItems.length > 0;
  const groups = [
    {
      id: 'browse-people',
      type: 'person',
      label: hasRelationships ? 'People / Entities' : 'Entities',
      description: hasRelationships
        ? 'All mapped participants in the current relationship records.'
        : 'Entity or record-label index for this dataset.',
      items: sortBrowseItems(people),
    },
    {
      id: 'browse-places',
      type: 'place',
      label: hasRoutes ? 'Places' : 'Locations',
      description: hasRoutes
        ? 'Source and target place index.'
        : 'Mapped location index for point or place records.',
      items: sortBrowseItems(places),
    },
    {
      id: 'browse-relationships',
      type: 'routePeople',
      label: 'Entity relationships',
      description: 'All mapped entity relationships, including additional relationship participants.',
      items: relationshipItems,
    },
    {
      id: 'browse-evidence',
      type: 'evidenceField',
      label: 'Evidence fields',
      description: 'Included metadata fields available for structured evidence filtering.',
      items: sortBrowseItems(evidenceFields),
    },
  ];

  if (hasRoutes) {
    groups.splice(2, 0, {
      id: 'browse-routes',
      type: 'routePlace',
      label: 'Routes',
      description: 'Source → target place route index.',
      items: routeItems,
    });
  }

  return groups.filter((group) => group.items.length > 0);
}
function filterBrowseGroups(groups, query) {
  const cleanQuery = browseText(query).toLowerCase();
  if (!cleanQuery) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        item.label.toLowerCase().includes(cleanQuery)
        || item.examples.some((example) => example.toLowerCase().includes(cleanQuery))
      )),
    }))
    .filter((group) => group.items.length > 0);
}

function createStructuredCriterion() {
  return {
    id: `criterion-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operator: 'must',
    field: 'any',
    mode: 'contains',
    value: '',
    firstMode: 'exact',
    firstValue: '',
    secondMode: 'contains',
    secondValue: '',
  };
}

function normalizeDraftStructuredCriteria(criteria = []) {
  return (Array.isArray(criteria) ? criteria : [])
    .map((criterion) => {
      const field = criterion.field === 'evidence'
        ? 'metadataValue'
        : criterion.field === 'evidenceFieldPresent'
          ? 'metadataFieldPresent'
          : criterion.field || 'any';
      return {
        id: criterion.id || `criterion-${Math.random().toString(16).slice(2)}`,
        operator: STRUCTURED_OPERATOR_OPTIONS.some((option) => option.id === criterion.operator) ? criterion.operator : 'must',
        field,
        metadataField: String(criterion.metadataField ?? '').trim(),
        mode: criterion.mode || 'contains',
        value: String(criterion.value ?? '').trim(),
        firstMode: criterion.firstMode || 'exact',
        firstValue: String(criterion.firstValue ?? '').trim(),
        secondMode: criterion.secondMode || 'contains',
        secondValue: String(criterion.secondValue ?? '').trim(),
      };
    })
    .filter((criterion) => {
      if (criterion.field === 'entityPair') {
        return criterion.firstValue && criterion.secondValue;
      }
      const mode = STRUCTURED_MATCH_MODE_OPTIONS.find((option) => option.id === criterion.mode);
      return mode?.needsValue === false || criterion.value;
    })
    .slice(0, MAX_STRUCTURED_CRITERIA);
}


function StructuredCriterionRow({
  criterion,
  onChange,
  onRemove,
  onKeyDown,
  suggestions = [],
  metadataFieldOptions = [],
  metadataValueSuggestions = [],
  personSuggestionsForPair = [],
}) {
  const selectedField = STRUCTURED_FIELD_OPTIONS.find((option) => option.id === criterion.field) || STRUCTURED_FIELD_OPTIONS[0];
  const selectedMode = STRUCTURED_MATCH_MODE_OPTIONS.find((option) => option.id === criterion.mode) || STRUCTURED_MATCH_MODE_OPTIONS[0];
  const needsValue = selectedMode.needsValue !== false;
  const capabilityValue = CAPABILITY_FILTER_OPTIONS.some((option) => option.id === criterion.value) ? criterion.value : '';
  const isMetadataValue = criterion.field === 'metadataValue';
  const isEntityPair = criterion.field === 'entityPair';
  const fieldSuggestions = isMetadataValue ? metadataValueSuggestions : suggestions;
  const entityMatchOptions = STRUCTURED_MATCH_MODE_OPTIONS.filter((option) => (
    option.id === 'contains' || option.id === 'exact' || option.id === 'startsWith'
  ));

  if (isEntityPair) {
    return (
      <div className="peridot-search-structured-row grid gap-2 rounded-xl border p-2.5 shadow-sm shadow-black/5 lg:grid-cols-[1.1fr_0.8fr_1.2fr_0.8fr_1.2fr_auto] lg:items-end">
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-field-${criterion.id}`}>Field</label>
          <select
            id={`structured-field-${criterion.id}`}
            value={criterion.field}
            onChange={(event) => onChange({ ...criterion, field: event.target.value })}
            className={INPUT_CLASS}
          >
            {STRUCTURED_FIELD_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-first-mode-${criterion.id}`}>First entity</label>
          <select
            id={`structured-first-mode-${criterion.id}`}
            value={criterion.firstMode || 'exact'}
            onChange={(event) => onChange({ ...criterion, firstMode: event.target.value })}
            className={INPUT_CLASS}
          >
            {entityMatchOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-first-value-${criterion.id}`}>First value</label>
          <AutocompleteTextInput
            id={`structured-first-value-${criterion.id}`}
            label="First value"
            value={criterion.firstValue || ''}
            onChange={(nextValue) => onChange({ ...criterion, firstValue: nextValue })}
            onKeyDown={onKeyDown}
            placeholder="Ferdinando II de' Medici"
            suggestions={personSuggestionsForPair || []}
            inputClassName={INPUT_CLASS}
            hideLabel
          />
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-second-mode-${criterion.id}`}>Other entity</label>
          <select
            id={`structured-second-mode-${criterion.id}`}
            value={criterion.secondMode || 'contains'}
            onChange={(event) => onChange({ ...criterion, secondMode: event.target.value })}
            className={INPUT_CLASS}
          >
            {entityMatchOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-second-value-${criterion.id}`}>Other value</label>
          <AutocompleteTextInput
            id={`structured-second-value-${criterion.id}`}
            label="Other value"
            value={criterion.secondValue || ''}
            onChange={(nextValue) => onChange({ ...criterion, secondValue: nextValue })}
            onKeyDown={onKeyDown}
            placeholder="de' Medici"
            suggestions={personSuggestionsForPair || []}
            inputClassName={INPUT_CLASS}
            hideLabel
          />
        </div>
        <button type="button" onClick={() => onRemove(criterion.id)} className={SECONDARY_BUTTON_CLASS + ' justify-self-start px-3 py-2 lg:justify-self-end'}>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className={`peridot-search-structured-row grid gap-2 rounded-xl border p-2.5 shadow-sm shadow-black/5 ${isMetadataValue ? 'lg:grid-cols-[1.08fr_1fr_0.9fr_1.3fr_auto]' : 'lg:grid-cols-[1.15fr_0.95fr_1.4fr_auto]'} lg:items-end`}>
      <div>
        <label className={FIELD_LABEL_CLASS} htmlFor={`structured-field-${criterion.id}`}>Field</label>
        <select
          id={`structured-field-${criterion.id}`}
          value={criterion.field}
          onChange={(event) => {
            const nextField = event.target.value;
            onChange({
              ...criterion,
              field: nextField,
              metadataField: nextField === 'metadataValue' ? criterion.metadataField : '',
              value: nextField === 'capability' ? '' : criterion.value,
            });
          }}
          className={INPUT_CLASS}
        >
          {STRUCTURED_FIELD_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      {isMetadataValue ? (
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor={`structured-metadata-field-${criterion.id}`}>Within metadata field</label>
          <select
            id={`structured-metadata-field-${criterion.id}`}
            value={criterion.metadataField || ''}
            onChange={(event) => onChange({ ...criterion, metadataField: event.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">Any metadata field</option>
            {metadataFieldOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className={FIELD_LABEL_CLASS} htmlFor={`structured-mode-${criterion.id}`}>Match</label>
        <select
          id={`structured-mode-${criterion.id}`}
          value={criterion.mode}
          onChange={(event) => onChange({ ...criterion, mode: event.target.value })}
          className={INPUT_CLASS}
        >
          {STRUCTURED_MATCH_MODE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={FIELD_LABEL_CLASS} htmlFor={`structured-value-${criterion.id}`}>Value</label>
        {criterion.field === 'capability' ? (
          <select
            id={`structured-value-${criterion.id}`}
            value={capabilityValue}
            disabled={!needsValue}
            onChange={(event) => onChange({ ...criterion, value: event.target.value })}
            onKeyDown={onKeyDown}
            className={INPUT_CLASS + (!needsValue ? ' opacity-60' : '')}
          >
            <option value="">Choose capability</option>
            {CAPABILITY_FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        ) : (
          <AutocompleteTextInput
            id={`structured-value-${criterion.id}`}
            label="Value"
            value={criterion.value}
            disabled={!needsValue}
            onChange={(nextValue) => onChange({ ...criterion, value: nextValue })}
            onKeyDown={onKeyDown}
            placeholder={needsValue ? selectedField.placeholder : 'No value needed'}
            suggestions={needsValue ? fieldSuggestions : []}
            inputClassName={INPUT_CLASS + (!needsValue ? ' opacity-60' : '')}
            hideLabel
          />
        )}
      </div>
      <button type="button" onClick={() => onRemove(criterion.id)} className={SECONDARY_BUTTON_CLASS + ' justify-self-start px-3 py-2 lg:justify-self-end'}>
        Remove
      </button>
    </div>
  );
}

function StructuredCriteriaGroup({
  group,
  criteria,
  onAdd,
  onChange,
  onRemove,
  onKeyDown,
  getSuggestions,
  metadataFieldOptions,
  getMetadataValueSuggestions,
  canAdd,
}) {
  return (
    <section className="peridot-search-structured-group rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="peridot-search-structured-group-title">{group.title}</h3>
          <p className="peridot-search-helper-text mt-1 text-xs leading-5">{group.description}</p>
        </div>
        <span className="peridot-search-count-badge rounded-full border px-2 py-0.5 text-[0.62rem] font-black">
          {criteria.length}
        </span>
      </div>

      {criteria.length ? (
        <div className="mt-3 space-y-2">
          {criteria.map((criterion) => (
            <StructuredCriterionRow
              key={criterion.id}
              criterion={criterion}
              onChange={onChange}
              onRemove={onRemove}
              onKeyDown={onKeyDown}
              suggestions={getSuggestions(criterion.field)}
              metadataFieldOptions={metadataFieldOptions}
              metadataValueSuggestions={getMetadataValueSuggestions(criterion.metadataField)}
              personSuggestionsForPair={getSuggestions('person')}
            />
          ))}
        </div>
      ) : (
        <p className="peridot-search-structured-group-empty mt-3">{group.emptyLabel}</p>
      )}

      <button
        type="button"
        onClick={() => onAdd(group.id)}
        disabled={!canAdd}
        className={SECONDARY_BUTTON_CLASS + ` mt-3 ${!canAdd ? ' opacity-55' : ''}`}
      >
        {group.addLabel}
      </button>
    </section>
  );
}

function MetadataFacetPanel({ groups, onChooseMetadataFacet }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGroups = expanded ? groups : groups.slice(0, 6);
  const hiddenCount = Math.max(0, groups.length - visibleGroups.length);

  if (!groups.length) return null;

  return (
    <section className="peridot-search-facet-panel peridot-search-metadata-facet-panel rounded-[1rem] border p-3 shadow-[0_10px_24px_var(--peridot-color-rgba-rgba-34-51-38-0-16)]">
      <div className="peridot-search-refine-facet-header">
        <div>
          <h3 className="peridot-search-panel-heading text-[0.62rem] font-black uppercase tracking-[0.15em]">Metadata</h3>
          <p className="peridot-search-panel-description mt-1 text-xs leading-5">
            Select a value to add it as a required metadata refinement.
          </p>
        </div>
        <span className="peridot-search-count-badge rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em]">
          {groups.length} fields
        </span>
      </div>

      <div className="peridot-search-metadata-facet-grid mt-3">
        {visibleGroups.map((group) => (
          <section key={group.id} className="peridot-search-metadata-field">
            <div className="peridot-search-metadata-field-header">
              <h4>{group.label}</h4>
              <span>{group.recordCount} records</span>
            </div>
            <div className="peridot-search-refine-chip-list mt-2 flex flex-wrap gap-1.5">
              {group.items.slice(0, 8).map((item) => (
                <button
                  key={`${group.id}-${item.value}`}
                  type="button"
                  onClick={() => onChooseMetadataFacet(group, item)}
                  className={`${CHIP_BUTTON_CLASS} peridot-search-facet-chip`}
                  title={`Add required metadata condition: ${group.label} exactly matches ${item.value}`}
                >
                  <span>{item.value}</span>
                  <span className="peridot-search-chip-count ml-1.5 rounded-full px-1.5 py-0.5 text-[0.6rem]">{item.count}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {hiddenCount ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={DARK_BUTTON_CLASS + ' peridot-search-refine-expand-button mt-3 px-3 py-1 text-[0.62rem]'}
        >
          {expanded ? 'Show fewer metadata fields' : `Show all metadata fields +${hiddenCount}`}
        </button>
      ) : null}
    </section>
  );
}


function AutocompleteTextInput({
  id,
  label,
  value,
  onChange,
  onKeyDown,
  placeholder,
  suggestions = [],
  helperText,
  disabled = false,
  inputClassName = INPUT_CLASS,
  hideLabel = false,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const matchingSuggestions = query.length >= 2
    ? suggestions
        .filter((suggestion) => String(suggestion ?? '').toLowerCase().includes(query))
        .slice(0, 20)
    : [];
  const showSuggestions = !disabled && isFocused && matchingSuggestions.length > 0;

  const chooseSuggestion = (suggestion) => {
    onChange(suggestion);
    setIsFocused(false);
  };

  return (
    <div className="peridot-search-autocomplete relative">
      {hideLabel ? null : <label htmlFor={id} className={FIELD_LABEL_CLASS}>{label}</label>}
      <input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {showSuggestions ? (
        <div className="peridot-search-autocomplete-menu absolute left-0 right-0 z-30 mt-2 max-h-56 overflow-y-auto rounded-2xl border p-1 shadow-2xl shadow-black/20">
          <div className="peridot-search-autocomplete-kicker px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.18em]">
            Suggestions
          </div>
          {matchingSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseSuggestion(suggestion)}
              className="peridot-search-autocomplete-option block w-full rounded-xl px-3 py-2 text-left text-sm leading-5 transition duration-150 active:translate-y-[1px] focus-visible:outline-none"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {helperText ? (
        <p className="peridot-search-helper-text mt-2 text-xs leading-5">{helperText}</p>
      ) : null}
    </div>
  );
}

function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="peridot-search-section-header">
      {eyebrow ? (
        <div className="peridot-search-section-eyebrow text-[0.6rem] font-black uppercase tracking-[0.18em]">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="peridot-search-section-title mt-0.5 text-2xl font-black tracking-tight">{title}</h2>
      {children ? <p className={'mt-1 ' + MUTED_TEXT_CLASS}>{children}</p> : null}
    </div>
  );
}

function ExploreDivider({ className = '' }) {
  return (
    <div className={`peridot-search-divider ${className}`.trim()} aria-hidden="true">
      <span />
    </div>
  );
}

function SearchTabButton({ id, stepNumber, label, summary, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      title={summary}
      className={`peridot-search-step-button peridot-search-step-button-${id} ${active ? 'peridot-search-step-button-active' : ''}`}
    >
      <span className="peridot-search-step-number">{stepNumber}</span>
      <span className="peridot-search-step-label">{label}</span>
    </button>
  );
}

function CapabilityFilterToggle({ option, checked, count, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(option.id)}
      title={option.description}
      className={`peridot-search-capability-toggle ${checked ? 'peridot-search-capability-toggle-active' : ''} rounded-xl border px-3 py-2 text-left transition duration-150 active:translate-y-[1px] focus-visible:outline-none`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-black uppercase leading-4 tracking-[0.12em]">{option.label}</span>
        {Number.isFinite(count) ? (
          <span className="peridot-search-count-badge rounded-full border px-2 py-0.5 text-[0.62rem] font-black">
            {count}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function getRefineFacetVisibleLimit(group) {
  const id = String(group?.id || '').toLowerCase();
  const type = String(group?.type || '').toLowerCase();
  const label = String(group?.label || '').toLowerCase();

  if (id.includes('capab') || type.includes('capab') || label.includes('capab')) return Number.MAX_SAFE_INTEGER;
  if ((id.includes('place') || type.includes('place') || label.includes('place')) && !id.includes('route') && !type.includes('route') && !label.includes('route')) return 12;
  if (id.includes('people') || id.includes('person') || type.includes('person') || label.includes('people') || label.includes('entit')) return 10;
  if (id.includes('year') || type.includes('year') || label.includes('year')) return 10;

  return 8;
}

function refineGroupIsRouteGroup(group) {
  const id = String(group?.id || '').toLowerCase();
  const type = String(group?.type || '').toLowerCase();
  const label = String(group?.label || '').toLowerCase();

  return id.includes('route') || type.includes('route') || label.includes('route');
}

function refineCapabilityItemIsRouteSpecific(item) {
  const value = String(item?.value || '').toLowerCase();
  const label = String(item?.label || '').toLowerCase();

  return value.includes('route') || label.includes('route');
}

/*
 * Refine's facet vocabulary should follow the applied result set's structure.
 * Route/correspondence datasets keep route facets. Point datasets use entity and
 * location language, and route-only facets are omitted so self-routes such as
 * "Airfield → Airfield" do not appear as meaningful routes.
 */
function normalizeSearchFacetGroupsForRefine(groups, { isRouteCapable = true } = {}) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  if (isRouteCapable) return safeGroups;

  return safeGroups
    .filter((group) => !refineGroupIsRouteGroup(group))
    .map((group) => {
      if (group.type === 'person') {
        return {
          ...group,
          label: 'Entities',
          description: group.description || 'Entities represented in the current result set.',
        };
      }

      if (group.type === 'place') {
        return {
          ...group,
          label: 'Locations',
          description: group.description || 'Mapped point locations in the current result set.',
        };
      }

      if (group.type === 'capability') {
        return {
          ...group,
          items: (group.items || []).filter((item) => !refineCapabilityItemIsRouteSpecific(item)),
        };
      }

      return group;
    })
    .filter((group) => (group.items || []).length > 0);
}

function FacetGroup({ group, activeCapabilityFilters, onChooseFacet }) {
  const [expanded, setExpanded] = useState(false);
  const visibleLimit = getRefineFacetVisibleLimit(group);
  const hiddenCount = Number.isFinite(visibleLimit) ? Math.max(0, group.items.length - visibleLimit) : 0;
  const visibleItems = expanded || !Number.isFinite(visibleLimit) ? group.items : group.items.slice(0, visibleLimit);
  const canExpand = hiddenCount > 0;

  return (
    <section className={`peridot-search-facet-panel peridot-search-refine-facet-panel ${expanded ? 'peridot-search-refine-facet-panel-expanded' : ''} rounded-[1rem] border p-3 shadow-[0_10px_24px_var(--peridot-color-rgba-rgba-34-51-38-0-16)]`}>
      <div className="peridot-search-refine-facet-header">
        <h3 className="peridot-search-panel-heading text-[0.62rem] font-black uppercase tracking-[0.15em]">
          {group.label}
        </h3>
        {canExpand ? (
          <span className="peridot-search-count-badge peridot-search-refine-hidden-count rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em]">
            +{hiddenCount} more
          </span>
        ) : null}
      </div>
      <div className="peridot-search-refine-chip-list mt-2 flex flex-wrap gap-1.5">
        {visibleItems.map((item) => {
          const isCapability = group.type === 'capability';
          const isActive = isCapability && activeCapabilityFilters.includes(item.value);
          return (
            <button
              key={`${group.id}-${item.value}`}
              type="button"
              onClick={() => onChooseFacet(group, item)}
              className={`${CHIP_BUTTON_CLASS} peridot-search-facet-chip ${isActive ? 'peridot-search-facet-chip-active' : ''}`}
              title={isCapability ? `Toggle ${item.label}` : `Set draft filter to ${item.value}`}
            >
              <span>{item.label || item.value}</span>
              <span className="peridot-search-chip-count ml-1.5 rounded-full px-1.5 py-0.5 text-[0.6rem]">
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={DARK_BUTTON_CLASS + ' peridot-search-refine-expand-button mt-2 px-3 py-1 text-[0.62rem]'}
        >
          {expanded ? 'Show less' : `Show all +${hiddenCount}`}
        </button>
      ) : null}
    </section>
  );
}


function BrowseIndexGroup({ group, onChooseBrowseItem }) {
  const [panelQuery, setPanelQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const cleanPanelQuery = panelQuery.trim().toLowerCase();
  const panelItems = cleanPanelQuery
    ? group.items.filter((item) => (
        item.label.toLowerCase().includes(cleanPanelQuery)
        || item.examples.some((example) => example.toLowerCase().includes(cleanPanelQuery))
      ))
    : group.items;
  const visibleItems = isExpanded ? panelItems : panelItems.slice(0, BROWSE_PANEL_VISIBLE_LIMIT);
  const hiddenCount = Math.max(panelItems.length - visibleItems.length, 0);
  const isRouteGroup = group.type === 'routePlace' || group.type === 'routePeople';
  const isEvidenceGroup = group.type === 'evidenceField';
  const usesCondensedColumns = isRouteGroup || isEvidenceGroup;

  return (
    <section className={`peridot-search-browse-panel peridot-search-browse-ledger-panel ${isExpanded ? 'peridot-search-browse-ledger-panel-expanded' : ''}`}>
      <div className="peridot-search-browse-ledger-panel-header">
        <div className="min-w-0">
          <h3 className="peridot-search-panel-heading peridot-search-browse-ledger-title">
            {group.label}
          </h3>
        </div>
        <span className="peridot-search-count-badge peridot-search-browse-ledger-count rounded-full border px-2 py-0.5 text-[0.62rem] font-black">
          {panelItems.length} shown
        </span>
      </div>

      <input
        id={`browse-panel-search-${group.id}`}
        value={panelQuery}
        onChange={(event) => {
          setPanelQuery(event.target.value);
          setIsExpanded(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && panelItems.length > BROWSE_PANEL_VISIBLE_LIMIT) {
            event.preventDefault();
            setIsExpanded(true);
          }
        }}
        className="peridot-search-input peridot-search-browse-ledger-search"
        placeholder={`Search within ${group.label.toLowerCase()}`}
        type="search"
      />

      <div className="peridot-search-browse-ledger" role="table" aria-label={`${group.label} browse index`}>
        <div className={`peridot-search-browse-ledger-row peridot-search-browse-ledger-head ${usesCondensedColumns ? 'peridot-search-browse-ledger-row-route' : ''}`} role="row">
          <div role="columnheader">{isRouteGroup ? 'Route' : isEvidenceGroup ? 'Field' : 'Name'}</div>
          <div role="columnheader">Records</div>
          {usesCondensedColumns ? null : <div role="columnheader">Source</div>}
          {usesCondensedColumns ? null : <div role="columnheader">Target</div>}
          <div role="columnheader">Search</div>
        </div>
        {visibleItems.map((item) => (
          <div key={`${group.id}-${item.value}`} className={`peridot-search-browse-ledger-row ${usesCondensedColumns ? 'peridot-search-browse-ledger-row-route' : ''}`} role="row">
            <div className="peridot-search-browse-ledger-name" role="cell" title={item.label}>{item.label}</div>
            <div className="peridot-search-browse-ledger-number" role="cell">{item.count}</div>
            {usesCondensedColumns ? null : <div className="peridot-search-browse-ledger-number" role="cell">{item.sourceCount || '—'}</div>}
            {usesCondensedColumns ? null : <div className="peridot-search-browse-ledger-number" role="cell">{item.targetCount || '—'}</div>}
            <div className="peridot-search-browse-ledger-action" role="cell">
              <button
                type="button"
                onClick={() => onChooseBrowseItem(group, item)}
                className={DARK_BUTTON_CLASS + ' peridot-search-browse-ledger-search-button'}
              >
                Search
              </button>
            </div>
          </div>
        ))}
        {!visibleItems.length ? (
          <div className="peridot-search-browse-ledger-empty" role="row">
            No entries match this panel search.
          </div>
        ) : null}
      </div>

      {panelItems.length > BROWSE_PANEL_VISIBLE_LIMIT ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className={DARK_BUTTON_CLASS + ' peridot-search-browse-ledger-expand'}
        >
          {isExpanded ? 'Show less' : `Show all +${hiddenCount}`}
        </button>
      ) : null}
    </section>
  );
}

const RESULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

function buildCondensedPaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, totalPages]);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) visiblePages.add(page);
  }

  const sortedPages = Array.from(visiblePages).sort((a, b) => a - b);
  const items = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (index > 0 && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}-${page}`);
    }
    items.push(page);
  });

  return items;
}

const UNKNOWN_RESULT_VALUES = new Set([
  '',
  'unknown',
  'unknown target',
  'unknown source',
  'unnamed',
  '—',
  '-',
  'null',
  'undefined',
]);

function cleanResultText(value) {
  return String(value ?? '').trim();
}

function isMeaningfulResultValue(value) {
  const text = cleanResultText(value);
  return Boolean(text) && !UNKNOWN_RESULT_VALUES.has(text.toLowerCase());
}

function firstResultText(sources, fields) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const field of fields) {
      const value = cleanResultText(source[field]);
      if (value) return value;
    }
  }
  return '';
}

function splitRouteLabel(value) {
  const text = cleanResultText(value);
  if (!text.includes('→')) return [text, ''];
  const [source = '', target = ''] = text.split('→');
  return [cleanResultText(source), cleanResultText(target)];
}

function getResultSources(result) {
  return [
    result,
    result?.row,
    result?.record,
    result?.data,
    result?.sourceRow,
    result?.originalRow,
    result?.raw,
  ];
}

function getResultDisplayParts(result) {
  const sources = getResultSources(result);
  const [routeSourceEntity, routeTargetEntity] = splitRouteLabel(result?.peopleRoute || result?.title);
  const [routeSourcePlace, routeTargetPlace] = splitRouteLabel(result?.placeRoute);

  const networkParticipants = Array.isArray(result?.networkParticipants) ? result.networkParticipants.filter(isMeaningfulResultValue) : [];
  const sourceEntity = networkParticipants[0] || firstResultText(sources, [
    'sourcePerson',
    'sourceEntity',
    'Source_Entity',
    'Source_Person',
    'Source',
    'sender',
    'Sender',
    'entity',
    'Entity',
    'label',
  ]) || routeSourceEntity;

  const targetEntity = networkParticipants.length > 1
    ? networkParticipants.slice(1).join(' · ')
    : firstResultText(sources, [
    'targetPerson',
    'targetEntity',
    'Target_Entity',
    'Target_Person',
    'Target',
    'recipient',
    'Recipient',
  ]) || routeTargetEntity;

  const sourceLocation = firstResultText(sources, [
    'sourcePlaceLabel',
    'sourcePlace',
    'sourceLocation',
    'sourceLoc',
    'Source_Place',
    'Source_Loc',
    'Location',
    'location',
    'place',
    'Place',
  ]) || routeSourcePlace;

  const targetLocation = firstResultText(sources, [
    'targetPlaceLabel',
    'targetPlace',
    'targetLocation',
    'targetLoc',
    'Target_Place',
    'Target_Loc',
    'Target_Inferred_Loc',
  ]) || routeTargetPlace;

  return {
    date: cleanResultText(result?.displayDate || result?.date || result?.Date) || '—',
    sourceEntity: cleanResultText(sourceEntity) || 'Unknown source',
    targetEntity: cleanResultText(targetEntity) || '',
    entity: cleanResultText(sourceEntity) || cleanResultText(targetEntity) || cleanResultText(result?.title) || 'Unknown entity',
    sourceLocation: cleanResultText(sourceLocation) || 'Unknown',
    targetLocation: cleanResultText(targetLocation) || '',
    location: cleanResultText(sourceLocation) || cleanResultText(targetLocation) || 'Unknown',
  };
}

function resultLooksRouteCapable(result) {
  const parts = getResultDisplayParts(result);
  const hasMeaningfulTargetEntity = isMeaningfulResultValue(parts.targetEntity);
  const hasMeaningfulSourceEntity = isMeaningfulResultValue(parts.sourceEntity);
  const hasDistinctMeaningfulLocations =
    isMeaningfulResultValue(parts.sourceLocation)
    && isMeaningfulResultValue(parts.targetLocation)
    && parts.sourceLocation.toLowerCase() !== parts.targetLocation.toLowerCase();

  return (hasMeaningfulSourceEntity && hasMeaningfulTargetEntity) || hasDistinctMeaningfulLocations;
}

function SearchResultCard({ result, onInspectSearchResult, isRouteCapable }) {
  const parts = getResultDisplayParts(result);

  if (!isRouteCapable) {
    return (
      <article className="peridot-search-result-card peridot-search-result-ledger-card peridot-search-results-ledger-row peridot-search-results-ledger-row-point">
        <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-date-cell">
          <span className="peridot-search-results-ledger-mobile-label">Date</span>
          <span className="peridot-search-result-date">{parts.date}</span>
        </div>

        <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-entity-cell">
          <span className="peridot-search-results-ledger-mobile-label">Entity</span>
          <span className="peridot-search-result-title" title={parts.entity}>{parts.entity}</span>
        </div>

        <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-location-cell">
          <span className="peridot-search-results-ledger-mobile-label">Location</span>
          <span className="peridot-search-result-meta-value" title={parts.location}>{parts.location}</span>
        </div>

        <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-action-cell">
          <button
            type="button"
            onClick={() => onInspectSearchResult?.(result)}
            className={DARK_BUTTON_CLASS + ' peridot-search-result-inspect-action'}
          >
            Inspect
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="peridot-search-result-card peridot-search-result-ledger-card peridot-search-results-ledger-row peridot-search-results-ledger-row-route">
      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-date-cell">
        <span className="peridot-search-results-ledger-mobile-label">Date</span>
        <span className="peridot-search-result-date">{parts.date}</span>
      </div>

      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-source-entity-cell">
        <span className="peridot-search-results-ledger-mobile-label">Focal / source entity</span>
        <span className="peridot-search-result-title" title={parts.sourceEntity}>{parts.sourceEntity}</span>
      </div>

      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-target-entity-cell">
        <span className="peridot-search-results-ledger-mobile-label">Related / target entities</span>
        <span className="peridot-search-result-meta-value" title={parts.targetEntity || 'Unknown target'}>
          {parts.targetEntity || 'Unknown target'}
        </span>
      </div>

      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-source-location-cell">
        <span className="peridot-search-results-ledger-mobile-label">Source location</span>
        <span className="peridot-search-result-meta-value" title={parts.sourceLocation}>{parts.sourceLocation}</span>
      </div>

      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-target-location-cell">
        <span className="peridot-search-results-ledger-mobile-label">Target location</span>
        <span className="peridot-search-result-meta-value" title={parts.targetLocation || 'Unknown'}>
          {parts.targetLocation || 'Unknown'}
        </span>
      </div>

      <div className="peridot-search-results-ledger-cell peridot-search-result-ledger-action-cell">
        <button
          type="button"
          onClick={() => onInspectSearchResult?.(result)}
          className={DARK_BUTTON_CLASS + ' peridot-search-result-inspect-action'}
        >
          Inspect
        </button>
      </div>
    </article>
  );
}


export function PeridotSearchWorkspace({
  search,
  setSearch,
  personFilter,
  setPersonFilter,
  placeFilter,
  setPlaceFilter,
  routePlaceFilter,
  setRoutePlaceFilter,
  routePeopleFilter,
  setRoutePeopleFilter,
  personSuggestions = [],
  placeSuggestions = [],
  routePlaceSuggestions = [],
  routePeopleSuggestions = [],
  capabilityFilters = [],
  setCapabilityFilters,
  structuredCriteria = [],
  setStructuredCriteria,
  currentMinCountLabel,
  currentRangeLabel,
  graph,
  rowDiagnostics,
  searchRows = [],
  browseRows = searchRows,
  evidenceBrowseRows = [],
  onInspectSearchResult,
  viewMode,
  minCount,
  setMinCount,
  timelineMonths,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  setTimelineMode,
  setIsPlaying,
  setPlaybackIndex,
  onOpenVisualizations,
}) {
  const getAppliedStartYear = () => String(timelineMonths[rangeStart] || '').slice(0, 4);
  const getAppliedEndYear = () => String(timelineMonths[rangeEnd] || '').slice(0, 4);
  const getDefaultStartYear = () => String(timelineMonths[0] || '').slice(0, 4);
  const getDefaultEndYear = () => String(timelineMonths[Math.max(timelineMonths.length - 1, 0)] || '').slice(0, 4);

  const [activeTab, setActiveTab] = useState('build');
  const [draftSearch, setDraftSearch] = useState(search ?? '');
  const [draftPersonFilter, setDraftPersonFilter] = useState(personFilter ?? '');
  const [draftPlaceFilter, setDraftPlaceFilter] = useState(placeFilter ?? '');
  const [draftRoutePlaceFilter, setDraftRoutePlaceFilter] = useState(routePlaceFilter ?? '');
  const [draftRoutePeopleFilter, setDraftRoutePeopleFilter] = useState(routePeopleFilter ?? '');
  const [draftCapabilityFilters, setDraftCapabilityFilters] = useState(Array.isArray(capabilityFilters) ? capabilityFilters : []);
  const [draftStructuredCriteria, setDraftStructuredCriteria] = useState(
    Array.isArray(structuredCriteria) ? structuredCriteria : [],
  );
  const [draftMinCount, setDraftMinCount] = useState(String(minCount ?? 1));
  const [draftStartYear, setDraftStartYear] = useState(getAppliedStartYear());
  const [draftEndYear, setDraftEndYear] = useState(getAppliedEndYear());
  const [filterStatusMessage, setFilterStatusMessage] = useState('');
  const [resultPageSize, setResultPageSize] = useState(10);
  const [resultPage, setResultPage] = useState(1);

  useEffect(() => {
    setDraftSearch(search ?? '');
    setDraftPersonFilter(personFilter ?? '');
    setDraftPlaceFilter(placeFilter ?? '');
    setDraftRoutePlaceFilter(routePlaceFilter ?? '');
    setDraftRoutePeopleFilter(routePeopleFilter ?? '');
    setDraftCapabilityFilters(Array.isArray(capabilityFilters) ? capabilityFilters : []);
    setDraftStructuredCriteria(Array.isArray(structuredCriteria) ? structuredCriteria : []);
    setDraftMinCount(String(minCount ?? 1));
    setDraftStartYear(getAppliedStartYear());
    setDraftEndYear(getAppliedEndYear());
  }, [
    search,
    personFilter,
    placeFilter,
    routePlaceFilter,
    routePeopleFilter,
    capabilityFilters,
    structuredCriteria,
    minCount,
    rangeStart,
    rangeEnd,
    timelineMonths.length,
    timelineMonths[rangeStart],
    timelineMonths[rangeEnd],
  ]);

  useEffect(() => {
    if (!filterStatusMessage) return undefined;
    const timeoutId = window.setTimeout(() => {
      setFilterStatusMessage('');
    }, 2200);
    return () => window.clearTimeout(timeoutId);
  }, [filterStatusMessage]);

  const timelineYearSuggestions = useMemo(() => (
    Array.from(new Set(timelineMonths.map((month) => String(month || '').slice(0, 4)).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
  ), [timelineMonths]);

  const appliedCapabilityFilters = Array.isArray(capabilityFilters) ? capabilityFilters : [];
  const allSearchResultCards = useMemo(() => buildPeridotSearchResults(
    searchRows,
    {
      search,
      personFilter,
      placeFilter,
      routePlaceFilter,
      routePeopleFilter,
      capabilityFilters: appliedCapabilityFilters,
      structuredCriteria,
    },
    { limit: Math.max(Array.isArray(searchRows) ? searchRows.length : 0, 1) },
  ), [searchRows, search, personFilter, placeFilter, routePlaceFilter, routePeopleFilter, appliedCapabilityFilters, structuredCriteria]);

  const searchResultsAreRouteCapable = useMemo(
    () => allSearchResultCards.some(resultLooksRouteCapable),
    [allSearchResultCards],
  );

  const resultPageCount = Math.max(1, Math.ceil(allSearchResultCards.length / resultPageSize));
  const safeResultPage = Math.min(resultPage, resultPageCount);
  const resultPageStartIndex = (safeResultPage - 1) * resultPageSize;
  const searchResultCards = allSearchResultCards.slice(resultPageStartIndex, resultPageStartIndex + resultPageSize);

  useEffect(() => {
    setResultPage(1);
  }, [
    search,
    personFilter,
    placeFilter,
    routePlaceFilter,
    routePeopleFilter,
    appliedCapabilityFilters,
    structuredCriteria,
    searchRows,
    resultPageSize,
  ]);

  useEffect(() => {
    setResultPage((currentPage) => Math.min(currentPage, resultPageCount));
  }, [resultPageCount]);

  /*
   * Retain every facet value from the supplied result scope. Facet panels still
   * begin compact and expand on demand; only the UI display is limited.
   */
  const rawSearchFacetGroups = useMemo(() => buildPeridotSearchFacets(searchRows), [searchRows]);
  const searchFacetGroups = useMemo(
    () => normalizeSearchFacetGroupsForRefine(rawSearchFacetGroups, { isRouteCapable: searchResultsAreRouteCapable }),
    [rawSearchFacetGroups, searchResultsAreRouteCapable],
  );
  const browseIndexGroups = useMemo(
    () => buildBrowseIndexGroups(browseRows, evidenceBrowseRows),
    [browseRows, evidenceBrowseRows],
  );
  const filteredBrowseIndexGroups = browseIndexGroups;

  const capabilityFacetCounts = useMemo(() => {
    const capabilityGroup = searchFacetGroups.find((group) => group.id === 'capabilities');
    return new Map((capabilityGroup?.items || []).map((item) => [item.value, item.count]));
  }, [searchFacetGroups]);

  const metadataFacetGroups = useMemo(
    () => buildPeridotMetadataFacetGroups(searchRows),
    [searchRows],
  );
  const metadataFieldOptions = useMemo(
    () => buildPeridotMetadataFacetGroups(searchRows).map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items,
    })),
    [searchRows],
  );
  const metadataFieldSuggestions = useMemo(
    () => metadataFieldOptions.map((option) => option.label),
    [metadataFieldOptions],
  );

  const getStructuredCriterionSuggestions = (fieldId) => {
    if (fieldId === 'person') return personSuggestions;
    if (fieldId === 'place') return placeSuggestions;
    if (fieldId === 'routePlace') return routePlaceSuggestions;
    if (fieldId === 'routePeople' || fieldId === 'entityPair') return personSuggestions;
    if (fieldId === 'date') return timelineYearSuggestions;
    if (fieldId === 'capability') return CAPABILITY_FILTER_OPTIONS.map((option) => option.label);
    if (fieldId === 'metadataFieldPresent' || fieldId === 'evidenceFieldPresent') return metadataFieldSuggestions;
    return [];
  };

  const getMetadataValueSuggestions = (metadataField = '') => {
    const cleanField = String(metadataField || '').toLowerCase();
    if (cleanField) {
      const matching = metadataFieldOptions.find((option) => String(option.key || '').toLowerCase() === cleanField);
      return (matching?.items || []).map((item) => item.value).filter(Boolean);
    }
    return metadataFacetGroups
      .flatMap((group) => group.items || [])
      .map((item) => item.value)
      .filter(Boolean)
      .slice(0, 200);
  };

  const activeCapabilityLabel = appliedCapabilityFilters.length
    ? appliedCapabilityFilters.map(getCapabilityFilterLabel).join(', ')
    : 'None';
  const draftCapabilityLabel = draftCapabilityFilters.length
    ? draftCapabilityFilters.map(getCapabilityFilterLabel).join(', ')
    : 'None selected';
  const appliedStructuredCriteria = normalizeDraftStructuredCriteria(structuredCriteria);
  const normalizedDraftStructuredCriteria = normalizeDraftStructuredCriteria(draftStructuredCriteria);
  const summarizeStructuredOperators = (criteria) => {
    const counts = { must: 0, should: 0, exclude: 0 };
    criteria.forEach((criterion) => {
      const operator = STRUCTURED_OPERATOR_OPTIONS.some((option) => option.id === criterion.operator) ? criterion.operator : 'must';
      counts[operator] += 1;
    });
    const parts = [];
    if (counts.must) parts.push(`${counts.must} required`);
    if (counts.should) parts.push(`${counts.should} any-of`);
    if (counts.exclude) parts.push(`${counts.exclude} excluded`);
    return parts.join(' · ');
  };
  const activeStructuredLabel = appliedStructuredCriteria.length ? summarizeStructuredOperators(appliedStructuredCriteria) : 'None';
  const draftStructuredLabel = normalizedDraftStructuredCriteria.length ? summarizeStructuredOperators(normalizedDraftStructuredCriteria) : 'None';
  const hiddenSearchResultCount = Math.max(0, allSearchResultCards.length - searchResultCards.length);
  const capabilityRows = useMemo(() => {
    const loadedRecordCount = Array.isArray(browseRows) ? browseRows.length : 0;
    const activeRecordCount = Array.isArray(searchRows) ? searchRows.length : 0;
    const visibleNodeCount = graph?.nodes?.length ?? 0;
    const hasTextValue = (value) => String(value ?? '').trim() !== '';
    const normalizePairValue = (value) => String(value ?? '').trim().toLowerCase();
    const firstTextValue = (row, fields) => fields
      .map((field) => row?.[field])
      .find(hasTextValue) || '';

    const hasCapabilityFlag = (row, flags) => {
      const capabilityBlock = row?.peridotCapabilities || row?.capabilities || row?.capabilityFlags || null;
      if (!capabilityBlock || typeof capabilityBlock !== 'object') return null;

      const presentFlags = flags.filter((flag) => Object.prototype.hasOwnProperty.call(capabilityBlock, flag));
      if (!presentFlags.length) return null;
      return presentFlags.some((flag) => Boolean(capabilityBlock[flag]));
    };

    const hasMeaningfulSourceTargetPair = (row, sourceFields, targetFields) => {
      const sourceValue = firstTextValue(row, sourceFields);
      const targetValue = firstTextValue(row, targetFields);
      if (!sourceValue || !targetValue) return false;

      // Point/site imports may use compatibility rows that put the same mapped
      // point into both source-like and target-like display fields so the legacy
      // map stage can render them. Those compatibility values should not make
      // the Capabilities tab report route or relationship availability.
      return normalizePairValue(sourceValue) !== normalizePairValue(targetValue);
    };

    const hasRouteOrRelationshipRecord = (row) => {
      const auditedCapability = hasCapabilityFlag(row, [
        'networkReady',
        'peopleNetworkReady',
        'placeNetworkReady',
        'routeMapReady',
      ]);
      if (auditedCapability === true) return true;

      if (rowHasPeridotEntityRelationship(row)) return true;

      const hasPlacePair = hasMeaningfulSourceTargetPair(
        row,
        ['Source_Location', 'Source_Loc', 'Source_Place', 'Source_Coordinates'],
        ['Target_Location', 'Target_Inferred_Loc', 'Target_Loc', 'Target_Place', 'Target_Coordinates'],
      );

      return hasPlacePair;
    };
    const routeRelationshipCount = (Array.isArray(searchRows) ? searchRows : []).filter(hasRouteOrRelationshipRecord).length;
    return [
      {
        label: 'Searchable records',
        value: `${loadedRecordCount || activeRecordCount || 0} loaded`,
        ready: (loadedRecordCount || activeRecordCount) > 0,
        note: 'Loaded records will be available to Advanced Search, Browse indexes, Inspector handoff, charts, and export where their mapped fields support those tools.',
      },
      {
        label: 'Current result scope',
        value: `${activeRecordCount} records`,
        ready: activeRecordCount > 0,
        note: 'The currently applied search scope used by Results, facets, Inspector handoff, Visualizations, charts, and Export.',
      },
      {
        label: 'Map visualizations',
        value: visibleNodeCount > 0 ? `${visibleNodeCount} visible map ${visibleNodeCount === 1 ? 'item' : 'items'}` : 'Not available',
        ready: visibleNodeCount > 0,
        statusLabel: visibleNodeCount > 0 ? 'Available' : 'Not available',
        note: visibleNodeCount > 0
          ? 'The current scope has mapped places, point records, or route endpoints available for map visualizations.'
          : 'No mapped places, point records, or route endpoints are available in the current scope.',
      },
      {
        label: 'Routes / relationships',
        value: routeRelationshipCount > 0 ? `${routeRelationshipCount} relationship/route ${routeRelationshipCount === 1 ? 'record' : 'records'}` : 'Not available',
        ready: routeRelationshipCount > 0,
        statusLabel: routeRelationshipCount > 0 ? 'Available' : 'Not available',
        note: routeRelationshipCount > 0
          ? 'The current scope has mapped routes or entity relationships available for route and network views.'
          : 'No mapped routes or entity relationships are available in the current scope.',
      },
      {
        label: 'Chart / export scope',
        value: activeRecordCount > 0 ? 'Available' : 'Not available',
        ready: activeRecordCount > 0,
        statusLabel: activeRecordCount > 0 ? 'Available' : 'Not available',
        note: activeRecordCount > 0
          ? 'The current applied result scope will be available for charting, visualization, and export through Peridot controls where the mapped fields support those tools.'
          : 'Apply or clear filters to restore an active result scope before charting, visualizing, or exporting.',
      },
    ];
  }, [browseRows, graph, searchRows]);
  const hasDraftChanges = (
    String(draftSearch ?? '') !== String(search ?? '')
    || String(draftPersonFilter ?? '') !== String(personFilter ?? '')
    || String(draftPlaceFilter ?? '') !== String(placeFilter ?? '')
    || String(draftRoutePlaceFilter ?? '') !== String(routePlaceFilter ?? '')
    || String(draftRoutePeopleFilter ?? '') !== String(routePeopleFilter ?? '')
    || String(draftMinCount ?? '') !== String(minCount ?? 1)
    || String(draftStartYear ?? '') !== getAppliedStartYear()
    || String(draftEndYear ?? '') !== getAppliedEndYear()
    || JSON.stringify(draftCapabilityFilters) !== JSON.stringify(appliedCapabilityFilters)
    || JSON.stringify(normalizedDraftStructuredCriteria) !== JSON.stringify(appliedStructuredCriteria)
  );

  const toggleDraftCapabilityFilter = (filterId) => {
    setDraftCapabilityFilters((current) => (
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : current.concat(filterId)
    ));
  };


  const updateDraftStructuredCriterion = (nextCriterion) => {
    setDraftStructuredCriteria((current) => (
      current.map((criterion) => (criterion.id === nextCriterion.id ? nextCriterion : criterion))
    ));
  };

  const addDraftStructuredCriterion = (operator = 'must') => {
    setDraftStructuredCriteria((current) => (
      current.length >= MAX_STRUCTURED_CRITERIA
        ? current
        : current.concat({ ...createStructuredCriterion(), operator })
    ));
  };

  const removeDraftStructuredCriterion = (criterionId) => {
    setDraftStructuredCriteria((current) => current.filter((criterion) => criterion.id !== criterionId));
  };

  const chooseFacet = (group, item) => {
    if (!group || !item) return;
    if (group.type === 'person') setDraftPersonFilter(item.value);
    if (group.type === 'place') setDraftPlaceFilter(item.value);
    if (group.type === 'routePlace') setDraftRoutePlaceFilter(item.value);
    if (group.type === 'routePeople') setDraftRoutePeopleFilter(item.value);
    if (group.type === 'year') {
      setDraftStartYear(item.value);
      setDraftEndYear(item.value);
    }
    if (group.type === 'capability') toggleDraftCapabilityFilter(item.value);
    if (group.type === 'metadataFieldPresent' || group.type === 'evidenceField') {
      addMetadataFieldPresenceCriterion(item.value);
    }
    setActiveTab('build');
  };

  const addMetadataFieldPresenceCriterion = (fieldLabel) => {
    const nextCriterion = {
      ...createStructuredCriterion(),
      operator: 'must',
      field: 'metadataFieldPresent',
      mode: 'exact',
      value: fieldLabel,
    };
    setDraftStructuredCriteria((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      if (safeCurrent.length >= MAX_STRUCTURED_CRITERIA) return safeCurrent;
      return safeCurrent.concat(nextCriterion);
    });
    setFilterStatusMessage('Metadata field added to required draft conditions. Apply Filters to update results.');
  };

  const chooseMetadataFacet = (group, item) => {
    if (!group || !item) return;
    const nextCriterion = {
      ...createStructuredCriterion(),
      operator: 'must',
      field: 'metadataValue',
      metadataField: group.key,
      mode: 'exact',
      value: item.value,
    };
    setDraftStructuredCriteria((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      if (safeCurrent.length >= MAX_STRUCTURED_CRITERIA) return safeCurrent;
      return safeCurrent.concat(nextCriterion);
    });
    setFilterStatusMessage('Metadata value added to required draft conditions. Apply Filters to update results.');
    setActiveTab('build');
  };



  const chooseBrowseIndexItem = (group, item) => {
    if (!group || !item) return;
    if (group.type === 'person') setDraftPersonFilter(item.value);
    if (group.type === 'place') setDraftPlaceFilter(item.value);
    if (group.type === 'routePlace') setDraftRoutePlaceFilter(item.value);
    if (group.type === 'routePeople') setDraftRoutePeopleFilter(item.value);
    if (group.type === 'evidenceField') {
      const nextCriterion = {
        ...createStructuredCriterion(),
        operator: 'must',
        field: 'metadataFieldPresent',
        mode: 'exact',
        value: item.value,
      };
      setDraftStructuredCriteria((current) => {
        const safeCurrent = Array.isArray(current) ? current : [];
        if (safeCurrent.length < MAX_STRUCTURED_CRITERIA) return safeCurrent.concat(nextCriterion);
        return safeCurrent.slice(0, MAX_STRUCTURED_CRITERIA - 1).concat(nextCriterion);
      });
    }
    setFilterStatusMessage('Browse item added to draft criteria. Apply Filters to update results.');
    setActiveTab('build');
  };

  const resolveTimelineBoundaryIndexFromYear = (boundary, year) => {
    if (!timelineMonths.length || !year) return -1;
    if (boundary === 'start') return timelineMonths.findIndex((month) => String(month).slice(0, 4) === String(year));
    for (let index = timelineMonths.length - 1; index >= 0; index -= 1) {
      if (String(timelineMonths[index]).slice(0, 4) === String(year)) return index;
    }
    return -1;
  };

  const clearFilters = () => {
    const defaultEndIndex = Math.max(timelineMonths.length - 1, 0);
    setFilterStatusMessage('Filters cleared. Updating view…');
    window.requestAnimationFrame(() => {
      setDraftSearch('');
      setDraftPersonFilter('');
      setDraftPlaceFilter('');
      setDraftRoutePlaceFilter('');
      setDraftRoutePeopleFilter('');
      setDraftCapabilityFilters([]);
      setDraftStructuredCriteria([]);
      setDraftMinCount('1');
      setDraftStartYear(getDefaultStartYear());
      setDraftEndYear(getDefaultEndYear());
      setSearch('');
      setPersonFilter('');
      setPlaceFilter('');
      setRoutePlaceFilter('');
      setRoutePeopleFilter('');
      setCapabilityFilters?.([]);
      setStructuredCriteria?.([]);
      setMinCount(1);
      setTimelineMode('all');
      setRangeStart(0);
      setRangeEnd(defaultEndIndex);
      setIsPlaying(false);
      setPlaybackIndex(-1);
    });
  };

  const applyDraftFilters = () => {
    const parsedMinCount = Number.parseInt(String(draftMinCount).trim(), 10);
    const nextMinCount = Number.isFinite(parsedMinCount) ? Math.max(1, parsedMinCount) : minCount;
    const nextSearch = String(draftSearch ?? '').trim();
    const nextPersonFilter = String(draftPersonFilter ?? '').trim();
    const nextPlaceFilter = String(draftPlaceFilter ?? '').trim();
    const nextRoutePlaceFilter = String(draftRoutePlaceFilter ?? '').trim();
    const nextRoutePeopleFilter = String(draftRoutePeopleFilter ?? '').trim();
    const nextCapabilityFilters = Array.isArray(draftCapabilityFilters) ? draftCapabilityFilters : [];
    const nextStructuredCriteria = normalizeDraftStructuredCriteria(draftStructuredCriteria);
    const nextStartIndex = resolveTimelineBoundaryIndexFromYear('start', draftStartYear);
    const nextEndIndex = resolveTimelineBoundaryIndexFromYear('end', draftEndYear);

    setFilterStatusMessage('Updating view…');
    window.requestAnimationFrame(() => {
      setSearch(nextSearch);
      setPersonFilter(nextPersonFilter);
      setPlaceFilter(nextPlaceFilter);
      setRoutePlaceFilter(nextRoutePlaceFilter);
      setRoutePeopleFilter(nextRoutePeopleFilter);
      setCapabilityFilters?.(nextCapabilityFilters);
      setStructuredCriteria?.(nextStructuredCriteria);
      setDraftStructuredCriteria(nextStructuredCriteria);
      setMinCount(nextMinCount);
      setDraftMinCount(String(nextMinCount));
      if (nextStartIndex >= 0 && nextEndIndex >= 0) {
        const safeStart = Math.min(nextStartIndex, nextEndIndex);
        const safeEnd = Math.max(nextStartIndex, nextEndIndex);
        setTimelineMode('range');
        setRangeStart(safeStart);
        setRangeEnd(safeEnd);
      } else {
        setTimelineMode('all');
        setRangeStart(0);
        setRangeEnd(Math.max(timelineMonths.length - 1, 0));
      }
      setIsPlaying(false);
      setPlaybackIndex(-1);
      setActiveTab('results');
    });
  };

  const handleDraftKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyDraftFilters();
    }
  };

  const renderBuildSearch = () => (
    <div className="peridot-search-build-view space-y-4">
      <SectionHeader eyebrow="Step 1" title="Build Search">
        Draft changes do not affect maps, charts, export, or Inspector until Apply Filters is pressed.
      </SectionHeader>
      <ExploreDivider />

      <div className={PANEL_INSET_CLASS + ' peridot-search-build-panel peridot-search-build-primary-panel p-4'}>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label htmlFor="advanced-search-keyword" className={FIELD_LABEL_CLASS}>Keyword search</label>
            <input
              id="advanced-search-keyword"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={viewMode === 'geographic' ? 'e.g. Siena, Maria Magdalena, 1613' : 'e.g. Caterina, Cosimo, Siena'}
              className={INPUT_CLASS}
            />
          </div>
          <div className="lg:col-span-2">
            <AutocompleteTextInput
              id="advanced-search-start-year"
              label="Start year"
              value={draftStartYear}
              onChange={setDraftStartYear}
              onKeyDown={handleDraftKeyDown}
              placeholder="Start"
              suggestions={timelineYearSuggestions}
            />
          </div>
          <div className="lg:col-span-2">
            <AutocompleteTextInput
              id="advanced-search-end-year"
              label="End year"
              value={draftEndYear}
              onChange={setDraftEndYear}
              onKeyDown={handleDraftKeyDown}
              placeholder="End"
              suggestions={timelineYearSuggestions}
            />
          </div>
          <div className="lg:col-span-4">
            <label htmlFor="advanced-search-minimum" className={FIELD_LABEL_CLASS}>
              Minimum {viewMode === 'geographic' ? 'route weight' : 'connection weight'}
            </label>
            <input
              id="advanced-search-minimum"
              type="number"
              min="1"
              value={draftMinCount}
              onChange={(event) => setDraftMinCount(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <p className="peridot-search-helper-text mt-2 text-xs leading-5">
          Press Enter in any field to apply. Available years: {timelineMonths.length ? `${timelineMonths[0]}–${timelineMonths[timelineMonths.length - 1]}` : 'none detected'}.
        </p>
      </div>

      <div className={PANEL_INSET_CLASS + ' peridot-search-build-panel peridot-search-build-entity-panel p-4'}>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="lg:w-[34%]">
            <AutocompleteTextInput
              id="advanced-search-person"
              label="Person / entity"
              value={draftPersonFilter}
              onChange={setDraftPersonFilter}
              onKeyDown={handleDraftKeyDown}
              placeholder="Person or entity"
              suggestions={personSuggestions}
            />
          </div>
          <div className="lg:w-[28%]">
            <AutocompleteTextInput
              id="advanced-search-place"
              label="Place"
              value={draftPlaceFilter}
              onChange={setDraftPlaceFilter}
              onKeyDown={handleDraftKeyDown}
              placeholder="Place"
              suggestions={placeSuggestions}
            />
          </div>
          <div className="lg:flex-1">
            <AutocompleteTextInput
              id="advanced-search-route-place"
              label="Route place"
              value={draftRoutePlaceFilter}
              onChange={setDraftRoutePlaceFilter}
              onKeyDown={handleDraftKeyDown}
              placeholder="Rome → Florence, or Florence"
              suggestions={routePlaceSuggestions}
            />
          </div>
          <div className="lg:flex-1">
            <AutocompleteTextInput
              id="advanced-search-route-people"
              label="Entity relationship"
              value={draftRoutePeopleFilter}
              onChange={setDraftRoutePeopleFilter}
              onKeyDown={handleDraftKeyDown}
              placeholder="Person A — Person B, Person A → Person B, or one name"
              suggestions={routePeopleSuggestions}
            />
          </div>
        </div>
      </div>

      <ExploreDivider className="peridot-search-build-divider-before-criteria" />

      <div className={PANEL_INSET_CLASS + ` peridot-search-build-panel peridot-search-structured-panel ${draftStructuredCriteria.length ? 'peridot-search-structured-panel-active' : 'peridot-search-structured-panel-empty'} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className={FIELD_LABEL_CLASS}>Structured query</div>
            <p className="peridot-search-helper-text mt-1 text-xs leading-5">
              Build a visible Required / Any-of / Excluded query. Conditions within each group have the meaning stated on that group.
            </p>
          </div>
          <div className="peridot-search-draft-pill rounded-full border px-3 py-1 text-xs font-bold">
            Draft: {draftStructuredLabel}
          </div>
        </div>

        <div className="peridot-search-structured-groups mt-3">
          {STRUCTURED_GROUP_OPTIONS.map((group) => {
            const groupCriteria = draftStructuredCriteria.filter((criterion) => criterion.operator === group.id);
            return (
              <StructuredCriteriaGroup
                key={group.id}
                group={group}
                criteria={groupCriteria}
                onAdd={addDraftStructuredCriterion}
                onChange={updateDraftStructuredCriterion}
                onRemove={removeDraftStructuredCriterion}
                onKeyDown={handleDraftKeyDown}
                getSuggestions={getStructuredCriterionSuggestions}
                metadataFieldOptions={metadataFieldOptions}
                getMetadataValueSuggestions={getMetadataValueSuggestions}
                canAdd={draftStructuredCriteria.length < MAX_STRUCTURED_CRITERIA}
              />
            );
          })}
        </div>

        <div className="peridot-search-structured-footer mt-3">
          <p className="peridot-search-helper-text text-xs leading-5">
            Applied: {activeStructuredLabel}.
          </p>
        </div>
      </div>

      <ExploreDivider className="peridot-search-build-divider-after-criteria" />

      <div className={PANEL_INSET_CLASS + ' peridot-search-build-panel peridot-search-capability-filter-panel p-4'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className={FIELD_LABEL_CLASS}>Capability filters</div>
            <p className="peridot-search-helper-text mt-1 text-xs leading-5">
              Toggle workflow readiness or missing-evidence filters.
            </p>
          </div>
          <div className="peridot-search-draft-pill rounded-full border px-3 py-1 text-xs font-bold">
            Draft: {draftCapabilityLabel}
          </div>
        </div>
        <div className="peridot-search-capability-filter-grid mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITY_FILTER_OPTIONS.map((option) => (
            <CapabilityFilterToggle
              key={option.id}
              option={option}
              checked={draftCapabilityFilters.includes(option.id)}
              count={capabilityFacetCounts.get(option.id)}
              onToggle={toggleDraftCapabilityFilter}
            />
          ))}
        </div>
      </div>


      <div className="peridot-search-status-strip peridot-search-build-action-strip flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border p-3 shadow-sm shadow-black/5">
        <p className="peridot-search-status-strip-text text-xs font-semibold leading-5">
          {hasDraftChanges ? 'Draft changes are pending.' : 'Applied state is current.'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON_CLASS}>
            Clear Filters
          </button>
          <button type="button" onClick={applyDraftFilters} className={PRIMARY_BUTTON_CLASS}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );


  const renderBrowse = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="Step 2" title="Browse Indexes">
          Browse uses the full loaded dataset, not just the current result set. Choose an item to seed draft search criteria, then apply filters.
        </SectionHeader>
        <div className="peridot-search-heading-pill rounded-full border px-3 py-1.5 text-xs font-black shadow-sm shadow-black/5">
          {(browseRows?.length || 0)} loaded records indexed
        </div>
      </div>

      {filteredBrowseIndexGroups.length ? (
        <div className="peridot-search-browse-grid grid gap-3">
          {filteredBrowseIndexGroups.map((group) => (
            <BrowseIndexGroup
              key={group.id}
              group={group}
              onChooseBrowseItem={chooseBrowseIndexItem}
            />
          ))}
        </div>
      ) : (
        <div className={PANEL_INSET_CLASS + ' p-4 text-sm leading-6'}>
          No browse-index entries match the current browse search.
        </div>
      )}
    </div>
  );

  const renderResults = () => {
    const firstShown = allSearchResultCards.length ? resultPageStartIndex + 1 : 0;
    const lastShown = Math.min(resultPageStartIndex + searchResultCards.length, allSearchResultCards.length);

    const goToResultPage = (page) => {
      setResultPage(Math.min(Math.max(page, 1), resultPageCount));
    };

    return (
      <div className="peridot-search-results-tab space-y-4">
        <div className="peridot-search-results-header flex flex-wrap items-start justify-between gap-3">
          <SectionHeader eyebrow="Step 3" title="Search Results">
            Compact ledger rows reflect the current applied dataset. Use Inspect to open a record in the full Inspector workspace.
          </SectionHeader>
          <div className="peridot-search-heading-pill flex flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm shadow-black/5">
            <span>{allSearchResultCards.length} records</span>
            <span className="peridot-search-heading-pill-separator">/</span>
            <span>{firstShown}–{lastShown} rows shown</span>
          </div>
        </div>
        <ExploreDivider />

        <div className="peridot-search-results-grid peridot-search-results-card-grid peridot-search-results-ledger">
          {searchResultCards.length ? (
            <>
              <div className="peridot-search-results-ledger-toolbar">
                <div className="peridot-search-results-ledger-showing">
                  Showing {firstShown}–{lastShown} of {allSearchResultCards.length} records.
                </div>
                <label className="peridot-search-results-page-size">
                  <span>View</span>
                  <select
                    value={resultPageSize}
                    onChange={(event) => {
                      setResultPageSize(Number(event.target.value));
                      setResultPage(1);
                    }}
                    aria-label="Rows per page"
                  >
                    {RESULT_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                className={
                  searchResultsAreRouteCapable
                    ? 'peridot-search-results-ledger-header peridot-search-results-ledger-header-route'
                    : 'peridot-search-results-ledger-header peridot-search-results-ledger-header-point'
                }
                aria-hidden="true"
              >
                {searchResultsAreRouteCapable ? (
                  <>
                    <span>Date</span>
                    <span>Focal / source entity</span>
                    <span>Related / target entities</span>
                    <span>Source location</span>
                    <span>Target location</span>
                    <span>Inspect</span>
                  </>
                ) : (
                  <>
                    <span>Date</span>
                    <span>Entity</span>
                    <span>Location</span>
                    <span>Inspect</span>
                  </>
                )}
              </div>
              <div className="peridot-search-results-ledger-body">
                {searchResultCards.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    isRouteCapable={searchResultsAreRouteCapable}
                    onInspectSearchResult={onInspectSearchResult}
                  />
                ))}
              </div>

              <div className="peridot-search-results-pagination" aria-label="Search results pages">
                <button type="button" onClick={() => goToResultPage(1)} disabled={safeResultPage === 1}>
                  First
                </button>
                <button type="button" onClick={() => goToResultPage(safeResultPage - 1)} disabled={safeResultPage === 1}>
                  Previous
                </button>
                {buildCondensedPaginationItems(safeResultPage, resultPageCount).map((item) => (
                  typeof item === 'number' ? (
                    <button
                      key={`page-${item}`}
                      type="button"
                      onClick={() => goToResultPage(item)}
                      className={item === safeResultPage ? 'peridot-search-results-pagination-current' : ''}
                      aria-current={item === safeResultPage ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="peridot-search-results-pagination-ellipsis" aria-hidden="true">
                      …
                    </span>
                  )
                ))}
                <button type="button" onClick={() => goToResultPage(safeResultPage + 1)} disabled={safeResultPage === resultPageCount}>
                  Next
                </button>
                <button type="button" onClick={() => goToResultPage(resultPageCount)} disabled={safeResultPage === resultPageCount}>
                  End
                </button>
              </div>
            </>
          ) : (
            <div className="peridot-search-empty-results peridot-search-results-empty-state rounded-[1.25rem] border p-6 text-center shadow-sm shadow-black/5">
              <div className="peridot-search-empty-results-title text-lg font-black">No records are currently in scope.</div>
              <p className="peridot-search-empty-results-text mx-auto mt-2 max-w-md text-sm leading-6">
                Clear filters or broaden the date window to restore results.
              </p>
              <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON_CLASS + ' mt-4'}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCapabilities = () => {
    const loadedCount = Array.isArray(browseRows) ? browseRows.length : 0;
    const appliedCount = Array.isArray(searchRows) ? searchRows.length : 0;
    const readyCapabilityCount = capabilityRows.filter((row) => row.ready).length;
    const unavailableRows = capabilityRows.filter((row) => !row.ready);

    return (
      <div className="space-y-4">
        <SectionHeader eyebrow="Step 5" title="Capabilities">
          Review what the loaded and applied records can support before moving into visualizations, charts, export, or Inspector evidence review.
        </SectionHeader>
        <ExploreDivider />

        <div className="peridot-search-capability-review-grid">
          <section className="peridot-search-capability-review-card">
            <div className={FIELD_LABEL_CLASS}>Scope status</div>
            <div className="peridot-search-capability-scope-list">
              <div>
                <span>Loaded records</span>
                <strong>{loadedCount}</strong>
              </div>
              <div>
                <span>Applied result scope</span>
                <strong>{appliedCount}</strong>
              </div>
              <div>
                <span>Timeline</span>
                <strong>{currentRangeLabel}</strong>
              </div>
              <div>
                <span>Minimum route weight</span>
                <strong>{currentMinCountLabel}</strong>
              </div>
              <div>
                <span>Draft state</span>
                <strong>{hasDraftChanges ? 'Pending changes' : 'Current'}</strong>
              </div>
            </div>
          </section>

          <section className="peridot-search-capability-review-card">
            <div className={FIELD_LABEL_CLASS}>Tool availability</div>
            <div className="peridot-search-capability-availability-list">
              {capabilityRows.map((row) => (
                <article key={row.label} className="peridot-search-capability-availability-row">
                  <div>
                    <h3>{row.label}</h3>
                    <p>{row.note}</p>
                  </div>
                  <div className="peridot-search-capability-availability-meta">
                    <strong>{row.value}</strong>
                    <span className={[
                      'peridot-search-capability-status',
                      row.ready ? 'peridot-search-capability-status-ready' : 'peridot-search-capability-status-missing',
                    ].join(' ')}>
                      {row.statusLabel || (row.ready ? 'Available' : 'Not available')}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
        <ExploreDivider />

        <div className="peridot-search-capability-review-note">
          <div>
            <span className={FIELD_LABEL_CLASS}>Review note</span>
            <p>
              {unavailableRows.length
                ? `${unavailableRows.length} capability ${unavailableRows.length === 1 ? 'area is' : 'areas are'} not available for the current scope.`
                : `${readyCapabilityCount} capability checks are available for the current scope.`}
              {' '}Data that cannot support one visualization can still remain available for search, Inspector review, charting, or export when its mapped fields support those tools.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderRefineInspect = () => (
    <div className="peridot-search-refine-view space-y-4">
      <SectionHeader eyebrow="Step 4" title="Refine / Inspect">
        Facets summarize the applied result set. Metadata values remain grouped under their field headings so a Language or custom-category refinement stays precise. Clicking a facet fills draft criteria; Apply commits the refinement.
      </SectionHeader>
      <ExploreDivider />

      <div className={PANEL_INSET_CLASS + ' p-3'}>
        <div className={FIELD_LABEL_CLASS}>Inspector handoff</div>
        <p className="peridot-search-helper-text mt-1 text-sm leading-5">
          Use <span className="peridot-search-inline-strong font-black">Inspect</span> on a result card to open the record in the full evidence workspace. Dataset capability information now lives in the <span className="peridot-search-inline-strong font-black">Capabilities</span> tab.
        </p>
      </div>
      <ExploreDivider />

      {searchFacetGroups.length || metadataFacetGroups.length ? (
        <div className="space-y-3">
          {searchFacetGroups.length ? (
            <div className="peridot-search-refine-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {searchFacetGroups.map((group) => (
                <FacetGroup
                  key={group.id}
                  group={group}
                  activeCapabilityFilters={draftCapabilityFilters}
                  onChooseFacet={chooseFacet}
                />
              ))}
            </div>
          ) : null}
          <MetadataFacetPanel
            groups={metadataFacetGroups}
            onChooseMetadataFacet={chooseMetadataFacet}
          />
        </div>
      ) : (
        <div className={PANEL_INSET_CLASS + ' p-4 text-sm leading-6'}>
          No facets are available for the current result set.
        </div>
      )}
    </div>
  );

  return (
    <section className="peridot-search-workspace peridot-search-workspace-animated min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1380px]">
        <div className={`${SHELL_CLASS} peridot-search-enter-shell`}>
          <header className="peridot-search-folio-header peridot-search-enter-header">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="peridot-search-workspace-kicker text-[0.62rem] font-black uppercase tracking-[0.24em]">Explore workspace</div>
                <h1 className="peridot-search-workspace-title mt-1.5 font-serif text-[clamp(2rem,3.2vw,3rem)] font-black leading-none tracking-[-0.045em]">
                  Advanced Search
                </h1>
                <p className="peridot-search-workspace-subtitle mt-2 max-w-3xl text-sm leading-6">
                  Build a draft query, browse indexes, review results, refine scope, check capabilities, and open records in Inspector.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <button type="button" onClick={onOpenVisualizations} className={SECONDARY_BUTTON_CLASS}>
                  Open visualizations
                </button>
                <button type="button" onClick={clearFilters} className={SECONDARY_BUTTON_CLASS}>
                  Clear Filters
                </button>
                <button type="button" onClick={applyDraftFilters} className={PRIMARY_BUTTON_CLASS}>
                  Apply Filters
                </button>
              </div>
            </div>

          </header>

          {filterStatusMessage ? (
            <div className="peridot-search-status-message">
              {filterStatusMessage}
            </div>
          ) : null}

          <nav className="peridot-search-step-rail peridot-search-enter-step-rail" aria-label="Advanced Search workflow tabs">
            <SearchTabButton
              id="build"
              stepNumber="1"
              label="Build"
              summary="Draft criteria and capability filters"
              active={activeTab === 'build'}
              onClick={setActiveTab}
            />
            <SearchTabButton
              id="browse"
              stepNumber="2"
              label="Browse"
              summary="Dataset-wide people, places, routes, and evidence"
              active={activeTab === 'browse'}
              onClick={setActiveTab}
            />
            <SearchTabButton
              id="results"
              stepNumber="3"
              label="Results"
              summary={`${searchRows?.length || 0} records currently applied`}
              active={activeTab === 'results'}
              onClick={setActiveTab}
            />
            <SearchTabButton
              id="refine"
              stepNumber="4"
              label="Refine"
              summary="Facet counts and Inspector guidance"
              active={activeTab === 'refine'}
              onClick={setActiveTab}
            />
            <SearchTabButton
              id="capabilities"
              stepNumber="5"
              label="Capabilities"
              summary="What this data can do"
              active={activeTab === 'capabilities'}
              onClick={setActiveTab}
            />
          </nav>

          <main className="peridot-search-folio-body peridot-search-enter-body">
            <div className={CARD_CLASS + ' peridot-search-active-card p-4'}>
              <div key={activeTab} className={`peridot-search-tab-motion peridot-search-tab-motion-${activeTab}`}>
                {activeTab === 'build' ? renderBuildSearch() : null}
                {activeTab === 'browse' ? renderBrowse() : null}
                {activeTab === 'results' ? renderResults() : null}
                {activeTab === 'refine' ? renderRefineInspect() : null}
                {activeTab === 'capabilities' ? renderCapabilities() : null}
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
