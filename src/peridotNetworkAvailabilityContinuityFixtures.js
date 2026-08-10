/*
 * Focused runtime-continuity regression for generalized entity relationships.
 *
 * Verifies that the temporary legacy normalizer preserves generalizedObservation
 * on normalized geography rows so the generalized network derivation remains
 * authoritative after import.
 */

import { normalizePeridotTemplateRows } from './peridotCsvNormalizer.js';
import { derivePeridotEntityNetworkSemantics } from './peridotEntityNetwork.js';

export function runPeridotNetworkAvailabilityContinuityFixture() {
  const generalizedObservation = {
    participants: [
      { value: 'Cardinal A', role: 'Cardinal', sourceColumn: 'Cardinal' },
      { value: 'Pope X', role: 'Created by', sourceColumn: 'Created by' },
    ],
    places: [],
    temporal: { date: '1605' },
    relationship: {
      type: 'Created by',
      label: '',
      direction: 'undirected',
      sourceColumns: {},
    },
    evidenceFields: [],
    originalUploadedRow: {
      Cardinal: 'Cardinal A',
      'Created by': 'Pope X',
    },
  };

  const runtime = normalizePeridotTemplateRows([{
    Source_Name: 'Cardinal A',
    Target_Name: 'Pope X',
    Date: '1605',
    Relationship: 'Created by',
    generalizedObservation,
    originalUploadedRow: generalizedObservation.originalUploadedRow,
  }]);

  const normalizedRow = runtime.normalizedRows[0];
  if (!normalizedRow?.generalizedObservation) {
    throw new Error('Expected generalizedObservation to survive runtime normalization.');
  }

  const network = derivePeridotEntityNetworkSemantics(runtime.normalizedRows);
  if (network.relationships.length !== 1) {
    throw new Error(`Expected one generalized network relationship; received ${network.relationships.length}.`);
  }

  const edge = network.relationships[0];
  if (edge.source !== 'Cardinal A' || edge.target !== 'Pope X') {
    throw new Error(`Unexpected network endpoints: ${edge.source} -> ${edge.target}.`);
  }
  if (edge.relationshipType !== 'Created by') {
    throw new Error(`Expected relationship type "Created by"; received "${edge.relationshipType}".`);
  }
  if (edge.direction !== 'undirected') {
    throw new Error(`Expected unknown/generalized direction to remain undirected; received "${edge.direction}".`);
  }

  return Object.freeze({
    passed: true,
    normalizedRowCount: runtime.normalizedRows.length,
    networkEdgeCount: network.relationships.length,
    source: edge.source,
    target: edge.target,
    relationshipType: edge.relationshipType,
    direction: edge.direction,
  });
}
