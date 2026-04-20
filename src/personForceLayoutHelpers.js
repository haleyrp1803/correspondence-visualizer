import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';

function buildStableRadialSeed(index, total, width, height) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const ring = 210 + (index % 5) * 24;
  return {
    x: width / 2 + Math.cos(angle) * ring,
    y: height / 2 + Math.sin(angle) * ring,
  };
}

export function buildForcePersonPositions({
  nodes,
  links,
  width,
  height,
  iterations = 300,
  collisionPadding = 10,
  chargeStrength = -220,
  baseLinkDistance = 120,
  distanceWeightFactor = 8,
}) {
  const simNodes = nodes.map((node, index, arr) => {
    const seed = buildStableRadialSeed(index, arr.length, width, height);
    return {
      id: node.id,
      radius: Number.isFinite(node.radius) ? node.radius : 6,
      x: seed.x,
      y: seed.y,
    };
  });

  const simLinks = links.map((link) => ({
    source: link.source,
    target: link.target,
    count: Number.isFinite(link.count) ? link.count : 1,
  }));

  const simulation = forceSimulation(simNodes)
    .stop()
    .alpha(1)
    .alphaDecay(1 - Math.pow(0.001, 1 / iterations))
    .force(
      'link',
      forceLink(simLinks)
        .id((d) => d.id)
        .distance((link) => Math.max(50, baseLinkDistance - (link.count - 1) * distanceWeightFactor))
        .strength((link) => Math.min(0.9, 0.18 + link.count * 0.08)),
    )
    .force('charge', forceManyBody().strength(chargeStrength))
    .force(
      'collide',
      forceCollide().radius((d) => d.radius + collisionPadding).iterations(2),
    )
    .force('center', forceCenter(width / 2, height / 2));

  for (let i = 0; i < iterations; i += 1) {
    simulation.tick();
  }

  return simNodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
  }));
}
