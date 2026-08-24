import { splitPeridotMappedValue } from './peridotMappedValueHandling.js';
import { buildPeridotGeneralizedObservation } from './peridotGeneralizedMappingRuntime.js';

export function runPeridotMappedValueHandlingSelfAudit() {
  const scalarComma = splitPeridotMappedValue('clerical, diplomatic', { cardinality: 'single', delimiter: ',' });
  const commaValues = splitPeridotMappedValue(' clerical, familial, diplomatic ', { cardinality: 'multiple', delimiter: ',' });
  const sparseValues = splitPeridotMappedValue('A, , B,', { cardinality: 'multiple', delimiter: ',' });
  const whitespaceValues = splitPeridotMappedValue('A    B\tC', { cardinality: 'multiple', delimiter: ' ' });
  const blankValues = splitPeridotMappedValue('   ', { cardinality: 'multiple', delimiter: ',' });
  const quotedWhitespaceValues = splitPeridotMappedValue('A   B C', { cardinality: 'multiple', delimiter: '" "' });
  const singleQuotedSlashValues = splitPeridotMappedValue('Papal States/Peretti-Montalto family', { cardinality: 'multiple', delimiter: "'/'" });
  const doubleQuotedSemicolonValues = splitPeridotMappedValue('1621;1623', { cardinality: 'multiple', delimiter: '";"' });

  const row = {
    Person: 'Maria',
    Associates: 'Anna; Caterina',
    Places: 'Florence; Rome',
    Roles: 'clerical, diplomatic',
    Dates: '1614-05-03; 1614-05-11',
  };
  const observation = buildPeridotGeneralizedObservation(row, {
    relationshipParts: [
      { participantColumn: 'Person', roleLabel: 'person', roleMode: 'heading' },
      { participantColumn: 'Associates', roleLabel: 'associate', roleMode: 'heading', valueHandling: { cardinality: 'multiple', delimiter: ';' } },
    ],
    placeParts: [
      { placeColumn: 'Places', roleLabel: 'associated place', roleMode: 'heading', valueHandling: { cardinality: 'multiple', delimiter: ';' } },
    ],
    temporalAssertionMappings: [
      { id: 'dates', role: 'Recorded date', kind: 'date', sourceMode: 'single', column: 'Dates', noteColumns: [], valueHandling: { cardinality: 'multiple', delimiter: ';' } },
    ],
    customFieldSelections: [
      { sourceColumn: 'Roles', label: 'Roles', action: 'include', analyticsEligible: true, valueHandling: { cardinality: 'multiple', delimiter: ',' } },
    ],
  }, 0);

  const checks = Object.freeze({
    scalarPunctuationPreserved: scalarComma.length === 1 && scalarComma[0] === 'clerical, diplomatic',
    commaSplittingTrimsValues: JSON.stringify(commaValues) === JSON.stringify(['clerical', 'familial', 'diplomatic']),
    emptySplitValuesDiscarded: JSON.stringify(sparseValues) === JSON.stringify(['A', 'B']),
    whitespaceDelimiterUsesRuns: JSON.stringify(whitespaceValues) === JSON.stringify(['A', 'B', 'C']),
    blankCellProducesNoValues: blankValues.length === 0,
    quotedWhitespaceDelimiterNormalized: JSON.stringify(quotedWhitespaceValues) === JSON.stringify(['A', 'B', 'C']),
    singleQuotedSlashDelimiterNormalized: JSON.stringify(singleQuotedSlashValues) === JSON.stringify(['Papal States', 'Peretti-Montalto family']),
    doubleQuotedSemicolonDelimiterNormalized: JSON.stringify(doubleQuotedSemicolonValues) === JSON.stringify(['1621', '1623']),
    participantCardinalityExpandsOneMappedPart:
      observation.participants.length === 3
      && observation.participants[1]?.index === 1
      && observation.participants[2]?.index === 1
      && observation.participants[1]?.occurrenceIndex === 0
      && observation.participants[2]?.occurrenceIndex === 1
      && observation.participants[1]?.value === 'Anna'
      && observation.participants[2]?.value === 'Caterina',
    participantRawValuePreserved:
      observation.participants[1]?.rawValue === 'Anna; Caterina'
      && observation.participants[2]?.rawValue === 'Anna; Caterina',
    placeCardinalityExpandsAssertions:
      observation.places.length === 2
      && observation.places[0]?.label === 'Florence'
      && observation.places[1]?.label === 'Rome'
      && observation.places[0]?.index === 0
      && observation.places[1]?.index === 0,
    evidenceCardinalityExpandsFields:
      observation.evidenceFields.length === 2
      && observation.evidenceFields[0]?.value === 'clerical'
      && observation.evidenceFields[1]?.value === 'diplomatic',
    singleColumnTemporalCardinalityExpandsAssertions:
      observation.temporal.assertions.length === 2
      && observation.temporal.assertions[0]?.sourceText === '1614-05-03'
      && observation.temporal.assertions[1]?.sourceText === '1614-05-11'
      && observation.temporal.assertions[0]?.fieldKey === 'dates'
      && observation.temporal.assertions[1]?.fieldKey === 'dates',
    sourceRowRemainsUntouched:
      observation.originalUploadedRow?.Associates === 'Anna; Caterina'
      && observation.originalUploadedRow?.Places === 'Florence; Rome'
      && observation.originalUploadedRow?.Roles === 'clerical, diplomatic'
      && observation.originalUploadedRow?.Dates === '1614-05-03; 1614-05-11',
  });

  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks });
}
