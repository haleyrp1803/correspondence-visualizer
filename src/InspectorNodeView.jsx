/*
 * Node, person-profile, place-profile, and linked-record Inspector view.
 *
 * This component renders entity reference pages for Inspector selections. The
 * full workspace view uses a scholarly reference-entry structure: a compact
 * lead section, a divider, connected entities, connected records, and selected
 * fields. The compact view remains a summary surface for quick inspection.
 *
 * Important relationships:
 * - Selection/detail payloads come from `interactionHelpers.js`, `App.jsx`, and
 *   workbook/custom-field metadata.
 * - Navigation actions call back into App-owned Inspector history so compact and
 *   full modes remain synchronized.
 *
 * Maintenance cautions:
 * - Use universal language such as "records", "connected people", and
 *   "connected places" rather than correspondence-only wording.
 * - Test person profile, place profile, record detail, route row, compact
 *   summary tile, and Back behavior after edits.
 */

import React, { useState } from 'react';
import { getRowPrimaryTemporalDisplay, getRowTemporalSortBounds } from './timelinePlaybackHelpers.js';
import { getPeridotRowEntityParticipantEntries } from './peridotEntityNetwork.js';
import { buildPeridotEntityAttributedStructure, buildPeridotRecordStructure } from './peridotRecordStructure.js';
import { PeridotRecordStructure } from './PeridotRecordStructure.jsx';

function detailLabelClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--detail-label-text)]';
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-[var(--section-border)]/80 py-1.5 last:border-b-0">
      <div className={detailLabelClassName()}>{label}</div>
      <div className="mt-0.5 break-words text-sm text-[var(--text-main)]">{value || '—'}</div>
    </div>
  );
}

function normalizeEntityText(value) {
  return String(value ?? '').trim();
}

function normalizeComparable(value) {
  return normalizeEntityText(value).toLowerCase();
}

function normalizePlaceLabel(value) {
  return normalizeEntityText(value) || 'Unknown';
}

function getSelectedEntityLabel(selectedProps) {
  return normalizeEntityText(selectedProps?.detailLabel || selectedProps?.label);
}

function getSelectedEntityId(selectedProps) {
  return normalizeEntityText(
    selectedProps?.entityId
    || selectedProps?.personMetadata?.canonicalEntityId
    || selectedProps?.personMetadata?.id,
  );
}

function getSelectedEntityType(selectedProps, viewMode) {
  if (selectedProps?.__kind === 'person-detail') return 'person';
  if (selectedProps?.__kind === 'place-detail') return 'place';
  if (selectedProps?.entityType === 'place') return 'place';
  if (selectedProps?.entityType === 'person') return 'person';
  return viewMode === 'geographic' ? 'place' : 'person';
}

function letterMatchesSelectedEntity(letter, selectedProps, viewMode) {
  const label = getSelectedEntityLabel(selectedProps);
  if (!label) return false;

  const normalizedLabel = normalizeComparable(label);
  const entityType = getSelectedEntityType(selectedProps, viewMode);

  if (entityType === 'person') {
    const selectedEntityId = getSelectedEntityId(selectedProps);
    const participants = getPeridotRowEntityParticipantEntries(letter);
    const rowHasCanonicalIdentity = participants.some((participant) => normalizeEntityText(participant?.id));
    if (selectedEntityId && rowHasCanonicalIdentity) {
      return participants.some((participant) => normalizeEntityText(participant?.id) === selectedEntityId);
    }
    return participants.some((participant) => normalizeComparable(participant?.label) === normalizedLabel);
  }

  const mappedPlaces = buildPeridotRecordStructure(letter || {}).places || [];
  if (mappedPlaces.some((entry) => normalizeComparable(normalizePlaceLabel(entry?.value)) === normalizedLabel)) return true;
  return [letter?.sourceLoc, letter?.targetLoc].some((value) => normalizeComparable(normalizePlaceLabel(value)) === normalizedLabel);
}

function normalizeLetterCustomFields(letter) {
  const fields = Array.isArray(letter?.customInspectorFields) ? letter.customInspectorFields : [];

  return fields
    .map((field) => {
      const label = normalizeEntityText(field?.label || field?.sourceColumn || field?.key);
      const value = normalizeEntityText(field?.value);
      return { label, value };
    })
    .filter((field) => field.label && field.value);
}

function buildEntityCustomFieldSummaries(selectedProps, viewMode) {
  /*
   * Entity profiles must describe the selected entity, not its entire record
   * neighborhood.  `customInspectorFields` on linked records can describe a
   * spouse, parent, child, event, or the record as a whole, so aggregating those
   * values here causes unrelated attributes to leak into the selected profile.
   *
   * Person-centered canonical imports already project entity-owned attributes
   * through `selectedProps.personMetadata.customInspectorFields`.  Those are the
   * only custom fields safe to present as attributes of a selected person.
   * Record-level evidence remains available in linked-record detail through the
   * generalized `PeridotRecordStructure` reader.
   *
   * Place-specific arbitrary attributes do not yet have an equivalent canonical
   * projection.  Until that ownership exists, a place profile intentionally
   * shows no generic custom-field card rather than borrowing values from related
   * records or people.
   */
  const entityType = getSelectedEntityType(selectedProps, viewMode);
  if (entityType !== 'person') return [];

  const fields = normalizeLetterCustomFields(selectedProps?.personMetadata || {});
  return fields
    .map((field) => ({
      label: field.label,
      recordCount: 1,
      values: [{ value: field.value, count: 1 }],
      additionalValueCount: 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function countMapIncrement(map, key, amount = 1) {
  const normalized = normalizeEntityText(key);
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) || 0) + amount);
}

function sortCountMap(map) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function getDateSpan(records = []) {
  let earliest = null;
  let latest = null;

  records.forEach((record) => {
    const bounds = getRowTemporalSortBounds(record);
    const label = getRowPrimaryTemporalDisplay(record);
    if (Number.isFinite(bounds.start) && (!earliest || bounds.start < earliest.key)) {
      earliest = { key: bounds.start, label };
    }
    const latestKey = Number.isFinite(bounds.end) ? bounds.end : bounds.start;
    if (Number.isFinite(latestKey) && (!latest || latestKey > latest.key)) {
      latest = { key: latestKey, label };
    }
  });

  if (!earliest && !latest) return '';
  const firstLabel = earliest?.label || latest?.label || '';
  const lastLabel = latest?.label || earliest?.label || '';
  return firstLabel === lastLabel ? firstLabel : `${firstLabel}–${lastLabel}`;
}

function getUniqueTemporalDisplays(records = []) {
  return Array.from(
    new Set(
      records
        .map((record) => normalizeEntityText(getRowPrimaryTemporalDisplay(record)))
        .filter(Boolean),
    ),
  );
}

function makeRoleSections(sourceTitle, sourceItems, targetTitle, targetItems) {
  return [
    { title: sourceTitle, items: sortCountMap(sourceItems) },
    { title: targetTitle, items: sortCountMap(targetItems) },
  ];
}

function sectionItemCount(sections = []) {
  return sections.reduce((sum, section) => sum + (section.items?.length || 0), 0);
}

function buildEntityProfile(selectedProps, selectedLetterMetadata = [], viewMode) {
  const entityType = getSelectedEntityType(selectedProps, viewMode);
  const entityLabel = getSelectedEntityLabel(selectedProps);
  const entityId = getSelectedEntityId(selectedProps);
  const normalizedEntityLabel = normalizeComparable(entityLabel);
  const matchingLetters = selectedLetterMetadata.filter((letter) => letterMatchesSelectedEntity(letter, selectedProps, viewMode));
  const routesWhenSource = new Map();
  const routesWhenTarget = new Map();

  const peopleWhenSource = new Map();
  const peopleWhenTarget = new Map();
  const placesWhenSource = new Map();
  const placesWhenTarget = new Map();

  matchingLetters.forEach((letter) => {
    const sourcePerson = normalizeEntityText(letter.source || letter.sourcePerson);
    const targetPerson = normalizeEntityText(letter.target || letter.targetPerson);
    const sourcePlace = normalizePlaceLabel(letter.sourceLoc);
    const targetPlace = normalizePlaceLabel(letter.targetLoc);
    const sourceEntityId = normalizeEntityText(letter.sourceEntityId);
    const targetEntityId = normalizeEntityText(letter.targetEntityId);
    const rowHasCanonicalIdentity = Boolean(sourceEntityId || targetEntityId);
    const isSelectedSourcePerson = entityId && rowHasCanonicalIdentity
      ? sourceEntityId === entityId
      : normalizeComparable(sourcePerson) === normalizedEntityLabel;
    const isSelectedTargetPerson = entityId && rowHasCanonicalIdentity
      ? targetEntityId === entityId
      : normalizeComparable(targetPerson) === normalizedEntityLabel;
    const isSelectedSourcePlace = normalizeComparable(sourcePlace) === normalizedEntityLabel;
    const isSelectedTargetPlace = normalizeComparable(targetPlace) === normalizedEntityLabel;

    if (entityType === 'person') {
      if (isSelectedSourcePerson) {
        countMapIncrement(peopleWhenSource, targetPerson);
        countMapIncrement(placesWhenSource, sourcePlace);
      }

      if (isSelectedTargetPerson) {
        countMapIncrement(peopleWhenTarget, sourcePerson);
        countMapIncrement(placesWhenTarget, targetPlace);
      }
    } else {
      if (isSelectedSourcePlace) {
        countMapIncrement(peopleWhenSource, sourcePerson);
        if (targetPlace && normalizeComparable(targetPlace) !== normalizedEntityLabel) countMapIncrement(placesWhenSource, targetPlace);
      }

      if (isSelectedTargetPlace) {
        countMapIncrement(peopleWhenTarget, targetPerson);
        if (sourcePlace && normalizeComparable(sourcePlace) !== normalizedEntityLabel) countMapIncrement(placesWhenTarget, sourcePlace);
      }
    }

    if (sourcePlace || targetPlace) {
      const routeLabel = `${sourcePlace || 'Unknown'} → ${targetPlace || 'Unknown'}`;

      if (entityType === 'person') {
        if (isSelectedSourcePerson) countMapIncrement(routesWhenSource, routeLabel);
        if (isSelectedTargetPerson) countMapIncrement(routesWhenTarget, routeLabel);
      } else {
        if (isSelectedSourcePlace) countMapIncrement(routesWhenSource, routeLabel);
        if (isSelectedTargetPlace) countMapIncrement(routesWhenTarget, routeLabel);
      }
    }
  });

  const relatedPeopleSections = entityType === 'person'
    ? makeRoleSections('As source entity', peopleWhenSource, 'As target entity', peopleWhenTarget)
    : makeRoleSections('Records starting here', peopleWhenSource, 'Records ending here', peopleWhenTarget);
  const relatedPlacesSections = entityType === 'person'
    ? makeRoleSections('As source entity', placesWhenSource, 'As target entity', placesWhenTarget)
    : makeRoleSections('As source entity', placesWhenSource, 'As target entity', placesWhenTarget);
  const routeSections = entityType === 'person'
    ? makeRoleSections('Directed place pairs when source entity', routesWhenSource, 'Directed place pairs when target entity', routesWhenTarget)
    : makeRoleSections('Outgoing directed pairs', routesWhenSource, 'Incoming directed pairs', routesWhenTarget);

  return {
    entityType,
    entityLabel,
    matchingLetters,
    dateSpan: getDateSpan(matchingLetters),
    relatedPeopleSections,
    relatedPlacesSections,
    routeSections,
    relatedPeopleCount: sectionItemCount(relatedPeopleSections),
    relatedPlacesCount: sectionItemCount(relatedPlacesSections),
    routeCount: sectionItemCount(routeSections),
    dateCount: getUniqueTemporalDisplays(matchingLetters).length,
  };
}

function SectionShell({ title, children, emptyMessage }) {
  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--utility-panel-bg)] p-3 shadow-[0_8px_24px_var(--peridot-color-rgba-rgba-87-58-46-0-06)]">
      <div className="mb-2 font-semibold uppercase tracking-[0.16em] text-[var(--panel-card-muted-text)]">
        {title}
      </div>
      {children || <div className="text-sm text-[var(--panel-card-muted-text)]">{emptyMessage}</div>}
    </section>
  );
}

const DEFAULT_REFERENCE_LIST_LIMIT = 10;

function CountSectionCard({ title, sections, emptyMessage, onOpenItem }) {
  const [expandedSections, setExpandedSections] = useState({});
  const normalizedSections = (sections || []).filter((section) => section);
  const hasItems = normalizedSections.some((section) => section.items?.length);

  if (!normalizedSections.length) {
    return <SectionShell title={title} emptyMessage={emptyMessage} />;
  }

  const toggleSection = (sectionTitle) => {
    setExpandedSections((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }));
  };

  return (
    <SectionShell title={title}>
      {hasItems ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {normalizedSections.map((section) => {
            const items = section.items || [];
            const isExpanded = Boolean(expandedSections[section.title]);
            const visibleItems = isExpanded ? items : items.slice(0, DEFAULT_REFERENCE_LIST_LIMIT);
            const hiddenCount = Math.max(0, items.length - visibleItems.length);

            return (
              <div key={section.title} className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--detail-label-text)]">
                  <span>{section.title}</span>
                  {items.length ? <span className="text-[var(--panel-card-muted-text)]">{items.length}</span> : null}
                </div>
                {items.length ? (
                  <div className="space-y-1.5">
                    {visibleItems.map((item) => {
                      const content = (
                        <div
                          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                            onOpenItem
                              ? 'border-[var(--inspector-clickable-border)] bg-[var(--inspector-clickable-bg)] text-[var(--inspector-clickable-text)] group-hover:border-[var(--inspector-clickable-hover-border)] group-hover:bg-[var(--inspector-clickable-hover-bg)] group-hover:text-[var(--inspector-clickable-hover-text)]'
                              : 'border-[var(--section-border)] bg-[#e1d1aa] text-[#102515]'
                          }`}
                        >
                          <span className="truncate font-medium text-inherit">{item.label}</span>
                          <span className="shrink-0 rounded-full bg-[var(--button-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--button-text)] shadow-sm">
                            {item.count}
                          </span>
                        </div>
                      );

                      return onOpenItem ? (
                        <button
                          type="button"
                          key={`${section.title}:${item.label}`}
                          onClick={() => onOpenItem(item.label)}
                          className="group block w-full text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={`${section.title}:${item.label}`}>{content}</div>
                      );
                    })}
                    {items.length > DEFAULT_REFERENCE_LIST_LIMIT ? (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.title)}
                        className="w-full rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--button-text)] transition hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
                      >
                        {isExpanded ? 'Show fewer' : `Show ${hiddenCount} more`}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--section-border)] bg-[var(--utility-panel-bg)] px-3 py-2 text-xs text-[var(--panel-card-muted-text)]">
                    No records in this role.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-[var(--panel-card-muted-text)]">{emptyMessage}</div>
      )}
    </SectionShell>
  );
}

function EntityCustomFieldsCard({ selectedProps, viewMode }) {
  const fields = buildEntityCustomFieldSummaries(selectedProps, viewMode);
  if (!fields.length) return null;

  return (
    <SectionShell title="Entity fields">
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0 rounded-xl border border-[var(--section-border)]/75 bg-[var(--section-bg)]/75 px-3 py-2">
            <div className={detailLabelClassName()}>{field.label}</div>
            <div className="mt-1 space-y-1 text-sm text-[var(--text-main)]">
              {field.values.map((item) => (
                <div key={`${field.label}:${item.value}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words">{item.value}</span>
                  {item.count > 1 ? (
                    <span className="shrink-0 rounded-full bg-[var(--stat-card-bg)] px-2 py-0.5 text-[10px] text-[var(--panel-card-muted-text)]">
                      {item.count}
                    </span>
                  ) : null}
                </div>
              ))}
              {field.additionalValueCount > 0 ? (
                <div className="text-xs text-[var(--panel-card-muted-text)]">
                  + {field.additionalValueCount} more value{field.additionalValueCount === 1 ? '' : 's'}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function getProfileRecordCount(selectedProps, profile) {
  return selectedProps?.linkedLetterCount || profile.matchingLetters.length || 0;
}


function formatCoordinateValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '';
  return numericValue.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function getCoordinateSummary(selectedProps) {
  const latitude = selectedProps?.latitude ?? selectedProps?.lat ?? selectedProps?.Latitude ?? selectedProps?.LATITUDE;
  const longitude = selectedProps?.longitude ?? selectedProps?.lng ?? selectedProps?.lon ?? selectedProps?.Longitude ?? selectedProps?.LONGITUDE;
  const formattedLatitude = formatCoordinateValue(latitude);
  const formattedLongitude = formatCoordinateValue(longitude);
  if (!formattedLatitude || !formattedLongitude) return '';
  return `${formattedLatitude}, ${formattedLongitude}`;
}

function getMostAssociatedPlace(profile) {
  const placeCounts = new Map();
  (profile.relatedPlacesSections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      countMapIncrement(placeCounts, item.label, item.count || 1);
    });
  });
  return sortCountMap(placeCounts)[0] || null;
}

function buildLeadSentence(selectedProps, profile) {
  const label = profile.entityLabel || getSelectedEntityLabel(selectedProps) || 'This selection';
  const typeLabel = profile.entityType === 'place' ? 'place' : 'person/entity';
  const recordCount = getProfileRecordCount(selectedProps, profile);
  const degree = Number(selectedProps?.degree);
  const edgeCount = Number(selectedProps?.incidentEdgeCount);
  const visibleRecordDates = profile.dateSpan;
  const coordinates = getCoordinateSummary(selectedProps);
  const associatedPlace = profile.entityType === 'place' ? null : getMostAssociatedPlace(profile);

  const networkParts = [];
  if (Number.isFinite(degree) && degree > 0) networkParts.push(`a network weight of ${degree}`);
  if (Number.isFinite(edgeCount) && edgeCount > 0) networkParts.push(`${edgeCount} connection${edgeCount === 1 ? '' : 's'}`);

  return (
    <>
      <span className="font-semibold text-[var(--panel-card-text)]">{label}</span>
      {' '}is a {typeLabel} in the current Inspector scope
      {networkParts.length ? ` with ${networkParts.join(' and ')}` : ''}. It represents{' '}
      <span className="font-semibold text-[var(--panel-card-text)]">{recordCount}</span>
      {' '}related record{recordCount === 1 ? '' : 's'}
      {visibleRecordDates ? <>. Dates of visible records: <span className="font-semibold text-[var(--panel-card-text)]">{visibleRecordDates}</span></> : null}
      {coordinates ? <> and is mapped at <span className="font-semibold text-[var(--panel-card-text)]">{coordinates}</span></> : null}
      {associatedPlace ? <>. It is most often associated with <span className="font-semibold text-[var(--panel-card-text)]">{associatedPlace.label}</span> in related records</> : null}.
    </>
  );
}

function ReferenceLead({ selectedProps, profile }) {
  const imageUrl = selectedProps?.personMetadata?.imageCreativeCommons || '';
  const title = profile.entityLabel || getSelectedEntityLabel(selectedProps);
  const typeLabel = profile.entityType === 'place' ? 'Place' : 'Person / entity';
  const placeholderInitial = (title || '?').slice(0, 1).toUpperCase();

  return (
    <section className="rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--utility-panel-bg)] p-3 shadow-[0_8px_24px_var(--peridot-color-rgba-rgba-87-58-46-0-06)]">
      <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--section-border)]/80 bg-[var(--section-bg)]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${title} reference image`}
              className="h-44 w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-44 items-center justify-center bg-[var(--section-bg)] text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--section-border)] bg-[var(--panel-bg)] text-3xl font-semibold text-[var(--detail-label-text)]">
                  {placeholderInitial}
                </div>
                <div className="mt-3 px-4 text-xs uppercase tracking-[0.16em] text-[var(--panel-card-muted-text)]">
                  Image if available
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className={detailLabelClassName()}>{typeLabel}</div>
          <h2 className="mt-1 break-words [font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-2xl font-semibold leading-tight tracking-[-0.025em] text-[var(--panel-card-text)]">
            {title || 'Selected entity'}
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--text-main)]">
            {buildLeadSentence(selectedProps, profile)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--section-border)]/70 bg-[var(--section-bg)]/80 px-3 py-2">
              <div className={detailLabelClassName()}>Connected places</div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--text-main)]">{profile.relatedPlacesCount}</div>
            </div>
            <div className="rounded-lg border border-[var(--section-border)]/70 bg-[var(--section-bg)]/80 px-3 py-2">
              <div className={detailLabelClassName()}>Connected people</div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--text-main)]">{profile.relatedPeopleCount}</div>
            </div>
            <div className="rounded-lg border border-[var(--section-border)]/70 bg-[var(--section-bg)]/80 px-3 py-2">
              <div className={detailLabelClassName()}>Dates represented</div>
              <div className="mt-0.5 text-sm font-semibold text-[var(--text-main)]">{profile.dateCount || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReferenceDivider() {
  return (
    <div className="peridot-inspector-filigree-divider" aria-hidden="true">
      <span>Section divider</span>
    </div>
  );
}

function CompactSummaryTile({ count, label, onOpenFullInspector }) {
  return (
    <button
      type="button"
      onClick={onOpenFullInspector}
      className="rounded-lg border border-[var(--section-border)]/75 bg-[var(--section-bg)]/80 px-3 py-2 text-left text-xs text-[var(--text-main)] transition hover:border-[var(--inspector-clickable-hover-border)] hover:bg-[var(--inspector-clickable-hover-bg)] hover:text-[var(--inspector-clickable-hover-text)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/70"
    >
      <div className="font-semibold">{count || 0}</div>
      <div className="text-[var(--text-muted)]">{label}</div>
    </button>
  );
}

function CompactDossierPrompt({
  entityType,
  linkedLetterCount,
  relatedPeopleCount,
  relatedPlacesCount,
  routeCount,
  onOpenFullInspector,
}) {
  const entityLabel = entityType === 'place' ? 'place' : 'entity';

  return (
    <div className="rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] p-3 text-sm text-[var(--text-main)] shadow-sm">
      <div className="font-semibold uppercase tracking-[0.14em] text-[var(--detail-label-text)]">
        At a glance
      </div>
      <p className="mt-2 leading-relaxed text-[var(--text-muted)]">
        This {entityLabel} profile summarizes the current filtered records. Open the full dossier for connected people,
        places, and chronological records.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <CompactSummaryTile count={linkedLetterCount} label="related records" onOpenFullInspector={onOpenFullInspector} />
        <CompactSummaryTile count={relatedPeopleCount} label="connected people" onOpenFullInspector={onOpenFullInspector} />
        <CompactSummaryTile count={relatedPlacesCount} label="connected places" onOpenFullInspector={onOpenFullInspector} />
        <CompactSummaryTile count={routeCount} label="connections" onOpenFullInspector={onOpenFullInspector} />
      </div>
      <button
        type="button"
        onClick={onOpenFullInspector}
        className="mt-3 w-full rounded-full border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--button-primary-text)] shadow-sm transition hover:bg-[var(--button-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/70"
      >
        Open full dossier
      </button>
    </div>
  );
}

export function InspectorNodeView({
  InspectorSummaryCardComponent,
  PersonMetadataCardComponent,
  MissingPersonMetadataCardComponent,
  InspectorConnectedCorrespondentsComponent,
  InspectorPersonPlacesComponent,
  LinkedLettersPanelComponent,
  InspectorClearSelectionButtonComponent,

  selectedProps,
  clearSelection,
  viewMode,
  linkedLettersToShow,
  selectedLetterMetadata,
  showAllLinkedLetters,
  setShowAllLinkedLetters,
  isLetterSectionExpanded,
  toggleLetterSection,
  onOpenPersonDetail,
  onOpenPlaceDetail,
  onOpenLetterDetail,
  onOpenRouteDetail,
  onExpandInspector,
  isCompact = false,
}) {
  const entityType = getSelectedEntityType(selectedProps, viewMode);
  const profile = buildEntityProfile(selectedProps, selectedLetterMetadata, viewMode);
  const selectedLabel = getSelectedEntityLabel(selectedProps);
  const entityEvidence = getSelectedEntityType(selectedProps, viewMode) === 'person'
    ? normalizeLetterCustomFields(selectedProps?.personMetadata || {})
    : [];
  const entityMappedStructure = buildPeridotEntityAttributedStructure(profile.matchingLetters, {
    entityLabel: selectedLabel,
    entityId: getSelectedEntityId(selectedProps),
    entityType,
    entityEvidence,
  });

  if (isCompact) {
    return (
      <div className="space-y-3">
        <InspectorSummaryCardComponent>
          <DetailRow label={entityType === 'place' ? 'Place' : 'Person / entity'} value={selectedLabel} />
          <DetailRow label="Related records" value={getProfileRecordCount(selectedProps, profile)} />
          <DetailRow label="Dates of Visible Records" value={profile.dateSpan} />
          {selectedProps.anchorLabel ? <DetailRow label="Anchor location" value={selectedProps.anchorLabel} /> : null}
          <DetailRow label="Network weight" value={selectedProps.degree} />
        </InspectorSummaryCardComponent>

        <CompactDossierPrompt
          entityType={entityType}
          linkedLetterCount={getProfileRecordCount(selectedProps, profile)}
          relatedPeopleCount={profile.relatedPeopleCount}
          relatedPlacesCount={profile.relatedPlacesCount}
          routeCount={profile.routeCount}
          onOpenFullInspector={onExpandInspector}
        />

        <InspectorClearSelectionButtonComponent onClear={clearSelection} />
      </div>
    );
  }

  return (
    <article className="space-y-3">
      <ReferenceLead selectedProps={selectedProps} profile={profile} />
      <ReferenceDivider />

      <div className="grid gap-3 lg:grid-cols-2">
        <CountSectionCard
          title="Connected places"
          sections={profile.relatedPlacesSections}
          emptyMessage="No connected places were found in related records for this profile."
          onOpenItem={onOpenPlaceDetail}
        />

        <CountSectionCard
          title="Connected people"
          sections={profile.relatedPeopleSections}
          emptyMessage="No connected people were found in related records for this profile."
          onOpenItem={onOpenPersonDetail}
        />
      </div>

      <ReferenceDivider />

      <CountSectionCard
        title="Directed connections"
        sections={profile.routeSections}
        emptyMessage="No directed source-target pairs were found in related records for this profile."
        onOpenItem={onOpenRouteDetail}
      />

      <ReferenceDivider />

      <LinkedLettersPanelComponent
        linkedLettersToShow={linkedLettersToShow}
        selectedLetterMetadata={selectedLetterMetadata}
        showAllLinkedLetters={showAllLinkedLetters}
        setShowAllLinkedLetters={setShowAllLinkedLetters}
        isLetterSectionExpanded={isLetterSectionExpanded}
        toggleLetterSection={toggleLetterSection}
        onOpenLetterDetail={onOpenLetterDetail}
      />

      <PeridotRecordStructure
        structure={entityMappedStructure}
        title={entityType === 'place' ? 'Mapped information about this place' : 'Mapped information about this person / entity'}
        onOpenPersonDetail={onOpenPersonDetail}
        onOpenPlaceDetail={onOpenPlaceDetail}
      />

      <div className="flex justify-end">
        <InspectorClearSelectionButtonComponent onClear={clearSelection} />
      </div>
    </article>
  );
}
