/*
 * Canonical entity display-label helpers.
 *
 * Identity and display are intentionally distinct. Canonical entity IDs remain
 * authoritative for matching; this module provides the single presentation
 * boundary that resolves those IDs to researcher-visible labels when the
 * canonical normalized dataset contains one.
 */

function asText(value) {
  return String(value ?? '').trim();
}

export function buildPeridotCanonicalEntityDisplayLabelMap(canonicalDataset = null) {
  const labels = new Map();
  const entities = Array.isArray(canonicalDataset?.entities) ? canonicalDataset.entities : [];

  entities.forEach((entity) => {
    const id = asText(entity?.id);
    const label = asText(entity?.label);
    if (!id || !label) return;
    labels.set(id, label);
  });

  return labels;
}

export function resolvePeridotCanonicalEntityDisplayLabel(entityLabelById, entityId, fallbackLabel = '') {
  const id = asText(entityId);
  const fallback = asText(fallbackLabel);
  if (!id) return fallback;

  const canonicalLabel = entityLabelById?.get ? asText(entityLabelById.get(id)) : '';
  return canonicalLabel || fallback || id;
}
