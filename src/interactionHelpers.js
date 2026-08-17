/*
 * Map/network selection and Inspector payload helpers.
 * 
 * This module turns low-level hover/click information into semantically meaningful selections for the Inspector. It resolves nearby nodes/edges/clusters, builds cluster selections, enriches linked-letter metadata, and constructs person/place detail payloads.
 * 
 * Important relationships:
 * - `mapInteractionHandlers.js` calls this module when browser events occur on the map/network stage.
 * - `App.jsx` stores the resulting selection and passes it into compact/full Inspector surfaces.
 * - Inspector components assume these helpers provide stable selection shapes for nodes, edges, clusters, people, places, and linked records.
 * 
 * Maintenance cautions:
 * - Selection shape changes must be tested in compact Inspector, full Inspector, linked-letter detail, Back history, and cluster-member navigation.
 */

import { pointToQuadraticDistance } from './mapLayoutHelpers';
import { getRowPrimaryTemporalDisplay, getRowTemporalSortBounds, getRowTemporalSortKey } from './timelinePlaybackHelpers.js';

export function buildNearbyCandidates(point, screenNodes, screenEdges, clusterSingularLabel, clusterPluralLabel) {
  const nodeCandidates = screenNodes
    .map((node) => {
      const distance = Math.hypot(point.x - node.screenX, point.y - node.screenY);
      const threshold = Math.max(4, node.screenRadius * 0.45 + 1.5);
      if (distance > threshold) return null;
      return {
        id: `node:${node.id}`,
        kind: 'node',
        label: node.label,
        subtitle: node.isCluster
          ? `${node.clusterSize} ${node.clusterSize === 1 ? clusterSingularLabel : clusterPluralLabel}`
          : `Connections: ${node.degree}`,
        distance,
        payload: node,
      };
    })
    .filter(Boolean);

  const edgeCandidates = screenEdges
    .map((edge) => {
      if (!edge.curve) return null;
      const distance = pointToQuadraticDistance(point.x, point.y, edge.curve);
      const threshold = Math.max(3, edge.screenWidth * 0.35 + 1.5);
      if (distance > threshold) return null;
      return {
        id: `edge:${edge.id}`,
        kind: 'edge',
        label: `${edge.sourceLabel} ${edge.direction === 'directed' ? '→' : '—'} ${edge.targetLabel}`,
        subtitle: `Weight: ${edge.count}`,
        distance,
        payload: edge,
      };
    })
    .filter(Boolean);

  return [...nodeCandidates, ...edgeCandidates]
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.kind !== b.kind) return a.kind === 'node' ? -1 : 1;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 12);
}

function normalizeClusterMember(member, fallbackIndex = 0) {
  if (typeof member === 'string') {
    return {
      id: `cluster-member:${member}:${fallbackIndex}`,
      label: member,
      degree: 0,
      anchorLabel: '',
    };
  }

  return {
    id: member?.id || `cluster-member:${member?.label || 'unknown'}:${fallbackIndex}`,
    label: member?.label || '',
    degree: member?.degree || 0,
    anchorLabel: member?.anchorLabel || '',
  };
}

export function buildClusterSelection(clusterNode) {
  const rawMembers = Array.isArray(clusterNode.members) && clusterNode.members.length
    ? clusterNode.members
    : clusterNode.memberLabels || [];

  const memberDetails = rawMembers
    .map((member, index) => normalizeClusterMember(member, index))
    .filter((member) => member.label)
    .sort((a, b) => {
      if (b.degree !== a.degree) return b.degree - a.degree;
      return a.label.localeCompare(b.label);
    });

  const memberLabels = memberDetails.map((member) => member.label);

  return {
    ...clusterNode,
    __kind: 'cluster',
    memberCount: clusterNode.clusterSize || memberDetails.length,
    placeCount: clusterNode.clusterSize || memberDetails.length,
    memberDetails,
    memberLabels,
    memberLabelPreview: memberLabels.slice(0, 20),
  };
}

function buildLinkedLettersFromIncidentEdges(incidentEdges) {
  return Array.from(
    new Map(
      incidentEdges
        .flatMap((edge) => edge.letterMetadata || [])
        .map((letter) => [letter.id, letter]),
    ).values(),
  ).sort((a, b) => {
    const aDate = getRowTemporalSortKey(a) ?? Number.MAX_SAFE_INTEGER;
    const bDate = getRowTemporalSortKey(b) ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return getLetterSourcePerson(a).localeCompare(getLetterSourcePerson(b));
  });
}

function buildDateBounds(incidentEdges) {
  const linkedLetters = Array.from(
    new Map(
      incidentEdges
        .flatMap((edge) => edge.letterMetadata || [])
        .map((letter) => [letter.id, letter]),
    ).values(),
  );
  if (linkedLetters.length) return buildDateBoundsFromLetters(linkedLetters);

  const sourceRows = incidentEdges.flatMap((edge) => edge.rows || []).filter(Boolean);
  if (sourceRows.length) return buildDateBoundsFromLetters(sourceRows);

  const allDates = incidentEdges.flatMap((edge) => edge.dates || []).filter(Boolean).sort();
  return {
    earliestDate: allDates[0] || '',
    latestDate: allDates[allDates.length - 1] || '',
  };
}

function buildCounterpartDetailsFromEdges(label, incidentEdges) {
  const counterpartMap = new Map();
  incidentEdges.forEach((edge) => {
    const counterpartLabel = edge.sourceLabel === label ? edge.targetLabel : edge.sourceLabel;
    if (!counterpartLabel) return;
    const existing = counterpartMap.get(counterpartLabel) || {
      label: counterpartLabel,
      count: 0,
    };
    existing.count += edge.count || 0;
    counterpartMap.set(counterpartLabel, existing);
  });

  return Array.from(counterpartMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

function buildCounterpartLabelsFromEdges(label, incidentEdges) {
  return buildCounterpartDetailsFromEdges(label, incidentEdges).map((item) => item.label);
}

function buildTopPlacesFromLetters(linkedLetters) {
  return Array.from(
    new Map(
      linkedLetters
        .flatMap((letter) => [normalizePlaceLabel(letter.sourceLoc), normalizePlaceLabel(letter.targetLoc)])
        .map((placeLabel) => [placeLabel, 1]),
    ).entries(),
  )
    .map(([label]) => label)
    .slice(0, 12);
}

function buildPlaceDetailsForPerson(linkedLetters, personLabel, mode) {
  const placeMap = new Map();
  linkedLetters.forEach((letter) => {
    const matchesMode = mode === 'sent' ? getLetterSourcePerson(letter) === personLabel : getLetterTargetPerson(letter) === personLabel;
    if (!matchesMode) return;
    const placeLabel = normalizePlaceLabel(letter.targetLoc);
    const existing = placeMap.get(placeLabel) || {
      label: placeLabel,
      count: 0,
    };
    existing.count += 1;
    placeMap.set(placeLabel, existing);
  });

  return Array.from(placeMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

function buildTopPeopleFromLetters(linkedLetters) {
  return Array.from(
    new Set(
      linkedLetters
        .flatMap((letter) => [getLetterSourcePerson(letter), getLetterTargetPerson(letter)])
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function buildLinkedLettersFromGraphEdges(graph) {
  return Array.from(
    new Map(
      (graph.edges || [])
        .flatMap((edge) => edge.letterMetadata || [])
        .map((letter) => [letter.id, letter]),
    ).values(),
  ).sort((a, b) => {
    const aDate = getRowTemporalSortKey(a) ?? Number.MAX_SAFE_INTEGER;
    const bDate = getRowTemporalSortKey(b) ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return getLetterSourcePerson(a).localeCompare(getLetterSourcePerson(b));
  });
}

function buildDateBoundsFromLetters(linkedLetters = []) {
  let earliest = null;
  let latest = null;

  linkedLetters.forEach((letter) => {
    const bounds = getRowTemporalSortBounds(letter);
    const label = getRowPrimaryTemporalDisplay(letter);
    if (Number.isFinite(bounds.start) && (!earliest || bounds.start < earliest.key)) {
      earliest = { key: bounds.start, label };
    }
    const latestKey = Number.isFinite(bounds.end) ? bounds.end : bounds.start;
    if (Number.isFinite(latestKey) && (!latest || latestKey > latest.key)) {
      latest = { key: latestKey, label };
    }
  });

  return {
    earliestDate: earliest?.label || '',
    latestDate: latest?.label || '',
  };
}

function buildCounterpartPlaceDetailsFromLetters(placeLabel, linkedLetters = []) {
  const counterpartMap = new Map();

  linkedLetters.forEach((letter) => {
    const sourceLoc = normalizePlaceLabel(letter.sourceLoc);
    const targetLoc = normalizePlaceLabel(letter.targetLoc);
    const counterpartLabel = placeMatchesLabel(sourceLoc, placeLabel)
      ? targetLoc
      : placeMatchesLabel(targetLoc, placeLabel)
        ? sourceLoc
        : '';

    if (!counterpartLabel) return;

    const existing = counterpartMap.get(counterpartLabel) || {
      label: counterpartLabel,
      count: 0,
    };
    existing.count += 1;
    counterpartMap.set(counterpartLabel, existing);
  });

  return Array.from(counterpartMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

function getLetterSourcePerson(letter) {
  return letter?.sourcePerson || letter?.source || '';
}

function getLetterTargetPerson(letter) {
  return letter?.targetPerson || letter?.target || '';
}

function normalizePlaceLabel(value) {
  const normalized = String(value ?? '').trim();
  return normalized || 'Unknown';
}

function placeMatchesLabel(value, placeLabel) {
  return normalizePlaceLabel(value).toLowerCase() === String(placeLabel ?? '').trim().toLowerCase();
}

function letterMatchesPerson(letter, personLabel) {
  return getLetterSourcePerson(letter) === personLabel || getLetterTargetPerson(letter) === personLabel;
}

function buildPersonCounterpartDetailsFromLetters(personLabel, linkedLetters = []) {
  const counterpartMap = new Map();

  linkedLetters.forEach((letter) => {
    const sourcePerson = getLetterSourcePerson(letter);
    const targetPerson = getLetterTargetPerson(letter);
    const counterpartLabel = sourcePerson === personLabel ? targetPerson : targetPerson === personLabel ? sourcePerson : '';

    if (!counterpartLabel) return;

    const existing = counterpartMap.get(counterpartLabel) || {
      label: counterpartLabel,
      count: 0,
    };
    existing.count += 1;
    counterpartMap.set(counterpartLabel, existing);
  });

  return Array.from(counterpartMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

function buildPersonDetailSelectionFromLetters(name, linkedLetters = [], personMetadataByName) {
  const personLetters = linkedLetters.filter((letter) => letterMatchesPerson(letter, name));
  if (!personLetters.length) return null;

  const { earliestDate, latestDate } = buildDateBoundsFromLetters(personLetters);
  const counterpartDetails = buildPersonCounterpartDetailsFromLetters(name, personLetters);

  return {
    id: `person-detail:${name}`,
    label: name,
    degree: personLetters.length,
    radius: 6,
    __kind: 'person-detail',
    incidentEdgeCount: counterpartDetails.length,
    linkedLetterCount: personLetters.length,
    linkedLetters: personLetters,
    counterpartLabels: counterpartDetails.map((item) => `${item.label} (${item.count})`),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: '',
    personMetadata: personMetadataByName.get(name) || null,
    detailLabel: name,
    detailPlaces: buildTopPlacesFromLetters(personLetters),
    sentPlaceDetails: buildPlaceDetailsForPerson(personLetters, name, 'sent'),
    sentPlaceLabels: buildPlaceDetailsForPerson(personLetters, name, 'sent').map((item) => `${item.label} (${item.count})`),
    receivedPlaceDetails: buildPlaceDetailsForPerson(personLetters, name, 'received'),
    receivedPlaceLabels: buildPlaceDetailsForPerson(personLetters, name, 'received').map((item) => `${item.label} (${item.count})`),
  };
}


export function buildNodeSelection(node, graph, personMetadataByName) {
  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === node.label || edge.targetLabel === node.label,
  );
  const linkedLetters = buildLinkedLettersFromIncidentEdges(incidentEdges);
  const { earliestDate, latestDate } = buildDateBounds(incidentEdges);
  const matchedPersonMetadata = personMetadataByName.get(node.label) || null;
  const counterpartDetails = buildCounterpartDetailsFromEdges(node.label, incidentEdges);

  return {
    ...node,
    __kind: 'node',
    incidentEdgeCount: incidentEdges.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: counterpartDetails.map((item) => `${item.label} (${item.count})`),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: node.anchorLabel || '',
    personMetadata: matchedPersonMetadata,
    sentPlaceDetails: buildPlaceDetailsForPerson(linkedLetters, node.label, 'sent'),
    sentPlaceLabels: buildPlaceDetailsForPerson(linkedLetters, node.label, 'sent').map((item) => `${item.label} (${item.count})`),
    receivedPlaceDetails: buildPlaceDetailsForPerson(linkedLetters, node.label, 'received'),
    receivedPlaceLabels: buildPlaceDetailsForPerson(linkedLetters, node.label, 'received').map((item) => `${item.label} (${item.count})`),
  };
}

export function buildPersonDetailSelection(name, graph, personMetadataByName) {
  const directNode = graph.nodes.find((item) => item.label === name && !item.isCluster);
  if (directNode) {
    const nodeSelection = buildNodeSelection(directNode, graph, personMetadataByName);
    return {
      ...nodeSelection,
      __kind: 'person-detail',
      detailLabel: name,
      detailPlaces: buildTopPlacesFromLetters(nodeSelection.linkedLetters || []),
      sentPlaceDetails: buildPlaceDetailsForPerson(nodeSelection.linkedLetters || [], name, 'sent'),
      sentPlaceLabels: buildPlaceDetailsForPerson(nodeSelection.linkedLetters || [], name, 'sent').map((item) => `${item.label} (${item.count})`),
      receivedPlaceDetails: buildPlaceDetailsForPerson(nodeSelection.linkedLetters || [], name, 'received'),
      receivedPlaceLabels: buildPlaceDetailsForPerson(nodeSelection.linkedLetters || [], name, 'received').map((item) => `${item.label} (${item.count})`),
    };
  }

  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === name || edge.targetLabel === name,
  );
  if (!incidentEdges.length) {
    return buildPersonDetailSelectionFromLetters(
      name,
      buildLinkedLettersFromGraphEdges(graph),
      personMetadataByName,
    );
  }

  const linkedLetters = buildLinkedLettersFromIncidentEdges(incidentEdges);
  const { earliestDate, latestDate } = buildDateBounds(incidentEdges);
  const counterpartDetails = buildCounterpartDetailsFromEdges(name, incidentEdges);

  return {
    id: `person-detail:${name}`,
    label: name,
    degree: incidentEdges.reduce((sum, edge) => sum + (edge.count || 0), 0),
    radius: 6,
    __kind: 'person-detail',
    incidentEdgeCount: incidentEdges.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: counterpartDetails.map((item) => `${item.label} (${item.count})`),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: '',
    personMetadata: personMetadataByName.get(name) || null,
    detailLabel: name,
    detailPlaces: buildTopPlacesFromLetters(linkedLetters),
    sentPlaceDetails: buildPlaceDetailsForPerson(linkedLetters, name, 'sent'),
    sentPlaceLabels: buildPlaceDetailsForPerson(linkedLetters, name, 'sent').map((item) => `${item.label} (${item.count})`),
    receivedPlaceDetails: buildPlaceDetailsForPerson(linkedLetters, name, 'received'),
    receivedPlaceLabels: buildPlaceDetailsForPerson(linkedLetters, name, 'received').map((item) => `${item.label} (${item.count})`),
  };
}

export function buildPlaceDetailSelection(placeLabel, graph, personMetadataByName) {
  const directNode = graph.nodes.find((item) => item.label === placeLabel && !item.isCluster);
  if (directNode) {
    const nodeSelection = buildNodeSelection(directNode, graph, personMetadataByName);
    return {
      ...nodeSelection,
      __kind: 'place-detail',
      detailLabel: placeLabel,
      entityType: 'place',
      topPeople: buildTopPeopleFromLetters(nodeSelection.linkedLetters || []),
    };
  }

  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === placeLabel || edge.targetLabel === placeLabel,
  );

  let linkedLetters = buildLinkedLettersFromIncidentEdges(incidentEdges);

  if (!linkedLetters.length) {
    linkedLetters = buildLinkedLettersFromGraphEdges(graph).filter(
      (letter) => placeMatchesLabel(letter.sourceLoc, placeLabel) || placeMatchesLabel(letter.targetLoc, placeLabel),
    );
  }

  if (!linkedLetters.length) return null;

  const { earliestDate, latestDate } = incidentEdges.length
    ? buildDateBounds(incidentEdges)
    : buildDateBoundsFromLetters(linkedLetters);
  const counterpartDetails = incidentEdges.length
    ? buildCounterpartDetailsFromEdges(placeLabel, incidentEdges)
    : buildCounterpartPlaceDetailsFromLetters(placeLabel, linkedLetters);

  return {
    id: `place-detail:${placeLabel}`,
    label: placeLabel,
    degree: incidentEdges.length
      ? incidentEdges.reduce((sum, edge) => sum + (edge.count || 0), 0)
      : linkedLetters.length,
    radius: 6,
    __kind: 'place-detail',
    entityType: 'place',
    incidentEdgeCount: incidentEdges.length || counterpartDetails.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: counterpartDetails.map((item) => `${item.label} (${item.count})`),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: '',
    personMetadata: null,
    detailLabel: placeLabel,
    topPeople: buildTopPeopleFromLetters(linkedLetters),
  };
}

export function resolveSelection(selectedSelection, graph, personMetadataByName, options = {}) {
  if (!selectedSelection) return null;

  if (selectedSelection.kind === 'edge') {
    const edge = graph.edges.find((item) => item.id === selectedSelection.id);
    return edge ? { ...edge, __kind: 'edge' } : null;
  }

  if (selectedSelection.kind === 'cluster') {
    const clusterNode =
      selectedSelection.clusterNode ||
      graph.nodes.find((item) => item.id === selectedSelection.id && item.isCluster);
    return clusterNode ? buildClusterSelection(clusterNode) : null;
  }

  if (selectedSelection.kind === 'node') {
    const node = graph.nodes.find((item) => item.id === selectedSelection.id && !item.isCluster);
    return node ? buildNodeSelection(node, graph, personMetadataByName) : null;
  }

  if (selectedSelection.kind === 'person-detail') {
    const currentGraphSelection = buildPersonDetailSelection(selectedSelection.name, graph, personMetadataByName);
    if (currentGraphSelection) return currentGraphSelection;

    const fallbackGraph = options.personGraphFallback;
    if (fallbackGraph && fallbackGraph !== graph) {
      return buildPersonDetailSelection(selectedSelection.name, fallbackGraph, personMetadataByName);
    }

    return null;
  }

  if (selectedSelection.kind === 'place-detail') {
    return buildPlaceDetailSelection(selectedSelection.label, graph, personMetadataByName);
  }

  return null;
}

export function enrichSelectedLetters(selectedProps, personMetadataByName) {
  if (!selectedProps) return [];
  const baseLetters = selectedProps.__kind === 'edge'
    ? selectedProps.letterMetadata || []
    : selectedProps.__kind === 'node' || selectedProps.__kind === 'person-detail' || selectedProps.__kind === 'place-detail'
      ? selectedProps.linkedLetters || []
      : [];

  return baseLetters.map((letter) => ({
    ...letter,
    sourcePersonMetadata: personMetadataByName.get(getLetterSourcePerson(letter)) || null,
    targetPersonMetadata: personMetadataByName.get(getLetterTargetPerson(letter)) || null,
  }));
}
