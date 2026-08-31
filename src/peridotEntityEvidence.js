/*
 * Canonical subject-aware Evidence projection for entity-facing consumers.
 *
 * Attribution Pass 2B creates atomic canonical assertions for mapped Evidence
 * fields. This helper is the single projection boundary that turns those
 * assertions into human-readable entity fields for Inspector consumption.
 * Record-level assertions are deliberately excluded because their subject is a
 * Record, not a canonical Entity.
 */

function asText(value) {
  return String(value ?? '').trim();
}

function isMappedEvidenceAssertion(assertion = {}) {
  return asText(assertion?.predicate).startsWith('mapped-evidence:');
}

function mappedEvidenceLabel(assertion = {}) {
  return asText(assertion?.attributes?.mappedLabel)
    || asText(assertion?.attributes?.sourceColumn)
    || asText(assertion?.predicate).replace(/^mapped-evidence:/, '').replace(/-/g, ' ')
    || 'Evidence';
}

function mappedEvidenceValue(assertion = {}) {
  if (assertion?.value === null || assertion?.value === undefined) return '';
  return asText(assertion.value);
}

/**
 * Build canonical entity-owned Evidence fields keyed by canonical Entity id.
 *
 * Only subjects present in canonicalDataset.entities are eligible. This strict
 * ownership boundary prevents record-level Evidence from leaking onto every
 * entity connected to a Record.
 */
export function buildPeridotCanonicalEntityEvidenceMap(canonicalDataset = null) {
  const entityIds = new Set(
    (canonicalDataset?.entities || [])
      .map((entity) => asText(entity?.id))
      .filter(Boolean),
  );
  const evidenceByEntityId = new Map();

  (canonicalDataset?.assertions || []).forEach((assertion) => {
    if (!isMappedEvidenceAssertion(assertion)) return;
    const subjectId = asText(assertion?.subjectId);
    if (!subjectId || !entityIds.has(subjectId)) return;

    const label = mappedEvidenceLabel(assertion);
    const value = mappedEvidenceValue(assertion);
    if (!label || !value) return;

    if (!evidenceByEntityId.has(subjectId)) evidenceByEntityId.set(subjectId, []);
    evidenceByEntityId.get(subjectId).push(Object.freeze({
      label,
      value,
      sourceColumn: asText(assertion?.attributes?.sourceColumn),
      assertionId: asText(assertion?.id),
      evidenceSourceIds: Object.freeze([...(assertion?.evidenceSourceIds || [])]),
      sourceRowNumber: Number(assertion?.provenance?.source?.sourceRowNumber) || null,
      sourceSheet: asText(assertion?.provenance?.source?.sourceSheet),
    }));
  });

  evidenceByEntityId.forEach((fields, entityId) => {
    const seen = new Set();
    const uniqueFields = fields.filter((field) => {
      const key = `${field.label.toLowerCase()}::${field.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    evidenceByEntityId.set(entityId, Object.freeze(uniqueFields));
  });

  return evidenceByEntityId;
}

export function getPeridotCanonicalEntityEvidence(evidenceByEntityId, entityId) {
  const key = asText(entityId);
  if (!key || !(evidenceByEntityId instanceof Map)) return [];
  return evidenceByEntityId.get(key) || [];
}


export function filterPeridotCanonicalEntityEvidenceToRows(fields = [], rows = []) {
  const visibleSourceRowNumbers = new Set(
    (rows || [])
      .map((row) => Number(row?.generalizedObservation?.rowIndex) + 2)
      .filter((rowNumber) => Number.isFinite(rowNumber)),
  );

  return (fields || []).filter((field) => (
    !Number.isFinite(Number(field?.sourceRowNumber))
    || visibleSourceRowNumbers.has(Number(field.sourceRowNumber))
  ));
}
