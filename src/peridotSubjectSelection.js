/*
 * Shared researcher-facing subject attribution helpers.
 *
 * Mapping UI may let one source assignment describe the record itself and/or
 * several mapped relationship participants. Canonical assertions remain
 * atomic: the runtime expands a mapping-level selection into one singular
 * subjectParticipantIndex per normalized assertion/occurrence.
 */

function asParticipantIndex(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function uniqueParticipantIndices(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(asParticipantIndex)
      .filter((value) => value !== null)
  )).sort((a, b) => a - b);
}

export function normalizePeridotSubjectSelection(value = {}, legacySubjectParticipantIndex = null) {
  const hasExplicitSelection = Boolean(
    value
    && typeof value === 'object'
    && (Object.prototype.hasOwnProperty.call(value, 'includeRecord') || Array.isArray(value.participantIndices))
  );

  if (hasExplicitSelection) {
    const participantIndices = uniqueParticipantIndices(value.participantIndices);
    const includeRecord = Boolean(value.includeRecord);
    if (includeRecord || participantIndices.length) {
      return { includeRecord, participantIndices };
    }
    // A mapping always needs at least one subject. Empty/invalid selections
    // fall back to the historical record-level default rather than disappearing.
    return { includeRecord: true, participantIndices: [] };
  }

  const legacyIndex = asParticipantIndex(legacySubjectParticipantIndex);
  if (legacyIndex !== null) {
    return { includeRecord: false, participantIndices: [legacyIndex] };
  }

  return { includeRecord: true, participantIndices: [] };
}

export function normalizePeridotSubjectSelectionFromMapping(mapping = {}) {
  return normalizePeridotSubjectSelection(mapping?.subjectSelection, mapping?.subjectParticipantIndex);
}

export function expandPeridotSubjectSelection(mapping = {}) {
  const selection = normalizePeridotSubjectSelectionFromMapping(mapping);
  return [
    ...(selection.includeRecord ? [null] : []),
    ...selection.participantIndices,
  ];
}

export function peridotSubjectSelectionIncludesParticipant(mapping = {}, participantIndex) {
  const normalizedIndex = asParticipantIndex(participantIndex);
  if (normalizedIndex === null) return false;
  return normalizePeridotSubjectSelectionFromMapping(mapping).participantIndices.includes(normalizedIndex);
}
