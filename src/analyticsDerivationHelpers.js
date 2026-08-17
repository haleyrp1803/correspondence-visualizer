/*
 * Analytics data-derivation layer.
 * 
 * This module converts the current filtered rows into chart-ready structures. It detects available categorical/numeric fields, applies Analytics-local date scopes, builds grouped/stacked/multi-series data, computes record-count and numeric aggregations, and formats time periods.
 * 
 * Important relationships:
 * - `AnalyticsPanel.jsx` calls this file to build data for the selected chart configuration.
 * - `analyticsConfig.js` supplies curated semantic field definitions and chart defaults.
 * - `analyticsChartComponents.jsx` expects this file to return already-shaped data rather than raw application rows.
 * 
 * Maintenance cautions:
 * - Dynamic field detection must stay conservative. Avoid admitting ID columns, raw coordinates, long notes, object values, or near-unique identifiers as categorical chart variables.
 * - Record count is a first-class metric; do not hide it as an implicit fallback when aggregate charts need a metric.
 */

import {
  ANALYTICS_BAR_FIELD_DEFINITIONS,
  ANALYTICS_HEATMAP_FIELD_DEFINITIONS,
  ANALYTICS_SEGMENT_FIELD_DEFINITIONS,
} from './analyticsConfig';
import { getRowTemporalDateParts } from './timelinePlaybackHelpers.js';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || text === '0') return '';
  return text;
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/["'’‘“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyMatchesCandidate(key, candidate) {
  return normalizeKey(key) === normalizeKey(candidate);
}

function getAliasedRowValue(row, canonicalKey, aliases = []) {
  if (!row) return '';

  const direct = normalizeText(row[canonicalKey]);
  if (direct) return direct;

  const candidates = [canonicalKey, ...aliases];
  const rowKeys = Object.keys(row);

  for (const candidate of candidates) {
    const foundKey = rowKeys.find((key) => keyMatchesCandidate(key, candidate));
    if (!foundKey) continue;

    const value = normalizeText(row[foundKey]);
    if (value) return value;
  }

  return '';
}

function getFieldDefinition(fieldKey) {
  return [
    ...ANALYTICS_BAR_FIELD_DEFINITIONS,
    ...ANALYTICS_HEATMAP_FIELD_DEFINITIONS,
    ...ANALYTICS_SEGMENT_FIELD_DEFINITIONS,
  ].find((definition) => definition.key === fieldKey);
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const cleaned = text.replace(/[,$£€]/g, '').replace(/%$/, '').trim();
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function getDatePartsFromRow(row) {
  // Canonical temporal assertions are the row-level date authority. The shared
  // helper retains the temporary legacy fallback for old/demo rows, so Analytics
  // does not need its own parser or any legacy date-object dependency.
  return getRowTemporalDateParts(row);
}

function getYearFromRow(row) {
  const parts = getDatePartsFromRow(row);
  return parts ? String(parts.year) : '';
}

function getPeriodGranularity(startYear, endYear) {
  const start = Number(startYear);
  const end = Number(endYear);
  const span = Math.max(0, end - start);

  if (span <= 1) return 'month';
  if (span <= 3) return 'quarter';
  if (span <= 5) return 'half';
  return 'year';
}

function formatPeriod({ year, month }, granularity) {
  if (granularity === 'month') {
    const monthLabel = String(month).padStart(2, '0');
    return `${year}-${monthLabel}`;
  }

  if (granularity === 'quarter') {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return `${year} Q${quarter}`;
  }

  if (granularity === 'half') {
    const half = month <= 6 ? 'H1' : 'H2';
    return `${year} ${half}`;
  }

  return String(year);
}

function formatFullDate(parts) {
  if (!parts) return '';
  const monthLabel = String(parts.month).padStart(2, '0');
  const dayLabel = String(parts.day).padStart(2, '0');

  if (parts.precision === 'day') return `${parts.year}-${monthLabel}-${dayLabel}`;
  if (parts.precision === 'month') return `${parts.year}-${monthLabel}`;
  return String(parts.year);
}

function dateLabelForRow(row, fieldKey = 'year', granularity = 'year') {
  const parts = getDatePartsFromRow(row);
  if (!parts) return '';

  if (fieldKey === 'fullDate') return formatFullDate(parts);
  if (fieldKey === 'timePeriod') return formatPeriod(parts, granularity);
  return String(parts.year);
}

function isDerivedDateAxisField(fieldKey) {
  return fieldKey === 'year' || fieldKey === 'fullDate' || fieldKey === 'timePeriod';
}

function periodSortValue(label) {
  const text = String(label || '');
  const yearMatch = text.match(/^(\d{3,4})/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;

  const fullDateMatch = text.match(/^(\d{3,4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (fullDateMatch) {
    const month = fullDateMatch[2] ? Number(fullDateMatch[2]) : 1;
    const day = fullDateMatch[3] ? Number(fullDateMatch[3]) : 1;
    return year * 372 + (month - 1) * 31 + (day - 1);
  }

  if (text.includes('Q')) {
    const quarter = Number(text.match(/Q(\d)/)?.[1] || 1);
    return year * 372 + (quarter - 1) * 93;
  }

  if (text.includes('H2')) return year * 372 + 186;
  if (text.includes('H1')) return year * 372;

  return year * 372;
}

function fieldValue(row, fieldKey) {
  if (isDerivedDateAxisField(fieldKey)) return dateLabelForRow(row, fieldKey, 'year');
  if (fieldKey === 'recordCount') return 'Record count';

  if (fieldKey === 'routePlace') {
    const source = fieldValue(row, 'sourceLoc');
    const target = fieldValue(row, 'targetLoc');
    if (!source || !target) return '';
    return `${source} → ${target}`;
  }

  if (fieldKey === 'routePerson') {
    const source = fieldValue(row, 'sourcePerson');
    const target = fieldValue(row, 'targetPerson');
    if (!source || !target) return '';
    return `${source} → ${target}`;
  }

  if (fieldKey === 'route') return fieldValue(row, 'routePlace');

  const definition = getFieldDefinition(fieldKey);
  if (definition) return getAliasedRowValue(row, definition.key, definition.aliases || []);

  return normalizeText(row[fieldKey]);
}

function hasRequiredField(rows, definition) {
  return rows.some((row) => Boolean(fieldValue(row, definition.key)));
}

function incrementNestedMap(map, outerKey, innerKey, increment = 1) {
  // Numeric-counter helper only. Do not use this for grouped chart buckets that
  // store arrays of raw values; adding to an array coerces it and destroys counts.
  if (!map.has(outerKey)) map.set(outerKey, new Map());
  const inner = map.get(outerKey);
  inner.set(innerKey, (inner.get(innerKey) || 0) + increment);
}

function aggregateValues(values, aggregation = 'count') {
  if (aggregation === 'count') return values.length;
  const numericValues = values.map(parseNumber).filter((value) => value !== null);
  if (!numericValues.length) return 0;
  if (aggregation === 'sum') return numericValues.reduce((sum, value) => sum + value, 0);
  if (aggregation === 'min') return Math.min(...numericValues);
  if (aggregation === 'max') return Math.max(...numericValues);
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function additiveAggregationFor(metricField) {
  return metricField === 'recordCount' ? 'count' : 'sum';
}

function effectiveAggregationForChart(chartType, metricField, aggregation = 'count') {
  if (!metricField || metricField === 'recordCount') return 'count';
  if (['pie', 'stackedBar', 'sunburst'].includes(chartType)) return 'sum';
  if (['sum', 'average', 'min', 'max'].includes(aggregation)) return aggregation;
  return 'sum';
}

function clampLimit(value, fallback = 10) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(100000, Math.floor(number)));
}

function aggregateForRanking(values = [], metricField = 'recordCount', aggregation = 'count') {
  if (metricField === 'recordCount') return aggregateValues(values, 'count');
  return aggregateValues(values, aggregation);
}

function aggregatePoint(values = [], metricField = 'recordCount', aggregation = 'count', missingValue = 0) {
  if (metricField === 'recordCount') return aggregateValues(values, 'count');
  if (!values.some((value) => parseNumber(value) !== null)) return missingValue;
  return aggregateValues(values, aggregation);
}

function addAllValues(target, source = []) {
  source.forEach((value) => target.push(value));
  return target;
}

function getRemainingCategoryLabel(existingLabels = []) {
  const labels = new Set(Array.from(existingLabels).map((label) => String(label)));
  if (!labels.has('Other')) return 'Other';
  if (!labels.has('Other categories')) return 'Other categories';
  return 'Remaining categories';
}

function metricLabelFor(fieldKey, aggregation = 'count') {
  return fieldKey === 'recordCount' ? 'record count' : `${aggregation} ${humanizeFieldLabel(fieldKey)}`;
}

function methodMetricLabelFor(fieldKey, aggregation = 'count') {
  const label = metricLabelFor(fieldKey, aggregation);
  return label.replace(/^./, (first) => first.toUpperCase());
}

function metricValue(row, metricField) {
  if (!metricField || metricField === 'recordCount') return 1;
  return parseNumber(row?.[metricField]);
}

function unitForMetric(metricField) {
  return metricField === 'recordCount' ? 'records' : 'value';
}

function topKeysByTotal(counts, topN) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, clampLimit(topN))
    .map((item) => item.label);
}

function normalizeCategorySelection(selection = {}) {
  const mode = selection?.mode === 'manual' ? 'manual' : 'topN';
  const comparisonMode = ['selectedOnly', 'selectedPlusOther', 'selectedPlusTotal'].includes(selection?.comparisonMode)
    ? selection.comparisonMode
    : 'selectedPlusOther';
  const values = Array.isArray(selection?.values)
    ? selection.values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  return { mode, comparisonMode, values };
}

function resolveSelectedCategoryLabels(totals = new Map(), topN = 10, selection = {}) {
  const normalized = normalizeCategorySelection(selection);
  const availableLabels = Array.from(totals.keys());
  const availableSet = new Set(availableLabels);

  if (normalized.mode !== 'manual') {
    return {
      selectedLabels: topKeysByTotal(totals, topN),
      omittedLabels: [],
      includeOther: false,
      includeTotal: false,
      mode: 'topN',
    };
  }

  const selectedLabels = normalized.values.filter((label, index, array) => (
    availableSet.has(label) && array.indexOf(label) === index
  ));
  const omittedLabels = availableLabels.filter((label) => !selectedLabels.includes(label));
  const includeOther = normalized.comparisonMode === 'selectedPlusOther' || normalized.comparisonMode === 'selectedPlusTotal';
  const includeTotal = normalized.comparisonMode === 'selectedPlusTotal';

  return {
    selectedLabels,
    omittedLabels,
    includeOther,
    includeTotal,
    mode: 'manual',
  };
}

function filterRowsByManualCategorySelection(rows = [], fieldKey, selection = {}) {
  const normalized = normalizeCategorySelection(selection);
  if (normalized.mode !== 'manual' || !fieldKey || !normalized.values.length) return rows;
  const selectedSet = new Set(normalized.values);
  return rows.filter((row) => selectedSet.has(fieldValue(row, fieldKey)));
}

function collectOtherValues(grouped = new Map(), labels = []) {
  const values = [];
  labels.forEach((label) => addAllValues(values, grouped.get(label) || []));
  return values;
}

function collectNestedOtherValues(nested = new Map(), outerKey, labels = []) {
  const values = [];
  const inner = nested.get(outerKey) || new Map();
  labels.forEach((label) => addAllValues(values, inner.get(label) || []));
  return values;
}

function collectNestedRowTotalValues(nested = new Map(), outerKey) {
  const values = [];
  const inner = nested.get(outerKey) || new Map();
  Array.from(inner.values()).forEach((bucketValues) => addAllValues(values, bucketValues || []));
  return values;
}

function collectSeriesOtherValues(nested = new Map(), labels = [], xLabel) {
  const values = [];
  labels.forEach((label) => addAllValues(values, nested.get(label)?.get(xLabel) || []));
  return values;
}

function collectSeriesTotalValues(nested = new Map(), xLabel) {
  const values = [];
  Array.from(nested.values()).forEach((inner) => addAllValues(values, inner?.get(xLabel) || []));
  return values;
}

function filterRowsByAnalyticsDateRange(rows, startYear, endYear) {
  const start = Number(startYear);
  const end = Number(endYear);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return rows;
  const minYear = Math.min(start, end);
  const maxYear = Math.max(start, end);

  return rows.filter((row) => {
    const parts = getDatePartsFromRow(row);
    if (!parts) return false;
    return parts.year >= minYear && parts.year <= maxYear;
  });
}

function periodLabelForRow(row, granularity) {
  const parts = getDatePartsFromRow(row);
  if (!parts) return '';
  return formatPeriod(parts, granularity);
}

function sortAxisLabels(labels, rows, fieldKey) {
  if (isDerivedDateAxisField(fieldKey)) return labels.sort((a, b) => periodSortValue(a) - periodSortValue(b));
  const numericValues = new Map();
  rows.forEach((row) => {
    const label = fieldValue(row, fieldKey);
    const number = parseNumber(label);
    if (label && number !== null) numericValues.set(label, number);
  });
  if (numericValues.size === labels.length) {
    return labels.sort((a, b) => numericValues.get(a) - numericValues.get(b));
  }
  return labels.sort((a, b) => String(a).localeCompare(String(b)));
}

function humanizeFieldLabel(key) {
  const explicitLabels = {
    sourcePerson: 'Source person',
    targetPerson: 'Target person',
    sourceLoc: 'Source place',
    targetLoc: 'Target place',
    routePlace: 'Route (Place)',
    routePerson: 'Route (Person)',
    archivalCollection: 'Archival collection',
    year: 'Year',
    fullDate: 'Full date',
    timePeriod: 'Time period',
    recordCount: 'Record count',
  };

  if (explicitLabels[key]) return explicitLabels[key];

  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function isTechnicalFieldKey(key) {
  const normalized = normalizeKey(key);
  if (!normalized) return true;
  const compactNormalized = normalized.replace(/\s+/g, '');

  const exactExclusions = new Set([
    'id', 'row id', 'parsed date', 'mappable', 'map able', 'source place id', 'target place id',
    'source id', 'target id', 'person id', 'place id', 'source lat', 'source long', 'source lng',
    'target lat', 'target long', 'target lng', 'lat', 'lng', 'long', 'latitude', 'longitude',
    'source latitude', 'source longitude', 'target latitude', 'target longitude',
  ]);

  const compactExclusions = new Set([
    'sourcelat', 'sourcelng', 'sourcelong', 'sourcelatitude', 'sourcelongitude',
    'targetlat', 'targetlng', 'targetlong', 'targetlatitude', 'targetlongitude',
    'lat', 'lng', 'long', 'latitude', 'longitude',
  ]);

  if (exactExclusions.has(normalized)) return true;
  if (compactExclusions.has(compactNormalized)) return true;
  if (/^(source|target)?(lat|lng|long|latitude|longitude)$/.test(compactNormalized)) return true;
  if (normalized.startsWith('__')) return true;
  if (/\b(id|uuid|guid)\b/.test(normalized)) return true;
  if (/\b(lat|lng|long|latitude|longitude)\b/.test(normalized)) return true;
  if (/\bmappable\b/.test(normalized)) return true;

  return false;
}

function isDateLikeFieldKey(key) {
  const normalized = normalizeKey(key);
  return normalized === 'date'
    || normalized === 'year'
    || normalized === 'date start'
    || normalized === 'date end'
    || normalized === 'date display'
    || /\b(date|year|period|time)\b/.test(normalized);
}

function isEvidenceLikeFieldKey(key) {
  const normalized = normalizeKey(key);
  return /\b(source|citation|archive|collection|repository|page|folio|link|url|image|note|description|transcription|translation)\b/.test(normalized);
}

function numericFieldStats(rows, key) {
  const values = rows.map((row) => row?.[key]).filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
  if (!values.length) return { count: 0, ratio: 0 };
  const numericValues = values.map(parseNumber).filter((value) => value !== null);
  return { count: numericValues.length, ratio: numericValues.length / values.length };
}

function isUsableDynamicFieldValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return false;
  if (typeof value === 'object') return false;

  const text = normalizeText(value);
  if (!text) return false;
  if (text.length > 140) return false;

  return true;
}

function isDynamicFieldCandidate(rows, key) {
  if (!key || isTechnicalFieldKey(key)) return false;

  const values = rows.map((row) => row?.[key]).filter((value) => value != null);
  if (!values.length) return false;

  const usableValues = values.filter(isUsableDynamicFieldValue);
  if (!usableValues.length) return false;

  const uniqueValues = new Set(usableValues.map((value) => normalizeText(value)));
  if (!uniqueValues.size) return false;
  if (values.length >= 5 && uniqueValues.size / values.length > 0.98) return false;

  return true;
}

function canonicalKeyForUploadedKey(key, existingDefinitions = []) {
  const normalized = normalizeKey(key);

  for (const definition of existingDefinitions) {
    const candidates = [definition.key, definition.label, ...(definition.aliases || [])].map(normalizeKey);
    if (candidates.includes(normalized)) return definition.key;
  }

  return null;
}

function buildDynamicFieldDefinitions(rows = [], existingDefinitions = []) {
  const existingKeys = new Set(existingDefinitions.map((definition) => definition.key));
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));

  return keys
    .filter((key) => !canonicalKeyForUploadedKey(key, existingDefinitions))
    .filter((key) => !existingKeys.has(key))
    .filter((key) => isDynamicFieldCandidate(rows, key))
    .map((key) => ({
      key,
      label: humanizeFieldLabel(key),
      description: `Use the uploaded “${humanizeFieldLabel(key)}” field.`,
      requiredFields: [key],
      dynamic: true,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildNumericMeasureDefinitions(rows = []) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
  return keys
    .filter((key) => !isTechnicalFieldKey(key))
    .filter((key) => !isDateLikeFieldKey(key))
    .filter((key) => !isEvidenceLikeFieldKey(key))
    .filter((key) => numericFieldStats(rows, key).ratio >= 0.65)
    .map((key) => ({
      key,
      label: humanizeFieldLabel(key),
      description: `Use numeric values from the uploaded “${humanizeFieldLabel(key)}” column.`,
      requiredFields: [key],
      dynamic: true,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildDateFieldDefinitions(rows = []) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
  const definitions = [];
  const hasDerivedDateParts = rows.some((row) => Boolean(getDatePartsFromRow(row)));

  if (hasDerivedDateParts) {
    definitions.push(
      { key: 'year', label: 'Year', description: 'Group records by year. Month and day are ignored.' },
      { key: 'fullDate', label: 'Full date', description: 'Group records by the most specific available date: year, year-month, or year-month-day.' },
    );
  }

  keys.forEach((key) => {
    if (!isDateLikeFieldKey(key)) return;
    if (definitions.some((definition) => definition.key === key)) return;
    const hasValues = rows.some((row) => normalizeText(row?.[key]));
    if (!hasValues) return;
    definitions.push({ key, label: humanizeFieldLabel(key), description: `Use values from “${humanizeFieldLabel(key)}” as the x-axis.` });
  });

  return definitions;
}

function mergeFieldDefinitions(baseDefinitions, dynamicDefinitions, { allowRoutes = true } = {}) {
  const byKey = new Map();

  baseDefinitions
    .filter((definition) => allowRoutes || (definition.key !== 'routePlace' && definition.key !== 'routePerson'))
    .forEach((definition) => byKey.set(definition.key, definition));

  dynamicDefinitions
    .filter((definition) => allowRoutes || (definition.key !== 'routePlace' && definition.key !== 'routePerson'))
    .forEach((definition) => {
      if (!byKey.has(definition.key)) byKey.set(definition.key, definition);
    });

  return Array.from(byKey.values());
}

function isUsableSeriesGroupingField(rows = [], fieldKey, xField) {
  if (!fieldKey || fieldKey === xField) return false;
  if (isDateLikeFieldKey(fieldKey)) return false;
  if (numericFieldStats(rows, fieldKey).ratio >= 0.65) return false;
  return rows.some((row) => Boolean(fieldValue(row, fieldKey)));
}

function resolveSeriesGroupingField(rows = [], preferredField, xField) {
  if (isUsableSeriesGroupingField(rows, preferredField, xField)) return preferredField;

  const fallbackFields = [
    'sourcePerson',
    'targetPerson',
    'sourceLoc',
    'targetLoc',
    'language',
    'relationship',
    'archivalCollection',
  ];

  return fallbackFields.find((fieldKey) => isUsableSeriesGroupingField(rows, fieldKey, xField)) || preferredField;
}


export function getAnalyticsYearRange(rows = []) {
  const years = Array.from(new Set(rows.map((row) => getDatePartsFromRow(row)?.year).filter((year) => Number.isFinite(year) && year > 0))).sort((a, b) => a - b);
  return { years, minYear: years[0] || null, maxYear: years[years.length - 1] || null };
}

export function getAnalyticsPeriodGranularity(startYear, endYear) {
  return getPeriodGranularity(startYear, endYear);
}

export function getAnalyticsCategoryValues(rows = [], fieldKey = 'sourcePerson', startYear, endYear) {
  const filteredRows = filterRowsByAnalyticsDateRange(rows, startYear, endYear);
  const counts = new Map();

  filteredRows.forEach((row) => {
    const label = fieldValue(row, fieldKey);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getAvailableAnalyticsFields(rows = []) {
  const dynamicDefinitions = buildDynamicFieldDefinitions(rows, ANALYTICS_BAR_FIELD_DEFINITIONS);
  const numericMeasureOptions = buildNumericMeasureDefinitions(rows);
  const dateFieldOptions = buildDateFieldDefinitions(rows);
  const allBarDefinitions = mergeFieldDefinitions(ANALYTICS_BAR_FIELD_DEFINITIONS, dynamicDefinitions);
  const allSegmentDefinitions = mergeFieldDefinitions(ANALYTICS_SEGMENT_FIELD_DEFINITIONS, dynamicDefinitions, { allowRoutes: false });
  const allHeatmapDefinitions = mergeFieldDefinitions(ANALYTICS_HEATMAP_FIELD_DEFINITIONS, dynamicDefinitions, { allowRoutes: false });

  const barGroupOptions = allBarDefinitions.filter((definition) => hasRequiredField(rows, definition));
  const segmentGroupOptions = allSegmentDefinitions.filter((definition) => hasRequiredField(rows, definition));
  const heatmapOptions = allHeatmapDefinitions.filter((definition) => hasRequiredField(rows, definition));

  const genericXAxisOptions = [
    ...dateFieldOptions,
    ...barGroupOptions.filter((definition) => !dateFieldOptions.some((dateDefinition) => dateDefinition.key === definition.key)),
  ];

  const orderedXAxisOptions = [
    ...dateFieldOptions,
    ...numericMeasureOptions.filter((definition) => !dateFieldOptions.some((dateDefinition) => dateDefinition.key === definition.key)),
  ];

  return {
    barGroupOptions,
    pieGroupOptions: barGroupOptions,
    segmentGroupOptions,
    heatmapRowOptions: heatmapOptions,
    heatmapColumnOptions: heatmapOptions,
    xAxisOptions: genericXAxisOptions,
    orderedXAxisOptions,
    dateFieldOptions,
    numericMeasureOptions,
    yMetricOptions: [{ key: 'recordCount', label: 'Record count', description: 'Count records in each group.' }, ...numericMeasureOptions],
    hasYearData: rows.some((row) => Boolean(getYearFromRow(row))),
    hasMeasureTimeSeries: orderedXAxisOptions.length > 0 && numericMeasureOptions.length > 0,
  };
}

export function buildBarChartData(rows = [], groupBy = 'sourcePerson', topN = 10, metricField = 'recordCount', aggregation = 'count', categorySelection = {}) {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = fieldValue(row, groupBy);
    if (!label) return;
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(metricField === 'recordCount' ? 1 : row?.[metricField]);
  });

  const valueAggregation = metricField === 'recordCount' ? 'count' : aggregation;
  const totals = new Map(Array.from(grouped.entries()).map(([label, values]) => [label, aggregateValues(values, valueAggregation)]));
  const { selectedLabels, omittedLabels, includeOther, includeTotal, mode } = resolveSelectedCategoryLabels(totals, topN, categorySelection);
  const selectedSet = new Set(selectedLabels);
  const visibleLabels = mode === 'manual' ? selectedLabels : topKeysByTotal(totals, topN);
  const data = visibleLabels.map((label) => ({
    label,
    count: totals.get(label) || 0,
    unit: metricField === 'recordCount' ? 'records' : 'value',
  }));

  const hiddenLabels = mode === 'manual' ? omittedLabels : Array.from(grouped.keys()).filter((label) => !selectedSet.has(label));
  if (hiddenLabels.length && (includeOther || mode !== 'manual')) {
    const otherValues = collectOtherValues(grouped, hiddenLabels);
    const otherCount = aggregateValues(otherValues, valueAggregation);
    if (otherCount) data.push({ label: getRemainingCategoryLabel(grouped.keys()), count: otherCount, unit: metricField === 'recordCount' ? 'records' : 'value' });
  }

  if (includeTotal) {
    const totalValues = [];
    Array.from(grouped.values()).forEach((values) => addAllValues(totalValues, values));
    data.push({ label: 'Dataset total', count: aggregateValues(totalValues, valueAggregation), unit: metricField === 'recordCount' ? 'records' : 'value' });
  }

  return data.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildPartToWholeChartData(rows = [], groupBy = 'sourcePerson', topN = 10, metricField = 'recordCount', categorySelection = {}) {
  const aggregation = additiveAggregationFor(metricField);
  const grouped = new Map();

  rows.forEach((row) => {
    const label = fieldValue(row, groupBy);
    if (!label) return;
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(metricField === 'recordCount' ? 1 : row?.[metricField]);
  });

  const totals = new Map(
    Array.from(grouped.entries()).map(([label, values]) => [label, aggregateValues(values, aggregation)]),
  );
  const { selectedLabels, omittedLabels, includeOther } = resolveSelectedCategoryLabels(totals, topN, categorySelection);
  const selectedSet = new Set(selectedLabels);
  const data = selectedLabels.map((label) => ({
    label,
    count: totals.get(label) || 0,
    unit: unitForMetric(metricField),
  }));

  const hiddenLabels = normalizeCategorySelection(categorySelection).mode === 'manual'
    ? omittedLabels
    : Array.from(grouped.keys()).filter((label) => !selectedSet.has(label));

  if (hiddenLabels.length && (includeOther || normalizeCategorySelection(categorySelection).mode !== 'manual')) {
    const otherValues = collectOtherValues(grouped, hiddenLabels);
    const otherCount = aggregateValues(otherValues, aggregation);
    if (otherCount) {
      data.push({
        label: getRemainingCategoryLabel(grouped.keys()),
        count: otherCount,
        unit: unitForMetric(metricField),
      });
    }
  }

  return data;
}

export function buildLineChartData(rows = [], xField = 'year', metricField = 'recordCount', aggregation = 'count', startYear, endYear) {
  const granularity = getPeriodGranularity(startYear, endYear);
  const grouped = new Map();
  rows.forEach((row) => {
    const label = isDerivedDateAxisField(xField) ? dateLabelForRow(row, xField, granularity) : fieldValue(row, xField);
    if (!label) return;
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(metricField === 'recordCount' ? 1 : row?.[metricField]);
  });
  return sortAxisLabels(Array.from(grouped.keys()), rows, xField).map((label) => ({
    label,
    count: aggregateValues(grouped.get(label) || [], metricField === 'recordCount' ? 'count' : aggregation),
    unit: metricField === 'recordCount' ? 'records' : 'value',
  }));
}

export function buildGroupedBarChartData(rows = [], xField = 'year', groupBy = 'sourcePerson', topN = 10, metricField = 'recordCount', aggregation = 'count', startYear, endYear, categorySelection = {}) {
  const granularity = getPeriodGranularity(startYear, endYear);
  const groupValues = new Map();
  const groupedValues = new Map();
  const xLabels = new Set();

  rows.forEach((row) => {
    const xLabel = isDerivedDateAxisField(xField) ? dateLabelForRow(row, xField, granularity) : fieldValue(row, xField);
    const group = fieldValue(row, groupBy);
    if (!xLabel || !group) return;
    const rawValue = metricField === 'recordCount' ? 1 : row?.[metricField];
    xLabels.add(xLabel);
    if (!groupValues.has(group)) groupValues.set(group, []);
    groupValues.get(group).push(rawValue);
    if (!groupedValues.has(xLabel)) groupedValues.set(xLabel, new Map());
    const inner = groupedValues.get(xLabel);
    if (!Array.isArray(inner.get(group))) inner.set(group, []);
    inner.get(group).push(rawValue);
  });

  const rankingAggregation = metricField === 'recordCount' ? 'count' : aggregation;
  const groupTotals = new Map(
    Array.from(groupValues.entries()).map(([label, values]) => [
      label,
      aggregateForRanking(values, metricField, rankingAggregation),
    ]),
  );
  const { selectedLabels, omittedLabels, includeOther, includeTotal } = resolveSelectedCategoryLabels(groupTotals, topN, categorySelection);
  const otherLabel = omittedLabels.length && includeOther ? getRemainingCategoryLabel(groupValues.keys()) : null;
  const totalLabel = includeTotal ? 'Dataset total' : null;
  const series = [
    ...selectedLabels,
    ...(otherLabel ? [otherLabel] : []),
    ...(totalLabel ? [totalLabel] : []),
  ];

  const data = sortAxisLabels(Array.from(xLabels), rows, xField).map((label) => {
    const groups = selectedLabels.map((seriesLabel) => ({
      label: seriesLabel,
      count: aggregateValues(groupedValues.get(label)?.get(seriesLabel) || [], rankingAggregation),
      unit: unitForMetric(metricField),
    }));

    if (otherLabel) {
      groups.push({
        label: otherLabel,
        count: aggregateValues(collectNestedOtherValues(groupedValues, label, omittedLabels), rankingAggregation),
        unit: unitForMetric(metricField),
      });
    }

    if (totalLabel) {
      groups.push({
        label: totalLabel,
        count: aggregateValues(collectNestedRowTotalValues(groupedValues, label), rankingAggregation),
        unit: unitForMetric(metricField),
      });
    }

    return { label, groups };
  });

  return { granularity, series, data };
}

export function buildStackedBarChartData(rows = [], xField = 'year', segmentBy = 'sourcePerson', topN = 10, metricField = 'recordCount', aggregation = 'count', startYear, endYear, categorySelection = {}) {
  const additiveAggregation = additiveAggregationFor(metricField);
  const granularity = getPeriodGranularity(startYear, endYear);
  const segmentTotals = new Map();
  const groupedValues = new Map();
  const xLabels = new Set();

  rows.forEach((row) => {
    const xLabel = isDerivedDateAxisField(xField) ? dateLabelForRow(row, xField, granularity) : fieldValue(row, xField);
    const segment = fieldValue(row, segmentBy);
    if (!xLabel || !segment) return;

    const rawValue = metricField === 'recordCount' ? 1 : row?.[metricField];
    xLabels.add(xLabel);
    segmentTotals.set(segment, (segmentTotals.get(segment) || 0) + aggregateValues([rawValue], additiveAggregation));

    if (!groupedValues.has(xLabel)) groupedValues.set(xLabel, new Map());
    const inner = groupedValues.get(xLabel);
    if (!Array.isArray(inner.get(segment))) inner.set(segment, []);
    inner.get(segment).push(rawValue);
  });

  const { selectedLabels, omittedLabels, includeOther, mode } = resolveSelectedCategoryLabels(segmentTotals, topN, categorySelection);
  const selectedSet = new Set(selectedLabels);
  const hiddenSegments = mode === 'manual'
    ? omittedLabels
    : Array.from(segmentTotals.keys()).filter((label) => !selectedSet.has(label));
  const otherLabel = hiddenSegments.length && (includeOther || mode !== 'manual') ? getRemainingCategoryLabel(segmentTotals.keys()) : null;
  const series = otherLabel ? [...selectedLabels, otherLabel] : selectedLabels;

  const data = sortAxisLabels(Array.from(xLabels), rows, xField).map((label) => {
    const rowSegmentValues = groupedValues.get(label) || new Map();
    const segments = selectedLabels.map((segmentLabel) => ({
      label: segmentLabel,
      count: aggregateValues(rowSegmentValues.get(segmentLabel) || [], additiveAggregation),
      unit: unitForMetric(metricField),
    }));

    if (otherLabel) {
      const otherValues = [];
      hiddenSegments.forEach((segmentLabel) => addAllValues(otherValues, rowSegmentValues.get(segmentLabel) || []));
      segments.push({
        label: otherLabel,
        count: aggregateValues(otherValues, additiveAggregation),
        unit: unitForMetric(metricField),
      });
    }

    return {
      label,
      segments,
      total: segments.reduce((sum, segment) => sum + segment.count, 0),
    };
  });

  return { granularity, series, data };
}


export function buildMultiLineChartData(rows = [], xField = 'year', seriesMode = 'wide', seriesFields = [], groupBy = 'sourcePerson', metricField = 'recordCount', aggregation = 'average', topN = 10, startYear, endYear, categorySelection = {}) {
  const granularity = getPeriodGranularity(startYear, endYear);
  const xLabels = new Set();
  const resolvedGroupBy = seriesMode === 'wide' ? groupBy : resolveSeriesGroupingField(rows, groupBy, xField);
  const xLabelForRow = (row) => isDerivedDateAxisField(xField) ? dateLabelForRow(row, xField, granularity) : fieldValue(row, xField);

  if (seriesMode === 'wide') {
    const series = seriesFields.slice(0, clampLimit(topN)).map((field) => {
      const grouped = new Map();
      rows.forEach((row) => {
        const label = xLabelForRow(row);
        const value = row?.[field.key || field];
        if (!label || parseNumber(value) === null) return;
        xLabels.add(label);
        if (!grouped.has(label)) grouped.set(label, []);
        grouped.get(label).push(value);
      });
      return { label: field.label || humanizeFieldLabel(field.key || field), grouped };
    });
    const sortedLabels = sortAxisLabels(Array.from(xLabels), rows, xField);
    return {
      granularity,
      periods: sortedLabels,
      series: series.map((item) => ({
        label: item.label,
        points: sortedLabels.map((label) => ({ label, count: aggregatePoint(item.grouped.get(label) || [], 'value', aggregation, null), unit: 'value' })),
      })),
    };
  }

  const groupValues = new Map();
  const groupedValues = new Map();
  rows.forEach((row) => {
    const xLabel = xLabelForRow(row);
    const group = fieldValue(row, resolvedGroupBy);
    if (!xLabel || !group) return;
    const rawValue = metricField === 'recordCount' ? 1 : row?.[metricField];
    xLabels.add(xLabel);
    if (!groupValues.has(group)) groupValues.set(group, []);
    groupValues.get(group).push(rawValue);
    if (!groupedValues.has(group)) groupedValues.set(group, new Map());
    const inner = groupedValues.get(group);
    if (!Array.isArray(inner.get(xLabel))) inner.set(xLabel, []);
    inner.get(xLabel).push(rawValue);
  });

  const pointAggregation = metricField === 'recordCount' ? 'count' : aggregation;
  const totals = new Map(
    Array.from(groupValues.entries()).map(([label, values]) => [
      label,
      aggregateForRanking(values, metricField, pointAggregation),
    ]),
  );
  const { selectedLabels, omittedLabels, includeOther, includeTotal } = resolveSelectedCategoryLabels(totals, topN, categorySelection);
  const otherLabel = omittedLabels.length && includeOther ? getRemainingCategoryLabel(groupValues.keys()) : null;
  const totalLabel = includeTotal ? 'Dataset total' : null;
  const sortedLabels = sortAxisLabels(Array.from(xLabels), rows, xField);
  const series = selectedLabels.map((label) => ({
    label,
    points: sortedLabels.map((xLabel) => ({
      label: xLabel,
      count: aggregatePoint(groupedValues.get(label)?.get(xLabel) || [], metricField, pointAggregation, metricField === 'recordCount' ? 0 : null),
      unit: unitForMetric(metricField),
    })),
  }));

  if (otherLabel) {
    series.push({
      label: otherLabel,
      points: sortedLabels.map((xLabel) => ({
        label: xLabel,
        count: aggregatePoint(collectSeriesOtherValues(groupedValues, omittedLabels, xLabel), metricField, pointAggregation, metricField === 'recordCount' ? 0 : null),
        unit: unitForMetric(metricField),
      })),
    });
  }

  if (totalLabel) {
    series.push({
      label: totalLabel,
      points: sortedLabels.map((xLabel) => ({
        label: xLabel,
        count: aggregatePoint(collectSeriesTotalValues(groupedValues, xLabel), metricField, pointAggregation, metricField === 'recordCount' ? 0 : null),
        unit: unitForMetric(metricField),
      })),
    });
  }

  return { granularity, periods: sortedLabels, series };
}

export function buildHeatmapChartData(rows = [], rowField = 'sourcePerson', columnField = 'targetPerson', topN = 10, metricField = 'recordCount', aggregation = 'count', categorySelection = {}) {
  const rowValues = new Map();
  const columnValues = new Map();
  const matrix = new Map();
  rows.forEach((row) => {
    const rowLabel = fieldValue(row, rowField);
    const columnLabel = fieldValue(row, columnField);
    if (!rowLabel || !columnLabel) return;
    const rawValue = metricField === 'recordCount' ? 1 : row?.[metricField];
    if (!rowValues.has(rowLabel)) rowValues.set(rowLabel, []);
    if (!columnValues.has(columnLabel)) columnValues.set(columnLabel, []);
    rowValues.get(rowLabel).push(rawValue);
    columnValues.get(columnLabel).push(rawValue);
    if (!matrix.has(rowLabel)) matrix.set(rowLabel, new Map());
    const inner = matrix.get(rowLabel);
    if (!Array.isArray(inner.get(columnLabel))) inner.set(columnLabel, []);
    inner.get(columnLabel).push(rawValue);
  });
  const rowTotals = new Map(
    Array.from(rowValues.entries()).map(([label, values]) => [
      label,
      aggregateForRanking(values, metricField, metricField === 'recordCount' ? 'count' : aggregation),
    ]),
  );
  const columnTotals = new Map(
    Array.from(columnValues.entries()).map(([label, values]) => [
      label,
      aggregateForRanking(values, metricField, metricField === 'recordCount' ? 'count' : aggregation),
    ]),
  );
  const { selectedLabels: selectedRows, omittedLabels: omittedRows, includeOther: includeOtherRows, includeTotal: includeTotalRows, mode: rowSelectionMode } = resolveSelectedCategoryLabels(rowTotals, topN, categorySelection);
  const rowLabels = rowSelectionMode === 'manual' ? selectedRows : topKeysByTotal(rowTotals, topN);
  const hiddenRows = rowSelectionMode === 'manual' ? omittedRows : [];
  const visibleRowLabels = [
    ...rowLabels,
    ...(hiddenRows.length && includeOtherRows ? [getRemainingCategoryLabel(rowTotals.keys())] : []),
    ...(includeTotalRows ? ['Dataset total'] : []),
  ];
  const columnLabels = topKeysByTotal(columnTotals, topN);
  const cells = [];
  visibleRowLabels.forEach((rowLabel) => {
    columnLabels.forEach((columnLabel) => {
      let values = matrix.get(rowLabel)?.get(columnLabel) || [];
      if (rowLabel === 'Dataset total') {
        values = [];
        Array.from(matrix.values()).forEach((columnMap) => addAllValues(values, columnMap.get(columnLabel) || []));
      } else if (hiddenRows.length && rowLabel === getRemainingCategoryLabel(rowTotals.keys())) {
        values = [];
        hiddenRows.forEach((hiddenRowLabel) => addAllValues(values, matrix.get(hiddenRowLabel)?.get(columnLabel) || []));
      }
      cells.push({ rowLabel, columnLabel, count: aggregatePoint(values, metricField, metricField === 'recordCount' ? 'count' : aggregation, 0), unit: unitForMetric(metricField) });
    });
  });
  return { rows: visibleRowLabels, columns: columnLabels, cells };
}

export function buildHistogramChartData(rows = [], valueField = 'recordCount', groupBy = 'sourcePerson', categorySelection = {}) {
  const values = valueField === 'recordCount'
    ? buildBarChartData(rows, groupBy, 100000, 'recordCount', 'count', categorySelection).filter((item) => item.label !== 'Dataset total').map((item) => item.count).filter((value) => Number.isFinite(value))
    : rows.map((row) => parseNumber(row?.[valueField])).filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{
      label: String(Math.round(min * 100) / 100),
      count: values.length,
      unit: valueField === 'recordCount' ? 'categories' : 'records',
    }];
  }

  const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(values.length))));
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + width * index;
    const end = index === binCount - 1 ? max : min + width * (index + 1);
    return {
      label: `${Math.round(start * 100) / 100}–${Math.round(end * 100) / 100}`,
      min: start,
      max: end,
      count: 0,
    };
  });

  values.forEach((value) => {
    const index = value === max ? binCount - 1 : Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / width)));
    bins[index].count += 1;
  });

  return bins.map(({ label, count }) => ({ label, count, unit: valueField === 'recordCount' ? 'categories' : 'records' }));
}

export function buildSunburstChartData(rows = [], parentBy = 'sourceLoc', childBy = 'sourcePerson', topN = 10, metricField = 'recordCount', aggregation = 'count', categorySelection = {}) {
  const additiveAggregation = additiveAggregationFor(metricField);
  const parentValues = new Map();
  const childValues = new Map();

  rows.forEach((row) => {
    const parent = fieldValue(row, parentBy);
    const child = fieldValue(row, childBy);
    if (!parent || !child) return;
    const rawValue = metricField === 'recordCount' ? 1 : row?.[metricField];

    if (!parentValues.has(parent)) parentValues.set(parent, []);
    parentValues.get(parent).push(rawValue);

    if (!childValues.has(parent)) childValues.set(parent, new Map());
    const children = childValues.get(parent);
    if (!children.has(child)) children.set(child, []);
    children.get(child).push(rawValue);
  });

  const parentTotals = new Map(
    Array.from(parentValues.entries()).map(([label, values]) => [
      label,
      aggregateValues(values, additiveAggregation),
    ]),
  );

  const { selectedLabels: selectedParentLabels, omittedLabels: omittedParentLabels, includeOther, mode: parentSelectionMode } = resolveSelectedCategoryLabels(parentTotals, topN, categorySelection);
  const selectedParentSet = new Set(selectedParentLabels);
  const hiddenParentLabels = parentSelectionMode === 'manual'
    ? omittedParentLabels
    : Array.from(parentTotals.keys()).filter((label) => !selectedParentSet.has(label));

  const parents = selectedParentLabels.map((parentLabel) => {
    const childMap = childValues.get(parentLabel) || new Map();
    const childTotals = new Map(
      Array.from(childMap.entries()).map(([label, values]) => [label, aggregateValues(values, additiveAggregation)]),
    );
    const selectedChildLabels = topKeysByTotal(childTotals, topN);
    const selectedChildSet = new Set(selectedChildLabels);
    const omittedChildLabels = Array.from(childMap.keys()).filter((label) => !selectedChildSet.has(label));
    const children = selectedChildLabels.map((label) => ({
      label,
      count: childTotals.get(label) || 0,
      unit: unitForMetric(metricField),
    }));

    if (omittedChildLabels.length) {
      const otherValues = [];
      omittedChildLabels.forEach((label) => addAllValues(otherValues, childMap.get(label) || []));
      const otherCount = aggregateValues(otherValues, additiveAggregation);
      if (otherCount) {
        children.push({
          label: getRemainingCategoryLabel(childMap.keys()),
          count: otherCount,
          unit: unitForMetric(metricField),
        });
      }
    }

    return { label: parentLabel, count: parentTotals.get(parentLabel) || 0, unit: unitForMetric(metricField), children };
  });

  if (hiddenParentLabels.length && (includeOther || parentSelectionMode !== 'manual')) {
    const omittedCount = hiddenParentLabels.reduce((sum, label) => sum + (parentTotals.get(label) || 0), 0);
    if (omittedCount) {
      parents.push({
        label: getRemainingCategoryLabel(parentTotals.keys()),
        count: omittedCount,
        unit: unitForMetric(metricField),
        children: [{ label: 'Other', count: omittedCount, unit: unitForMetric(metricField) }],
      });
    }
  }

  return { total: Array.from(parentTotals.values()).reduce((sum, count) => sum + count, 0), parents };
}

/**
 * Build the chart-ready payload consumed by `AnalyticsChartPreview`.
 *
 * Extension contract:
 * - Every chartType returned here must have a corresponding renderer branch in
 *   `analyticsChartComponents.jsx`.
 * - Every chartType that needs user choices should have matching controls in
 *   `AnalyticsPanel.jsx`.
 * - Keep this function focused on shaping already-filtered rows into chart data;
 *   global Search/Filter scope, timeline playback scope, and export behavior are
 *   owned by higher-level workspaces.
 */
export function buildAnalyticsChartData({
  rows = [],
  chartType = 'bar',
  xField = 'year',
  yField = 'recordCount',
  aggregation = 'count',
  barGroupBy = 'sourcePerson',
  barOrientation = 'vertical',
  lineFilterBy = 'sourcePerson',
  pieGroupBy = 'language',
  histogramValueField = 'recordCount',
  histogramGroupBy = 'sourcePerson',
  stackSegmentBy = 'sourcePerson',
  groupedBarGroupBy = 'sourcePerson',
  heatmapRowBy = 'sourcePerson',
  heatmapColumnBy = 'targetPerson',
  multiLineMode = 'wide',
  multiLineGroupBy = 'sourcePerson',
  multiLineSeriesFields = [],
  sunburstParentBy = 'sourceLoc',
  sunburstChildBy = 'sourcePerson',
  topN = 10,
  categorySelection = {},
  startYear,
  endYear,
} = {}) {
  const filteredRows = filterRowsByAnalyticsDateRange(rows, startYear, endYear);
  const rangeSuffix = startYear && endYear ? ` Selected range: ${Math.min(startYear, endYear)}–${Math.max(startYear, endYear)}.` : '';
  const effectiveAggregation = effectiveAggregationForChart(chartType, yField, aggregation);
  const metricLabel = metricLabelFor(yField, effectiveAggregation);
  const additiveAggregation = additiveAggregationFor(yField);
  const additiveMetricLabel = metricLabelFor(yField, additiveAggregation);

  if (chartType === 'line') {
    const lineRows = filterRowsByManualCategorySelection(filteredRows, lineFilterBy, categorySelection);
    const data = buildLineChartData(lineRows, xField, yField, effectiveAggregation, startYear, endYear);
    const selectionSuffix = normalizeCategorySelection(categorySelection).mode === 'manual' && categorySelection?.values?.length
      ? ` Filtered by ${humanizeFieldLabel(lineFilterBy)}.`
      : '';
    return { chartType: 'line', title: `${humanizeFieldLabel(yField)} by ${humanizeFieldLabel(xField)}`, subtitle: `${metricLabel} by selected x-axis.${selectionSuffix}${rangeSuffix}`, xLabel: humanizeFieldLabel(xField), yLabel: humanizeFieldLabel(yField), data };
  }
  if (chartType === 'pie') {
    const data = buildPartToWholeChartData(filteredRows, pieGroupBy, topN, yField, categorySelection);
    return {
      chartType: 'pie',
      title: `${humanizeFieldLabel(pieGroupBy)} share`,
      subtitle: `${additiveMetricLabel} grouped by selected category.${rangeSuffix}`,
      methodNote: `Measure: ${methodMetricLabelFor(yField, additiveAggregation)}`,
      data,
    };
  }
  if (chartType === 'histogram') {
    const valueField = histogramValueField || yField || 'recordCount';
    const data = buildHistogramChartData(filteredRows, valueField, histogramGroupBy, valueField === 'recordCount' ? categorySelection : {});
    if (valueField === 'recordCount') {
      return {
        chartType: 'histogram',
        title: `Distribution of record counts by ${humanizeFieldLabel(histogramGroupBy)}`,
        subtitle: `Binned counts of records per selected category.${rangeSuffix}`,
        xLabel: 'Record-count bin',
        yLabel: 'Category count',
        data,
      };
    }
    return {
      chartType: 'histogram',
      title: `Distribution of ${humanizeFieldLabel(valueField)}`,
      subtitle: `Binned numeric values from the selected field.${rangeSuffix}`,
      xLabel: humanizeFieldLabel(valueField),
      yLabel: 'Record count',
      data,
    };
  }
  if (chartType === 'groupedBar') {
    const { series, data } = buildGroupedBarChartData(filteredRows, xField, groupedBarGroupBy, topN, yField, effectiveAggregation, startYear, endYear, categorySelection);
    return {
      chartType: 'groupedBar',
      title: `${humanizeFieldLabel(groupedBarGroupBy)} by ${humanizeFieldLabel(xField)}`,
      subtitle: `Side-by-side groups using ${metricLabel}.${rangeSuffix}`,
      xLabel: humanizeFieldLabel(xField),
      yLabel: methodMetricLabelFor(yField, effectiveAggregation),
      series,
      data,
    };
  }
  if (chartType === 'stackedBar') {
    const { series, data } = buildStackedBarChartData(filteredRows, xField, stackSegmentBy, topN, yField, additiveAggregation, startYear, endYear, categorySelection);
    return {
      chartType: 'stackedBar',
      title: `${humanizeFieldLabel(xField)} split by ${humanizeFieldLabel(stackSegmentBy)}`,
      subtitle: `Stacked segments using ${additiveMetricLabel}.${rangeSuffix}`,
      xLabel: humanizeFieldLabel(xField),
      yLabel: methodMetricLabelFor(yField, additiveAggregation),
      series,
      data,
    };
  }
  if (chartType === 'multiLine') {
    const data = buildMultiLineChartData(filteredRows, xField, multiLineMode, multiLineSeriesFields, multiLineGroupBy, yField, effectiveAggregation, topN, startYear, endYear, categorySelection);
    return {
      chartType: 'multiLine',
      title: `Trends by ${humanizeFieldLabel(xField)}`,
      subtitle: multiLineMode === 'wide'
        ? `Selected numeric columns shown as separate series.${rangeSuffix}`
        : `One line per ${humanizeFieldLabel(multiLineGroupBy)} using ${metricLabel}.${rangeSuffix}`,
      xLabel: humanizeFieldLabel(xField),
      yLabel: methodMetricLabelFor(yField, effectiveAggregation),
      ...data,
    };
  }
  if (chartType === 'heatmap') {
    const data = buildHeatmapChartData(filteredRows, heatmapRowBy, heatmapColumnBy, topN, yField, effectiveAggregation, categorySelection);
    return { chartType: 'heatmap', title: `${humanizeFieldLabel(heatmapRowBy)} × ${humanizeFieldLabel(heatmapColumnBy)}`, subtitle: `Matrix cells use ${metricLabel}.${rangeSuffix}`, ...data };
  }
  if (chartType === 'sunburst') {
    const data = buildSunburstChartData(filteredRows, sunburstParentBy, sunburstChildBy, topN, yField, additiveAggregation, categorySelection);
    return {
      chartType: 'sunburst',
      title: `${humanizeFieldLabel(sunburstParentBy)} → ${humanizeFieldLabel(sunburstChildBy)}`,
      subtitle: `Hierarchical part-to-whole view using ${additiveMetricLabel}.${rangeSuffix}`,
      methodNote: `Hierarchy: ${humanizeFieldLabel(sunburstParentBy)} → ${humanizeFieldLabel(sunburstChildBy)} · Measure: ${methodMetricLabelFor(yField, additiveAggregation)}`,
      ...data,
    };
  }
  const data = buildBarChartData(filteredRows, barGroupBy, topN, yField, effectiveAggregation, categorySelection);
  return {
    chartType: 'bar',
    orientation: barOrientation,
    title: `${humanizeFieldLabel(yField)} by ${humanizeFieldLabel(barGroupBy)}`,
    subtitle: `${metricLabel} grouped by selected category.${rangeSuffix}`,
    xLabel: humanizeFieldLabel(barGroupBy),
    yLabel: methodMetricLabelFor(yField, effectiveAggregation),
    data,
  };
}
