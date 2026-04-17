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

export function buildNodeSelection(node, graph, personMetadataByName) {
  const incidentEdges = graph.edges.filter(
    (edge) => edge.sourceLabel === node.label || edge.targetLabel === node.label
  );

  const linkedLetters = Array.from(
    new Map(
      incidentEdges
        .flatMap((edge) => edge.letterMetadata || [])
        .map((letter) => [letter.id, letter])
    ).values()
  ).sort((a, b) => {
    const aDate = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    const bDate = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return (a.source || '').localeCompare(b.source || '');
  });

  const allDates = incidentEdges.flatMap((edge) => edge.dates || []).filter(Boolean).sort();
  const matchedPersonMetadata = personMetadataByName.get(node.label) || null;

  return {
    ...node,
    __kind: 'node',
    incidentEdgeCount: incidentEdges.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: Array.from(
      new Set(
        incidentEdges.map((edge) =>
          edge.sourceLabel === node.label ? edge.targetLabel : edge.sourceLabel
        )
      )
    ).slice(0, 12),
    earliestDate: allDates[0] || '',
    latestDate: allDates[allDates.length - 1] || '',
    anchorLabel: node.anchorLabel || '',
    personMetadata: matchedPersonMetadata,
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

  return null;
}

export function enrichSelectedLetters(selectedProps, personMetadataByName) {
  if (!selectedProps) return [];

  const baseLetters =
    selectedProps.__kind === 'edge'
      ? selectedProps.letterMetadata || []
      : selectedProps.__kind === 'node'
      ? selectedProps.linkedLetters || []
      : [];

  return baseLetters.map((letter) => ({
    ...letter,
    sourcePersonMetadata: personMetadataByName.get(letter.source) || null,
    targetPersonMetadata: personMetadataByName.get(letter.target) || null,
  }));
}
