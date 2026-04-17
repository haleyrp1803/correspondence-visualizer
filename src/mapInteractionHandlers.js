export function buildMapInteractionHandlers({
  clearSelection,
  setHoverCard,
  setHoveredEdgeId,
  setSelectedSelection,
  setShowAllLinkedLetters,
  setShowRightSidebar,
  buildHoverCardState,
  buildNodeHoverSummary,
  viewMode,
}) {
  const handleBlankMapClick = () => {
    setHoverCard(null);
    setHoveredEdgeId('');
    clearSelection();
  };

  const handleEdgeClick = (edge, point) => {
    setShowRightSidebar(true);
    setSelectedSelection({ kind: 'edge', id: edge.id });
    setShowAllLinkedLetters(false);
    setHoverCard(
      buildHoverCardState(
        `${edge.sourceLabel} → ${edge.targetLabel}`,
        `Weight: ${edge.count}`,
        point
      )
    );
  };

  const handleNodeHover = (node, point) => {
    setHoverCard(
      buildHoverCardState(node.label, buildNodeHoverSummary(node, viewMode), point)
    );
  };

  const handleNodeClick = (node, point) => {
    setShowRightSidebar(true);
    setHoverCard(
      buildHoverCardState(node.label, buildNodeHoverSummary(node, viewMode), point)
    );

    setSelectedSelection({
      kind: node.isCluster ? 'cluster' : 'node',
      id: node.id,
    });
    setShowAllLinkedLetters(false);
  };

  return {
    handleBlankMapClick,
    handleEdgeClick,
    handleNodeHover,
    handleNodeClick,
  };
}
