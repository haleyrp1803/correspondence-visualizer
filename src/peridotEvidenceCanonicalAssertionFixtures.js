import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';

function assert(name, condition, details = '') {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ''}`);
  return true;
}

export function runPeridotEvidenceCanonicalAssertionFixtureAudit() {
  const rows = [{
    PersonA: 'Anna',
    PersonB: 'Maria',
    Roles: 'clerical / diplomatic',
  }];

  const mapping = {
    relationshipParts: [
      { participantColumn: 'PersonA', roleLabel: 'person A', roleMode: 'heading' },
      { participantColumn: 'PersonB', roleLabel: 'person B', roleMode: 'heading' },
    ],
    customFieldSelections: [{
      sourceColumn: 'Roles',
      action: 'include',
      label: 'Role',
      valueHandling: { cardinality: 'multiple', delimiter: '/' },
      subjectSelection: { includeRecord: true, participantIndices: [0] },
      analyticsEligible: true,
    }],
  };

  const mappedRows = applyPeridotGeneralizedColumnMapping(rows, mapping);
  const observation = mappedRows[0]?.generalizedObservation || {};
  const canonical = normalizePeridotGeneralizedMappedRows(mappedRows, {
    datasetId: 'evidence-canonical-assertion-fixture',
    datasetLabel: 'Evidence canonical assertion fixture',
    sourceFileId: 'fixture',
    sourceFileName: 'fixture.csv',
    sourceSheet: 'Data',
    importedAt: '2026-08-31T00:00:00.000Z',
  });

  const record = canonical.records?.[0];
  const personAId = record?.participantIds?.[0];
  const personBId = record?.participantIds?.[1];
  const evidenceSource = canonical.evidenceSources?.[0];
  const evidenceAssertions = (canonical.assertions || []).filter((assertion) =>
    String(assertion?.predicate || '').startsWith('mapped-evidence:')
  );
  const assertionSubjects = evidenceAssertions.map((assertion) => assertion.subjectId);
  const values = evidenceAssertions.map((assertion) => assertion.value).sort();

  const checks = {
    generalizedEvidenceFansOutByValueAndSubject: assert(
      'generalized Evidence fans out by value and subject',
      observation.evidenceFields?.length === 4
    ),
    evidenceSourceRemainsOnePerRecord: assert(
      'EvidenceSource remains one per record',
      canonical.evidenceSources?.length === 1
    ),
    evidenceSourceDoesNotDuplicateSubjectFanout: assert(
      'EvidenceSource fields do not duplicate subject fan-out',
      evidenceSource?.attributes?.fields?.length === 2
    ),
    recordCustomFieldsDoNotDuplicateSubjectFanout: assert(
      'record customFields do not duplicate subject fan-out',
      Array.isArray(record?.attributes?.customFields?.Role)
        && record.attributes.customFields.Role.length === 2
    ),
    canonicalAssertionsAreAtomic: assert(
      'canonical Evidence assertions are atomic',
      evidenceAssertions.length === 4
        && assertionSubjects.filter((id) => id === record.id).length === 2
        && assertionSubjects.filter((id) => id === personAId).length === 2
        && !assertionSubjects.includes(personBId)
    ),
    canonicalAssertionsPreserveValues: assert(
      'canonical Evidence assertions preserve split values',
      JSON.stringify(values) === JSON.stringify(['clerical', 'clerical', 'diplomatic', 'diplomatic'])
    ),
    canonicalAssertionsLinkEvidenceSource: assert(
      'canonical Evidence assertions link to one EvidenceSource',
      evidenceAssertions.every((assertion) => assertion.evidenceSourceIds?.length === 1
        && assertion.evidenceSourceIds[0] === evidenceSource.id)
    ),
    canonicalAssertionsPreserveMappingMetadata: assert(
      'canonical Evidence assertions preserve mapping metadata',
      evidenceAssertions.every((assertion) => assertion.attributes?.mappedLabel === 'Role'
        && assertion.attributes?.sourceColumn === 'Roles'
        && assertion.attributes?.rawValue === 'clerical / diplomatic')
    ),
    legacyCustomFieldsRemainOnePerSplitValue: assert(
      'legacy customInspectorFields remain one per split source value',
      mappedRows[0]?.customInspectorFields?.length === 2
    ),
  };

  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks });
}
