import {
  buildPeridotCanonicalEntityDisplayLabelMap,
  resolvePeridotCanonicalEntityDisplayLabel,
} from './peridotEntityDisplayLabels.js';
import { derivePeridotEntityNetworkSemantics } from './peridotEntityNetwork.js';

function assert(name, condition, details = '') {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
  return { name, passed: true };
}

export function runPeridotEntityDisplayLabelFixtures() {
  const xvpke = 'peridot-entity:people:field:XVPKE';
  const qj4ea = 'peridot-entity:people:field:QJ4EA';
  const dszj5 = 'peridot-entity:people:field:DSZJ5';
  const sigismund = 'peridot-entity:people:field:OMES6';

  const canonicalDataset = {
    entities: [
      { id: xvpke, label: 'Elizabeth von Habsburg' },
      { id: qj4ea, label: 'Eleonora Degli Albizzi' },
      { id: dszj5, label: 'DSZJ5' },
      { id: sigismund, label: 'Sigismund II Augustus Jagiellon' },
    ],
  };

  const labels = buildPeridotCanonicalEntityDisplayLabelMap(canonicalDataset);
  const semantics = derivePeridotEntityNetworkSemantics([
    {
      generalizedObservation: {
        participants: [
          { value: 'Sigismund II Augustus Jagiellon', entityId: sigismund, role: 'person' },
          { value: 'XVPKE', entityId: xvpke, role: 'former partner' },
          { value: 'DSZJ5', entityId: dszj5, role: 'former partner' },
        ],
        relationship: { direction: 'undirected', type: 'family' },
      },
    },
    {
      generalizedObservation: {
        participants: [
          { value: 'Person A', entityId: 'peridot-entity:people:field:A', role: 'person' },
          { value: 'QJ4EA', entityId: qj4ea, role: 'former partner' },
        ],
        relationship: { direction: 'undirected', type: 'family' },
      },
    },
  ], { entityLabelById: labels });

  const labelsFor = (entityId) => semantics.relationships
    .filter((edge) => edge.sourceId === entityId || edge.targetId === entityId)
    .map((edge) => edge.sourceId === entityId ? edge.source : edge.target);

  return [
    assert('canonical XVPKE label resolves to Elizabeth', resolvePeridotCanonicalEntityDisplayLabel(labels, xvpke, 'XVPKE') === 'Elizabeth von Habsburg'),
    assert('canonical QJ4EA label resolves to Eleonora', resolvePeridotCanonicalEntityDisplayLabel(labels, qj4ea, 'QJ4EA') === 'Eleonora Degli Albizzi'),
    assert('unresolved DSZJ5 remains its source identifier', resolvePeridotCanonicalEntityDisplayLabel(labels, dszj5, 'DSZJ5') === 'DSZJ5'),
    assert('network semantics consume canonical XVPKE display label', labelsFor(xvpke).every((label) => label === 'Elizabeth von Habsburg')),
    assert('network semantics consume canonical QJ4EA display label', labelsFor(qj4ea).every((label) => label === 'Eleonora Degli Albizzi')),
    assert('network semantics preserve unresolved DSZJ5 display fallback', labelsFor(dszj5).every((label) => label === 'DSZJ5')),
  ];
}
