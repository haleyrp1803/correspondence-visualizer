import { pointToQuadraticDistance } from './mapLayoutHelpers';

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
        label: `${edge.sourceLabel} → ${edge.targetLabel}`,
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

export function buildClusterSelection(clusterNode) {
  const sortedMembers = (clusterNode.memberLabels || []).slice().sort((a, b) => a.localeCompare(b));
  return {
    ...clusterNode,
    __kind: 'cluster',
    placeCount: clusterNode.clusterSize,
    memberLabels: sortedMembers,
    memberLabelPreview: sortedMembers.slice(0, 20),
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
    const aDate = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    const bDate = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return (a.source || '').localeCompare(b.source || '');
  });
}

function buildDateBounds(incidentEdges) {
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
        .flatMap((letter) => [letter.sourceLoc, letter.targetLoc])
        .filter(Boolean)
        .map((placeLabel) => [placeLabel, 1]),
    ).entries(),
  )
    .map(([label]) => label)
    .slice(0, 12);
}

function buildTopPeopleFromLetters(linkedLetters) {
  return Array.from(
    new Set(
      linkedLetters
        .flatMap((letter) => [letter.source, letter.target])
        .filter(Boolean),
    ),
  ).slice(0, 12);
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
    counterpartLabels: counterpartDetails.map((item) => item.label),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: node.anchorLabel || '',
    personMetadata: matchedPersonMetadata,
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
    };
  }

  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === name || edge.targetLabel === name,
  );
  if (!incidentEdges.length) return null;

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
    counterpartLabels: counterpartDetails.map((item) => item.label),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: '',
    personMetadata: personMetadataByName.get(name) || null,
    detailLabel: name,
    detailPlaces: buildTopPlacesFromLetters(linkedLetters),
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
      topPeople: buildTopPeopleFromLetters(nodeSelection.linkedLetters || []),
    };
  }

  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === placeLabel || edge.targetLabel === placeLabel,
  );
  if (!incidentEdges.length) return null;

  const linkedLetters = buildLinkedLettersFromIncidentEdges(incidentEdges);
  const { earliestDate, latestDate } = buildDateBounds(incidentEdges);
  const counterpartDetails = buildCounterpartDetailsFromEdges(placeLabel, incidentEdges);

  return {
    id: `place-detail:${placeLabel}`,
    label: placeLabel,
    degree: incidentEdges.reduce((sum, edge) => sum + (edge.count || 0), 0),
    radius: 6,
    __kind: 'place-detail',
    incidentEdgeCount: incidentEdges.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: counterpartDetails.map((item) => item.label),
    counterpartDetails,
    earliestDate,
    latestDate,
    anchorLabel: '',
    personMetadata: null,
    detailLabel: placeLabel,
    topPeople: buildTopPeopleFromLetters(linkedLetters),
  };
}

export function resolveSelection(selectedSelection, graph, personMetadataByName) {
  if (!selectedSelection) return null;

  if (selectedSelection.kind === 'edge') {
    const edge = graph.edges.find((item) => item.id === selectedSelection.id);
    return edge ? { ...edge, __kind: 'edge' } : null;
  }

  if (selectedSelection.kind === 'cluster') {
    const clusterNode = graph.nodes.find((item) => item.id === selectedSelection.id && item.isCluster);
    return clusterNode ? buildClusterSelection(clusterNode) : null;
  }

  if (selectedSelection.kind === 'node') {
    const node = graph.nodes.find((item) => item.id === selectedSelection.id && !item.isCluster);
    return node ? buildNodeSelection(node, graph, personMetadataByName) : null;
  }

  if (selectedSelection.kind === 'person-detail') {
    return buildPersonDetailSelection(selectedSelection.name, graph, personMetadataByName);
  }

  if (selectedSelection.kind === 'place-detail') {
    return buildPlaceDetailSelection(selectedSelection.label, graph, personMetadataByName);
  }

  return null;
}

export function enrichSelectedLetters(selectedProps, personMetadataByName) {
  if (!selectedProps) return [];

  const baseLetters =
    selectedProps.__kind === 'edge'
      ? selectedProps.letterMetadata || []
      : selectedProps.__kind === 'node' ||
          selectedProps.__kind === 'person-detail' ||
          selectedProps.__kind === 'place-detail'
        ? selectedProps.linkedLetters || []
        : [];

  return baseLetters.map((letter) => ({
    ...letter,
    sourcePersonMetadata: personMetadataByName.get(letter.source) || null,
    targetPersonMetadata: personMetadataByName.get(letter.target) || null,
  }));
}
