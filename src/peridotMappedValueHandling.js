/*
 * Shared cardinality handling for researcher-mapped source values.
 *
 * Source cells remain untouched. A mapping may explicitly declare that one
 * cell contains several values and provide the delimiter Peridot should use.
 * The result is always an array so semantic consumers can expand one mapped
 * item into zero, one, or many normalized assertions without inferring source
 * meaning from punctuation.
 */

export const PERIDOT_VALUE_CARDINALITIES = Object.freeze({
  single: 'single',
  multiple: 'multiple',
});

export const DEFAULT_PERIDOT_VALUE_HANDLING = Object.freeze({
  cardinality: PERIDOT_VALUE_CARDINALITIES.single,
  delimiter: ',',
});

export function normalizePeridotDelimiter(rawDelimiter) {
  let delimiter = String(rawDelimiter ?? DEFAULT_PERIDOT_VALUE_HANDLING.delimiter);
  if (delimiter.length >= 2) {
    const first = delimiter[0];
    const last = delimiter[delimiter.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      delimiter = delimiter.slice(1, -1);
    }
  }
  return delimiter || DEFAULT_PERIDOT_VALUE_HANDLING.delimiter;
}

export function normalizePeridotValueHandling(valueHandling = {}) {
  const cardinality = valueHandling?.cardinality === PERIDOT_VALUE_CARDINALITIES.multiple
    ? PERIDOT_VALUE_CARDINALITIES.multiple
    : PERIDOT_VALUE_CARDINALITIES.single;
  const delimiter = normalizePeridotDelimiter(valueHandling?.delimiter);
  return Object.freeze({
    cardinality,
    delimiter,
  });
}

export function splitPeridotMappedValue(rawValue, valueHandling = {}) {
  const handling = normalizePeridotValueHandling(valueHandling);
  const rawText = String(rawValue ?? '');
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  if (handling.cardinality !== PERIDOT_VALUE_CARDINALITIES.multiple) return [trimmed];

  const delimiter = handling.delimiter;
  const pieces = /^\s+$/.test(delimiter)
    ? trimmed.split(/\s+/)
    : trimmed.split(delimiter);

  return pieces.map((value) => String(value ?? '').trim()).filter(Boolean);
}
