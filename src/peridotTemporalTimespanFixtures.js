import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { parsePeridotTemporalSpan, parsePeridotTemporalValue } from './peridotTemporalAssertions.js';
import { normalizePeridotGeneralizedMappedRows } from './peridotCorrespondenceProfile.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const STRESS_ROWS = Object.freeze([
  ['A', '(May 2026 - April 2026)', 'Y', 'Y', 'approximate'],
  ['B', '1619 to 1621/09/03', 'Y', 'Y', 'uncertain'],
  ['C', 'word 1613 to 1819 something', 'N', 'Y', 'unknown'],
  ['D', 'March 20, 1311 to May 1718', 'Y', 'N', 'certain'],
  ['E', '1777 up until 1900-08-27', 'Y', 'Y', 'missing month'],
  ['F', '1876-02-09-1877-03-13', 'Y', 'N', 'complete'],
  ['G', '1876-02-09 - 1877-03-13', 'Y', 'Y', 'incomplete'],
  ['H', '1876-02-09 -to1877-03-13', 'Y', 'N', ''],
  ['I', '1618 - ?', 'N', 'N', ''],
  ['J', '1618', 'Y', 'N', ''],
  ['K', 'Unknown', 'N', 'N', ''],
  ['L', 'c. 1918', 'N', 'Y', ''],
  ['M', 'c.1918 to circa 1991', 'Y', 'Y', ''],
  ['N', 'circa May 2006', 'N', 'Y', ''],
  ['O', 'c1812', 'N', 'N', ''],
  ['P', 'Sept 16, 2024 - ?', 'N', 'Y', ''],
  ['Q', 'unknown', 'N', 'N', ''],
  ['R', '', 'N', 'Y', ''],
  ['S', '0000/08/08 - 1800/08/28', 'N', 'N', ''],
  ['T', 'approx. 1617 - May of 1615', 'Y', 'Y', ''],
  ['U', 'approx. 1617 - May of 1645', 'N', 'Y', ''],
  ['V', 'indescipherable', 'N', 'Y', ''],
].map(([Event, Period, certain, complete, Qualifier]) => Object.freeze({ Event, Period, 'Certain?': certain, 'Complete?': complete, Qualifier })));

export function runPeridotTemporalTimespanSelfAudit() {
  const yearRange = parsePeridotTemporalSpan('1600–1640');
  assert(yearRange.start?.year === 1600 && yearRange.end?.year === 1640, 'Year endpoints should survive.');
  assert(yearRange.start?.month === null && yearRange.end?.month === null, 'Year-only values must not invent month precision.');

  const partial = parsePeridotTemporalValue('1607/00/02');
  assert(partial.start?.year === 1607 && partial.start?.month === null && partial.start?.day === 2, 'Known year/day with unknown month must survive without invention.');
  assert(partial.temporalShape === 'partialPoint', 'Zero-component historical date should be a partial point.');

  const noYear = parsePeridotTemporalSpan('0000/08/08 - 1800/08/28');
  assert(noYear.start?.year === null && noYear.start?.month === 8 && noYear.start?.day === 8, 'Unknown year with known month/day must survive.');
  assert(noYear.visualizationUsability.timelinePositionable === true, 'Interval remains positionable from its known endpoint while retaining partial structure.');

  const ambiguous = parsePeridotTemporalSpan('03/04/1600–05/06/1640');
  assert(ambiguous.parsingStatus === 'unrecognized', 'Ambiguous numeric dates should be preserved rather than guessed.');

  const prose = parsePeridotTemporalSpan('word 1613 to 1819 something');
  assert(prose.start?.year === 1613 && prose.end?.year === 1819, 'Outer viable dates should survive surrounding non-date text.');

  const annotated = parsePeridotTemporalSpan('1593–1604 (see source list)');
  assert(annotated.start?.year === 1593 && annotated.end?.year === 1604, 'Trailing source annotations must not defeat a viable interval.');

  const probable = parsePeridotTemporalSpan('Probably 1552–1616');
  assert(probable.start?.year === 1552 && probable.end?.year === 1616 && probable.temporalShape === 'approximateInterval', 'Leading probability language should preserve a viable approximate interval.');

  const competing = parsePeridotTemporalSpan('Uncertain: Treccani 1552; Wikipedia 1550–1621');
  assert(competing.parsingStatus === 'unrecognized' && competing.parseWarnings.some((warning) => warning.includes('more than two viable date expressions')), 'Competing date possibilities must remain flagged rather than collapsed.');

  const singleton = parsePeridotTemporalSpan('1618');
  assert(singleton.temporalShape === 'point' && singleton.end?.year === 1618, 'Singleton value in a timespan field should remain a point.');

  const open = parsePeridotTemporalSpan('1618 - ?');
  assert(open.temporalShape === 'openInterval' && open.boundedness === 'openEnd' && open.end === null, 'Unknown end should remain open.');

  const backwards = parsePeridotTemporalSpan('(May 2026 - April 2026)');
  assert(backwards.consistency === 'backwards' && backwards.temporalShape === 'inconsistent', 'Backwards ranges should be preserved and classified as inconsistent.');

  const stressMapped = applyPeridotGeneralizedColumnMapping(STRESS_ROWS, {
    relationshipParts: [{ participantColumn: 'Event', headingRole: 'Event' }],
    temporalMapping: { Date_Range: 'Period' },
    temporalNoteMappings: { Date_Range: ['Certain?', 'Complete?', 'Qualifier'] },
  });
  const stressCanonical = normalizePeridotGeneralizedMappedRows(stressMapped, { datasetId: 'temporal-stress-fixture' });
  const firstAssertion = stressCanonical.records[0]?.temporalAssertions?.[0];
  assert(firstAssertion?.temporalNotes?.length === 3, 'Arbitrary researcher temporal note columns should survive canonically.');
  assert(firstAssertion.temporalNotes.find((note) => note.sourceColumn === 'Qualifier')?.value === 'approximate', 'Researcher qualifier value should survive without controlling machine interpretation.');
  assert(firstAssertion.consistency === 'backwards', 'Machine-derived backwards status should remain independent from researcher notes.');

  const cardinalRow = applyPeridotGeneralizedColumnMapping([
    { Cardinal: 'Example Cardinal', 'Creation date': '1618', Lifespan: '1570–1630' },
  ], {
    relationshipParts: [{ participantColumn: 'Cardinal', headingRole: 'Cardinal' }],
    temporalMapping: { Date: 'Creation date', Date_Range: 'Lifespan' },
  });
  const cardinalCanonical = normalizePeridotGeneralizedMappedRows(cardinalRow, { datasetId: 'cardinal-temporal-fixture' });
  const cardinalAssertions = cardinalCanonical.records?.[0]?.temporalAssertions || [];
  assert(cardinalAssertions.length === 2, 'Creation date and lifespan must survive as two canonical temporal assertions.');
  assert(cardinalAssertions.some((assertion) => assertion.role === 'Creation date'), 'Creation date role should derive transparently from mapped source column.');
  assert(cardinalAssertions.some((assertion) => assertion.role === 'Lifespan'), 'Lifespan role should derive transparently from mapped source column.');

  const stressAssertions = stressCanonical.records.map((record) => record.temporalAssertions?.[0]).filter(Boolean);
  assert(stressAssertions.some((assertion) => assertion.temporalShape === 'approximatePoint'), 'Stress corpus should include approximate points.');
  assert(stressAssertions.some((assertion) => assertion.temporalShape === 'openInterval'), 'Stress corpus should include open intervals.');
  assert(competing.parsingStatus === 'unrecognized', 'Competing temporal claims should preserve an unrecognized/flagged case.');
  assert(stressAssertions.some((assertion) => assertion.temporalShape === 'partialInterval'), 'Stress corpus should preserve partial intervals.');

  return Object.freeze({
    stressRecordCount: stressCanonical.records.length,
    cardinalTemporalAssertionCount: cardinalAssertions.length,
    partialKnownComponents: partial.start?.knownComponents,
    backwardsWarningCount: backwards.parseWarnings.length,
    attachedNoteCount: firstAssertion?.temporalNotes?.length || 0,
  });
}
