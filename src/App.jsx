/*
 * Explore-direct routing pass.
 *
 * Peridot application shell and orchestration boundary.
 * 
 * This file is intentionally the broadest file in the app. It owns the top-level React state that has to be shared across workspaces: loaded data, normalized rows, derived graph structures, timeline/playback state, Search & Filter draft/applied state, Inspector selection/history, theme tokens, export wiring, and workspace routing. Most visual surfaces are now delegated to extracted `Peridot*Workspace` and Inspector/map helper components, but this file remains the place where those surfaces are composed and where cross-workflow data dependencies are coordinated.
 * 
 * Important relationships:
 * - Data ingestion flows through `peridotCsv*`, `peridotColumnMapping`, and `peridotWorkbook*` helpers before becoming the active internal row/model state here.
 * - Visualization rendering is delegated to `PeridotVisualizationsWorkspace`, map-stage helpers, Analytics helpers, and Inspector components, but those consumers receive data derived here.
 * - Search & Filter defines the active filtered dataset; Timeline, Analytics, Inspector, and Export should consume that filtered scope rather than independently recomputing incompatible scopes.
 * - Inspector compact/full presentation is coordinated here so both modes share the same selection and history.
 * 
 * Maintenance cautions:
 * - Treat this as a fragile orchestration file. Prefer extracting pure helpers or UI boundaries rather than adding more long inline sections.
 * - Do not rename legacy side-panel compatibility props casually; they still protect Inspector auto-open behavior.
 * - When changing data shape, test Data upload, Search, Timeline, Analytics, Inspector, and Export together because each consumes derived state from this file.
 */

// Core React hooks used throughout the app.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoContains, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries50m from 'world-atlas/countries-50m.json';
import {
  buildClusteredNodes,
  buildDefaultMapView,
  buildVisibleLabelIds,
  parseQuadraticPath,
} from './mapLayoutHelpers';
import {
  buildNearbyCandidates,
  enrichSelectedLetters,
  resolveSelection,
} from './interactionHelpers';
import { buildMapInteractionHandlers } from './mapInteractionHandlers';
import {
  buildPlaybackRows,
  buildTimelineMonths,
  getAvailableTemporalRoles,
  getRowPrimaryTemporalDisplay,
  getRowTemporalDateParts,
  getRowTemporalSortKey,
  getRowTimelineCapability,
  getTimelineRangeSortBounds,
  PERIDOT_TIMELINE_PLAYBACK_MODES,
  filterRowsByTimelineWindow,
  filterRowsForPlayback,
} from './timelinePlaybackHelpers';
import { parsePeridotTemporalValue } from './peridotTemporalAssertions.js';
import { HoverCardOverlay, MapControlsOverlay, MapLegendOverlay, MapTitleBar } from './mapStageComponents';
import {
  buildExportEdgeRows,
  buildExportNodeRows,
  renderSvgElementToPngBlob,
  rowsToCsv,
  serializeSvgForExport,
  slugifyFilenamePart,
  makeDownloadUrl,
  revokeObjectUrl,
} from './exportHelpers';
import { buildForcePersonPositions } from './personForceLayoutHelpers';
import { derivePeridotEntityNetworkSemantics, derivePeridotGeographicEntityNetworkSemantics, getPeridotRowEntityParticipants, getPeridotRowEntityRelationshipLabels, getPeridotRowEntityRelationships } from './peridotEntityNetwork.js';
import { InspectorConnectedCorrespondents } from './InspectorConnectedCorrespondents';
import { InspectorPersonPlaces } from './InspectorPersonPlaces';
import { InspectorBackButton } from './InspectorBackButton';
import { InspectorContent } from './InspectorPanel.jsx';
import { PeridotRecordStructure } from './PeridotRecordStructure.jsx';
import { buildPeridotRecordStructure } from './peridotRecordStructure.js';
import { LeftControlPanel } from './LeftControlPanel';
import { PeridotHamburgerMenu } from './PeridotHamburgerMenu';
import { PeridotHomeWorkspace } from './PeridotHomeWorkspace';
import { PeridotDataWorkspace } from './PeridotDataWorkspace';
import { PeridotThemeWorkspace } from './PeridotThemeWorkspace';
import { PeridotVisualizationsWorkspace } from './PeridotVisualizationsWorkspace';
import { PeridotExploreWorkspace } from './PeridotExploreWorkspace';
import { PeridotLearnMoreWorkspace } from './PeridotLearnMoreWorkspace';
import { PeridotTutorial } from './PeridotTutorial';
import {
  getPeridotTutorialStep,
  PERIDOT_TUTORIAL_START_INDEX,
  PERIDOT_TUTORIAL_STEPS,
} from './peridotTutorialConfig.js';
import { PeridotSearchWorkspace } from './PeridotSearchWorkspace';
import { buildPeridotSearchRecords, rowMatchesSearchCapabilityFilter, rowMatchesSearchText, rowMatchesStructuredCriteria } from './peridotSearchResultHelpers.js';
import {
  DEFAULT_PERIDOT_WORKSPACE_MODE,
  PERIDOT_WORKSPACE_MODES,
  resolvePeridotWorkspaceMode,
} from './peridotWorkspaceConfig';
import { DEFAULT_ANALYTICS_STATE } from './analyticsConfig';
import { buildAnalyticsChartData, getAvailableAnalyticsFields } from './analyticsDerivationHelpers';
import { InspectorEmptyState as InspectorEmptyStateView } from './InspectorEmptyState';
import { InspectorClusterView as InspectorClusterViewView } from './InspectorClusterView';
import { InspectorEdgeView as InspectorEdgeViewView } from './InspectorEdgeView';
import { InspectorNodeView as InspectorNodeViewView } from './InspectorNodeView';
import { PERIDOT_TEMPLATE_COLUMNS } from './peridotCsvSchema.js';
import { buildPeridotCanonicalRuntimeModel } from './peridotCanonicalRuntimeModel.js';
import { buildPeridotGenealogyRuntimeModel } from './peridotGenealogyRuntimeModel.js';
import { buildPeridotCsvValidationSummary } from './peridotCsvValidation.js';
import { buildInitialPeridotColumnMappingState } from './peridotColumnMapping.js';
import { applyPeridotGeneralizedColumnMapping } from './peridotGeneralizedMappingRuntime.js';
import { parsePeridotTableFile, summarizePeridotWorkbook } from './peridotWorkbookParsing.js';
import { buildInitialPeridotWorkbookMappingState, buildPeridotRowsFromWorkbookMapping, validatePeridotWorkbookMapping } from './peridotWorkbookMapping.js';
import { PeridotColumnMappingModal } from './PeridotColumnMappingModal.jsx';
import {
  DEFAULT_PERIDOT_DATASET_PROFILE_ID,
  getPeridotDatasetProfile,
  isPeridotCorrespondenceProfile,
  isPeridotGenealogyProfile,
  resolvePeridotDatasetProfileId,
} from './peridotDatasetProfiles.js';
import { PERIDOT_APP_THEME_DEFAULTS, PERIDOT_MAP_STYLE_PRESETS } from './peridotTheme.js';
import {
  PERIDOT_SAMPLE_DATASETS,
  getPeridotSampleDataset,
  getPeridotSampleDatasetUrl,
} from './peridotSampleDatasets.js';

// Inspector presentation modes are introduced as inert state first.
// Later passes will wire these values into compact side-panel and full-workspace routing.
const INSPECTOR_PRESENTATION_MODES = Object.freeze({
  CLOSED: 'closed',
  COMPACT: 'compact',
  WORKSPACE: 'workspace',
  EMPTY_WORKSPACE: 'empty-workspace',
});

// ============================================================
// DATA INGESTION HELPERS
// ============================================================
// Everything below this heading is about taking uploaded text tables and
// turning them into reliable JavaScript objects the app can use.
//
// Full-world basemap configuration.

// Low-level CSV/TSV line parser that respects quoted fields.
function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

// Full CSV/TSV parser that preserves quoted commas and multiline quoted values.
function parseCsv(csvText) {
  const text = String(csvText ?? '')
    .replace(/^\ufeff/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
  if (!text) return [];

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) lines.push(current);
  if (!lines.length) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map((cell) => cell.trim());

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

function detectDelimitedTableFormat(csvText) {
  const text = String(csvText ?? '')
    .replace(/^\ufeff/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
  if (!text) return { delimiter: ',', label: 'CSV' };

  let headerLine = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      headerLine += char;
      if (inQuotes && next === '"') {
        headerLine += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) break;
    headerLine += char;
  }

  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  return { delimiter, label: delimiter === '\t' ? 'TSV' : 'CSV' };
}

function getCsvHeaders(csvText) {
  const text = String(csvText ?? '')
    .replace(/^\ufeff/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
  if (!text) return [];

  let headerLine = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      headerLine += char;
      if (inQuotes && next === '"') {
        headerLine += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) break;
    headerLine += char;
  }

  const { delimiter } = detectDelimitedTableFormat(text);
  return parseDelimitedLine(headerLine, delimiter).map((cell) => cell.trim());
}


// Basic text normalization helpers.
function asText(value) {
  return String(value ?? '').trim();
}

function normalizeHeaderName(header) {
  return asText(header)
    .replace(/^ï»¿/, '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getFieldValue(row, candidateHeaders) {
  for (const header of candidateHeaders) {
    if (header in row && asText(row[header]) !== '') return row[header];
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeaderName(key), value]);
  for (const header of candidateHeaders) {
    const normalizedCandidate = normalizeHeaderName(header);
    const match = normalizedEntries.find(([normalizedKey, value]) => normalizedKey === normalizedCandidate && asText(value) !== '');
    if (match) return match[1];
  }

  return '';
}

function asNumber(value) {
  const cleaned = asText(value);
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'unknown') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function validCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon);
}

function makePlaceKey(label, lat, lon) {
  return `${label}__${lat}__${lon}`;
}

// Canonical temporal projection for the old direct geography/linked-record input
// path. Even compatibility inputs now enter active consumers through canonical
// temporal assertions; no independent parsed-date object is maintained.
function buildCanonicalTemporalState(rawValue, role = 'Date') {
  return {
    temporalAssertions: [parsePeridotTemporalValue(rawValue, { role })],
  };
}

// ============================================================
// HEADER ALIAS MAPS
// ============================================================
// These alias lists are the app's translation dictionaries.
// They let a user upload spreadsheets whose column names vary slightly
// while still mapping those columns into the internal schema.
//
// Keeping these lists centralized makes later maintenance safer:
// if a new spreadsheet uses a slightly different header name, the change
// can usually be made here without touching the rest of the logic.
const GEOGRAPHY_HEADER_ALIASES = {
  date: ['Date*', 'Date'],
  sourceLoc: ['Source_Loc', 'Source Loc', 'Source Location', 'Source Place', 'From_Loc', 'From Location', 'From Place'],
  sourceLat: ['Source_Lat', 'Source Latitude', 'Source Lat', 'Source_Latitude', 'SourceLatitude', 'Source_Y', 'From_Lat', 'From Latitude', 'From Lat'],
  sourceLon: ['Source_Long', 'Source Longitude', 'Source Lon', 'Source Lng', 'Source_Longitude', 'SourceLongitude', 'Source_X', 'From_Long', 'From Longitude', 'From Lon', 'From Lng'],
  sourcePerson: ['Source', 'Sender', 'From', 'Source_Name', 'Source Name'],
  targetPerson: ['Target', 'Recipient', 'To', 'Target_Name', 'Target Name'],
  targetLoc: ['Target_Inferred_Loc', 'Target_Inferred_Location', 'Target Loc', 'Target Location', 'Target Place', 'Target_Inferred Location', 'Target Inferred Loc', 'Target Inferred Location', 'Recipient_Loc', 'Recipient Location', 'Recipient Place', 'To_Loc', 'To Location', 'To Place'],
  targetLat: ['Target_Lat', 'Target Latitude', 'Target Lat', 'Target_Latitude', 'TargetLatitude', 'Target_Y', 'Target_Inferred_Lat', 'Target_Inferred_Latitude', 'Target Inferred Lat', 'Target Inferred Latitude', 'Recipient_Lat', 'Recipient Latitude', 'Recipient Lat', 'To_Lat', 'To Latitude', 'To Lat'],
  targetLon: ['Target_Long', 'Target Longitude', 'Target Lon', 'Target Lng', 'Target_Longitude', 'TargetLongitude', 'Target_X', 'Target_Inferred_Long', 'Target_Inferred_Longitude', 'Target Inferred Long', 'Target Inferred Longitude', 'Target_Inferred_Lng', 'Recipient_Long', 'Recipient Longitude', 'Recipient Lon', 'Recipient Lng', 'To_Long', 'To Longitude', 'To Lon', 'To Lng'],
};

const LETTER_HEADER_ALIASES = {
  source: ['Source', 'Sender', 'From'],
  target: ['Target', 'Recipient', 'To'],
  archivalCollection: ['Archival Collection', 'Archival Collection ', 'Collection', 'Archive Collection'],
  archivalPage: ['Archival Page (r/v)', 'Archival Page', 'Archival Page r/v'],
  pdfPage: ['PDF Page', 'Pdf Page', 'PDF_Page'],
  date: ['Date*', 'Date'],
  sourceLoc: ['Source_Loc', 'Source Loc', 'Source Location'],
  sourceTitle: ['Source_Title', 'Source Title'],
  targetTitle: ['Target_Title', 'Target Title'],
  relationship: ['Relationship', 'Relation'],
  cipher: ['Cipher?', 'Cipher'],
  topic: ['Topic', 'Subject'],
  language: ['Language', 'Lang'],
  transcription: ['Transcription', 'Transcript'],
  translation: ['Rough Translation', 'Translation'],
  notes: ['Notes', 'Note'],
};

const PERSON_METADATA_HEADER_ALIASES = {
  person: ['Person', 'Name', 'Person Name'],
  wikiEn: ['Wiki_EN', 'Wiki EN', 'English Wikipedia', 'Wikipedia_EN', 'Wikipedia EN'],
  wikiIt: ['Wiki_IT', 'Wiki IT', 'Italian Wikipedia', 'Wikipedia_IT', 'Wikipedia IT'],
  treccani: ['Treccani'],
  imageCreativeCommons: ['Image_CreativeCommons', 'Image CreativeCommons', 'Creative Commons Image', 'Creative Commons', 'Image'],
};

// Geography-table normalization: maps uploaded headers into the internal route schema.
function normalizeGeographyRows(rows) {
  const cleaned = rows.map((row) => {
    const date = asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.date));
    return {
    date,
    ...buildCanonicalTemporalState(date),
    sourceLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLoc)),
    sourceLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLat)),
    sourceLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLon)),
    sourcePerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourcePerson)),
    sourcePoliticalHint: extractPoliticalHintFromRow(row, 'source'),
    targetPerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetPerson)),
    targetLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLoc)),
    targetLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLat)),
    targetLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLon)),
    targetPoliticalHint: extractPoliticalHintFromRow(row, 'target'),
    };
  });

  const placeMap = new Map();

  const addPlace = (label, lat, lon, roleHint, politicalHint = '') => {
    if (!label || !validCoord(lat, lon) || (lat === 0 && lon === 0)) return null;
    const key = makePlaceKey(label, lat, lon);
    if (!placeMap.has(key)) {
      placeMap.set(key, {
        id: key,
        label,
        lat,
        lon,
        type: 'place',
        roleHint,
        politicalHints: mergePoliticalHint([], politicalHint),
      });
    } else if (politicalHint) {
      const existing = placeMap.get(key);
      existing.politicalHints = mergePoliticalHint(existing.politicalHints, politicalHint);
    }
    return key;
  };

  const normalizedRows = cleaned.map((row, idx) => {
    const sourcePlaceId = addPlace(row.sourceLoc, row.sourceLat, row.sourceLon, 'source', row.sourcePoliticalHint);
    const targetPlaceId = addPlace(row.targetLoc, row.targetLat, row.targetLon, 'target', row.targetPoliticalHint);
    return {
      id: `geo_${idx + 1}`,
      ...row,
      sourcePlaceId,
      targetPlaceId,
      mappable: Boolean(sourcePlaceId && targetPlaceId),
    };
  });
  return { normalizedRows, places: Array.from(placeMap.values()) };
}

// Raw linked-record normalization: maps uploaded headers into the inspector schema.
// Terminology note: many internal helpers below still use legacy `letter` names
// because the Inspector began as a correspondence dossier. User-facing copy should
// say linked records where possible; internal identifiers should wait for a
// deliberate Inspector/data-model refactor.
function normalizeLettersRows(rows) {
  return rows.map((row, idx) => {
    const source = asText(getFieldValue(row, LETTER_HEADER_ALIASES.source));
    const target = asText(getFieldValue(row, LETTER_HEADER_ALIASES.target));
    const date = asText(getFieldValue(row, LETTER_HEADER_ALIASES.date));
    return {
      id: `letter_${idx + 1}`,
      archivalCollection: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalCollection)),
      archivalPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalPage)),
      pdfPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.pdfPage)),
      date,
      ...buildCanonicalTemporalState(date),
      sourceLoc: asText(getFieldValue(row, LETTER_HEADER_ALIASES.sourceLoc)),
      source,
      sourceTitle: asText(getFieldValue(row, LETTER_HEADER_ALIASES.sourceTitle)),
      target,
      targetTitle: asText(getFieldValue(row, LETTER_HEADER_ALIASES.targetTitle)),
      relationship: asText(getFieldValue(row, LETTER_HEADER_ALIASES.relationship)),
      cipher: asText(getFieldValue(row, LETTER_HEADER_ALIASES.cipher)),
      topic: asText(getFieldValue(row, LETTER_HEADER_ALIASES.topic)),
      language: asText(getFieldValue(row, LETTER_HEADER_ALIASES.language)),
      transcription: asText(getFieldValue(row, LETTER_HEADER_ALIASES.transcription)),
      translation: asText(getFieldValue(row, LETTER_HEADER_ALIASES.translation)),
      notes: asText(getFieldValue(row, LETTER_HEADER_ALIASES.notes)),
      personKey: `${source}-->${target}`,
    };
  });
}

// Person metadata joins by exact person-name match only.
// This is intentional for this prototype: no fuzzy matching, no silent
// normalization, and no guessed identity merges.
function normalizePersonMetadataRows(rows) {
  return rows
    .map((row, idx) => ({
      id: `person_meta_${idx + 1}`,
      person: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.person)),
      wikiEn: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.wikiEn)),
      wikiIt: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.wikiIt)),
      treccani: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.treccani)),
      imageCreativeCommons: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.imageCreativeCommons)),
    }))
    .filter((row) => row.person);
}

// ============================================================
// EDGE AGGREGATION HELPERS
// ============================================================
// These helpers break aggregation into three clearer steps:
// 1. collect raw geographic rows into route buckets
// 2. index letter rows by person-to-person key
// 3. build final edge records used by the map and inspector
function buildEdgeBuckets(rows) {
  const edgeMap = new Map();

  for (const row of rows) {
    if (!row.mappable) continue;
    const key = `${row.sourcePlaceId}-->${row.targetPlaceId}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        id: key,
        sourcePlaceId: row.sourcePlaceId,
        targetPlaceId: row.targetPlaceId,
        dates: new Set(),
        monthKeys: new Set(),
        sources: new Set(),
        targets: new Set(),
        personKeys: new Set(),
        rows: [],
        count: 0,
      });
    }

    const bucket = edgeMap.get(key);
    bucket.count += 1;
    const temporalDisplay = getRowPrimaryTemporalDisplay(row);
    const temporalParts = getRowTemporalDateParts(row);
    if (temporalDisplay) bucket.dates.add(temporalDisplay);
    if (temporalParts?.year) bucket.monthKeys.add(String(temporalParts.year));
    if (row.sourcePerson) bucket.sources.add(row.sourcePerson);
    if (row.targetPerson) bucket.targets.add(row.targetPerson);
    bucket.personKeys.add(`${row.sourcePerson}-->${row.targetPerson}`);
    bucket.rows.push(row);
  }

  return edgeMap;
}

function buildLettersByPersonKey(letters) {
  const lettersByPersonKey = new Map();
  for (const letter of letters) {
    if (!lettersByPersonKey.has(letter.personKey)) lettersByPersonKey.set(letter.personKey, []);
    lettersByPersonKey.get(letter.personKey).push(letter);
  }
  return lettersByPersonKey;
}

function finalizeAggregatedEdges(edgeMap, lettersByPersonKey) {
  return Array.from(edgeMap.values()).map((edge) => {
    const samplePairs = edge.rows.map((d) => `${d.sourcePerson} → ${d.targetPerson}`);
    const matches = new Map();

    edge.personKeys.forEach((personKey) => {
      (lettersByPersonKey.get(personKey) || []).forEach((letter) => {
        matches.set(letter.id, letter);
      });
    });

    const matchingLetters = Array.from(matches.values()).sort((a, b) => {
      const aDate = getRowTemporalSortKey(a) ?? Number.MAX_SAFE_INTEGER;
      const bDate = getRowTemporalSortKey(b) ?? Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return a.source.localeCompare(b.source);
    });

    return {
      ...edge,
      dates: Array.from(edge.dates),
      monthKeys: Array.from(edge.monthKeys).sort(),
      sources: Array.from(edge.sources),
      targets: Array.from(edge.targets),
      samplePairs: Array.from(new Set(samplePairs)).slice(0, 8),
      letterMetadata: matchingLetters,
    };
  });
}

// Geographic aggregation: turns normalized rows into weighted place-to-place route edges.
function aggregateEdgesFromRows(rows, letters) {
  const edgeMap = buildEdgeBuckets(rows);
  const lettersByPersonKey = buildLettersByPersonKey(letters);
  return finalizeAggregatedEdges(edgeMap, lettersByPersonKey);
}

// ============================================================
// GRAPH + PROJECTION HELPERS
// ============================================================
// These helpers convert normalized data into map-ready structures.
// Basemap projection helpers.
function createWorldProjection(width, height) {
  return geoNaturalEarth1()
    .fitExtent(
      [
        [24, 24],
        [width - 24, height - 24],
      ],
      { type: 'Sphere' }
    );
}

function projectToSvg(lon, lat, width, height) {
  const projection = createWorldProjection(width, height);
  const point = projection([lon, lat]);
  if (!point) return { x: width / 2, y: height / 2 };
  return { x: point[0], y: point[1] };
}


const POLITICAL_HINT_TOKENS = ['country', 'state', 'nation', 'region', 'territory'];

function normalizePoliticalKey(value) {
  return asText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractPoliticalHintFromRow(row, role) {
  const roleTokens = role === 'source' ? ['source', 'from', 'sender'] : ['target', 'to', 'recipient'];
  const otherRoleTokens = role === 'source' ? ['target', 'to', 'recipient'] : ['source', 'from', 'sender'];
  const exactMatches = [];
  const genericMatches = [];

  Object.entries(row || {}).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || '').toLowerCase();
    if (!POLITICAL_HINT_TOKENS.some((token) => key.includes(token))) return;

    const value = asText(rawValue);
    if (!value) return;

    const matchesRole = roleTokens.some((token) => key.includes(token));
    const matchesOtherRole = otherRoleTokens.some((token) => key.includes(token));

    if (matchesRole) {
      exactMatches.push(value);
    } else if (!matchesOtherRole) {
      genericMatches.push(value);
    }
  });

  return exactMatches[0] || genericMatches[0] || '';
}

function mergePoliticalHint(existingHints, nextHint) {
  const merged = new Set(existingHints || []);
  const normalized = normalizePoliticalKey(nextHint);
  if (normalized) merged.add(normalized);
  return Array.from(merged);
}

function extractPoliticalHintsFromNode(node) {
  const hints = new Set(Array.isArray(node.politicalHints) ? node.politicalHints : []);
  Object.entries(node || {}).forEach(([key, value]) => {
    const lower = String(key || '').toLowerCase();
    if (!POLITICAL_HINT_TOKENS.some((token) => lower.includes(token))) return;
    const normalized = normalizePoliticalKey(value);
    if (normalized) hints.add(normalized);
  });
  return Array.from(hints);
}

// Decorative water labels for the historical-map treatment.
// These are intentionally centralized so future design iterations can
// easily adjust wording, placement, or which oceans are shown.
// Use `lines` for stacked two-line labels while keeping the text horizontal.
const MAP_WATER_LABELS = [
  { id: 'atlantic-ocean', lines: ['Atlantic', 'Ocean'], lon: -43, lat: 29.5, size: 12 },
  { id: 'pacific-ocean-east', lines: ['Pacific', 'Ocean'], lon: -155, lat: 8, size: 12 },
  { id: 'pacific-ocean-west', lines: ['Pacific', 'Ocean'], lon: 138, lat: 19, size: 12 },
  { id: 'indian-ocean', lines: ['Indian', 'Ocean'], lon: 79, lat: -23, size: 12 },
  { id: 'arctic-ocean', lines: ['Arctic Ocean'], lon: 20, lat: 88, size: 11 },
  { id: 'southern-ocean', lines: ['Southern', 'Ocean'], lon: 25, lat: -58, size: 11 },
];

function curvedPath(a, b, bend = 0.16) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = midX + nx * len * bend;
  const cy = midY + ny * len * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function createAdaptiveNodeRadiusScale(values, minRadius, maxRadius, contrastPower = 1.35) {
  const sortedValues = values
    .map((value) => Number(value) || 0)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sortedValues.length) {
    return () => minRadius;
  }

  const minValue = sortedValues[0];
  const maxValue = sortedValues[sortedValues.length - 1];

  if (minValue === maxValue) {
    return () => minRadius;
  }

  const logDenominator = Math.log1p(maxValue - minValue);

  return (value) => {
    const safeValue = Math.max(0, Number(value) || 0);
    if (safeValue <= minValue) {
      return minRadius;
    }

    const normalized = Math.min(1, Math.log1p(safeValue - minValue) / logDenominator);
    const contrasted = Math.pow(normalized, contrastPower);
    return minRadius + contrasted * (maxRadius - minRadius);
  };
}

// Geographic graph builder: projected place nodes plus curved route paths.
function buildGraph(places, aggregatedEdges, width, height) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const edgeCountsByPlaceId = new Map();

  aggregatedEdges.forEach((edge) => {
    edgeCountsByPlaceId.set(edge.sourcePlaceId, (edgeCountsByPlaceId.get(edge.sourcePlaceId) || 0) + edge.count);
    edgeCountsByPlaceId.set(edge.targetPlaceId, (edgeCountsByPlaceId.get(edge.targetPlaceId) || 0) + edge.count);
  });

  const nodeDrafts = places.map((place) => {
    const projected = projectToSvg(place.lon, place.lat, width, height);
    const degree = edgeCountsByPlaceId.get(place.id) || 0;
    return {
      ...place,
      x: projected.x,
      y: projected.y,
      degree,
    };
  });

  const radiusForDegree = createAdaptiveNodeRadiusScale(
    nodeDrafts.map((node) => node.degree),
    5,
    32
  );

  const nodes = nodeDrafts.map((node) => ({
    ...node,
    radius: radiusForDegree(node.degree),
  }));

  const edges = aggregatedEdges
    .map((edge) => {
      const source = placeById.get(edge.sourcePlaceId);
      const target = placeById.get(edge.targetPlaceId);
      if (!source || !target) return null;
      const a = projectToSvg(source.lon, source.lat, width, height);
      const b = projectToSvg(target.lon, target.lat, width, height);
      return {
        ...edge,
        sourceLabel: source.label,
        targetLabel: target.label,
        path: curvedPath(a, b),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        width: Math.max(0.4, Math.min(3.1, 0.4 + Math.pow(edge.count, 0.72) * 0.34)),
      };
    })
    .filter(Boolean);

  return { nodes, edges, edgeCountsByPlaceId };
}

function computePersonEdgeWidth(count) {
  return Math.max(0.6, Math.min(4.2, 0.6 + Math.pow(count, 0.72) * 0.42));
}

// Person-network graph builder shared by geographic and force-directed layouts.
// Relationship semantics are derived in peridotEntityNetwork.js so layout no
// longer determines (or reconstructs) what the user's relationships mean.
function buildPersonGraph(rows, width, height, layoutMode, minCount = 1, searchQuery = '', semanticOptions = null) {
  const personMap = new Map();
  const { relationships, locations } = layoutMode === 'geographic' && semanticOptions
    ? derivePeridotGeographicEntityNetworkSemantics(semanticOptions.relationshipRows, semanticOptions.locationRows)
    : derivePeridotEntityNetworkSemantics(rows);

  const relationshipPersonKey = (relationship, side) => (
    side === 'source'
      ? (relationship.sourceId || relationship.source)
      : (relationship.targetId || relationship.target)
  );

  relationships.forEach((relationship) => {
    [
      { key: relationshipPersonKey(relationship, 'source'), label: relationship.source, entityId: relationship.sourceId || '' },
      { key: relationshipPersonKey(relationship, 'target'), label: relationship.target, entityId: relationship.targetId || '' },
    ].forEach((person) => {
      if (!person.key) return;
      if (!personMap.has(person.key)) {
        personMap.set(person.key, {
          id: person.key,
          entityId: person.entityId,
          label: person.label || person.key,
          appearances: 0,
          locationCounts: new Map(),
        });
      }
      personMap.get(person.key).appearances += relationship.count;
    });
  });

  locations.forEach((location) => {
    const personKey = location.personId || location.person;
    if (!personKey) return;
    if (!personMap.has(personKey)) {
      personMap.set(personKey, {
        id: personKey,
        entityId: location.personId || '',
        label: location.person || personKey,
        appearances: 0,
        locationCounts: new Map(),
      });
    }
    const key = `${location.label}__${location.latitude}__${location.longitude}`;
    const personRecord = personMap.get(personKey);
    personRecord.locationCounts.set(key, (personRecord.locationCounts.get(key) || 0) + 1);
  });

  const q = searchQuery.trim().toLowerCase();
  const filteredEdgeRecords = relationships.filter((edge) => {
    if (edge.count < minCount) return false;
    if (!q) return true;
    const haystack = [
      edge.source,
      edge.target,
      edge.relationshipType,
      edge.relationshipLabel,
      edge.sourceRole,
      edge.targetRole,
      ...(edge.dates || []),
      ...edge.rows.flatMap((row) => [row?.sourceLoc, row?.targetLoc, row?.sourcePerson, row?.targetPerson]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const peopleInUse = new Set();
  filteredEdgeRecords.forEach((edge) => {
    peopleInUse.add(edge.sourceId || edge.source);
    peopleInUse.add(edge.targetId || edge.target);
  });

  let people = Array.from(personMap.values())
    .filter((person) => peopleInUse.has(person.id))
    .map((person) => {
      let x = width / 2;
      let y = height / 2;
      let anchorLabel = '';
      let isMappable = true;

      if (layoutMode === 'geographic') {
        if (!person.locationCounts.size) {
          isMappable = false;
        } else {
          const best = Array.from(person.locationCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
          const [label, lat, lon] = best.split('__');
          const projected = projectToSvg(Number(lon), Number(lat), width, height);
          x = projected.x;
          y = projected.y;
          anchorLabel = label;
        }
      }

      return {
        ...person,
        x,
        y,
        anchorLabel,
        isMappable,
        degree: 0,
        radius: 6,
      };
    });

  if (layoutMode === 'geographic') {
    people = people.filter((person) => person.isMappable);
  }

  let personById = new Map(people.map((p) => [p.id, p]));

  filteredEdgeRecords.forEach((edge) => {
    const source = personById.get(edge.sourceId || edge.source);
    const target = personById.get(edge.targetId || edge.target);
    if (!source || !target) return;
    source.degree += edge.count;
    target.degree += edge.count;
  });

  const radiusForPersonDegree = createAdaptiveNodeRadiusScale(
    people.map((person) => person.degree),
    5.5,
    34
  );

  people.forEach((person) => {
    person.radius = radiusForPersonDegree(person.degree);
  });

  if (layoutMode === 'force') {
    const settledPositions = buildForcePersonPositions({
      nodes: people,
      links: filteredEdgeRecords.map((edge) => ({
        source: edge.sourceId || edge.source,
        target: edge.targetId || edge.target,
        count: edge.count,
      })),
      width,
      height,
    });

    const settledById = new Map(settledPositions.map((node) => [node.id, node]));

    people = people.map((person) => {
      const settled = settledById.get(person.id);
      if (!settled) return person;
      return {
        ...person,
        x: settled.x,
        y: settled.y,
      };
    });

    personById = new Map(people.map((p) => [p.id, p]));
  }

  const edges = filteredEdgeRecords
    .map((edge) => {
      const source = personById.get(edge.sourceId || edge.source);
      const target = personById.get(edge.targetId || edge.target);
      if (!source || !target) return null;
      const directionalGlyph = edge.direction === 'directed' ? '→' : '—';
      return {
        ...edge,
        sourceLabel: source.label,
        targetLabel: target.label,
        sourceEntityId: edge.sourceId || source.entityId || '',
        targetEntityId: edge.targetId || target.entityId || '',
        sourceNodeId: source.id,
        targetNodeId: target.id,
        path: curvedPath({ x: source.x, y: source.y }, { x: target.x, y: target.y }, layoutMode === 'geographic' ? 0.12 : 0.22),
        width: computePersonEdgeWidth(edge.count),
        letterMetadata: edge.rows,
        samplePairs: [`${edge.source} ${directionalGlyph} ${edge.target}`],
        sources: [edge.source],
        targets: [edge.target],
        dates: edge.dates || [],
      };
    })
    .filter(Boolean);

  return { nodes: people, edges };
}

function normalizeFilterTerm(value) {
  return String(value ?? '').trim().toLowerCase();
}

function matchesFilterTerm(values, filterTerm) {
  const q = normalizeFilterTerm(filterTerm);
  if (!q) return true;

  return values
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(q));
}

function filterRowsBySearchAndEntity(rows, {
  searchQuery = '',
  personQuery = '',
  placeQuery = '',
  routePlaceQuery = '',
  routePeopleQuery = '',
    capabilityFilters = [],
    structuredCriteria = [],
} = {}) {
  const q = normalizeFilterTerm(searchQuery);
  const personQ = normalizeFilterTerm(personQuery);
  const placeQ = normalizeFilterTerm(placeQuery);
  const routePlaceQ = normalizeFilterTerm(routePlaceQuery);
  const routePeopleQ = normalizeFilterTerm(routePeopleQuery);
  const activeCapabilityFilters = Array.isArray(capabilityFilters) ? capabilityFilters.filter(Boolean) : [];
  const activeStructuredCriteria = Array.isArray(structuredCriteria) ? structuredCriteria : [];

  if (!q && !personQ && !placeQ && !routePlaceQ && !routePeopleQ && !activeCapabilityFilters.length && !activeStructuredCriteria.length) {
    return rows;
  }

  return rows.filter((row) => {
    const placeRouteLabel = [row.sourceLoc, row.targetLoc].filter(Boolean).join(' → ');
    const networkParticipants = getPeridotRowEntityParticipants(row);
    const networkRelationshipLabels = getPeridotRowEntityRelationshipLabels(row);
    const placeRouteSearchText = [
      placeRouteLabel,
      [row.sourceLoc, row.targetLoc].filter(Boolean).join(' to '),
      row.sourceLoc,
      row.targetLoc,
    ];
    const peopleRouteSearchText = [
      ...networkRelationshipLabels,
      ...networkRelationshipLabels.map((label) => label.replace(/→|—/g, ' to ')),
      ...networkParticipants,
    ];

    if (activeStructuredCriteria.length && !rowMatchesStructuredCriteria(row, activeStructuredCriteria)) {
      return false;
    }

    if (activeCapabilityFilters.length && !activeCapabilityFilters.every((filterId) => rowMatchesSearchCapabilityFilter(row, filterId))) {
      return false;
    }

    if (personQ && !matchesFilterTerm(networkParticipants, personQ)) {
      return false;
    }

    if (placeQ && !matchesFilterTerm([row.sourceLoc, row.targetLoc], placeQ)) {
      return false;
    }

    if (routePlaceQ && !matchesFilterTerm(placeRouteSearchText, routePlaceQ)) {
      return false;
    }

    if (routePeopleQ && !matchesFilterTerm(peopleRouteSearchText, routePeopleQ)) {
      return false;
    }

    if (!q) {
      return true;
    }

    return rowMatchesSearchText(row, q);
  });
}


function buildSearchFilterSuggestions(rows) {
  const people = new Set();
  const places = new Set();
  const placeRoutes = new Set();
  const peopleRoutes = new Set();

  rows.forEach((row) => {
    getPeridotRowEntityParticipants(row).forEach((value) => {
      const label = asText(value);
      if (label) people.add(label);
    });

    [row.sourceLoc, row.targetLoc].forEach((value) => {
      const label = asText(value);
      if (label) places.add(label);
    });

    const sourcePlace = asText(row.sourceLoc);
    const targetPlace = asText(row.targetLoc);
    if (sourcePlace && targetPlace) {
      placeRoutes.add(`${sourcePlace} → ${targetPlace}`);
    }

    getPeridotRowEntityRelationshipLabels(row).forEach((label) => {
      if (label) peopleRoutes.add(label);
    });
  });

  return {
    people: Array.from(people).sort((a, b) => a.localeCompare(b)),
    places: Array.from(places).sort((a, b) => a.localeCompare(b)),
    placeRoutes: Array.from(placeRoutes).sort((a, b) => a.localeCompare(b)),
    peopleRoutes: Array.from(peopleRoutes).sort((a, b) => a.localeCompare(b)),
  };
}


function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}


// -----------------------------
// Theme system
// -----------------------------
// Major interface and map style defaults are now sourced from the semantic
// palette system. Keeping these aliases preserves existing App.jsx behavior
// while making palette/image-import edits flow through `peridotTheme.js`.
const THEME_DEFAULTS = PERIDOT_APP_THEME_DEFAULTS;
const MAP_STYLE_PRESETS = PERIDOT_MAP_STYLE_PRESETS;

// ============================================================
// SHARED STYLE HELPERS + SMALL UI BUILDING BLOCKS
// ============================================================
// These functions do not hold core project data logic.
// They exist to keep repeated styling and small reusable UI pieces in
// one place so the large app component below stays more readable.
//
// Small inspector row component used throughout the right-hand panel.
function museumShellClassName() {
  return 'h-screen w-full bg-[var(--shell-bg)] text-[var(--text-main)]';
}

function sidebarSurfaceClassName() {
  return 'relative overflow-visible border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-sm transition-all duration-300';
}


function floatingCardClassName() {
  return 'rounded-2xl border border-[var(--floating-border)] bg-[var(--floating-bg)] text-[var(--text-main)] shadow-[0_18px_40px_var(--peridot-role-card-shadow)] backdrop-blur';
}

function panelHeadingClassName() {
  return 'text-[32px] font-bold leading-tight tracking-[-0.02em] text-[var(--heading-text)]';
}


function serifHeadingClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] tracking-[-0.02em] text-[var(--heading-text)]';
}


// Reusable summary/diagnostic stat tile.
// Use this whenever a section needs the same small card pattern:
// muted label on top, large value below.

// Reusable linked-record card used in both node and edge inspector views.
// Internal component names still use linked-letter terminology for compatibility
// with the current Inspector path; user-facing labels should say linked records.
// This keeps the record summary, expandable long-text sections, and metadata
// display consistent no matter how the user reached the inspector.
function normalizeLinkedLetterCustomInspectorFields(letter) {
  const fields = Array.isArray(letter?.customInspectorFields) ? letter.customInspectorFields : [];

  return fields
    .map((field) => {
      const label = String(field?.label || field?.sourceColumn || field?.key || '').trim();
      const value = field?.value ?? '';
      const displayValue = String(value ?? '').trim();

      return {
        label,
        value: displayValue,
      };
    })
    .filter((field) => field.label && field.value);
}

function getLinkedLetterUniqueId(letter, fallbackIndex = 0) {
  const originalRow = letter?.originalTemplateRow || {};
  const uploadedRow = letter?.originalUploadedRow || {};
  const sheetRows = uploadedRow?.sheetRows || {};
  const firstSheetRow = Object.values(sheetRows)[0] || {};

  const candidates = [
    letter?.Letter_ID,
    letter?.letterId,
    letter?.letterID,
    letter?.recordId,
    letter?.id,
    originalRow?.Letter_ID,
    originalRow?.['Letter ID'],
    originalRow?.letter_id,
    originalRow?.ID,
    originalRow?.id,
    uploadedRow?.Letter_ID,
    uploadedRow?.['Letter ID'],
    uploadedRow?.letter_id,
    uploadedRow?.primaryId,
    firstSheetRow?.Letter_ID,
    firstSheetRow?.['Letter ID'],
    firstSheetRow?.letter_id,
    firstSheetRow?.ID,
    firstSheetRow?.id,
  ];

  const found = candidates.map((value) => String(value ?? '').trim()).find(Boolean);
  return found || `Record ${fallbackIndex + 1}`;
}

function DetailFieldList({ rows }) {
  const visibleRows = rows.filter((row) => {
    const value = row?.value;
    return value !== null && value !== undefined && String(value).trim() !== '';
  });

  if (!visibleRows.length) return null;

  return (
    <div className="divide-y divide-[var(--section-border)]/70 rounded-xl border border-[var(--section-border)]/70 bg-[var(--section-bg)]/70 px-3">
      {visibleRows.map((row) => {
        const isLinkedValue = typeof row.onClick === 'function';

        return (
          <div key={row.label} className="py-2 first:pt-2 last:pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--detail-label-text)]">
              {row.label}
            </div>
            {isLinkedValue ? (
              <button
                type="button"
                onClick={row.onClick}
                className="mt-1 inline-flex max-w-full rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] px-2.5 py-1.5 text-left text-sm font-medium text-[var(--button-text)] transition hover:border-[var(--button-hover-border)] hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
              >
                <span className="break-words">{row.value}</span>
              </button>
            ) : (
              <div className="mt-0.5 break-words text-sm text-[var(--panel-card-text)]">
                {row.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CustomInspectorFieldsBlock({ fields }) {
  if (!fields?.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-[var(--section-border)]/70 bg-[var(--section-bg)]/70 p-3">
      <div className="font-semibold uppercase tracking-[0.14em] text-[11px] text-[var(--panel-card-muted-text)]">
        User-selected fields
      </div>
      <div className="mt-2 divide-y divide-[var(--section-border)]/70">
        {fields.map((field, index) => (
          <div key={`${field.label}:${index}`} className="py-1.5 first:pt-0 last:pb-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--detail-label-text)]">
              {field.label}
            </div>
            <div className="mt-0.5 break-words text-sm text-[var(--panel-card-text)]">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getLinkedRecordDateLabel(letter) {
  return getRowPrimaryTemporalDisplay(letter) || 'undated';
}

function getLinkedRecordSortKey(letter, fallbackIndex = 0) {
  const canonicalSortKey = getRowTemporalSortKey(letter);
  if (Number.isFinite(canonicalSortKey)) return canonicalSortKey;
  return Number.MAX_SAFE_INTEGER - 100000 + fallbackIndex;
}

function sortLinkedRecordsChronologically(records = []) {
  return records
    .map((letter, index) => ({ letter, index, sortKey: getLinkedRecordSortKey(letter, index) }))
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      const aLabel = getLinkedRecordEntityLabel(a.letter);
      const bLabel = getLinkedRecordEntityLabel(b.letter);
      return aLabel.localeCompare(bLabel) || a.index - b.index;
    })
    .map((item) => item.letter);
}

function getLinkedRecordEntityLabel(letter) {
  const structure = buildPeridotRecordStructure(letter || {});
  const values = structure.participants
    .map((entry) => entry.label ? `${entry.label}: ${entry.value}` : entry.value)
    .filter(Boolean);
  return values.join(' · ') || letter?.entity || letter?.person || letter?.personName || letter?.name || letter?.label || 'No entity recorded';
}

function getLinkedRecordLocationLabel(letter) {
  const structure = buildPeridotRecordStructure(letter || {});
  const values = structure.places
    .map((entry) => entry.label ? `${entry.label}: ${entry.value}` : entry.value)
    .filter(Boolean);
  return values.join(' · ') || 'No place recorded';
}

function getLinkedRecordRelationshipLabel(letter) {
  const structure = buildPeridotRecordStructure(letter || {});
  return structure.relationships
    .map((entry) => `${entry.label}: ${entry.value}`)
    .filter(Boolean)
    .join(' · ');
}

function normalizeLinkedRecordTableEvidenceFields(letter) {
  const generalized = Array.isArray(letter?.generalizedObservation?.evidenceFields)
    ? letter.generalizedObservation.evidenceFields
    : [];
  const combined = [
    ...generalized.map((field) => ({
      label: String(field?.label || field?.sourceColumn || '').trim(),
      value: String(field?.value ?? '').trim(),
    })),
    ...normalizeLinkedLetterCustomInspectorFields(letter),
  ].filter((field) => field.label && field.value);

  const seen = new Set();
  return combined.filter((field) => {
    const key = field.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLinkedRecordCustomFieldValue(letter, label) {
  const normalizedLabel = String(label || '').trim().toLowerCase();
  if (!normalizedLabel) return '';

  return normalizeLinkedRecordTableEvidenceFields(letter)
    .find((field) => String(field.label || '').trim().toLowerCase() === normalizedLabel)
    ?.value || '';
}

function getLinkedRecordColumnValue(letter, columnKey, fallbackIndex = 0) {
  if (columnKey === 'date') return getLinkedRecordDateLabel(letter);
  if (columnKey === 'entities') return getLinkedRecordEntityLabel(letter);
  if (columnKey === 'places') return getLinkedRecordLocationLabel(letter);
  if (columnKey === 'relationships') return getLinkedRecordRelationshipLabel(letter);
  if (columnKey.startsWith('custom:')) return getLinkedRecordCustomFieldValue(letter, columnKey.slice('custom:'.length));
  if (columnKey === 'record') return getLinkedLetterUniqueId(letter, fallbackIndex);
  return '';
}

function buildConnectedRecordColumns(records = []) {
  const customLabels = [];
  const seen = new Set();

  records.forEach((letter) => {
    normalizeLinkedRecordTableEvidenceFields(letter).forEach((field) => {
      const label = String(field.label || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      customLabels.push(label);
    });
  });

  return [
    { key: 'date', label: 'Date / period', className: 'min-w-[8rem] w-[9rem]' },
    { key: 'entities', label: 'People / entities', className: 'min-w-[18rem]' },
    { key: 'places', label: 'Places', className: 'min-w-[14rem]' },
    { key: 'relationships', label: 'Relationships', className: 'min-w-[18rem]' },
    ...customLabels.map((label) => ({
      key: `custom:${label}`,
      label,
      className: 'min-w-[11rem]',
    })),
  ];
}

function getConnectedRecordSortValue(letter, columnKey, fallbackIndex = 0) {
  if (columnKey === 'date') return getLinkedRecordSortKey(letter, fallbackIndex);
  return getLinkedRecordColumnValue(letter, columnKey, fallbackIndex).toLowerCase();
}

function getConnectedRecordPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return sortedPages.reduce((items, page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) items.push('ellipsis');
    items.push(page);
    return items;
  }, []);
}

function LinkedLetterListItem({ letter, index, onOpenLetter }) {
  const uniqueId = getLinkedLetterUniqueId(letter, index);
  const entityLabel = getLinkedRecordEntityLabel(letter);
  const dateLabel = getLinkedRecordDateLabel(letter);
  const placeLabel = getLinkedRecordLocationLabel(letter);

  return (
    <button
      type="button"
      onClick={() => onOpenLetter(letter, index)}
      className="w-full rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] px-3 py-2 text-left text-sm text-[var(--button-text)] transition hover:border-[var(--button-hover-border)] hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
    >
      <div className="grid grid-cols-[minmax(5.8rem,0.24fr)_minmax(0,1fr)] gap-3">
        <div className="shrink-0 text-xs font-bold tabular-nums text-[var(--button-text)]">
          {dateLabel}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--button-text)]">
            {entityLabel}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--button-text)]/80">
            <span className="truncate">{placeLabel}</span>
            <span className="truncate">Record: {uniqueId}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function LinkedLetterDetailPage({ letter, index, onBack, onOpenPersonDetail, onOpenPlaceDetail }) {
  const uniqueId = getLinkedLetterUniqueId(letter, index);

  return (
    <div className="rounded-2xl border border-[var(--section-border)]/80 bg-[var(--section-bg)] p-4 shadow-[0_8px_24px_var(--peridot-role-card-shadow)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold uppercase tracking-[0.16em] text-[var(--panel-card-muted-text)]">
            Linked record detail
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--panel-card-text)]">{uniqueId}</div>
        </div>
        <button type="button" onClick={onBack} className={buttonClassName()}>
          Back to linked records
        </button>
      </div>

      <PeridotRecordStructure
        row={letter}
        onOpenPersonDetail={onOpenPersonDetail}
        onOpenPlaceDetail={onOpenPlaceDetail}
      />

    </div>
  );
}

function LinkedLetterCard({
  letter,
  index,
  onOpenLetter,
}) {
  return <LinkedLetterListItem letter={letter} index={index} onOpenLetter={onOpenLetter} />;
}

// Shared expand/collapse wrapper used throughout the side panels.
// This keeps section behavior consistent and makes future editing easier:
// title, optional header content, and expandable body all live in one place.


function buttonClassName({ active = false, variant = 'secondary' } = {}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--shell-bg)]';
  const variants = {
    primary: 'border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)] shadow-[0_8px_18px_var(--peridot-role-card-shadow)]',
    secondary: 'border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]',
    ghost: 'bg-transparent text-[var(--muted-text)] hover:bg-[var(--ghost-hover)] hover:text-[var(--text-main)]',
  };

  if (active) {
    return `${base} border border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)] shadow-[0_10px_22px_var(--peridot-role-card-shadow)] hover:bg-[var(--button-primary-active-hover)]`;
  }
  return `${base} ${variants[variant] || variants.secondary}`;
}

function edgeKeyFromRow(row) {
  return row?.mappable ? `${row.sourcePlaceId}-->${row.targetPlaceId}` : '';
}

// Sidebar toggle behavior:
// - when collapsed, Controls shows a cog and Inspector shows a hamburger/menu icon
// - when open, both become dark blue circular close buttons
function SidebarToggle({ side, open, onToggle }) {
  const left = side === 'left';
  const panelName = left ? 'Controls' : 'Inspector';

  const closedIcon = left ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M12 2.4c-.7 0-1.4.1-2 .3l-.7 2.2c-.5.2-1 .4-1.5.7l-2.1-.9c-1 .6-1.8 1.4-2.4 2.4l.9 2.1c-.3.5-.5 1-.7 1.5l-2.2.7c-.2.7-.3 1.3-.3 2s.1 1.4.3 2l2.2.7c.2.5.4 1 .7 1.5l-.9 2.1c.6 1 1.4 1.8 2.4 2.4l2.1-.9c.5.3 1 .5 1.5.7l.7 2.2c.7.2 1.3.3 2 .3s1.4-.1 2-.3l.7-2.2c.5-.2 1-.4 1.5-.7l2.1.9c1-.6 1.8-1.4 2.4-2.4l-.9-2.1c.3-.5.5-1 .7-1.5l2.2-.7c.2-.7.3-1.3.3-2s-.1-1.4-.3-2l-2.2-.7c-.2-.5-.4-1-.7-1.5l.9-2.1c-.6-1-1.4-1.8-2.4-2.4l-2.1.9c-.5-.3-1-.5-1.5-.7l-.7-2.2c-.6-.2-1.3-.3-2-.3Zm0 5.4a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 0 1 0-8.4Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15" />
      <path d="M4.5 12h15" />
      <path d="M4.5 17h15" />
    </svg>
  );

  const openIcon = (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'absolute top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_8px_20px_var(--peridot-role-card-shadow)] transition-all duration-150 hover:shadow-[0_12px_24px_var(--peridot-role-card-shadow)]',
        left ? 'right-3' : 'left-3',
        open
          ? 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]'
          : 'border-[var(--toggle-border)] bg-[var(--toggle-bg-open)] text-[var(--toggle-text)] hover:bg-[var(--utility-panel-bg)] hover:text-[var(--toggle-text-hover)]',
      ].join(' ')}
      aria-label={open ? `Collapse ${side} panel` : `Expand ${side} panel`}
      title={open ? `Hide ${panelName}` : `Show ${panelName}`}
    >
      <span className="sr-only">{open ? `Hide ${panelName}` : `Show ${panelName}`}</span>
      {open ? openIcon : closedIcon}
    </button>
  );
}

// Selection helpers.
// These centralize the logic that converts a lightweight remembered
// selection ({ kind, id }) into the full inspector-ready object.
// Keeping this outside the main app component reduces the risk of
// selection bugs when filtering, relayout, or clustering changes.
// Timeline and export helpers.
// These move date-window math and export shaping out of the main app
// component so the top-level React state reads more clearly.


function buildNodeHoverSummary(node, viewMode) {
  if (node.isCluster) {
    const singularLabel = viewMode === 'geographic' ? 'place' : 'person';
    const pluralLabel = viewMode === 'geographic' ? 'places' : 'people';
    return `${node.clusterSize} ${node.clusterSize === 1 ? singularLabel : pluralLabel}`;
  }

  return viewMode === 'geographic'
    ? `Weighted degree: ${node.degree}`
    : `Weighted connections: ${node.degree}`;
}

function buildHoverCardState(title, subtitle, point) {
  return {
    title,
    subtitle,
    x: point?.x ?? 24,
    y: point?.y ?? 24,
    clientX: point?.clientX ?? 0,
    clientY: point?.clientY ?? 0,
  };
}

function getLinkEndpointId(endpoint) {
  if (endpoint && typeof endpoint === 'object') {
    return String(endpoint.id ?? endpoint.label ?? '').trim();
  }

  return String(endpoint ?? '').trim();
}

function getNodeNetworkWeight(node) {
  const candidates = [
    node?.degree,
    node?.count,
    node?.weight,
    node?.recordCount,
    node?.radius,
  ];

  const numericValues = candidates
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return numericValues.length ? Math.max(...numericValues) : 1;
}

function averageWeightedNodePosition(weightedNodes, fallbackNode) {
  if (!weightedNodes.length) {
    return {
      x: fallbackNode?.x ?? 0,
      y: fallbackNode?.y ?? 0,
    };
  }

  const totals = weightedNodes.reduce(
    (acc, item) => {
      const x = Number(item.node?.x);
      const y = Number(item.node?.y);
      const weight = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1;

      if (!Number.isFinite(x) || !Number.isFinite(y)) return acc;

      return {
        x: acc.x + x * weight,
        y: acc.y + y * weight,
        weight: acc.weight + weight,
      };
    },
    { x: 0, y: 0, weight: 0 },
  );

  if (!totals.weight) {
    return {
      x: fallbackNode?.x ?? 0,
      y: fallbackNode?.y ?? 0,
    };
  }

  return {
    x: totals.x / totals.weight,
    y: totals.y / totals.weight,
  };
}

function buildDenseForceNetworkView(nodes = [], edges = [], width, height, clampScale) {
  if (!nodes.length || !width || !height) {
    return buildDefaultMapView(nodes, width, height, clampScale);
  }

  const positionedNodes = nodes.filter((node) => Number.isFinite(node?.x) && Number.isFinite(node?.y));
  if (!positionedNodes.length) {
    return buildDefaultMapView(nodes, width, height, clampScale);
  }

  const nodesById = new Map(positionedNodes.map((node) => [String(node.id), node]));
  const adjacency = new Map(positionedNodes.map((node) => [String(node.id), []]));

  edges.forEach((edge) => {
    const sourceId = getLinkEndpointId(edge?.source);
    const targetId = getLinkEndpointId(edge?.target);
    const source = nodesById.get(sourceId);
    const target = nodesById.get(targetId);

    if (!source || !target) return;

    const linkWeight = Math.max(1, Number(edge?.count) || Number(edge?.weight) || 1);
    adjacency.get(sourceId)?.push({ node: target, weight: linkWeight });
    adjacency.get(targetId)?.push({ node: source, weight: linkWeight });
  });

  const rankedNodes = positionedNodes
    .map((node) => {
      const nodeId = String(node.id);
      const nodeWeight = getNodeNetworkWeight(node);
      const neighbors = adjacency.get(nodeId) || [];
      const neighborScore = neighbors.reduce((sum, neighbor) => {
        return sum + neighbor.weight + getNodeNetworkWeight(neighbor.node) * 0.35;
      }, 0);

      return {
        node,
        score: nodeWeight * 1.8 + neighborScore + neighbors.length * 4,
      };
    })
    .sort((a, b) => b.score - a.score || String(a.node.label || a.node.id).localeCompare(String(b.node.label || b.node.id)));

  const anchorNode = rankedNodes[0]?.node || positionedNodes[0];
  const anchorId = String(anchorNode.id);
  const immediateNeighbors = [...(adjacency.get(anchorId) || [])]
    .sort((a, b) => {
      const aScore = a.weight + getNodeNetworkWeight(a.node);
      const bScore = b.weight + getNodeNetworkWeight(b.node);
      return bScore - aScore;
    })
    .slice(0, 14)
    .map((item) => item.node);

  const focusNodesById = new Map();
  [anchorNode, ...immediateNeighbors].forEach((node) => {
    if (node) focusNodesById.set(String(node.id), node);
  });

  rankedNodes.slice(0, 8).forEach(({ node }) => {
    if (focusNodesById.size < 9 && node) focusNodesById.set(String(node.id), node);
  });

  const focusNodes = Array.from(focusNodesById.values());
  const focusBounds = focusNodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x),
      maxX: Math.max(bounds.maxX, node.x),
      minY: Math.min(bounds.minY, node.y),
      maxY: Math.max(bounds.maxY, node.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  const boundsAreUsable = Number.isFinite(focusBounds.minX)
    && Number.isFinite(focusBounds.maxX)
    && Number.isFinite(focusBounds.minY)
    && Number.isFinite(focusBounds.maxY);

  const fullView = buildDefaultMapView(nodes, width, height, clampScale);
  const clusterSpanX = boundsAreUsable ? Math.max(1, focusBounds.maxX - focusBounds.minX) : width;
  const clusterSpanY = boundsAreUsable ? Math.max(1, focusBounds.maxY - focusBounds.minY) : height;
  const horizontalPadding = Math.max(120, width * 0.18);
  const verticalPadding = Math.max(96, height * 0.18);
  const candidateScale = Math.min(
    (width - horizontalPadding * 2) / clusterSpanX,
    (height - verticalPadding * 2) / clusterSpanY,
  );
  const fullScale = Number.isFinite(fullView.scale) && fullView.scale > 0 ? fullView.scale : 1;
  const scale = clampScale(Math.max(fullScale, Math.min(2.15, Math.max(0.9, candidateScale))));

  const weightedFocusNodes = [
    { node: anchorNode, weight: getNodeNetworkWeight(anchorNode) * 2.75 },
    ...immediateNeighbors.map((node) => ({ node, weight: getNodeNetworkWeight(node) })),
  ];
  const focusCenter = averageWeightedNodePosition(weightedFocusNodes, anchorNode);

  return {
    scale,
    tx: width / 2 - focusCenter.x * scale,
    ty: height / 2 - focusCenter.y * scale,
  };
}

function buildMapStageProps(args) {
  return {
    mapViewportRef: args.mapViewportRef,
    mapViewportSize: args.mapViewportSize,
    graph: args.graph,
    hoveredEdgeId: args.hoveredEdgeId,
    hoveredNodeId: args.hoveredNodeId,
    handleEdgeEnter: args.handleEdgeEnter,
    handleEdgeLeave: args.handleEdgeLeave,
    handleEdgeClick: args.handleEdgeClick,
    handleNodeHover: args.handleNodeHover,
    handleNodeLeave: args.handleNodeLeave,
    handleNodeClick: args.handleNodeClick,
    showLabels: args.showLabels,
    activeAnimationEdgeId: args.activeAnimationEdgeId,
    activeAnimationNodeIds: args.activeAnimationNodeIds,
    viewMode: args.viewMode,
    personLayoutMode: args.personLayoutMode,
    handleBlankMapClick: args.handleBlankMapClick,
    selectedProps: args.selectedProps,
    zoomTuning: args.zoomTuning,
    viewResetKey: args.viewResetKey,
    initialFocusStrategy: args.initialFocusStrategy,
    hoverCard: args.hoverCard,
  };
}

// CONTROL PANEL PROP STAGING AREA
// This function is the main bundling boundary for the left control panel.
// Why it matters:
// - It gathers top-level app state and setters into grouped prop buckets.
// - The LeftControlPanel subtree depends on this shape staying consistent.
// - Extraction attempts tend to fail when a child component expects a value
//   that was available in App.jsx scope but was not forwarded through here.
// Maintenance rule: when moving anything out of App.jsx, audit this function
// first and treat it as the authoritative contract for the control panel.
function buildLeftControlPanelProps(args) {
  return {
    sidebarState: {
      showLeftSidebar: args.showLeftSidebar,
      showRightSidebar: args.showRightSidebar,
      setShowLeftSidebar: args.setShowLeftSidebar,
      setShowRightSidebar: args.setShowRightSidebar,
      showDataInputsPanel: args.showDataInputsPanel,
      setShowDataInputsPanel: args.setShowDataInputsPanel,
      showVisualizationTypePanel: args.showVisualizationTypePanel,
      setShowVisualizationTypePanel: args.setShowVisualizationTypePanel,
      showDisplayControlsPanel: args.showDisplayControlsPanel,
      setShowDisplayControlsPanel: args.setShowDisplayControlsPanel,
      showTimelinePanel: args.showTimelinePanel,
      setShowTimelinePanel: args.setShowTimelinePanel,
      showExportPanel: args.showExportPanel,
      setShowExportPanel: args.setShowExportPanel,
      showSummaryPanel: args.showSummaryPanel,
      setShowSummaryPanel: args.setShowSummaryPanel,
      showThemePanel: args.showThemePanel,
      setShowThemePanel: args.setShowThemePanel,
    },
    dataInputState: {
      peridotFileLabel: args.peridotFileLabel,
      peridotValidationSummary: args.peridotValidationSummary,
      isPeridotValidationModalOpen: args.isPeridotValidationModalOpen,
      handlePeridotCsvUpload: args.handlePeridotCsvUpload,
      handleDownloadPeridotTemplate: args.handleDownloadPeridotTemplate,
      closePeridotValidationModal: args.closePeridotValidationModal,
      columnMappingStaging: args.columnMappingStaging,
      isColumnMappingModalOpen: args.isColumnMappingModalOpen,
      handleColumnMappingTableUpload: args.handleColumnMappingTableUpload,
      openColumnMappingModal: args.openColumnMappingModal,
      clearColumnMappingStaging: args.clearColumnMappingStaging,
      rowDiagnostics: args.rowDiagnostics,
    },
    displayState: {
      showLabels: args.showLabels,
      setShowLabels: args.setShowLabels,
      viewMode: args.viewMode,
      setViewMode: args.setViewMode,
      personLayoutMode: args.personLayoutMode,
      setPersonLayoutMode: args.setPersonLayoutMode,
      search: args.search,
      setSearch: args.setSearch,
      personFilter: args.personFilter,
      setPersonFilter: args.setPersonFilter,
      placeFilter: args.placeFilter,
      setPlaceFilter: args.setPlaceFilter,
      routePlaceFilter: args.routePlaceFilter,
      setRoutePlaceFilter: args.setRoutePlaceFilter,
      routePeopleFilter: args.routePeopleFilter,
      setRoutePeopleFilter: args.setRoutePeopleFilter,
      personSuggestions: args.searchFilterSuggestions?.people || [],
      placeSuggestions: args.searchFilterSuggestions?.places || [],
      routePlaceSuggestions: args.searchFilterSuggestions?.placeRoutes || [],
      routePeopleSuggestions: args.searchFilterSuggestions?.peopleRoutes || [],
      currentMinCountLabel: args.currentMinCountLabel,
      minCountOptions: args.minCountOptions,
      minCount: args.minCount,
      setMinCount: args.setMinCount,
    },
    timelineState: {
      timelineMode: args.timelineMode,
      setTimelineMode: args.setTimelineMode,
      currentRangeLabel: args.currentRangeLabel,
      timelineMonths: args.timelineMonths,
      rangeStart: args.rangeStart,
      setRangeStart: args.setRangeStart,
      rangeEnd: args.rangeEnd,
      setRangeEnd: args.setRangeEnd,
      currentPlaybackLabel: args.currentPlaybackLabel,
      currentPlaybackSpeedLabel: args.currentPlaybackSpeedLabel,
      playbackSpeedOptions: args.playbackSpeedOptions,
      playbackSpeed: args.playbackSpeed,
      setPlaybackSpeed: args.setPlaybackSpeed,
      isPlaying: args.isPlaying,
      setIsPlaying: args.setIsPlaying,
      playbackIndex: args.playbackIndex,
      setPlaybackIndex: args.setPlaybackIndex,
      selectedRowsForPlayback: args.selectedRowsForPlayback,
    },
    themeState: {
      applyThemePreset: args.applyThemePreset,
      resetTheme: args.resetTheme,
    },
    exportState: { handleExportSvg: args.handleExportSvg, handleExportPng: args.handleExportPng, handleExportEdgesCsv: args.handleExportEdgesCsv, handleExportNodesCsv: args.handleExportNodesCsv, graph: args.graph, exportStatus: args.exportStatus, }, analyticsState: { chartType: args.analyticsChartType, setChartType: args.setAnalyticsChartType, barGroupBy: args.analyticsBarGroupBy, setBarGroupBy: args.setAnalyticsBarGroupBy, topN: args.analyticsTopN, setTopN: args.setAnalyticsTopN, availableFields: args.analyticsFields, chartData: args.analyticsChartData, rows: args.analyticsRows, },
  };
}

function buildInspectorPanelProps(args) {
  return {
    sidebar: {
      showRightSidebar: args.showRightSidebar,
      setShowRightSidebar: args.setShowRightSidebar,
      setShowLeftSidebar: args.setShowLeftSidebar,
      showInspectorInfo: args.showInspectorInfo,
      setShowInspectorInfo: args.setShowInspectorInfo,
    },
    inspectorState: {
      selectedProps: args.selectedProps,
      selectedKind: args.selectedProps?.__kind || null,
      clearSelection: args.clearSelection,
      viewMode: args.viewMode,
      onOpenPersonDetail: args.onOpenPersonDetail,
      onOpenPlaceDetail: args.onOpenPlaceDetail,
      onOpenLetterDetail: args.onOpenLetterDetail,
      inspectorHistoryLength: args.inspectorHistoryLength,
      canGoBack: args.inspectorHistoryLength > 0,
      onBackInspector: args.onBackInspector,
      onCloseInspector: args.onCloseInspector,
      onExpandInspector: args.onExpandInspector,
    },
    letterState: {
      linkedLettersToShow: args.linkedLettersToShow,
      selectedLetterMetadata: args.selectedLetterMetadata,
      showAllLinkedLetters: args.showAllLinkedLetters,
      setShowAllLinkedLetters: args.setShowAllLinkedLetters,
      isLetterSectionExpanded: args.isLetterSectionExpanded,
      toggleLetterSection: args.toggleLetterSection,
    },
  };
}

// ============================================================
// MAIN MAP RENDERER
// ============================================================
// Main map renderer.
// Important sections inside this component:
// 1. viewport state
// 2. basemap and water labels
// 3. clustering and label visibility
// 4. edge rendering
// 5. node rendering
// 6. label rendering
// 7. map controls
function SvgMap({
  width,
  height,
  edges,
  nodes,
  hoveredEdgeId,
  hoveredNodeId,
  onEdgeEnter,
  onEdgeLeave,
  onEdgeClick,
  onNodeHover,
  onNodeLeave,
  onNodeClick,
  showLabels,
  activeAnimationEdgeId,
  activeAnimationNodeIds,
  clusterSingularLabel = 'place',
  clusterPluralLabel = 'places',
  showBasemap = true,
  showGeographicBackdrop = true,
  onBlankClick,
  selectedFeature,
  zoomTuning = {},
  viewResetKey = 'default',
  initialFocusStrategy = 'fit-all',
}) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragState, setDragState] = useState(null);
  const [basemapError, setBasemapError] = useState('');
  const animationFrameRef = useRef(null);
  const holdActionRef = useRef(null);
  const hasInitializedViewRef = useRef(false);
  const lastViewResetKeyRef = useRef('');
  const lastViewportSizeRef = useRef({ width: 0, height: 0 });

  const clampScale = (scale) => Math.max(0.6, Math.min(160, scale));
  const frame = { x: 20, y: 20, w: width - 40, h: height - 40 };

  const projection = useMemo(() => createWorldProjection(width, height), [width, height]);

  const defaultView = useMemo(() => {
    if (initialFocusStrategy === 'force-dense-cluster') {
      return buildDenseForceNetworkView(nodes, edges, width, height, clampScale);
    }

    return buildDefaultMapView(nodes, width, height, clampScale);
  }, [edges, initialFocusStrategy, nodes, width, height]);

  const basemapPathGenerator = useMemo(() => geoPath(projection), [projection]);

  const screenWaterLabels = useMemo(() => {
    return MAP_WATER_LABELS.map((item) => {
      const point = projectToSvg(item.lon, item.lat, width, height);
      return {
        ...item,
        x: point.x,
        y: point.y,
      };
    });
  }, [width, height]);
  const basemapFeatures = useMemo(() => {
    try {
      const collection = feature(countries50m, countries50m.objects.countries);
      const features = collection.features || [];
      return features
        .map((country, index) => {
          const matchKeys = new Set();
          [
            country.properties?.name,
            country.properties?.NAME,
            country.properties?.admin,
            country.properties?.name_long,
            country.properties?.formal_en,
            country.properties?.geounit,
            country.properties?.sovereignt,
          ].forEach((value) => {
            const normalized = normalizePoliticalKey(value);
            if (normalized) matchKeys.add(normalized);
          });

          return {
            id: country.id || country.properties?.name || index,
            d: basemapPathGenerator(country),
            geometry: country,
            matchKeys: Array.from(matchKeys),
          };
        })
        .filter((country) => country.d);
    } catch (error) {
      return [];
    }
  }, [basemapPathGenerator]);

  const activeCountryIds = useMemo(() => {
    if (!showGeographicBackdrop || !showBasemap || !basemapFeatures.length || !nodes.length) return new Set();

    const matchedIds = new Set();

    const findCountryByHint = (hint) => {
      return basemapFeatures.find((featureItem) => featureItem.matchKeys.includes(hint));
    };

    nodes.forEach((node) => {
      const hints = extractPoliticalHintsFromNode(node);
      const hintedCountry = hints.map(findCountryByHint).find(Boolean);
      if (hintedCountry) {
        matchedIds.add(hintedCountry.id);
        return;
      }

      if (typeof projection.invert !== 'function') return;
      const lonLat = projection.invert([node.x, node.y]);
      if (!lonLat || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) return;

      const containingCountry = basemapFeatures.find((featureItem) => geoContains(featureItem.geometry, lonLat));
      if (containingCountry) matchedIds.add(containingCountry.id);
    });

    return matchedIds;
  }, [basemapFeatures, nodes, projection, showBasemap, showGeographicBackdrop]);

  useEffect(() => {
    setBasemapError(basemapFeatures.length ? '' : 'Basemap unavailable');
  }, [basemapFeatures.length]);

  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    const shouldRecenter =
      !hasInitializedViewRef.current ||
      lastViewResetKeyRef.current !== viewResetKey;

    if (!shouldRecenter) return;

    setView(defaultView);
    hasInitializedViewRef.current = true;
    lastViewResetKeyRef.current = viewResetKey;
    lastViewportSizeRef.current = { width, height };
  }, [defaultView, nodes.length, viewResetKey, width, height]);

  useEffect(() => {
    const previous = lastViewportSizeRef.current;

    if (!width || !height) {
      lastViewportSizeRef.current = { width, height };
      return;
    }

    if (!hasInitializedViewRef.current || !previous.width || !previous.height) {
      lastViewportSizeRef.current = { width, height };
      return;
    }

    const deltaWidth = width - previous.width;
    const deltaHeight = height - previous.height;

    if (!deltaWidth && !deltaHeight) return;

    setView((prev) => ({
      ...prev,
      tx: prev.tx + deltaWidth / 2,
      ty: prev.ty + deltaHeight / 2,
    }));

    lastViewportSizeRef.current = { width, height };
  }, [width, height]);

  const tuning = {
    nodeMinRadius: 6.4,
    edgeMinWidth: 2,
    nodeMultiplier: 2,
    edgeMultiplier: 5,
    edgeOpacity: 0.375,
    labelFontSize: 16.85,
    labelOffset: 13.7,
    labelThreshold: 1,
    clusterThreshold: 42,
    ...zoomTuning,
  };

  const clusterThresholdScreenPx = Math.max(0, tuning.clusterThreshold);
  const clusterThresholdPx = clusterThresholdScreenPx / Math.max(view.scale, 0.001);
  const labelDensityThreshold = Math.max(0, tuning.labelThreshold);
  const semanticNodeScale = Math.max(0, tuning.nodeMultiplier);
  const semanticEdgeScale = Math.max(0, tuning.edgeMultiplier);
  const baseEdgeOpacity = Math.max(0, tuning.edgeOpacity);
  const labelFontSize = Math.max(0, tuning.labelFontSize);
  const labelOffset = Math.max(0, tuning.labelOffset);

  const clusteredNodes = useMemo(
    () => buildClusteredNodes(nodes, clusterThresholdPx, clusterSingularLabel, clusterPluralLabel),
    [nodes, clusterThresholdPx, clusterPluralLabel, clusterSingularLabel]
  );

  const screenNodes = useMemo(() => {
    return clusteredNodes.map((node) => {
      const screenX = view.tx + node.x * view.scale;
      const screenY = view.ty + node.y * view.scale;
      const minRadius = tuning.nodeMinRadius;
      const computedRadius = (node.radius || 0) * semanticNodeScale;

      return {
        ...node,
        screenX,
        screenY,
        screenRadius: Math.max(minRadius, computedRadius),
        clusterTextSize: 8.8,
      };
    });
  }, [clusteredNodes, view.tx, view.ty, view.scale, semanticNodeScale, tuning.nodeMinRadius]);

  const labelCandidates = useMemo(() => {
    return screenNodes
      .map((node) => ({
        ...node,
        priority: (node.degree || 0) * 10 + (node.radius || 0),
      }))
      .sort((a, b) => b.priority - a.priority);
  }, [screenNodes]);

  const screenEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      screenPath: edge.path,
      screenWidth: Math.max(tuning.edgeMinWidth, edge.width * semanticEdgeScale),
      screenOpacity: baseEdgeOpacity,
      curve: parseQuadraticPath(edge.path),
    }));
  }, [edges, semanticEdgeScale, baseEdgeOpacity, tuning.edgeMinWidth]);

  const visibleLabelIds = useMemo(
    () => buildVisibleLabelIds(labelCandidates, showLabels, labelDensityThreshold, labelFontSize, labelOffset),
    [showLabels, labelCandidates, labelDensityThreshold, labelFontSize, labelOffset]
  );

  const zoomAtPoint = (clientX, clientY, nextScale) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    setView((prev) => {
      const clamped = clampScale(nextScale);
      const worldX = (px - prev.tx) / prev.scale;
      const worldY = (py - prev.ty) / prev.scale;
      return {
        scale: clamped,
        tx: px - worldX * clamped,
        ty: py - worldY * clamped,
      };
    });
  };

  const getPointerPosition = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 24, y: 24, clientX: 0, clientY: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(16, Math.min(rect.width - 16, event.clientX - rect.left)),
      y: Math.max(16, Math.min(rect.height - 16, event.clientY - rect.top)),
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const getNearbyCandidates = (point) => buildNearbyCandidates(point, screenNodes, screenEdges, clusterSingularLabel, clusterPluralLabel);

  const dispatchSelectionFromPoint = (point, fallbackKind = null, fallbackPayload = null) => {
    const candidates = getNearbyCandidates(point);

    if (fallbackKind === 'node' && fallbackPayload) {
      onNodeClick(fallbackPayload, point);
      return;
    }

    if (fallbackKind === 'edge' && fallbackPayload) {
      onEdgeClick(fallbackPayload, point);
      return;
    }

    if (candidates.length) {
      const hit = candidates[0];
      if (hit.kind === 'node') onNodeClick(hit.payload, point);
      if (hit.kind === 'edge') onEdgeClick(hit.payload, point);
      return;
    }

    onBlankClick?.();
  };

  const selectedKind = selectedFeature?.__kind || '';
  const selectedId = selectedFeature?.id || '';

  const handleWheel = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAtPoint(event.clientX, event.clientY, view.scale * factor);
  };

  const stopControlAnimation = () => {
    holdActionRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleMouseDown = (event) => {
    stopControlAnimation();
    if (event.button !== 0) return;
    setDragState({
      startX: event.clientX,
      startY: event.clientY,
      startTx: view.tx,
      startTy: view.ty,
    });
  };

  const handleMouseMove = (event) => {
    if (!dragState) return;
    setView((prev) => ({
      ...prev,
      tx: dragState.startTx + (event.clientX - dragState.startX),
      ty: dragState.startTy + (event.clientY - dragState.startY),
    }));
  };

  useEffect(() => {
    return () => {
      stopControlAnimation();
    };
  }, []);

  const handleMouseUp = () => setDragState(null);
  const handleMouseLeave = () => {
    setDragState(null);
    onEdgeLeave();
    onNodeLeave?.();
  };

  const panStep = 4.5;
  const zoomFactorPerFrame = 1.012;

  const applyZoomAroundCenter = (prev, factor) => {
    const nextScale = clampScale(prev.scale * factor);
    if (nextScale === prev.scale) return prev;
    const centerX = width / 2;
    const centerY = height / 2;
    const worldX = (centerX - prev.tx) / prev.scale;
    const worldY = (centerY - prev.ty) / prev.scale;
    return {
      ...prev,
      scale: nextScale,
      tx: centerX - worldX * nextScale,
      ty: centerY - worldY * nextScale,
    };
  };

  const startControlAnimation = (action) => {
    stopControlAnimation();
    holdActionRef.current = action;
    let lastTime = null;

    const tick = (now) => {
      if (!holdActionRef.current) return;
      if (lastTime == null) lastTime = now;
      const delta = Math.min(32, now - lastTime || 16.67);
      lastTime = now;
      const frameScale = delta / 16.67;

      setView((prev) => {
        switch (holdActionRef.current) {
          case 'panUp':
            return { ...prev, ty: prev.ty + panStep * frameScale };
          case 'panDown':
            return { ...prev, ty: prev.ty - panStep * frameScale };
          case 'panLeft':
            return { ...prev, tx: prev.tx + panStep * frameScale };
          case 'panRight':
            return { ...prev, tx: prev.tx - panStep * frameScale };
          case 'zoomIn':
            return applyZoomAroundCenter(prev, Math.pow(zoomFactorPerFrame, frameScale));
          case 'zoomOut':
            return applyZoomAroundCenter(prev, Math.pow(1 / zoomFactorPerFrame, frameScale));
          default:
            return prev;
        }
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const resetView = () => {
    stopControlAnimation();
    const duration = 220;
    const startView = { ...view };
    const targetView = defaultView;
    let startTime = null;
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      if (startTime == null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeInOutCubic(t);
      setView({
        scale: startView.scale + (targetView.scale - startView.scale) * eased,
        tx: startView.tx + (targetView.tx - startView.tx) * eased,
        ty: startView.ty + (targetView.ty - startView.ty) * eased,
      });
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--map-canvas-bg)]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full bg-[var(--map-canvas-bg)]"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={(event) => {
          if (dragState) return;
          dispatchSelectionFromPoint(getPointerPosition(event));
        }}
        style={{ cursor: dragState ? 'grabbing' : 'grab' }}
      >
        <defs>
          {/* -----------------------------
              Map texture system
              -----------------------------
              These definitions are intentionally grouped and labeled so the
              historical-map styling can be iterated on safely in future passes.
              1. clip path for the framed map area
              2. paper grain for parchment-like surface variation
              3. sea-line pattern inspired by hand-colored portolan/atlas water treatment
              4. land-line pattern for engraved hachure-style tinting
              5. ornamental compass marker for early-modern atmosphere
          */}
          <clipPath id="map-frame-clip">
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="16" />
          </clipPath>

          <marker
            id="peridot-directed-edge-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke" />
          </marker>

          <filter id="map-paper-grain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
            <feComponentTransfer in="monoNoise" result="softNoise">
              <feFuncA type="table" tableValues="0 0.035" />
            </feComponentTransfer>
          </filter>

          <pattern id="map-sea-lines" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <rect width="24" height="24" fill="transparent" />
            <path d="M -6 6 C 2 2, 10 2, 18 6 C 26 10, 34 10, 42 6" fill="none" stroke="var(--map-texture-sea-line)" strokeOpacity="0.28" strokeWidth="0.9" />
            <path d="M -6 18 C 2 14, 10 14, 18 18 C 26 22, 34 22, 42 18" fill="none" stroke="var(--map-texture-sea-line)" strokeOpacity="0.24" strokeWidth="0.8" />
          </pattern>

          <pattern id="map-land-lines" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <rect width="12" height="12" fill="transparent" />
            <path d="M -2 2 L 14 2" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.18" strokeWidth="0.55" />
            <path d="M -2 6 L 14 6" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.14" strokeWidth="0.48" />
            <path d="M -2 10 L 14 10" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.11" strokeWidth="0.42" />
          </pattern>

          <g id="map-compass-rose">
            <circle cx="0" cy="0" r="18" fill="none" stroke="var(--map-texture-compass)" strokeOpacity="0.42" strokeWidth="1" />
            <path d="M 0 -24 L 4 -4 L 0 0 L -4 -4 Z" fill="var(--map-texture-compass)" fillOpacity="0.55" />
            <path d="M 24 0 L 4 4 L 0 0 L 4 -4 Z" fill="var(--map-texture-compass)" fillOpacity="0.32" />
            <path d="M 0 24 L -4 4 L 0 0 L 4 4 Z" fill="var(--map-texture-compass)" fillOpacity="0.2" />
            <path d="M -24 0 L -4 -4 L 0 0 L -4 4 Z" fill="var(--map-texture-compass)" fillOpacity="0.32" />
            <text x="0" y="-30" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--map-texture-compass)">N</text>
          </g>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="var(--map-canvas-bg)" />
        {showGeographicBackdrop ? (
          <>
            <rect x="0" y="0" width={width} height={height} fill="var(--map-texture-sea)" opacity="0.35" filter="url(#map-paper-grain)" />
            <rect x="0" y="0" width={width} height={height} fill="url(#map-sea-lines)" opacity="0.78" />
          </>
        ) : null}
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.w}
          height={frame.h}
          fill={showGeographicBackdrop ? 'var(--map-texture-sea)' : 'var(--map-frame-bg)'}
          stroke="var(--map-frame-border)"
          strokeWidth="1.4"
          rx="16"
        />
        {showGeographicBackdrop ? (
          <>
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-texture-sea)" opacity="0.24" filter="url(#map-paper-grain)" rx="16" />
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="url(#map-sea-lines)" opacity="0.34" rx="16" />
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-texture-frame-wash)" opacity="0.06" filter="url(#map-paper-grain)" rx="16" />
          </>
        ) : (
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-texture-frame-wash)" opacity="0.26" filter="url(#map-paper-grain)" rx="16" />
        )}
        <rect x={frame.x + 8} y={frame.y + 8} width={frame.w - 16} height={frame.h - 16} fill="none" stroke="var(--map-frame-border)" strokeOpacity="0.35" strokeWidth="0.9" rx="12" />
        <g clipPath="url(#map-frame-clip)">
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {showGeographicBackdrop ? (
              <>
                {showBasemap && basemapFeatures.length ? basemapFeatures.map((featureItem) => (
                  <g key={featureItem.id}>
                    <path
                      d={featureItem.d}
                      fill={activeCountryIds.has(featureItem.id) ? 'var(--map-land-active-fill)' : 'var(--map-land-fill)'}
                      stroke="var(--map-land-stroke)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.94"
                    />
                    <path
                      d={featureItem.d}
                      fill="url(#map-land-lines)"
                      opacity="0.42"
                    />
                    <path
                      d={featureItem.d}
                      fill="var(--map-texture-land-tint)"
                      opacity="0.08"
                      filter="url(#map-paper-grain)"
                    />
                  </g>
                )) : showBasemap ? (
                  <rect x="24" y="24" width={width - 48} height={height - 48} rx="24" fill="var(--map-land-fill)" opacity="0.55" />
                ) : null}
                <g opacity="0.14" stroke="var(--map-grid-stroke)" strokeWidth="1">
                  <line x1="140" y1="120" x2="140" y2="680" />
                  <line x1="260" y1="120" x2="260" y2="680" />
                  <line x1="380" y1="120" x2="380" y2="680" />
                  <line x1="500" y1="120" x2="500" y2="680" />
                  <line x1="620" y1="120" x2="620" y2="680" />
                  <line x1="740" y1="120" x2="740" y2="680" />
                  <line x1="100" y1="180" x2="860" y2="180" />
                  <line x1="100" y1="300" x2="860" y2="300" />
                  <line x1="100" y1="420" x2="860" y2="420" />
                  <line x1="100" y1="540" x2="860" y2="540" />
                  <line x1="100" y1="660" x2="860" y2="660" />
                </g>
                <use href="#map-compass-rose" x={frame.x + frame.w - 70} y={frame.y + 72} opacity="0.5" />
                <g pointerEvents="none" opacity="0.62">
                  {screenWaterLabels.map((item) => {
                    const lines = Array.isArray(item.lines) && item.lines.length ? item.lines : [item.label || ''];
                    const lineStep = item.size * 1.02;
                    const startDy = lines.length > 1 ? -((lines.length - 1) * lineStep) / 2 : 0;
                    return (
                      <text
                        key={item.id}
                        x={item.x}
                        y={item.y}
                        fill="var(--map-texture-compass)"
                        fillOpacity="0.72"
                        fontSize={item.size}
                        fontStyle="italic"
                        fontFamily="var(--map-water-label-font-family)"
                        textAnchor="middle"
                        letterSpacing="0.08em"
                      >
                        {lines.map((line, index) => (
                          <tspan
                            key={`${item.id}-line-${index}`}
                            x={item.x}
                            dy={index === 0 ? startDy : lineStep}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    );
                  })}
                </g>
              </>
            ) : null}
            <g>
              {screenEdges.map((edge) => {
                const isAnimated = edge.id === activeAnimationEdgeId;
                const isSelected = selectedKind === 'edge' && selectedId === edge.id;
                const edgeStroke = isSelected
                  ? 'var(--map-edge-selected)'
                  : isAnimated
                    ? 'var(--map-edge-active)'
                    : edge.id === hoveredEdgeId
                      ? 'var(--map-edge-hover)'
                      : 'var(--map-edge)';
                const edgeOpacity = isSelected
                  ? 0.92
                  : isAnimated
                    ? Math.max(0.85, edge.screenOpacity + 0.28)
                    : edge.id === hoveredEdgeId
                      ? Math.max(0.6, edge.screenOpacity + 0.2)
                      : edge.screenOpacity;
                const edgeStrokeWidth = isAnimated
                  ? edge.screenWidth + 1
                  : edge.id === hoveredEdgeId
                    ? edge.screenWidth + 0.6
                    : edge.screenWidth;
                return (
                  <path
                    key={edge.id}
                    d={edge.screenPath}
                    fill="none"
                    stroke={edgeStroke}
                    strokeOpacity={edgeOpacity}
                    strokeWidth={edgeStrokeWidth}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeDasharray={isAnimated ? 'none' : edge.count <= 2 ? '2.5 2' : 'none'}
                    markerEnd={edge.direction === 'directed' ? 'url(#peridot-directed-edge-arrow)' : undefined}
                    onMouseEnter={(event) => onEdgeEnter(edge, getPointerPosition(event))}
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchSelectionFromPoint(getPointerPosition(event), 'edge', edge);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </g>
          </g>
          <g>
            {screenNodes.map((node) => {
              const isAnimated = !node.isCluster && activeAnimationNodeIds?.has(node.id);
              const isSelected =
                (selectedKind === 'node' && selectedId === node.id) ||
                (selectedKind === 'cluster' && selectedId === node.id);
              const inFrame = node.screenX >= frame.x && node.screenX <= frame.x + frame.w && node.screenY >= frame.y && node.screenY <= frame.y + frame.h;
              if (!inFrame) return null;

              const isHovered = node.id === hoveredNodeId;
              const nodeFill = isSelected
                ? 'var(--map-node-selected)'
                : isHovered
                  ? 'var(--map-node-hover)'
                  : node.isCluster
                    ? 'var(--map-node-cluster)'
                    : isAnimated
                      ? 'var(--map-node-animated)'
                      : 'var(--map-node)';
              const nodeStroke = 'var(--map-node-stroke)';
              const nodeStrokeWidth = isSelected ? '3.2' : isHovered ? (node.isCluster ? '2.7' : '2.3') : isAnimated ? '2.5' : node.isCluster ? '2' : '1.5';
              const nodeRadius = isAnimated ? node.screenRadius + 3 : isHovered ? node.screenRadius + 1.5 : node.screenRadius;

              return (
                <g
                  key={node.id}
                  onMouseEnter={(event) => onNodeHover(node, getPointerPosition(event))}
                  onMouseLeave={() => onNodeLeave?.()}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatchSelectionFromPoint(getPointerPosition(event), 'node', node);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={node.screenX}
                    cy={node.screenY}
                    r={nodeRadius}
                    fill={nodeFill}
                    fillOpacity={isSelected ? '0.98' : node.isCluster ? '0.92' : '0.9'}
                    stroke={nodeStroke}
                    strokeWidth={nodeStrokeWidth}
                  />
                  {node.isCluster ? (
                    <text x={node.screenX} y={node.screenY} textAnchor="middle" dominantBaseline="middle" fontSize={node.clusterTextSize} fontWeight="700" fill="var(--map-node-stroke)" stroke="var(--map-edge-selected)" strokeWidth="1.2" paintOrder="stroke">
                      {node.clusterSize}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
          <g pointerEvents="none">
            {screenNodes.map((node) => {
              const shouldShowLabel = visibleLabelIds.has(node.id);
              const inFrame = node.screenX >= frame.x && node.screenX <= frame.x + frame.w && node.screenY >= frame.y && node.screenY <= frame.y + frame.h;
              if (!shouldShowLabel || !inFrame) return null;
              const labelText = node.isCluster && node.topLabel ? `${node.topLabel} +${node.clusterSize - 1}` : node.label;
              return (
                <text
                  key={`label-${node.id}`}
                  x={node.screenX}
                  y={node.screenY + node.screenRadius + labelOffset}
                  textAnchor="middle"
                  fontSize={labelFontSize}
                  fontWeight="var(--map-label-font-weight)"
                  fontStyle="var(--map-label-font-style)"
                  fontFamily="var(--map-label-font-family)"
                  fill="var(--map-label-text)"
                  stroke="var(--map-label-stroke)"
                  strokeWidth="var(--map-label-stroke-width)"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ letterSpacing: '0.01em' }}
                >
                  {labelText}
                </text>
              );
            })}
          </g>
        </g>
      </svg>

      {showBasemap && basemapError ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-[var(--map-warning-bg)] px-3 py-2 text-xs text-[var(--map-warning-text)] shadow">
          {basemapError}
        </div>
      ) : null}
      <MapLegendOverlay
        nodes={nodes}
        edges={edges}
        clusterPluralLabel={clusterPluralLabel}
        floatingCardClassName={floatingCardClassName}
      />
      <MapControlsOverlay
        floatingCardClassName={floatingCardClassName}
        buttonClassName={buttonClassName}
        onPanUp={() => startControlAnimation('panUp')}
        onPanLeft={() => startControlAnimation('panLeft')}
        onPanDown={() => startControlAnimation('panDown')}
        onPanRight={() => startControlAnimation('panRight')}
        onZoomIn={() => startControlAnimation('zoomIn')}
        onZoomOut={() => startControlAnimation('zoomOut')}
        onStop={stopControlAnimation}
        onReset={resetView}
      />
    </div>
  );
}

function InspectorSummaryCard({ children }) {
  return (
    <div className="rounded-2xl border border-[var(--summary-card-border)] bg-[var(--summary-card-bg)] p-4 text-[var(--summary-card-text)] shadow-[0_10px_28px_var(--peridot-role-card-shadow)]">
      {children}
    </div>
  );
}

function InspectorClearSelectionButton({ onClear }) {
  return (
    <div className="flex justify-center">
      <button type="button" onClick={onClear} className={buttonClassName()}>
        Clear selection
      </button>
    </div>
  );
}

function PersonMetadataCard({ selectedProps }) {
  if (!selectedProps?.personMetadata) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)] p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--panel-card-text)]">Person metadata</div>
      {selectedProps.personMetadata.imageCreativeCommons ? (
        <div className="mb-3 overflow-hidden rounded-xl border border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)]">
          <img
            src={selectedProps.personMetadata.imageCreativeCommons}
            alt={`${selectedProps.label} portrait`}
            className="h-48 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : null}
      <div className="space-y-2 text-sm">
        {selectedProps.personMetadata.wikiEn ? <a href={selectedProps.personMetadata.wikiEn} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">English Wikipedia</a> : null}
        {selectedProps.personMetadata.wikiIt ? <a href={selectedProps.personMetadata.wikiIt} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Italian Wikipedia</a> : null}
        {selectedProps.personMetadata.treccani ? <a href={selectedProps.personMetadata.treccani} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Treccani</a> : null}
        {selectedProps.personMetadata.imageCreativeCommons ? <a href={selectedProps.personMetadata.imageCreativeCommons} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Creative Commons image</a> : null}
      </div>
    </div>
  );
}

function MissingPersonMetadataCard() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-card-border)]/80 bg-[var(--panel-card-bg)] p-4 text-sm text-[var(--panel-card-muted-text)]">
      No exact-match person metadata was found for this selected person.
    </div>
  );
}

function LinkedLettersPanel({
  selectedLetterMetadata,
  onOpenLetterDetail,
}) {
  const columns = useMemo(() => buildConnectedRecordColumns(selectedLetterMetadata), [selectedLetterMetadata]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState({ key: 'date', direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});

  const setColumnFilter = (columnKey, value) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: value }));
    setCurrentPage(1);
  };

  const toggleSort = (columnKey) => {
    setSortState((prev) => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const visibleRecords = useMemo(() => {
    const activeFilters = Object.entries(columnFilters)
      .map(([key, value]) => [key, String(value || '').trim().toLowerCase()])
      .filter(([, value]) => value);

    const filtered = selectedLetterMetadata.filter((letter, index) => activeFilters.every(([key, value]) => (
      getLinkedRecordColumnValue(letter, key, index).toLowerCase().includes(value)
    )));

    return filtered
      .map((letter, index) => ({ letter, index, sortValue: getConnectedRecordSortValue(letter, sortState.key, index) }))
      .sort((a, b) => {
        if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
          return sortState.direction === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
        }
        const comparison = String(a.sortValue).localeCompare(String(b.sortValue));
        return sortState.direction === 'asc' ? comparison : -comparison;
      });
  }, [selectedLetterMetadata, columnFilters, sortState]);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pageRecords = visibleRecords.slice(startIndex, startIndex + pageSize);
  const paginationItems = getConnectedRecordPaginationItems(safeCurrentPage, totalPages);
  const showingStart = visibleRecords.length ? startIndex + 1 : 0;
  const showingEnd = Math.min(startIndex + pageSize, visibleRecords.length);

  const goToPage = (page) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

  return (
    <div className="rounded-2xl border border-[var(--section-border)]/80 bg-[var(--section-bg)] p-3 shadow-[0_8px_24px_var(--peridot-role-card-shadow)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 text-sm">
        <div>
          <div className="font-semibold uppercase tracking-[0.16em] text-[var(--panel-card-muted-text)]">Connected records</div>
          <div className="mt-1 text-xs text-[var(--panel-card-muted-text)]">
            Records are ordered chronologically by default. Sort or filter each column, then select a row to open the full record page.
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-card-muted-text)]">
          View
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] px-2 py-1 text-xs font-bold text-[var(--button-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      {selectedLetterMetadata.length ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--section-border)]/80 bg-[#e1d1aa]">
            <table className="min-w-full border-collapse text-left text-xs text-[#102515]">
              <thead className="bg-[#d7c18f] text-[10px] uppercase tracking-[0.12em] text-[#6f4d17]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className={`${column.className} border-b border-[var(--section-border)]/80 px-3 py-2 align-bottom`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="flex w-full items-center justify-between gap-2 text-left font-bold text-[var(--detail-label-text)] hover:text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                      >
                        <span className="truncate">{column.label}</span>
                        <span className="shrink-0 text-[9px] text-[var(--panel-card-muted-text)]">
                          {sortState.key === column.key ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.map((column) => (
                    <th key={`${column.key}:filter`} className={`${column.className} border-b border-[var(--section-border)]/80 px-3 py-1.5`}>
                      <input
                        type="search"
                        value={columnFilters[column.key] || ''}
                        onChange={(event) => setColumnFilter(column.key, event.target.value)}
                        placeholder={`Filter ${column.label}`}
                        className="w-full rounded-md border border-[#b58b42]/70 bg-[#eadfc3] px-2 py-1 text-[11px] normal-case tracking-normal text-[#102515] placeholder:text-[#314331] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--section-border)]/70">
                {pageRecords.length ? pageRecords.map(({ letter, index }) => (
                  <tr
                    key={letter.id || `${getLinkedLetterUniqueId(letter, index)}-${index}`}
                    className="cursor-pointer bg-[#eadfc3] text-[#102515] transition odd:bg-[#e1d1aa] hover:bg-[#18391f] hover:text-[#fff3c8]"
                    onClick={() => onOpenLetterDetail?.(letter, index)}
                  >
                    {columns.map((column) => (
                      <td key={`${letter.id || index}:${column.key}`} className={`${column.className} max-w-[24rem] px-3 py-2 align-top`}>
                        <div className="truncate font-semibold text-inherit">
                          {getLinkedRecordColumnValue(letter, column.key, index) || '—'}
                        </div>
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-4 text-sm text-[var(--panel-card-muted-text)]">
                      No connected records match the active column filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--panel-card-muted-text)]">
            <div>
              Showing {showingStart}–{showingEnd} of {visibleRecords.length} connected record{visibleRecords.length === 1 ? '' : 's'}
              {visibleRecords.length !== selectedLetterMetadata.length ? `, filtered from ${selectedLetterMetadata.length}` : ''}.
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => goToPage(1)} disabled={safeCurrentPage === 1} className={buttonClassName({ variant: 'secondary' })}>First</button>
              <button type="button" onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1} className={buttonClassName({ variant: 'secondary' })}>Previous</button>
              {paginationItems.map((item, index) => item === 'ellipsis' ? (
                <span key={`ellipsis:${index}`} className="px-1 text-[var(--panel-card-muted-text)]">…</span>
              ) : (
                <button
                  type="button"
                  key={item}
                  onClick={() => goToPage(item)}
                  className={buttonClassName({ active: item === safeCurrentPage, variant: 'secondary' })}
                >
                  {item}
                </button>
              ))}
              <button type="button" onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages} className={buttonClassName({ variant: 'secondary' })}>Next</button>
              <button type="button" onClick={() => goToPage(totalPages)} disabled={safeCurrentPage === totalPages} className={buttonClassName({ variant: 'secondary' })}>End</button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-[var(--panel-card-muted-text)]">No connected records were found for this selection in the current matching logic.</div>
      )}
    </div>
  );
}

function LegacyD3MapStage({
  mapViewportRef,
  mapViewportSize,
  graph,
  hoveredEdgeId,
  hoveredNodeId,
  handleEdgeEnter,
  handleEdgeLeave,
  handleEdgeClick,
  handleNodeHover,
  handleNodeLeave,
  handleNodeClick,
  showLabels,
  activeAnimationEdgeId,
  activeAnimationNodeIds,
  viewMode,
  personLayoutMode,
  handleBlankMapClick,
  selectedProps,
  zoomTuning,
  viewResetKey,
  initialFocusStrategy,
  hoverCard,
}) {
  return (
    <div ref={mapViewportRef} className="relative min-h-0 flex-1" data-peridot-tutorial-anchor="visualization-stage">
      {mapViewportSize.width > 0 && mapViewportSize.height > 0 ? (
        <SvgMap
          width={mapViewportSize.width}
          height={mapViewportSize.height}
          edges={graph.edges}
          nodes={graph.nodes}
          hoveredEdgeId={hoveredEdgeId}
          hoveredNodeId={hoveredNodeId}
          onEdgeEnter={handleEdgeEnter}
          onEdgeLeave={handleEdgeLeave}
          onEdgeClick={handleEdgeClick}
          onNodeHover={handleNodeHover}
          onNodeLeave={handleNodeLeave}
          onNodeClick={handleNodeClick}
          showLabels={showLabels}
          activeAnimationEdgeId={activeAnimationEdgeId}
          activeAnimationNodeIds={activeAnimationNodeIds}
          clusterSingularLabel={viewMode === 'geographic' ? 'place' : 'person'}
          clusterPluralLabel={viewMode === 'geographic' ? 'places' : 'people'}
          showBasemap={viewMode === 'geographic' || personLayoutMode === 'geographic'}
          showGeographicBackdrop={viewMode === 'geographic' || personLayoutMode === 'geographic'}
          onBlankClick={handleBlankMapClick}
          selectedFeature={selectedProps}
          zoomTuning={zoomTuning}
          viewResetKey={viewResetKey}
          initialFocusStrategy={initialFocusStrategy}
        />
      ) : null}

      <HoverCardOverlay hoverCard={hoverCard} mapViewportSize={mapViewportSize} />

    </div>
  );
}


function MapStage(props) {
  // Stable map-stage boundary. The dormant MapLibre preview was removed, so
  // this wrapper now deliberately routes every production and development map
  // render through the SVG/D3 stage used by the rest of the app.
  return <LegacyD3MapStage {...props} />;
}

// DISPLAY CONTROLS SECTION
// This subsection is relatively self-contained, but it still depends on
// shared helper components and several top-level setters. It is safer than the
// timeline/export sections, but it is still part of the control-panel render
// boundary that only activates once the cog opens the sidebar.


function InspectorHeader({ showInspectorInfo, setShowInspectorInfo }) {
  return (
    <div className="mb-0 w-full">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="[font-family:Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-[26px] font-bold leading-tight tracking-[-0.01em] text-[var(--peridot-role-inspector-heading-text)] drop-shadow-[0_1px_1px_var(--peridot-role-card-shadow)]">
          Inspector
        </h2>
        <button
          type="button"
          onClick={() => setShowInspectorInfo((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--peridot-role-inspector-card-border)] bg-[var(--peridot-role-inspector-clickable-bg)] text-[13px] font-bold leading-none text-[var(--peridot-role-inspector-clickable-text)] shadow-sm transition-colors hover:bg-[var(--peridot-role-inspector-clickable-hover-bg)] hover:text-[var(--peridot-role-inspector-clickable-text)] focus:outline-none focus:ring-2 focus:ring-[var(--peridot-role-interface-focus-ring)]"
          aria-label="Toggle inspector information"
          title="Inspector information"
        >
          i
        </button>
      </div>
      {showInspectorInfo ? (
        <div className="mt-3 w-full rounded-2xl border border-[var(--peridot-role-inspector-card-border)] bg-[var(--peridot-role-inspector-card-bg)] p-3 text-sm leading-relaxed text-[var(--peridot-role-inspector-body-text)] shadow-inner shadow-[var(--peridot-role-card-shadow)]">
          Summary details in this panel reflect the currently selected view, date window, search filter, and minimum-weight threshold, not the full dataset.
        </div>
      ) : null}
    </div>
  );
}

function AppMainWorkspace({
  pageTitle,
  setPageTitle,
  mapStageProps,
  workspaceMode,
  homeWorkspaceProps,
  dataWorkspaceProps,
  themeWorkspaceProps,
  visualizationWorkspaceProps,
  exploreWorkspaceProps,
  learnMoreWorkspaceProps,
  searchWorkspaceProps,
  inspectorWorkspaceProps,
}) {
  const workspaceInspectorPanelProps = inspectorWorkspaceProps?.inspectorPanelProps
    ? {
        ...inspectorWorkspaceProps.inspectorPanelProps,
        inspectorState: {
          ...inspectorWorkspaceProps.inspectorPanelProps.inspectorState,
          onCloseInspector: inspectorWorkspaceProps.onCloseInspectorWorkspace,
        },
      }
    : null;
  const isInspectorWorkspaceOpen = [
    INSPECTOR_PRESENTATION_MODES.WORKSPACE,
    INSPECTOR_PRESENTATION_MODES.EMPTY_WORKSPACE,
  ].includes(inspectorWorkspaceProps?.inspectorPresentationMode);

  const inspectorWorkspaceOverlay = isInspectorWorkspaceOpen ? (
    <div className="absolute inset-0 z-40 flex items-stretch justify-center bg-[var(--peridot-role-interface-scrim-strong)] p-4 backdrop-blur-[4px] sm:p-6">
      <section
        className="peridot-inspector-reference-ground flex h-full w-full max-w-[82rem] flex-col overflow-hidden rounded-[2.5rem] border border-[var(--peridot-role-inspector-card-border)] p-3 text-[var(--peridot-role-inspector-heading-text)] shadow-[0_30px_100px_var(--peridot-role-card-shadow)] ring-1 ring-[var(--peridot-role-interface-focus-ring)] sm:p-4"
        aria-label="Inspector workspace"
      >
        {workspaceInspectorPanelProps ? (
          <InspectorContent
            {...workspaceInspectorPanelProps}
            shellComponents={inspectorWorkspaceProps.inspectorShellComponents}
            viewComponents={inspectorWorkspaceProps.inspectorViewComponents}
            showExpandButton={false}
            presentation="workspace"
          />
        ) : null}
      </section>
    </div>
  ) : null;

  return (
    <main
      className="h-full"
      data-peridot-workspace-mode={workspaceMode}
    >
      {workspaceMode === PERIDOT_WORKSPACE_MODES.HOME ? (
        <PeridotHomeWorkspace {...homeWorkspaceProps} />
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.DATA ? (
        <PeridotDataWorkspace {...dataWorkspaceProps} />
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.THEME ? (
        <PeridotThemeWorkspace {...themeWorkspaceProps} />
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.VISUALIZATIONS ? (
        <div className="relative h-full overflow-hidden" data-peridot-visualizations-with-inspector={isInspectorWorkspaceOpen ? 'true' : 'false'} data-peridot-tutorial-anchor="visualizations-workspace">
          <PeridotVisualizationsWorkspace
            {...visualizationWorkspaceProps}
            suppressFloatingFrameToggles={isInspectorWorkspaceOpen}
          />
          {inspectorWorkspaceOverlay}
        </div>
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.EXPLORE ? (
        <div className="relative h-full overflow-hidden" data-peridot-explore-with-inspector={isInspectorWorkspaceOpen ? 'true' : 'false'}>
          <PeridotExploreWorkspace {...exploreWorkspaceProps} />
          {inspectorWorkspaceOverlay}
        </div>
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.LEARN_MORE ? (
        <PeridotLearnMoreWorkspace {...learnMoreWorkspaceProps} />
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.SEARCH ? (
        <div className="relative h-full overflow-hidden" data-peridot-search-with-inspector={isInspectorWorkspaceOpen ? 'true' : 'false'}>
          <PeridotSearchWorkspace {...searchWorkspaceProps} />
          {inspectorWorkspaceOverlay}
        </div>
      ) : workspaceMode === PERIDOT_WORKSPACE_MODES.INSPECTOR ? (
        <div className="relative h-full overflow-hidden bg-[var(--peridot-role-interface-app-background)]" data-peridot-inspector-workspace="true">
          <PeridotVisualizationsWorkspace {...visualizationWorkspaceProps} suppressFloatingFrameToggles />
          {inspectorWorkspaceOverlay}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="shrink-0 bg-[var(--title-bar-bg)] py-3 pl-[76px] pr-4 sm:pl-[80px]">
            <MapTitleBar pageTitle={pageTitle} setPageTitle={setPageTitle} />
          </div>
          <MapStage {...mapStageProps} />
        </div>
      )}
    </main>
  );
}

export default function EuropeNetworkMapApp() {
  // ------------------------------------------------------------
  // Current data source
  // ------------------------------------------------------------
  const [peridotFileLabel, setPeridotFileLabel] = useState('No data selected');
  const [peridotValidationSummary, setPeridotValidationSummary] = useState(null);
  const [isPeridotValidationModalOpen, setIsPeridotValidationModalOpen] = useState(false);
  const [peridotNormalizedData, setPeridotNormalizedData] = useState(null);
  const [columnMappingStaging, setColumnMappingStaging] = useState(null);
  // Preserve the original uploaded source + accepted mapping configuration so
  // researchers can reopen and revise mapped roles without re-uploading the file.
  // This is intentionally separate from transient `columnMappingStaging`: cancelling
  // an edit abandons only the draft edit, never the currently active dataset.
  const [activeMappedDataSource, setActiveMappedDataSource] = useState(null);
  const [isColumnMappingModalOpen, setIsColumnMappingModalOpen] = useState(false);
  const [isSampleChooserOpen, setIsSampleChooserOpen] = useState(false);
  const [sampleLoadingId, setSampleLoadingId] = useState('');
  const [pendingTutorialSampleSelection, setPendingTutorialSampleSelection] = useState(false);

  // ------------------------------------------------------------
  // Workspace routing state
  // ------------------------------------------------------------
  // Home, Data, Visualizations, Explore, Learn More, Search, and Theme render
  // as full workspace modes. Search and Inspector remain internal/compatibility
  // routes because the simplified product menu now presents a smaller stack.
  const [workspaceMode, setWorkspaceMode] = useState(DEFAULT_PERIDOT_WORKSPACE_MODE);
  const [visualizationsWorkspacePanel, setVisualizationsWorkspacePanel] = useState('place-map');
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(PERIDOT_TUTORIAL_START_INDEX);
  const tutorialReturnFocusRef = useRef(null);
  const setResolvedWorkspaceMode = (nextMode) => {
    setWorkspaceMode((currentMode) => resolvePeridotWorkspaceMode(nextMode, currentMode));
  };

  // ------------------------------------------------------------
  // User interaction and view state
  // ------------------------------------------------------------
  const [showLabels, setShowLabels] = useState(true);
  const [minCount, setMinCount] = useState(1);
  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [placeFilter, setPlaceFilter] = useState('');
  const [routePlaceFilter, setRoutePlaceFilter] = useState('');
  const [routePeopleFilter, setRoutePeopleFilter] = useState('');
  const [capabilityFilters, setCapabilityFilters] = useState([]);
  const [structuredCriteria, setStructuredCriteria] = useState([]);
  const [selectedSelection, setSelectedSelection] = useState(null);
  const [inspectorPresentationMode, setInspectorPresentationMode] = useState(
    INSPECTOR_PRESENTATION_MODES.CLOSED,
  );
  const [inspectorHistory, setInspectorHistory] = useState([]);
  const inspectorNavigationRef = useRef(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState('');
  const [hoverCard, setHoverCard] = useState(null);

  const openInspectorPersonDetail = (name, entityId = '') => {
    if (!name && !entityId) return;
    if (selectedSelection) {
      setInspectorHistory((prev) => [...prev, selectedSelection]);
    }
    inspectorNavigationRef.current = true;
    setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.WORKSPACE);
    setIsSidePanelOpen(false);
    setActivePanelTab('inspector');
    setSelectedSelection({ kind: 'person-detail', name, entityId: String(entityId || '').trim() });
    setShowAllLinkedLetters(false);
  };

  const openInspectorPlaceDetail = (label) => {
    if (!label) return;
    if (selectedSelection) {
      setInspectorHistory((prev) => [...prev, selectedSelection]);
    }
    inspectorNavigationRef.current = true;
    setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.WORKSPACE);
    setIsSidePanelOpen(false);
    setActivePanelTab('inspector');
    setSelectedSelection({ kind: 'place-detail', label });
    setShowAllLinkedLetters(false);
  };

  const openInspectorLetterDetail = (letter, index = 0) => {
    if (!letter) return;
    if (selectedSelection) {
      setInspectorHistory((prev) => [...prev, selectedSelection]);
    }
    const uniqueId = getLinkedLetterUniqueId(letter, index);
    inspectorNavigationRef.current = true;
    setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.WORKSPACE);
    setIsSidePanelOpen(false);
    setActivePanelTab('inspector');
    setSelectedSelection({
      kind: 'letter-detail',
      id: `letter-detail:${uniqueId}:${index}`,
      label: uniqueId,
      detailLabel: uniqueId,
      letter,
      index,
    });
    setShowAllLinkedLetters(false);
  };

  const openInspectorSearchResult = (result) => {
    const row = result?.row || result?.letter || null;
    if (!row) return;
    openInspectorLetterDetail(row, result?.index || 0);
  };

  const goBackInspector = () => {
    setInspectorHistory((prev) => {
      if (!prev.length) return prev;
      const previous = prev[prev.length - 1];
      inspectorNavigationRef.current = true;
      if (inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.WORKSPACE || inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.EMPTY_WORKSPACE) {
        setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.WORKSPACE);
        setIsSidePanelOpen(false);
      } else {
        setShowRightSidebar(true);
      }
      setSelectedSelection(previous);
      setShowAllLinkedLetters(false);
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    if (!inspectorNavigationRef.current) {
      if (!selectedSelection || ['node', 'edge', 'cluster'].includes(selectedSelection.kind)) {
        setInspectorHistory([]);
      }
    }
    inspectorNavigationRef.current = false;
  }, [selectedSelection]);

  const [timelineMode, setTimelineMode] = useState('range');
  const [isPlaying, setIsPlaying] = useState(false);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(700);
  const [timelinePlaybackMode, setTimelinePlaybackMode] = useState(PERIDOT_TIMELINE_PLAYBACK_MODES.CUMULATIVE);
  const [enabledTemporalRoles, setEnabledTemporalRoles] = useState([]);
  const [showAllLinkedLetters, setShowAllLinkedLetters] = useState(false);
  const [expandedLetterSections, setExpandedLetterSections] = useState({});
  const [viewMode, setViewMode] = useState('person');
  const [personLayoutMode, setPersonLayoutMode] = useState('geographic'); const [analyticsChartType, setAnalyticsChartType] = useState(DEFAULT_ANALYTICS_STATE.chartType); const [analyticsBarGroupBy, setAnalyticsBarGroupBy] = useState(DEFAULT_ANALYTICS_STATE.barGroupBy); const [analyticsTopN, setAnalyticsTopN] = useState(DEFAULT_ANALYTICS_STATE.topN);

  
  // CONTROL PANEL OPEN/CLOSED STATE FOR INDIVIDUAL SECTIONS
  // These booleans control whether each accordion-like section renders its body.
  // They are separate from `showLeftSidebar`, which controls whether the entire
  // left panel subtree renders at all.
  const [showDataInputsPanel, setShowDataInputsPanel] = useState(true);
  const [showVisualizationTypePanel, setShowVisualizationTypePanel] = useState(false);
  const [showDisplayControlsPanel, setShowDisplayControlsPanel] = useState(false);
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  // MASTER SIDE PANEL STATE
  // The side panel now has two separate concepts:
  // - isSidePanelOpen controls whether the shared panel shell is open.
  // - activePanelTab controls which tab the open shell displays.
  // Existing panel components still receive show/set props for compatibility,
  // but those setters now route through this split model.
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState('controls');
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const showLeftSidebar = isSidePanelOpen && activePanelTab === 'controls';
  const showRightSidebar = isSidePanelOpen && activePanelTab === 'inspector';

  const resolvePanelToggleValue = (nextValue, currentValue) => (
    typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
  );

  const setShowLeftSidebar = (nextValue) => {
    setIsSidePanelOpen((currentlyOpen) => {
      const currentlyShowingControls = currentlyOpen && activePanelTab === 'controls';
      const shouldOpen = resolvePanelToggleValue(nextValue, currentlyShowingControls);
      if (shouldOpen) {
        setActivePanelTab('controls');
        return true;
      }
      return currentlyShowingControls ? false : currentlyOpen;
    });
  };

  const setShowRightSidebar = (nextValue) => {
    setIsSidePanelOpen((currentlyOpen) => {
      const currentlyShowingInspector = currentlyOpen && activePanelTab === 'inspector';
      const shouldOpen = resolvePanelToggleValue(nextValue, currentlyShowingInspector);
      if (shouldOpen) {
        setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.COMPACT);
        setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
        setActivePanelTab('inspector');
        return true;
      }
      if (currentlyShowingInspector) {
        setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.CLOSED);
        return false;
      }
      return currentlyOpen;
    });
  };

  const [showInspectorInfo, setShowInspectorInfo] = useState(false);

  // ------------------------------------------------------------
  // Presentation and layout state
  // ------------------------------------------------------------
  const [pageTitle, setPageTitle] = useState('Correspondence Visualizer');
  const [exportStatus, setExportStatus] = useState(null);
  const mapViewportRef = useRef(null);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });

  const [zoomTuning] = useState({
    nodeMinRadius: 6.4,
    edgeMinWidth: 2,
    nodeMultiplier: 2,
    edgeMultiplier: 5,
    edgeOpacity: 0.375,
    labelFontSize: 16.85,
    labelOffset: 13.7,
    labelThreshold: 1,
    clusterThreshold: 42,
  });
  const [themeTuning, setThemeTuning] = useState(THEME_DEFAULTS);
  const [themePresetKey, setThemePresetKey] = useState('peridot');

  const minCountOptions = [
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6â€“10', value: 6 },
    { label: '11â€“15', value: 11 },
    { label: '16â€“20', value: 16 },
    { label: '21â€“25', value: 21 },
    { label: '26â€“30', value: 26 },
    { label: '31+', value: 31 },
  ];

  const playbackSpeedOptions = [
    { label: 'Very Slow', value: 1200 },
    { label: 'Slow', value: 700 },
    { label: 'Medium', value: 350 },
    { label: 'Fast', value: 175 },
    { label: 'Very Fast', value: 90 },
  ];

  // ------------------------------------------------------------
  // Derived theme variables
  // ------------------------------------------------------------
  const themeStyleVars = useMemo(() => {
    const vars = {};
    Object.entries(themeTuning).forEach(([key, value]) => {
      const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      vars[`--${kebab}`] = value;
    });
    return vars;
  }, [themeTuning]);

  // ------------------------------------------------------------
  // Parsed and normalized source tables
  // ------------------------------------------------------------
  // No dataset is preloaded. A new visitor sees an empty application state until
  // they explicitly choose a built-in sample or upload their own source file.
  const geographyRows = useMemo(
    () => (peridotNormalizedData ? peridotNormalizedData.normalizedRows : []),
    [peridotNormalizedData]
  );
  const normalizedLetters = useMemo(
    () => (peridotNormalizedData ? peridotNormalizedData.normalizedLetters : []),
    [peridotNormalizedData]
  );
  const normalizedPersonMetadata = useMemo(
    () => (peridotNormalizedData ? peridotNormalizedData.normalizedPersonMetadata : []),
    [peridotNormalizedData]
  );
  const personMetadataByName = useMemo(() => {
    const map = new Map();
    normalizedPersonMetadata.forEach((row) => {
      if (!map.has(row.person)) map.set(row.person, row);
    });
    return map;
  }, [normalizedPersonMetadata]);
  const personMetadataById = useMemo(() => {
    const map = new Map();
    normalizedPersonMetadata.forEach((row) => {
      const entityId = String(row?.canonicalEntityId || row?.id || '').trim();
      if (entityId && !map.has(entityId)) map.set(entityId, row);
    });
    return map;
  }, [normalizedPersonMetadata]);
  const { places, normalizedRows } = useMemo(
    () => (peridotNormalizedData ? {
      places: peridotNormalizedData.places,
      normalizedRows: peridotNormalizedData.normalizedRows,
    } : normalizeGeographyRows(geographyRows)),
    [peridotNormalizedData, geographyRows]
  );

  /*
   * Search records preserve every geographic field required by maps and graphs,
   * while attaching metadata only when Peridot can establish an exact source-row
   * relationship. Search, Results, and Refine must share this enriched row
   * collection; using normalizedRows directly would silently omit linked
   * Language, Archival collection, and custom-field values from Refine.
   */
  const searchRecords = useMemo(
    () => buildPeridotSearchRecords(normalizedRows, normalizedLetters, {
      allowValidatedParallelRows: !peridotNormalizedData,
    }),
    [normalizedRows, normalizedLetters, peridotNormalizedData],
  );
  const searchFilterSuggestions = useMemo(() => buildSearchFilterSuggestions(searchRecords), [searchRecords]);

  // ------------------------------------------------------------
  // Timeline / filter / playback scope contract
  // ------------------------------------------------------------
  // `normalizedRows` is the loaded dataset after parsing, validation, and
  // normalization. It is intentionally the broadest row scope in the app.
  //
  // Search scope and visualization scope deliberately diverge after committed
  // filters are applied:
  // 1. `timelineWindowRows` applies the global timeline range when Timeline is
  //    not in "all dates" mode.
  // 2. `filteredRowsForActiveFilters` applies committed Search & Filter
  //    conditions on top of that timeline window. This is the authoritative
  //    scope for Advanced Search Results and Refine facets.
  // 3. `selectedRowsForPlayback` derives assertion-level temporal entries from that committed scope and sorts them into playback order.
  // 4. `filteredRowsByTime` deduplicates active temporal entries back to rows and applies only current playback progress. It is the
  //    narrower scope for graph/map/network rendering and visualization export.
  //
  // Playback must never redefine Search Results or Refine. Moving the playback
  // scrubber may change visible map/network content, but it must not change the
  // count, rows, or facets of the already committed Search scope.
  //
  // Analytics has one additional local date-range concept inside
  // `AnalyticsPanel.jsx`. That chart-local range is not the same state as the
  // global timeline scrubber below, so do not merge or rename those states
  // without first defining the desired cross-workspace filtering semantics.
  const availableTemporalRoles = useMemo(() => getAvailableTemporalRoles(searchRecords), [searchRecords]);
  const temporalRoleSignature = availableTemporalRoles.join('\u0001');

  // A newly loaded/mapped dataset starts with every positionable temporal role
  // enabled. T3 keeps the selection dataset-derived rather than hard-coding
  // historian-specific role names such as Creation date or Lifespan.
  useEffect(() => {
    setEnabledTemporalRoles(availableTemporalRoles);
    setIsPlaying(false);
    setPlaybackIndex(-1);
  }, [temporalRoleSignature]);

  const enabledTemporalRoleSet = useMemo(() => new Set(enabledTemporalRoles), [enabledTemporalRoles]);
  const timelineMonths = useMemo(() => buildTimelineMonths(searchRecords, {
    enabledRoles: enabledTemporalRoleSet,
  }), [searchRecords, enabledTemporalRoleSet]);

  useEffect(() => {
    if (!timelineMonths.length) {
      setRangeStart(0);
      setRangeEnd(0);
      setPlaybackIndex(-1);
      return;
    }
    setRangeStart(0);
    setRangeEnd(timelineMonths.length - 1);
    setPlaybackIndex(-1);
  }, [timelineMonths.length]);

  // Entity relationships can be structural and therefore legitimately undated
  // (genealogy parent/partner assertions are the clearest example). Geographic
  // People Map layout should not lose that structure merely because Timeline
  // filtering is operating on date-bearing event/place rows. We therefore keep
  // a Search-filtered relationship scope before Timeline, while geographic
  // anchors continue to come from the Timeline/playback-visible row scope.
  const entityRelationshipStructureRows = useMemo(() => {
    return filterRowsBySearchAndEntity(searchRecords, {
      searchQuery: search,
      personQuery: personFilter,
      placeQuery: placeFilter,
      routePlaceQuery: routePlaceFilter,
      routePeopleQuery: routePeopleFilter,
      capabilityFilters,
      structuredCriteria,
    });
  }, [searchRecords, search, personFilter, placeFilter, routePlaceFilter, routePeopleFilter, capabilityFilters, structuredCriteria]);

  const inspectorStructuralRelationshipRows = useMemo(() => (
    entityRelationshipStructureRows.filter((row) => (
      getPeridotRowEntityRelationships(row).length > 0
      && !getRowPrimaryTemporalDisplay(row)
    ))
  ), [entityRelationshipStructureRows]);

  const timelineWindowRows = useMemo(() => {
    return filterRowsByTimelineWindow(searchRecords, timelineMode, timelineMonths, rangeStart, rangeEnd, {
      enabledRoles: enabledTemporalRoleSet,
    });
  }, [searchRecords, timelineMode, timelineMonths, rangeStart, rangeEnd, enabledTemporalRoleSet]);

  const filteredRowsForActiveFilters = useMemo(() => {
    return filterRowsBySearchAndEntity(timelineWindowRows, {
      searchQuery: search,
      personQuery: personFilter,
      placeQuery: placeFilter,
      routePlaceQuery: routePlaceFilter,
      routePeopleQuery: routePeopleFilter,
      capabilityFilters,
      structuredCriteria,
    });
  }, [timelineWindowRows, search, personFilter, placeFilter, routePlaceFilter, routePeopleFilter, capabilityFilters, structuredCriteria]);

  const playbackWindowBounds = useMemo(() => (
    timelineMode === 'range'
      ? getTimelineRangeSortBounds(timelineMonths, rangeStart, rangeEnd)
      : null
  ), [timelineMode, timelineMonths, rangeStart, rangeEnd]);

  const selectedRowsForPlayback = useMemo(() => {
    return buildPlaybackRows(filteredRowsForActiveFilters, {
      enabledRoles: enabledTemporalRoleSet,
      windowStart: playbackWindowBounds?.start ?? null,
      windowEnd: playbackWindowBounds?.end ?? null,
      playbackMode: timelinePlaybackMode,
    });
  }, [filteredRowsForActiveFilters, enabledTemporalRoleSet, playbackWindowBounds, timelinePlaybackMode]);

  useEffect(() => {
    if (!isPlaying || !selectedRowsForPlayback.length) return undefined;
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => {
        const next = current + 1;
        if (next >= selectedRowsForPlayback.length) {
          setIsPlaying(false);
          return selectedRowsForPlayback.length - 1;
        }
        return next;
      });
    }, playbackSpeed);
    return () => window.clearInterval(timer);
  }, [isPlaying, selectedRowsForPlayback, playbackSpeed]);

  const filteredRowsByTime = useMemo(() => {
    return filterRowsForPlayback(filteredRowsForActiveFilters, selectedRowsForPlayback, playbackIndex, {
      playbackMode: timelinePlaybackMode,
    });
  }, [filteredRowsForActiveFilters, playbackIndex, selectedRowsForPlayback, timelinePlaybackMode]);

  // ------------------------------------------------------------
  // Graph derivations
  // ------------------------------------------------------------
  const aggregatedEdges = useMemo(() => aggregateEdgesFromRows(filteredRowsByTime, normalizedLetters), [filteredRowsByTime, normalizedLetters]);

  const filteredAggregatedEdges = useMemo(() => {
    return aggregatedEdges.filter((edge) => edge.count >= minCount);
  }, [aggregatedEdges, minCount]);

  const placeIdsInUse = useMemo(() => {
    const ids = new Set();
    filteredAggregatedEdges.forEach((edge) => {
      ids.add(edge.sourcePlaceId);
      ids.add(edge.targetPlaceId);
    });
    return ids;
  }, [filteredAggregatedEdges]);

  const filteredPlaces = useMemo(() => places.filter((place) => placeIdsInUse.has(place.id)), [places, placeIdsInUse]);
  const geographicGraph = useMemo(
    () => buildGraph(filteredPlaces, filteredAggregatedEdges, mapViewportSize.width, mapViewportSize.height),
    [filteredPlaces, filteredAggregatedEdges, mapViewportSize.width, mapViewportSize.height]
  );
  const entityNetworkSemantics = useMemo(
    () => derivePeridotEntityNetworkSemantics(filteredRowsByTime),
    [filteredRowsByTime]
  );
  // Force layout is intentionally expensive (hundreds of synchronous D3 ticks).
  // Do not compute it merely because Force Directed was the last selected person
  // layout while the researcher is viewing Maps, Charts, Search, or another
  // workspace. A lightweight semantic graph is sufficient for off-stage
  // Inspector/export fallbacks; geometry is derived only for the active person
  // visualization.
  const isPersonNetworkGeometryActive = workspaceMode === PERIDOT_WORKSPACE_MODES.VISUALIZATIONS
    && ['people-network', 'force-directed'].includes(visualizationsWorkspacePanel)
    && viewMode === 'person';
  const personGraphLayoutMode = isPersonNetworkGeometryActive ? personLayoutMode : 'semantic';
  const personGraph = useMemo(
    () => buildPersonGraph(
      filteredRowsByTime,
      mapViewportSize.width,
      mapViewportSize.height,
      personGraphLayoutMode,
      minCount,
      '',
      personGraphLayoutMode === 'geographic'
        ? { relationshipRows: entityRelationshipStructureRows, locationRows: filteredRowsByTime }
        : null
    ),
    [entityRelationshipStructureRows, filteredRowsByTime, mapViewportSize.width, mapViewportSize.height, personGraphLayoutMode, minCount]
  );
  const graph = viewMode === 'geographic' ? geographicGraph : personGraph;

  // Playback visibility and visualization capability are intentionally separate.
  // Co-current playback can legitimately reach a moment with zero active rows;
  // that should render an empty stage without revoking the visualization itself.
  // Capability is therefore derived from the committed Timeline/Search scope
  // before playback, while the graph/map/chart body continues to use
  // `filteredRowsByTime` for the current playback moment.
  const availabilityAggregatedEdges = useMemo(
    () => aggregateEdgesFromRows(filteredRowsForActiveFilters, normalizedLetters),
    [filteredRowsForActiveFilters, normalizedLetters]
  );
  const availabilityFilteredAggregatedEdges = useMemo(
    () => availabilityAggregatedEdges.filter((edge) => edge.count >= minCount),
    [availabilityAggregatedEdges, minCount]
  );
  const availabilityEntityNetworkSemantics = useMemo(
    () => derivePeridotEntityNetworkSemantics(filteredRowsForActiveFilters),
    [filteredRowsForActiveFilters]
  );
  const availabilityGeographicEntityNetworkSemantics = useMemo(
    () => derivePeridotGeographicEntityNetworkSemantics(
      entityRelationshipStructureRows,
      filteredRowsForActiveFilters
    ),
    [entityRelationshipStructureRows, filteredRowsForActiveFilters]
  );
  const availabilityAnalyticsFields = useMemo(
    () => getAvailableAnalyticsFields(filteredRowsForActiveFilters),
    [filteredRowsForActiveFilters]
  );

  const analyticsFields = useMemo(() => getAvailableAnalyticsFields(filteredRowsByTime), [filteredRowsByTime]);
  useEffect(() => {
    if (analyticsChartType !== 'bar') return;
    const available = analyticsFields.barGroupOptions || [];
    if (!available.length) return;
    if (!available.some((field) => field.key === analyticsBarGroupBy)) {
      setAnalyticsBarGroupBy(available[0].key);
    }
  }, [analyticsBarGroupBy, analyticsChartType, analyticsFields]);
  const analyticsChartData = useMemo(
    () => buildAnalyticsChartData({
      rows: filteredRowsByTime,
      chartType: analyticsChartType,
      barGroupBy: analyticsBarGroupBy,
      topN: analyticsTopN,
    }),
    [filteredRowsByTime, analyticsChartType, analyticsBarGroupBy, analyticsTopN]
  );

  const visualizationAvailability = useMemo(() => {
    const rowCount = filteredRowsForActiveFilters.length;
    const pointCount = places.length;
    const routeCount = availabilityFilteredAggregatedEdges.length;
    // Network availability is semantic, not layout-dependent. A dataset can
    // contain valid entity relationships even when none of its entities has a
    // geographic anchor. In that case the force-directed network must remain
    // available while the geographic person/entity layout may have nothing to
    // position.
    const availableNetworkRelationships = (availabilityEntityNetworkSemantics.relationships || [])
      .filter((edge) => edge.count >= minCount);
    const availableNetworkEntities = new Set();
    availableNetworkRelationships.forEach((edge) => {
      if (edge.source) availableNetworkEntities.add(edge.source);
      if (edge.target) availableNetworkEntities.add(edge.target);
    });
    const networkNodeCount = availableNetworkEntities.size;
    const networkEdgeCount = availableNetworkRelationships.length;

    // Geographic person/entity networks have a stricter capability boundary
    // than force-directed networks. A semantic relationship is sufficient for
    // force layout, but a geographic network requires at least one relationship
    // whose two endpoints can both be positioned from explicit mapped coordinates.
    const geographicallyMappableEntities = new Set(
      (availabilityGeographicEntityNetworkSemantics.locations || [])
        .filter((location) => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
        .map((location) => location.person)
        .filter(Boolean)
    );
    const availableGeographicRelationships = (availabilityGeographicEntityNetworkSemantics.relationships || [])
      .filter((edge) => edge.count >= minCount);
    const geographicNetworkEdgeCount = availableGeographicRelationships.filter((edge) => (
      geographicallyMappableEntities.has(edge.source)
      && geographicallyMappableEntities.has(edge.target)
    )).length;
    const geographicNetworkNodeCount = new Set(
      availableGeographicRelationships
        .filter((edge) => (
          geographicallyMappableEntities.has(edge.source)
          && geographicallyMappableEntities.has(edge.target)
        ))
        .flatMap((edge) => [edge.source, edge.target])
    ).size;

    const chartFieldCount = [
      ...(availabilityAnalyticsFields.barGroupOptions || []),
      ...(availabilityAnalyticsFields.segmentGroupOptions || []),
      ...(availabilityAnalyticsFields.heatmapRowOptions || []),
      ...(availabilityAnalyticsFields.xAxisOptions || []),
      ...(availabilityAnalyticsFields.yMetricOptions || []),
      ...(availabilityAnalyticsFields.numericMeasureOptions || []),
    ].length;

    return {
      rowCount,
      pointCount,
      routeCount,
      networkNodeCount,
      networkEdgeCount,
      geographicNetworkNodeCount,
      geographicNetworkEdgeCount,
      chartFieldCount,
      hasPointMap: pointCount > 0,
      hasRouteMap: routeCount > 0,
      hasNetwork: networkNodeCount > 0 && networkEdgeCount > 0,
      hasForceNetwork: networkNodeCount > 0 && networkEdgeCount > 0,
      hasEntityNetwork: geographicNetworkNodeCount > 0 && geographicNetworkEdgeCount > 0,
      hasCharts: rowCount > 0 && chartFieldCount > 0,
      hasExploreData: rowCount > 0,
    };
  }, [availabilityAnalyticsFields, availabilityEntityNetworkSemantics, availabilityGeographicEntityNetworkSemantics, availabilityFilteredAggregatedEdges.length, filteredRowsForActiveFilters.length, minCount, places.length]);
  const viewResetKey = useMemo(() => {
    const layoutKey = viewMode === 'person' ? `${viewMode}:${personLayoutMode}` : viewMode;
    return `${layoutKey}:${timelineMode}:${rangeStart}:${rangeEnd}`;
  }, [viewMode, personLayoutMode, timelineMode, rangeStart, rangeEnd]);

  // ------------------------------------------------------------
  // Selection and inspector derivations
  // ------------------------------------------------------------
  const selectedProps = useMemo(() => {
    if (selectedSelection?.kind === 'letter-detail') {
      const uniqueId = selectedSelection.label || getLinkedLetterUniqueId(selectedSelection.letter, selectedSelection.index || 0);
      return {
        __kind: 'letter-detail',
        id: selectedSelection.id || `letter-detail:${uniqueId}:${selectedSelection.index || 0}`,
        label: uniqueId,
        detailLabel: uniqueId,
        letter: selectedSelection.letter,
        index: selectedSelection.index || 0,
      };
    }

    return resolveSelection(selectedSelection, graph, personMetadataByName, {
      personGraphFallback: personGraph,
      personMetadataById,
      viewMode,
      inspectorRows: filteredRowsByTime,
      inspectorRelationshipRows: inspectorStructuralRelationshipRows,
    });
  }, [selectedSelection, graph, personMetadataByName, personMetadataById, personGraph, viewMode, filteredRowsByTime, inspectorStructuralRelationshipRows]);

  const selectedLetterMetadata = useMemo(() => {
    if (selectedProps?.__kind === 'letter-detail') return [];
    return sortLinkedRecordsChronologically(enrichSelectedLetters(selectedProps, personMetadataByName, personMetadataById));
  }, [selectedProps, personMetadataByName, personMetadataById]);

  const linkedLettersToShow = showAllLinkedLetters ? selectedLetterMetadata : selectedLetterMetadata.slice(0, 10);

  const toggleLetterSection = (letterId, section) => {
    setExpandedLetterSections((prev) => {
      const key = `${letterId}__${section}`;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  };

  const isLetterSectionExpanded = (letterId, section) => Boolean(expandedLetterSections[`${letterId}__${section}`]);

  useEffect(() => {
    setExpandedLetterSections({});
  }, [selectedSelection?.id, selectedSelection?.kind]);

  const currentRangeLabel = timelineMonths.length && timelineMode === 'range'
    ? `${timelineMonths[Math.min(rangeStart, rangeEnd)] || '—'} to ${timelineMonths[Math.max(rangeStart, rangeEnd)] || '—'}`
    : 'All available dates';
  const currentPlaybackLabel = playbackIndex >= 0 && selectedRowsForPlayback[playbackIndex] ? (selectedRowsForPlayback[playbackIndex].displayLabel || selectedRowsForPlayback[playbackIndex].row?.date || 'dated record') : 'not running';
  const hasActivePlayback = playbackIndex >= 0 && Boolean(selectedRowsForPlayback[playbackIndex]);
  const currentPlaybackSpeedLabel = playbackSpeedOptions.find((option) => option.value === playbackSpeed)?.label || 'Slow';
  const currentMinCountLabel = minCountOptions.find((option) => option.value === minCount)?.label || String(minCount);

  // ------------------------------------------------------------
  // Diagnostics and export helpers
  // ------------------------------------------------------------
  const rowDiagnostics = useMemo(() => {
    const mappableRows = normalizedRows.filter((row) => row.mappable);
    const unknownDateRows = normalizedRows.filter((row) => !getRowTimelineCapability(row).hasTemporalEvidence).length;
    const timelineUsableRows = normalizedRows.filter((row) => getRowTimelineCapability(row).timelineReady).length;
    const peopleInFilteredRows = Array.from(new Set(filteredRowsByTime.flatMap((row) => getPeridotRowEntityParticipants(row)).filter(Boolean)));
    const exactPersonMetadataMatches = peopleInFilteredRows.filter((name) => personMetadataByName.has(name)).length;
    const visibleLinkedLetters = graph.edges.reduce((sum, edge) => sum + ((edge.letterMetadata || []).length), 0);

    return {
      geographyRows: geographyRows.length,
      normalizedRows: normalizedRows.length,
      mappableRows: mappableRows.length,
      unmappableRows: Math.max(0, normalizedRows.length - mappableRows.length),
      unknownDateRows,
      timelineUsableRows,
      timelineMonths: timelineMonths.length,
      filteredRows: filteredRowsByTime.length,
      routeCount: graph.edges.length,
      nodeCount: graph.nodes.length,
      linkedLetterMatches: visibleLinkedLetters,
      letterRows: normalizedLetters.length,
      personMetadataRows: normalizedPersonMetadata.length,
      exactPersonMetadataMatches,
    };
  }, [normalizedRows, filteredRowsByTime, graph.edges, graph.nodes, normalizedLetters.length, normalizedPersonMetadata.length, geographyRows.length, timelineMonths.length, personMetadataByName]);

  const exportVisibleDateLabel = useMemo(() => {
    const visibleYears = buildTimelineMonths(filteredRowsByTime, { enabledRoles: enabledTemporalRoles });
    let baseRange = currentRangeLabel;

    if (visibleYears.length) {
      const start = visibleYears[0];
      const end = visibleYears[visibleYears.length - 1];
      baseRange = start === end ? start : `${start} to ${end}`;
    }

    if (hasActivePlayback) {
      return `${baseRange} (visible through playback pause)`;
    }

    return baseRange;
  }, [filteredRowsByTime, enabledTemporalRoles, currentRangeLabel, hasActivePlayback]);

  const exportSubtitleLines = useMemo(() => {
    const activeFilterLabels = [
      search.trim() ? `Keyword: ${search.trim()}` : '',
      personFilter.trim() ? `Person: ${personFilter.trim()}` : '',
      placeFilter.trim() ? `Place: ${placeFilter.trim()}` : '',
      routePlaceFilter.trim() ? `Route place: ${routePlaceFilter.trim()}` : '',
      routePeopleFilter.trim() ? `Route people: ${routePeopleFilter.trim()}` : '',
      minCount > 1 ? `Minimum weight: ${currentMinCountLabel}` : '',
    ].filter(Boolean);

    return [
      `View: ${viewMode === 'geographic' ? 'Geographic routes' : 'Person network'}`,
      `Visible dates: ${exportVisibleDateLabel}`,
      activeFilterLabels.length ? `Filters: ${activeFilterLabels.join(' · ')}` : '',
    ].filter(Boolean);
  }, [viewMode, search, personFilter, placeFilter, routePlaceFilter, routePeopleFilter, minCount, currentMinCountLabel, exportVisibleDateLabel]);

  const buildMapPngExportFooterLines = (exportOptions = {}) => {
    const footerLines = [];

    if (exportOptions.includeDateRange) {
      footerLines.push(`Visible dates: ${exportVisibleDateLabel}`);
    }

    if (exportOptions.includeActiveFilters) {
      const activeFilterLabels = [
        search.trim() ? `Keyword: ${search.trim()}` : '',
        personFilter.trim() ? `Person: ${personFilter.trim()}` : '',
        placeFilter.trim() ? `Place: ${placeFilter.trim()}` : '',
        routePlaceFilter.trim() ? `Route place: ${routePlaceFilter.trim()}` : '',
        routePeopleFilter.trim() ? `Route people: ${routePeopleFilter.trim()}` : '',
        minCount > 1 ? `Minimum weight: ${currentMinCountLabel}` : '',
      ].filter(Boolean);

      if (activeFilterLabels.length) {
        footerLines.push(`Filters: ${activeFilterLabels.join(' · ')}`);
      }
    }

    if (exportOptions.includeResultCounts) {
      const nodeCount = graph.nodes.length;
      const edgeCount = graph.edges.length;
      footerLines.push(
        viewMode === 'geographic'
          ? `${nodeCount} visible map ${nodeCount === 1 ? 'item' : 'items'}${edgeCount ? ` · ${edgeCount} ${edgeCount === 1 ? 'route' : 'routes'}` : ''}`
          : `${nodeCount} visible ${nodeCount === 1 ? 'node' : 'nodes'} · ${edgeCount} ${edgeCount === 1 ? 'relationship' : 'relationships'}`
      );
    }

    return footerLines;
  };

  // Export rows are intentionally built from the current `graph`, not directly
  // from `normalizedRows`. `graph` has already absorbed the active timeline
  // window, Search & Filter state, playback progress, selected visualization
  // mode, and minimum-count threshold. This keeps header export aligned with
  // what the user is seeing, but it also means export behavior must be tested
  // whenever timeline/filter/playback graph derivation changes.
  const exportEdgesRows = useMemo(() => buildExportEdgeRows(graph.edges), [graph.edges]);

  const exportNodesRows = useMemo(() => buildExportNodeRows(graph.nodes), [graph.nodes]);

  const activePlaybackRow = hasActivePlayback ? selectedRowsForPlayback[playbackIndex]?.row || null : null;
  const activeAnimationEdgeId = activePlaybackRow ? (viewMode === 'geographic' ? edgeKeyFromRow(activePlaybackRow) : `${activePlaybackRow.sourcePerson}-->${activePlaybackRow.targetPerson}`) : '';
  const activeAnimationNodeIds = useMemo(() => {
    if (!activePlaybackRow) return new Set();
    return viewMode === 'geographic'
      ? new Set([activePlaybackRow.sourcePlaceId, activePlaybackRow.targetPlaceId].filter(Boolean))
      : new Set([activePlaybackRow.sourcePerson, activePlaybackRow.targetPerson].filter(Boolean));
  }, [activePlaybackRow, viewMode]);

  const clearSelection = () => {
    setSelectedSelection(null);
    setInspectorHistory([]);
    setHoveredNodeId('');
    setShowAllLinkedLetters(false);
    setExpandedLetterSections({});
  };

  const closeCompactInspector = () => {
    setShowRightSidebar(false);
  };

  const closeInspectorWorkspace = () => {
    setInspectorPresentationMode(INSPECTOR_PRESENTATION_MODES.CLOSED);
    setIsSidePanelOpen(false);
    if (workspaceMode === PERIDOT_WORKSPACE_MODES.INSPECTOR) {
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    }
  };

  const expandInspectorToWorkspace = () => {
    setInspectorPresentationMode(
      selectedSelection
        ? INSPECTOR_PRESENTATION_MODES.WORKSPACE
        : INSPECTOR_PRESENTATION_MODES.EMPTY_WORKSPACE,
    );
    setIsSidePanelOpen(false);
  };

  useEffect(() => {
    const handleInspectorEscape = (event) => {
      if (event.key !== 'Escape') return;

      if (
        inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.WORKSPACE
        || inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.EMPTY_WORKSPACE
      ) {
        event.preventDefault();
        closeInspectorWorkspace();
        return;
      }

      if (inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.COMPACT || showRightSidebar) {
        event.preventDefault();
        closeCompactInspector();
      }
    };

    window.addEventListener('keydown', handleInspectorEscape);
    return () => window.removeEventListener('keydown', handleInspectorEscape);
  }, [inspectorPresentationMode, showRightSidebar]);

  const triggerDownload = (blob, filename) => {
    const url = makeDownloadUrl(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => revokeObjectUrl(url), 0);

    return {
      filename,
      bytes: blob.size,
      timestamp: new Date().toLocaleTimeString(),
    };
  };

  const handleDownloadPeridotTemplate = () => {
    const emptyTemplateRow = Object.fromEntries(PERIDOT_TEMPLATE_COLUMNS.map((column) => [column, '']));
    const templateCsv = rowsToCsv([emptyTemplateRow]);
    triggerDownload(
      new Blob([templateCsv], { type: 'text/csv;charset=utf-8' }),
      'peridot_template.csv'
    );
  };

  const resetActiveDataInteractionState = () => {
    // A new data source should not inherit stale active filters,
    // playback position, or map/inspector selection from the prior dataset.
    setSearch('');
    setPersonFilter('');
    setPlaceFilter('');
    setRoutePlaceFilter('');
    setRoutePeopleFilter('');
    setMinCount(1);
    setTimelineMode('range');
    setIsPlaying(false);
    setPlaybackIndex(-1);
    clearSelection();
  };

  const handlePeridotCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileText(file);
      const parsedRows = parseCsv(text);
      const headers = getCsvHeaders(text);
      const validationSummary = buildPeridotCsvValidationSummary(parsedRows, headers);
      const fileLabel = file.name || 'Uploaded Peridot CSV';
      const normalized = buildPeridotCanonicalRuntimeModel(parsedRows, {
        fileLabel,
        sourceKind: 'public-template-csv',
        sourceSheet: 'Uploaded table',
      });

      setPeridotNormalizedData(normalized);
      setActiveMappedDataSource(null);

      setPeridotFileLabel(fileLabel);

      setPeridotValidationSummary(validationSummary);
      setIsPeridotValidationModalOpen(true);

      resetActiveDataInteractionState();
    } catch (error) {
      setIsPeridotValidationModalOpen(true);
      setPeridotValidationSummary({
        popup: {
          title: 'Upload failed',
          intro: `Peridot could not read this CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
          capabilityLines: [],
          warningLines: [],
          closingLines: ['No data was changed.'],
        },
        summaryLines: ['Upload failed.'],
        warnings: [],
        hasWarnings: true,
        totalRows: 0,
        acceptedRecordCount: 0,
        unsupportedRowCount: 0,
        capabilityCounts: {},
      });
    } finally {
      e.target.value = '';
    }
  };


  const handleColumnMappingTableUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileLabel = file.name || 'Uploaded table';
    // The public upload flow now always enters the generalized mapper. Dataset
    // profiles remain an internal compatibility token while legacy profile-specific
    // code is retired separately; researchers no longer choose correspondence vs.
    // genealogy before mapping.
    const datasetProfileId = DEFAULT_PERIDOT_DATASET_PROFILE_ID;
    const datasetProfile = getPeridotDatasetProfile(datasetProfileId);
    const lowerName = fileLabel.toLowerCase();
    const displayFileType = lowerName.endsWith('.tsv')
      ? 'TSV'
      : lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
        ? 'Excel workbook'
        : 'CSV';

    setIsColumnMappingModalOpen(false);
    setColumnMappingStaging({
      status: 'parsing',
      datasetProfileId,
      datasetProfile,
      fileLabel,
      fileType: displayFileType,
      rowCount: 0,
      columnCount: 0,
      sheetCount: 0,
      sheets: [],
      headers: [],
      rows: [],
      previewRows: [],
      mappingState: null,
      workbookModel: null,
      workbookSummary: null,
      stagedAt: new Date().toLocaleTimeString(),
      statusMessage: 'Reading workbook structure. Large Excel files may take a moment.',
    });

    try {
      // Let React paint the parsing state before the synchronous workbook parser
      // does heavier Excel work on the main thread.
      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      const workbookModel = await parsePeridotTableFile(file);
      const workbookSummary = summarizePeridotWorkbook(workbookModel);

      if (workbookModel.fileType === 'unsupported') {
        throw new Error(workbookSummary.warnings?.[0]?.message || 'Unsupported file type.');
      }

      const usableSheets = (workbookModel.sheets || []).filter((sheet) => sheet.headers?.length && sheet.rows?.length);
      const primarySheet = usableSheets[0] || workbookModel.sheets?.[0] || null;
      const isSingleSheetWorkbook = usableSheets.length === 1;
      const canUseCurrentSingleTableMapper = Boolean(primarySheet && isSingleSheetWorkbook);

      const isMultiSheetWorkbook = usableSheets.length > 1;
      const mappingState = canUseCurrentSingleTableMapper
        ? buildInitialPeridotColumnMappingState(
            primarySheet.headers || [],
            primarySheet.rows || [],
            { datasetProfileId }
          )
        : buildInitialPeridotWorkbookMappingState(workbookModel, { datasetProfileId });

      setColumnMappingStaging({
        status: 'ready',
        datasetProfileId,
        datasetProfile,
        fileLabel,
        fileType: workbookModel.fileType === 'excel'
          ? 'Excel workbook'
          : workbookModel.fileType === 'tsv'
            ? 'TSV'
            : 'CSV',
        delimiter: workbookModel.fileType === 'tsv' ? '\t' : ',',
        rowCount: workbookSummary.totalRows,
        columnCount: workbookSummary.totalColumns,
        sheetCount: workbookSummary.sheetCount,
        sheets: workbookSummary.sheets,
        workbookModel,
        workbookSummary,
        activeSheetName: primarySheet?.sheetName || '',
        headers: primarySheet?.headers || [],
        rows: canUseCurrentSingleTableMapper ? primarySheet.rows || [] : [],
        previewRows: primarySheet?.previewRows || [],
        mappingState,
        mappingMode: isMultiSheetWorkbook ? 'workbook' : 'single-table',
        stagedAt: new Date().toLocaleTimeString(),
        multiSheetWorkbook: isMultiSheetWorkbook,
        workbookMappingRequired: isMultiSheetWorkbook,
        workbookMappingMessage: isMultiSheetWorkbook
          ? 'This workbook has multiple usable sheets. You can now open the workbook mapping workspace to choose a primary record sheet, select a primary unique ID column, and preview Sheet + Column mappings. Multi-sheet import will be wired in the next pass.'
          : '',
      });
      setIsColumnMappingModalOpen(Boolean(mappingState));
    } catch (error) {
      setColumnMappingStaging({
        status: 'error',
        datasetProfileId,
        datasetProfile,
        fileLabel,
        fileType: displayFileType,
        rowCount: 0,
        columnCount: 0,
        sheetCount: 0,
        sheets: [],
        headers: [],
        rows: [],
        previewRows: [],
        mappingState: null,
        workbookModel: null,
        workbookSummary: null,
        stagedAt: new Date().toLocaleTimeString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsColumnMappingModalOpen(false);
    } finally {
      e.target.value = '';
    }
  };

  const loadPeridotSampleWorkbook = async (sample) => {
    const sampleUrl = getPeridotSampleDatasetUrl(sample);
    const response = await fetch(sampleUrl);
    if (!response.ok) {
      throw new Error(`Could not load ${sample.title} (${response.status}).`);
    }
    const blob = await response.blob();
    const file = new File([blob], sample.fileName, { type: blob.type || 'application/octet-stream' });
    return parsePeridotTableFile(file);
  };

  const buildPeridotSampleStaging = (sample, workbookModel) => {
    const workbookSummary = summarizePeridotWorkbook(workbookModel);
    const usableSheets = (workbookModel.sheets || []).filter((sheet) => sheet.headers?.length && sheet.rows?.length);
    const primarySheetName = sample.mappingMode === 'workbook'
      ? sample.mappingState.primarySheetName
      : (usableSheets[0]?.sheetName || 'Uploaded table');
    const primarySheet = usableSheets.find((sheet) => sheet.sheetName === primarySheetName) || usableSheets[0] || null;
    const mappingState = JSON.parse(JSON.stringify(sample.mappingState || {}));
    if (sample.mappingMode !== 'workbook') mappingState.sourceSheet = primarySheet?.sheetName || 'Uploaded table';

    return {
      status: 'ready',
      datasetProfileId: DEFAULT_PERIDOT_DATASET_PROFILE_ID,
      datasetProfile: getPeridotDatasetProfile(DEFAULT_PERIDOT_DATASET_PROFILE_ID),
      fileLabel: sample.fileName,
      fileType: workbookModel.fileType === 'excel' ? 'Excel workbook' : workbookModel.fileType === 'tsv' ? 'TSV' : 'CSV',
      delimiter: workbookModel.fileType === 'tsv' ? '\t' : ',',
      rowCount: workbookSummary.totalRows,
      columnCount: workbookSummary.totalColumns,
      sheetCount: workbookSummary.sheetCount,
      sheets: workbookSummary.sheets,
      workbookModel,
      workbookSummary,
      activeSheetName: primarySheet?.sheetName || '',
      headers: primarySheet?.headers || [],
      rows: sample.mappingMode === 'workbook' ? [] : (primarySheet?.rows || []),
      previewRows: primarySheet?.previewRows || [],
      mappingState,
      canonicalSampleMapping: JSON.parse(JSON.stringify(sample.mappingState || {})),
      mappingMode: sample.mappingMode,
      multiSheetWorkbook: sample.mappingMode === 'workbook' && usableSheets.length > 1,
      workbookMappingRequired: sample.mappingMode === 'workbook',
      isSampleData: true,
      sampleDatasetId: sample.id,
      sampleDatasetTitle: sample.title,
      stagedAt: new Date().toLocaleTimeString(),
    };
  };

  const editPeridotSampleMapping = async (sampleId) => {
    const sample = getPeridotSampleDataset(sampleId);
    if (!sample) return;
    setSampleLoadingId(sampleId);
    try {
      const workbookModel = await loadPeridotSampleWorkbook(sample);
      const baseStaging = buildPeridotSampleStaging(sample, workbookModel);
      const activeSampleMapping = activeMappedDataSource?.isSampleData
        && activeMappedDataSource?.sampleDatasetId === sampleId
        ? JSON.parse(JSON.stringify(activeMappedDataSource.mappingState || sample.mappingState || {}))
        : JSON.parse(JSON.stringify(sample.mappingState || {}));
      setColumnMappingStaging({
        ...baseStaging,
        mappingState: activeSampleMapping,
        canonicalSampleMapping: JSON.parse(JSON.stringify(sample.mappingState || {})),
        editingSampleMapping: true,
        editingActiveData: Boolean(activeMappedDataSource?.isSampleData && activeMappedDataSource?.sampleDatasetId === sampleId),
        stagedAt: new Date().toLocaleTimeString(),
      });
      setIsColumnMappingModalOpen(true);
    } catch (error) {
      setPeridotValidationSummary({
        popup: {
          title: 'Sample could not be opened',
          intro: error instanceof Error ? error.message : 'Unknown sample-loading error.',
          capabilityLines: [], warningLines: [], closingLines: ['No data was changed.'],
        },
        summaryLines: ['Sample loading failed.'], warnings: [], hasWarnings: true, totalRows: 0, acceptedRecordCount: 0, unsupportedRowCount: 0, capabilityCounts: {},
      });
      setIsPeridotValidationModalOpen(true);
    } finally {
      setSampleLoadingId('');
    }
  };

  const resetPeridotSampleMapping = () => {
    setColumnMappingStaging((current) => {
      if (!current?.editingSampleMapping || !current?.canonicalSampleMapping) return current;
      return {
        ...current,
        mappingState: JSON.parse(JSON.stringify(current.canonicalSampleMapping)),
        stagedAt: new Date().toLocaleTimeString(),
      };
    });
  };

  const activatePeridotSampleData = async (sampleId) => {
    const sample = getPeridotSampleDataset(sampleId);
    if (!sample) return;
    setSampleLoadingId(sampleId);
    try {
      const workbookModel = await loadPeridotSampleWorkbook(sample);
      const staging = buildPeridotSampleStaging(sample, workbookModel);
      let mappedRows = [];
      let finalValidationSummary = null;

      if (sample.mappingMode === 'workbook') {
        const workbookValidation = validatePeridotWorkbookMapping(workbookModel, staging.mappingState);
        if (!workbookValidation.isValid) {
          const firstError = workbookValidation.issues?.find((issue) => issue.severity === 'error');
          throw new Error(firstError?.message || `${sample.title} has an invalid saved mapping.`);
        }
        mappedRows = buildPeridotRowsFromWorkbookMapping(workbookModel, staging.mappingState);
        finalValidationSummary = buildPeridotCsvValidationSummary(mappedRows, PERIDOT_TEMPLATE_COLUMNS);
      } else {
        mappedRows = applyPeridotGeneralizedColumnMapping(staging.rows || [], staging.mappingState);
        finalValidationSummary = buildPeridotCsvValidationSummary(mappedRows, PERIDOT_TEMPLATE_COLUMNS);
      }

      const normalized = buildPeridotCanonicalRuntimeModel(mappedRows, {
        fileLabel: `${sample.title} (sample)`,
        sourceKind: sample.mappingMode === 'workbook' ? 'mapped-workbook-sample' : 'mapped-single-table-sample',
        sourceSheet: staging.mappingState.primarySheetName || staging.activeSheetName || 'Uploaded table',
      });

      setPeridotNormalizedData(normalized);
      setPeridotFileLabel(`${sample.title} (sample)`);
      setPeridotValidationSummary(finalValidationSummary);
      setIsPeridotValidationModalOpen(false);
      setActiveMappedDataSource({
        ...staging,
        status: 'ready',
        mappingState: staging.mappingState,
        isSampleData: true,
        sampleDatasetId: sample.id,
        savedMappingAt: new Date().toLocaleTimeString(),
      });
      setColumnMappingStaging(null);
      setIsColumnMappingModalOpen(false);
      setIsSampleChooserOpen(false);
      resetActiveDataInteractionState();
      setViewMode('geographic');
      setPersonLayoutMode('geographic');
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
      setIsSidePanelOpen(false);

      if (pendingTutorialSampleSelection) {
        setPendingTutorialSampleSelection(false);
        window.requestAnimationFrame(() => {
          const startStep = getPeridotTutorialStep(PERIDOT_TUTORIAL_START_INDEX);
          setTutorialStepIndex(PERIDOT_TUTORIAL_START_INDEX);
          setIsTutorialActive(true);
          routeTutorialStepToWorkspace(startStep);
        });
      }
    } catch (error) {
      setPeridotValidationSummary({
        popup: {
          title: 'Sample could not be loaded',
          intro: error instanceof Error ? error.message : 'Unknown sample-loading error.',
          capabilityLines: [], warningLines: [], closingLines: ['No data was changed.'],
        },
        summaryLines: ['Sample loading failed.'], warnings: [], hasWarnings: true, totalRows: 0, acceptedRecordCount: 0, unsupportedRowCount: 0, capabilityCounts: {},
      });
      setIsPeridotValidationModalOpen(true);
    } finally {
      setSampleLoadingId('');
    }
  };

  const handleSaveColumnMappingState = ({ datasetProfileId, tableOrientation, placeParts, relationshipParts, identityMapping, relationshipMetadataMapping, coreMapping, temporalMapping, temporalNoteMappings, temporalAssertionMappings, pointMapping, routeCoordinatePairMapping, customFieldSelections, validationSummary, workbookMappingState, workbookValidation, workbookSummary, genealogyMappingState, supplementalResolution } = {}) => {
    setColumnMappingStaging((current) => {
      if (!current || current.status !== 'ready') return current;

      if (genealogyMappingState) {
        return {
          ...current,
          datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
          datasetProfile: getPeridotDatasetProfile(datasetProfileId || current.datasetProfileId),
          mappingState: {
            ...genealogyMappingState,
            datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
          },
          genealogySupplementalResolution: supplementalResolution || current.genealogySupplementalResolution || null,
          genealogyMappingValidation: genealogyMappingState.validation || current.genealogyMappingValidation || null,
          savedMappingAt: new Date().toLocaleTimeString(),
        };
      }

      if (workbookMappingState) {
        return {
          ...current,
          datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
          datasetProfile: getPeridotDatasetProfile(datasetProfileId || current.datasetProfileId),
          mappingState: {
            ...workbookMappingState,
            datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
          },
          workbookMappingValidation: workbookValidation || current.workbookMappingValidation || null,
          workbookMappingSummary: workbookSummary || current.workbookMappingSummary || null,
          savedMappingAt: new Date().toLocaleTimeString(),
        };
      }

      return {
        ...current,
        datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
        datasetProfile: getPeridotDatasetProfile(datasetProfileId || current.datasetProfileId),
        mappingState: {
          ...(current.mappingState || {}),
          datasetProfileId: resolvePeridotDatasetProfileId(datasetProfileId || current.datasetProfileId),
          tableOrientation: tableOrientation || current.mappingState?.tableOrientation || 'columns',
          placeParts: placeParts || current.mappingState?.placeParts || [],
          relationshipParts: relationshipParts || current.mappingState?.relationshipParts || [],
          identityMapping: identityMapping || current.mappingState?.identityMapping || { record: { strategy: 'row', columns: [] }, entityGroups: [] },
          relationshipMetadataMapping: relationshipMetadataMapping || current.mappingState?.relationshipMetadataMapping || {},
          coreMapping: coreMapping || current.mappingState?.coreMapping || {},
          temporalMapping: temporalMapping || current.mappingState?.temporalMapping || {},
          temporalNoteMappings: temporalNoteMappings || current.mappingState?.temporalNoteMappings || {},
          temporalAssertionMappings: temporalAssertionMappings || current.mappingState?.temporalAssertionMappings || [],
          pointMapping: pointMapping || current.mappingState?.pointMapping || {},
          routeCoordinatePairMapping: routeCoordinatePairMapping || current.mappingState?.routeCoordinatePairMapping || {},
          customFieldSelections: customFieldSelections || current.mappingState?.customFieldSelections || [],
        },
        mappingValidationSummary: validationSummary || current.mappingValidationSummary || null,
        savedMappingAt: new Date().toLocaleTimeString(),
      };
    });
  };

  const handleConfirmColumnMappingImport = ({ datasetProfileId, tableOrientation, placeParts, relationshipParts, identityMapping, relationshipMetadataMapping, coreMapping, temporalMapping, temporalNoteMappings, temporalAssertionMappings, pointMapping, routeCoordinatePairMapping, customFieldSelections, validationSummary, workbookMappingState, workbookValidation, workbookSummary, genealogyMappingState, supplementalResolution } = {}) => {
    if (!columnMappingStaging || columnMappingStaging.status !== 'ready') return;
    const activeDatasetProfileId = resolvePeridotDatasetProfileId(
      datasetProfileId
      || columnMappingStaging.datasetProfileId
      || columnMappingStaging.mappingState?.datasetProfileId
    );

    if (isPeridotGenealogyProfile(activeDatasetProfileId)) {
      try {
        const nextGenealogyMapping = genealogyMappingState || columnMappingStaging.mappingState;
        const nextResolution = supplementalResolution
          || nextGenealogyMapping?.validation?.supplementalResolution
          || columnMappingStaging.genealogySupplementalResolution;

        if (!nextGenealogyMapping?.validation?.isValid || !nextResolution?.isResolved) {
          const firstError = nextGenealogyMapping?.validation?.issues?.find((issue) => issue.severity === 'error');
          throw new Error(firstError?.message || 'Genealogy mapping is not valid.');
        }

        const sourceRows = Array.isArray(nextResolution.rows) ? nextResolution.rows : [];
        const isWorkbookImport = Boolean(columnMappingStaging.workbookMappingRequired || columnMappingStaging.mappingMode === 'workbook');
        const fieldMapping = isWorkbookImport
          ? Object.fromEntries(
              Object.entries(nextGenealogyMapping.fieldMappings || {}).map(([field, ref]) => [field, ref?.columnName || ''])
            )
          : (nextGenealogyMapping.fieldMapping || {});

        const fileLabel = `${columnMappingStaging.fileLabel || 'Mapped genealogy'} (genealogy)`;
        const sourceSheet = isWorkbookImport
          ? (nextGenealogyMapping.primarySheetName || columnMappingStaging.activeSheetName || 'People')
          : (columnMappingStaging.activeSheetName || 'Uploaded table');

        const normalized = buildPeridotGenealogyRuntimeModel(sourceRows, fieldMapping, {
          fileLabel,
          sourceKind: isWorkbookImport ? 'mapped-genealogy-workbook' : 'mapped-genealogy-table',
          sourceSheet,
          supplementalResolution: nextResolution,
        });

        setPeridotNormalizedData(normalized);
        setPeridotFileLabel(fileLabel);
        setPeridotValidationSummary(normalized.validationSummary);
        setIsPeridotValidationModalOpen(true);
        setColumnMappingStaging(null);
        setIsColumnMappingModalOpen(false);
        resetActiveDataInteractionState();
        setViewMode('person');
        setPersonLayoutMode('force');
        setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
        setIsSidePanelOpen(false);
        return;
      } catch (error) {
        setPeridotValidationSummary({
          popup: {
            title: 'Genealogy import failed',
            intro: `Peridot could not activate the genealogy dataset: ${error instanceof Error ? error.message : 'Unknown error'}`,
            capabilityLines: [],
            warningLines: [],
            closingLines: ['No data was changed.'],
          },
          summaryLines: ['Genealogy import failed.'],
          warnings: [],
          hasWarnings: true,
          totalRows: columnMappingStaging.rowCount || 0,
          acceptedRecordCount: 0,
          unsupportedRowCount: 0,
          capabilityCounts: {},
        });
        setIsPeridotValidationModalOpen(true);
        return;
      }
    }

    if (!isPeridotCorrespondenceProfile(activeDatasetProfileId)) {
      setPeridotValidationSummary({
        popup: {
          title: 'Unsupported dataset profile',
          intro: 'Peridot could not identify an active import route for this dataset profile.',
          capabilityLines: [],
          warningLines: ['No data was changed.'],
          closingLines: ['Return to Manage Your Data and select a supported profile.'],
        },
        summaryLines: ['Unsupported dataset profile.'],
        warnings: [],
        hasWarnings: true,
        totalRows: columnMappingStaging.rowCount || 0,
        acceptedRecordCount: 0,
        unsupportedRowCount: 0,
        capabilityCounts: {},
      });
      setIsPeridotValidationModalOpen(true);
      return;
    }

    if (!columnMappingStaging.mappingState) {
      setPeridotValidationSummary({
        popup: {
          title: 'Import not ready',
          intro: 'Peridot could not find a saved mapping configuration for this staged file.',
          capabilityLines: [],
          warningLines: ['No data was changed.'],
          closingLines: ['Reopen the mapping workspace and review the mapping choices before importing.'],
        },
        summaryLines: ['Import not ready.'],
        warnings: [],
        hasWarnings: true,
        totalRows: 0,
        acceptedRecordCount: 0,
        unsupportedRowCount: 0,
        capabilityCounts: {},
      });
      setIsPeridotValidationModalOpen(true);
      return;
    }

    try {
      const isWorkbookImport = Boolean(columnMappingStaging.workbookMappingRequired || columnMappingStaging.mappingMode === 'workbook');

      if (isWorkbookImport) {
        const nextWorkbookMapping = workbookMappingState || columnMappingStaging.mappingState;
        const nextWorkbookValidation = workbookValidation || validatePeridotWorkbookMapping(columnMappingStaging.workbookModel, nextWorkbookMapping);

        if (!nextWorkbookValidation?.isValid) {
          const firstError = nextWorkbookValidation?.issues?.find((issue) => issue.severity === 'error');
          throw new Error(firstError?.message || 'Workbook mapping is not valid.');
        }

        const mappedRows = buildPeridotRowsFromWorkbookMapping(columnMappingStaging.workbookModel, nextWorkbookMapping);
        const finalValidationSummary = buildPeridotCsvValidationSummary(mappedRows, PERIDOT_TEMPLATE_COLUMNS);
        const editingSample = Boolean(columnMappingStaging.editingSampleMapping && columnMappingStaging.sampleDatasetId);
        const sampleDefinition = editingSample ? getPeridotSampleDataset(columnMappingStaging.sampleDatasetId) : null;
        const fileLabel = editingSample
          ? `${sampleDefinition?.title || columnMappingStaging.sampleDatasetTitle || 'Sample'} (sample)`
          : `${columnMappingStaging.fileLabel || 'Mapped workbook'} (mapped workbook)`;
        const normalized = buildPeridotCanonicalRuntimeModel(mappedRows, {
          fileLabel,
          sourceKind: editingSample ? 'mapped-workbook-sample' : 'mapped-workbook',
          sourceSheet: nextWorkbookMapping.primarySheetName || 'Mapped workbook',
        });

        setPeridotNormalizedData(normalized);
        setPeridotFileLabel(fileLabel);
        setPeridotValidationSummary(finalValidationSummary);
        setIsPeridotValidationModalOpen(true);
        setActiveMappedDataSource({
          ...columnMappingStaging,
          status: 'ready',
          mappingState: nextWorkbookMapping,
          mappingMode: 'workbook',
          workbookMappingRequired: true,
          savedMappingAt: new Date().toLocaleTimeString(),
        });
        // The transient editing/staging copy can now be removed. The active mapped
        // source above retains the original workbook plus accepted mapping state.
        setColumnMappingStaging(null);
        setIsColumnMappingModalOpen(false);
        resetActiveDataInteractionState();
        setViewMode('geographic');
        setPersonLayoutMode('geographic');
        setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
        setIsSidePanelOpen(false);
        return;
      }

      const nextCoreMapping = coreMapping || columnMappingStaging.mappingState?.coreMapping || {};
      const nextTemporalMapping = temporalMapping || columnMappingStaging.mappingState?.temporalMapping || {};
      const nextTemporalNoteMappings = temporalNoteMappings || columnMappingStaging.mappingState?.temporalNoteMappings || {};
      const nextTemporalAssertionMappings = temporalAssertionMappings || columnMappingStaging.mappingState?.temporalAssertionMappings || [];
      const nextPointMapping = pointMapping || columnMappingStaging.mappingState?.pointMapping || {};
      const nextRouteCoordinatePairMapping = routeCoordinatePairMapping || columnMappingStaging.mappingState?.routeCoordinatePairMapping || {};
      const nextPlaceParts = placeParts || columnMappingStaging.mappingState?.placeParts || [];
      const nextRelationshipParts = relationshipParts || columnMappingStaging.mappingState?.relationshipParts || [];
      const nextIdentityMapping = identityMapping || columnMappingStaging.mappingState?.identityMapping || { record: { strategy: 'row', columns: [] }, entityGroups: [] };
      const nextRelationshipMetadataMapping = relationshipMetadataMapping || columnMappingStaging.mappingState?.relationshipMetadataMapping || {};
      const nextCustomFieldSelections = customFieldSelections || columnMappingStaging.mappingState?.customFieldSelections || [];
      const mappedRows = applyPeridotGeneralizedColumnMapping(columnMappingStaging.rows || [], {
        tableOrientation: tableOrientation || columnMappingStaging.mappingState?.tableOrientation || 'columns',
        placeParts: nextPlaceParts,
        relationshipParts: nextRelationshipParts,
        identityMapping: nextIdentityMapping,
        relationshipMetadataMapping: nextRelationshipMetadataMapping,
        coreMapping: nextCoreMapping,
        temporalMapping: nextTemporalMapping,
        temporalNoteMappings: nextTemporalNoteMappings,
        temporalAssertionMappings: nextTemporalAssertionMappings,
        pointMapping: nextPointMapping,
        routeCoordinatePairMapping: nextRouteCoordinatePairMapping,
        customFieldSelections: nextCustomFieldSelections,
      });
      const finalValidationSummary = validationSummary || buildPeridotCsvValidationSummary(mappedRows, PERIDOT_TEMPLATE_COLUMNS);
      const editingSample = Boolean(columnMappingStaging.editingSampleMapping && columnMappingStaging.sampleDatasetId);
      const sampleDefinition = editingSample ? getPeridotSampleDataset(columnMappingStaging.sampleDatasetId) : null;
      const fileLabel = editingSample
        ? `${sampleDefinition?.title || columnMappingStaging.sampleDatasetTitle || 'Sample'} (sample)`
        : `${columnMappingStaging.fileLabel || 'Mapped table'} (mapped)`;
      const normalized = buildPeridotCanonicalRuntimeModel(mappedRows, {
        fileLabel,
        sourceKind: editingSample ? 'mapped-single-table-sample' : 'mapped-single-table',
        sourceSheet: columnMappingStaging.mappingState?.sourceSheet || 'Uploaded table',
      });

      setPeridotNormalizedData(normalized);
      setPeridotFileLabel(fileLabel);
      setPeridotValidationSummary(finalValidationSummary);
      setIsPeridotValidationModalOpen(true);
      const acceptedMappingState = {
        ...(columnMappingStaging.mappingState || {}),
        datasetProfileId: activeDatasetProfileId,
        tableOrientation: tableOrientation || columnMappingStaging.mappingState?.tableOrientation || 'columns',
        placeParts: nextPlaceParts,
        relationshipParts: nextRelationshipParts,
        identityMapping: nextIdentityMapping,
        relationshipMetadataMapping: nextRelationshipMetadataMapping,
        coreMapping: nextCoreMapping,
        temporalMapping: nextTemporalMapping,
        temporalNoteMappings: nextTemporalNoteMappings,
        temporalAssertionMappings: nextTemporalAssertionMappings,
        pointMapping: nextPointMapping,
        routeCoordinatePairMapping: nextRouteCoordinatePairMapping,
        customFieldSelections: nextCustomFieldSelections,
      };
      setActiveMappedDataSource({
        ...columnMappingStaging,
        status: 'ready',
        mappingState: acceptedMappingState,
        mappingMode: 'single-table',
        workbookMappingRequired: false,
        savedMappingAt: new Date().toLocaleTimeString(),
      });
      // The transient editing/staging copy can now be removed. The active mapped
      // source above retains the original rows plus accepted mapping state.
      setColumnMappingStaging(null);
      setIsColumnMappingModalOpen(false);
      resetActiveDataInteractionState();
      setViewMode('geographic');
      setPersonLayoutMode('geographic');
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
      setIsSidePanelOpen(false);
    } catch (error) {
      setPeridotValidationSummary({
        popup: {
          title: 'Import failed',
          intro: `Peridot could not import the mapped table: ${error instanceof Error ? error.message : 'Unknown error'}`,
          capabilityLines: [],
          warningLines: [],
          closingLines: ['No data was changed.'],
        },
        summaryLines: ['Import failed.'],
        warnings: [],
        hasWarnings: true,
        totalRows: 0,
        acceptedRecordCount: 0,
        unsupportedRowCount: 0,
        capabilityCounts: {},
      });
      setIsPeridotValidationModalOpen(true);
    }
  };

  const openActiveMappedDataEditor = () => {
    if (!activeMappedDataSource) return;
    setColumnMappingStaging({
      ...activeMappedDataSource,
      status: 'ready',
      editingActiveData: true,
      stagedAt: new Date().toLocaleTimeString(),
    });
    setIsColumnMappingModalOpen(true);
  };

  const clearColumnMappingStaging = () => {
    setColumnMappingStaging(null);
    setIsColumnMappingModalOpen(false);
  };

  // Closing or cancelling the mapping workspace means abandoning the currently
  // staged upload. Peridot should not surface abandoned staged files as public
  // resumable state in the Data workspace.
  const discardColumnMappingStaging = () => {
    setColumnMappingStaging(null);
    setIsColumnMappingModalOpen(false);
  };

  const getMapSvgElement = () => mapViewportRef.current?.querySelector('svg') || null;

  const handleExportSvg = () => {
    try {
      const svgElement = getMapSvgElement();
      if (!svgElement) {
        setExportStatus({ kind: 'error', message: 'SVG export failed: map not found.' });
        return;
      }
      const serialized = serializeSvgForExport(svgElement, {
        title: pageTitle,
        subtitleLines: exportSubtitleLines,
      });
      const result = triggerDownload(
        new Blob([serialized.markup], { type: 'image/svg+xml;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-map.svg`
      );
      setExportStatus({ kind: 'success', message: 'SVG export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `SVG export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportPng = async (exportOptions = {}) => {
    try {
      const svgElement = getMapSvgElement();
      if (!svgElement) {
        setExportStatus({ kind: 'error', message: 'PNG export failed: map not found.' });
        return;
      }

      const includeTitle = Boolean(exportOptions.includeTitle);
      const title = includeTitle ? String(exportOptions.title || pageTitle || '').trim() : '';
      const footerLines = buildMapPngExportFooterLines(exportOptions);
      const pngBlob = await renderSvgElementToPngBlob(svgElement, {
        title,
        footerLines,
      });
      const result = triggerDownload(
        pngBlob,
        `${slugifyFilenamePart(title || pageTitle, 'correspondence-visualizer')}-${viewMode}-map.png`
      );
      setExportStatus({ kind: 'success', message: 'PNG export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `PNG export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportEdgesCsv = () => {
    try {
      const csv = rowsToCsv(exportEdgesRows);
      const result = triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-edges.csv`
      );
      setExportStatus({ kind: 'success', message: 'Routes CSV export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `Routes CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportNodesCsv = () => {
    try {
      const csv = rowsToCsv(exportNodesRows);
      const result = triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-nodes.csv`
      );
      setExportStatus({ kind: 'success', message: 'Nodes CSV export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `Nodes CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const applyThemePreset = (presetKey) => {
    const preset = MAP_STYLE_PRESETS[presetKey];
    if (!preset) return;
    setThemePresetKey(presetKey);
    setThemeTuning((prev) => ({
      ...prev,
      ...preset,
    }));
  };

  const resetTheme = () => {
    setThemePresetKey('peridot');
    setThemeTuning(THEME_DEFAULTS);
  };

  const handleEdgeEnter = (edge, point) => {
    setHoveredEdgeId(edge.id);
    setHoverCard(buildHoverCardState(`${edge.sourceLabel} → ${edge.targetLabel}`, `Weight: ${edge.count}`, point));
  };

  const handleEdgeLeave = () => {
    setHoveredEdgeId('');
    setHoverCard(null);
  };


  const {
    handleBlankMapClick: handleBlankMapClickBase,
    handleEdgeClick,
    handleNodeHover,
    handleNodeClick,
  } = buildMapInteractionHandlers({
    clearSelection,
    setHoverCard,
    setHoveredEdgeId,
    setSelectedSelection,
    setShowAllLinkedLetters,
    setShowRightSidebar,
    buildHoverCardState,
    buildNodeHoverSummary,
    viewMode,
  });

  const handleBlankMapClick = (...args) => {
    handleBlankMapClickBase(...args);
    if (showRightSidebar || inspectorPresentationMode === INSPECTOR_PRESENTATION_MODES.COMPACT) {
      closeCompactInspector();
    }
  };

  const handleNodeHoverWithHighlight = (node, point) => {
    setHoveredNodeId(node?.id || '');
    handleNodeHover(node, point);
  };

  const clearHoveredNodeHighlight = () => {
    setHoveredNodeId('');
  };


  useEffect(() => {
    const element = mapViewportRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.round(element.clientWidth || 0));
      const nextHeight = Math.max(0, Math.round(element.clientHeight || 0));
      setMapViewportSize((prev) => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [workspaceMode, visualizationsWorkspacePanel, viewMode, personLayoutMode]);

  useEffect(() => {
    if (!hoverCard) return undefined;
    const handleMove = (event) => {
      const dx = event.clientX - (hoverCard.clientX ?? 0);
      const dy = event.clientY - (hoverCard.clientY ?? 0);
      if (Math.sqrt(dx * dx + dy * dy) > 110) {
        setHoverCard(null);
        setHoveredEdgeId('');
      }
    };
    const handleDown = () => {
      setHoverCard(null);
      setHoveredEdgeId('');
        };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
    };
  }, [hoverCard]);

  const mapStageProps = buildMapStageProps({
    mapViewportRef,
    mapViewportSize,
    graph,
    hoveredEdgeId,
    hoveredNodeId,
    handleEdgeEnter,
    handleEdgeLeave,
    handleEdgeClick,
    handleNodeHover: handleNodeHoverWithHighlight,
    handleNodeLeave: clearHoveredNodeHighlight,
    handleNodeClick,
    showLabels,
    activeAnimationEdgeId,
    activeAnimationNodeIds,
    viewMode,
    handleBlankMapClick,
    selectedProps,
    zoomTuning,
    viewResetKey,
    initialFocusStrategy: viewMode === 'person' && personLayoutMode === 'force' ? 'force-dense-cluster' : 'fit-all',
    hoverCard,
    personLayoutMode,
  });

  // PREPARE THE FULL LEFT PANEL PROP CONTRACT
  // This object is the handoff from App.jsx orchestration into the control
  // panel subtree. If the panel ever whites out when opened, inspect this
  // contract and the receiving child props before attempting new extraction.
  const leftControlPanelProps = buildLeftControlPanelProps({
    showLeftSidebar,
    showRightSidebar,
    setShowLeftSidebar,
    setShowRightSidebar,
    showDataInputsPanel,
    setShowDataInputsPanel,
    showVisualizationTypePanel,
    setShowVisualizationTypePanel,
    showDisplayControlsPanel,
    setShowDisplayControlsPanel,
    showTimelinePanel,
    setShowTimelinePanel,
    showExportPanel,
    setShowExportPanel,
    showSummaryPanel,
    setShowSummaryPanel,
    showThemePanel,
    setShowThemePanel,
    peridotFileLabel,
    peridotValidationSummary,
    isPeridotValidationModalOpen,
    handlePeridotCsvUpload,
    handleDownloadPeridotTemplate,
    closePeridotValidationModal: () => setIsPeridotValidationModalOpen(false),
    columnMappingStaging,
    isColumnMappingModalOpen,
    handleColumnMappingTableUpload,
    openColumnMappingModal: () => setIsColumnMappingModalOpen(true),
    clearColumnMappingStaging,
    rowDiagnostics,
    showLabels,
    setShowLabels,
    viewMode,
    setViewMode,
    personLayoutMode,
    setPersonLayoutMode,
    search,
    setSearch,
    personFilter,
    setPersonFilter,
    placeFilter,
    setPlaceFilter,
    routePlaceFilter,
    setRoutePlaceFilter,
    routePeopleFilter,
    setRoutePeopleFilter,
    searchFilterSuggestions,
    currentMinCountLabel,
    minCountOptions,
    minCount,
    setMinCount,
    timelineMode,
    setTimelineMode,
    currentRangeLabel,
    timelineMonths,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    currentPlaybackLabel,
    currentPlaybackSpeedLabel,
    playbackSpeedOptions,
    playbackSpeed,
    setPlaybackSpeed,
    isPlaying,
    setIsPlaying,
    playbackIndex,
    setPlaybackIndex,
    selectedRowsForPlayback,
    applyThemePreset,
    resetTheme,
    handleExportSvg,
    handleExportPng,
    handleExportEdgesCsv,
    handleExportNodesCsv,
    graph, exportStatus, analyticsChartType, setAnalyticsChartType, analyticsBarGroupBy, setAnalyticsBarGroupBy, analyticsTopN, setAnalyticsTopN, analyticsFields, analyticsChartData, analyticsRows: filteredRowsByTime, }); const inspectorPanelProps = buildInspectorPanelProps({
    showRightSidebar,
    setShowRightSidebar,
    setShowLeftSidebar,
    showInspectorInfo,
    setShowInspectorInfo,
    selectedProps,
    clearSelection,
    viewMode,
    onOpenPersonDetail: openInspectorPersonDetail,
    onOpenPlaceDetail: openInspectorPlaceDetail,
    onOpenLetterDetail: openInspectorLetterDetail,
    inspectorHistoryLength: inspectorHistory.length,
    onBackInspector: goBackInspector,
    onCloseInspector: closeCompactInspector,
    onExpandInspector: expandInspectorToWorkspace,
    linkedLettersToShow,
    selectedLetterMetadata,
    showAllLinkedLetters,
    setShowAllLinkedLetters,
    isLetterSectionExpanded,
    toggleLetterSection,
  });

  const inspectorShellComponents = {
    SidebarToggleComponent: SidebarToggle,
    InspectorHeaderComponent: InspectorHeader,
    InspectorBackButtonComponent: InspectorBackButton,
  };

  const inspectorViewComponents = {
    InspectorEmptyState: InspectorEmptyStateView,
    InspectorClusterView: (props) => (
      <InspectorClusterViewView
        {...props}
        InspectorSummaryCardComponent={InspectorSummaryCard}
        InspectorClearSelectionButtonComponent={InspectorClearSelectionButton}
      />
    ),
    InspectorNodeView: (props) => (
      <InspectorNodeViewView
        {...props}
        InspectorSummaryCardComponent={InspectorSummaryCard}
        PersonMetadataCardComponent={PersonMetadataCard}
        MissingPersonMetadataCardComponent={MissingPersonMetadataCard}
        InspectorConnectedCorrespondentsComponent={InspectorConnectedCorrespondents}
        InspectorPersonPlacesComponent={InspectorPersonPlaces}
        LinkedLettersPanelComponent={LinkedLettersPanel}
        InspectorClearSelectionButtonComponent={InspectorClearSelectionButton}
      />
    ),
    InspectorEdgeView: (props) => (
      <InspectorEdgeViewView
        {...props}
        InspectorSummaryCardComponent={InspectorSummaryCard}
        LinkedLettersPanelComponent={LinkedLettersPanel}
        InspectorClearSelectionButtonComponent={InspectorClearSelectionButton}
      />
    ),
    InspectorLetterView: (props) => (
      <LinkedLetterDetailPage
        {...props}
        onBack={goBackInspector}
      />
    ),
  };

  const openDataWorkspace = () => {
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.DATA);
    setIsSidePanelOpen(false);
  };

  const openVisualizationsWorkspace = () => {
    setVisualizationsWorkspacePanel('place-map');
    setViewMode('geographic');
    setPersonLayoutMode('geographic');
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    setIsSidePanelOpen(false);
  };

  const useSampleData = () => {
    setIsSampleChooserOpen(true);
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.DATA);
    setIsSidePanelOpen(false);
  };

  const selectPlaceMapVisualization = () => {
    setVisualizationsWorkspacePanel('place-map');
    setViewMode('geographic');
    setPersonLayoutMode('geographic');
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    setIsSidePanelOpen(false);
  };

  const selectPeopleNetworkVisualization = () => {
    setVisualizationsWorkspacePanel('people-network');
    setViewMode('person');
    setPersonLayoutMode('geographic');
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    setIsSidePanelOpen(false);
  };

  const selectForceDirectedVisualization = () => {
    setVisualizationsWorkspacePanel('force-directed');
    setViewMode('person');
    setPersonLayoutMode('force');
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    setIsSidePanelOpen(false);
  };

  const openAnalyticsWorkspace = () => {
    setVisualizationsWorkspacePanel('analytics');
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.VISUALIZATIONS);
    setIsSidePanelOpen(false);
  };

  const openChartVisualization = (chartType) => {
    if (chartType) {
      setAnalyticsChartType(chartType);
    }
    openAnalyticsWorkspace();
  };

  const routeTutorialStepToWorkspace = (step) => {
    if (!step) return;

    if (step.workspace === 'home') {
      openHomeWorkspace();
      return;
    }

    if (step.workspace === 'search') {
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.SEARCH);
      setIsSidePanelOpen(false);
      return;
    }

    openVisualizationsWorkspace();
  };

  const startTutorial = () => {
    tutorialReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (!peridotNormalizedData) {
      setPendingTutorialSampleSelection(true);
      setIsSampleChooserOpen(true);
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.DATA);
      setIsSidePanelOpen(false);
      return;
    }
    const startStep = getPeridotTutorialStep(PERIDOT_TUTORIAL_START_INDEX);
    setTutorialStepIndex(PERIDOT_TUTORIAL_START_INDEX);
    setIsTutorialActive(true);
    routeTutorialStepToWorkspace(startStep);
  };

  const closeTutorial = () => {
    setIsTutorialActive(false);
    window.requestAnimationFrame(() => {
      const returnTarget = tutorialReturnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
      tutorialReturnFocusRef.current = null;
    });
  };

  const goToPreviousTutorialStep = () => {
    if (tutorialStepIndex <= PERIDOT_TUTORIAL_START_INDEX) {
      closeTutorial();
      openHomeWorkspace();
      return;
    }

    const nextIndex = tutorialStepIndex - 1;
    setTutorialStepIndex(nextIndex);
    routeTutorialStepToWorkspace(getPeridotTutorialStep(nextIndex));
  };

  const goToNextTutorialStep = () => {
    if (tutorialStepIndex >= PERIDOT_TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }

    const nextIndex = tutorialStepIndex + 1;
    setTutorialStepIndex(nextIndex);
    routeTutorialStepToWorkspace(getPeridotTutorialStep(nextIndex));
  };

  const activeTutorialStep = getPeridotTutorialStep(tutorialStepIndex);

  const homeWorkspaceProps = {
    onUploadData: openDataWorkspace,
    onUseSampleData: useSampleData,
    onStartTutorial: startTutorial,
  };

  const dataWorkspaceProps = {
    peridotFileLabel,
    peridotValidationSummary,
    columnMappingStaging,
    activeMappedDataSource: activeMappedDataSource?.isSampleData ? null : activeMappedDataSource,
    activeSampleDataSource: activeMappedDataSource?.isSampleData ? activeMappedDataSource : null,
    handleDownloadPeridotTemplate,
    handleColumnMappingTableUpload,
    openColumnMappingModal: () => setIsColumnMappingModalOpen(true),
    openActiveMappedDataEditor,
    clearColumnMappingStaging,
    onUseSampleData: useSampleData,
    sampleChooserOpen: isSampleChooserOpen,
    sampleDatasets: PERIDOT_SAMPLE_DATASETS.map((sample) => ({ ...sample, downloadUrl: getPeridotSampleDatasetUrl(sample) })),
    onCloseSampleChooser: () => { setIsSampleChooserOpen(false); setPendingTutorialSampleSelection(false); },
    onExploreSample: activatePeridotSampleData,
    onEditSampleMapping: editPeridotSampleMapping,
    sampleLoadingId,
  };

  const themeWorkspaceProps = {
    themePresetKey,
    applyThemePreset,
    resetTheme,
    onOpenVisualizations: openVisualizationsWorkspace,
  };

  const analyticsWorkspaceProps = {
    analyticsState: {
      chartType: analyticsChartType,
      setChartType: setAnalyticsChartType,
      barGroupBy: analyticsBarGroupBy,
      setBarGroupBy: setAnalyticsBarGroupBy,
      topN: analyticsTopN,
      setTopN: setAnalyticsTopN,
      availableFields: analyticsFields,
      chartData: analyticsChartData,
      rows: filteredRowsByTime,
    },
  };

  const timelineControlsProps = {
    currentRangeLabel,
    timelineMonths,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    currentPlaybackLabel,
    currentPlaybackSpeedLabel,
    playbackSpeedOptions,
    playbackSpeed,
    setPlaybackSpeed,
    isPlaying,
    setIsPlaying,
    playbackIndex,
    setPlaybackIndex,
    selectedRowsForPlayback,
    timelineMode,
    setTimelineMode,
    availableTemporalRoles,
    enabledTemporalRoles,
    setEnabledTemporalRoles,
    timelinePlaybackMode,
    setTimelinePlaybackMode,
  };

  const visualizationWorkspaceProps = {
    pageTitle,
    setPageTitle,
    mapStageProps,
    MapStageComponent: MapStage,
    viewMode,
    personLayoutMode,
    visualizationsWorkspacePanel,
    analyticsWorkspaceProps,
    onSelectPlaceMap: selectPlaceMapVisualization,
    onSelectPeopleNetwork: selectPeopleNetworkVisualization,
    onSelectForceDirected: selectForceDirectedVisualization,
    onOpenAnalytics: openAnalyticsWorkspace,
    onOpenChartVisualization: openChartVisualization,
    onOpenSearch: () => {
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.SEARCH);
      setIsSidePanelOpen(false);
    },
    onOpenExplore: () => {
      // Explore is now the product entry point for Advanced Search and dataset capabilities.
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.SEARCH);
      setIsSidePanelOpen(false);
    },
    timelineControlsProps,
    exportControls: {
      exportStatus,
      handleExportSvg,
      handleExportPng,
      handleExportEdgesCsv,
      handleExportNodesCsv,
      graph,
      defaultExportTitle: pageTitle,
    },
    visualizationAvailability,
  };

  const searchWorkspaceProps = {
    search,
    setSearch,
    personFilter,
    setPersonFilter,
    placeFilter,
    setPlaceFilter,
    routePlaceFilter,
    setRoutePlaceFilter,
    routePeopleFilter,
    setRoutePeopleFilter,
    capabilityFilters,
    setCapabilityFilters,
    structuredCriteria,
    setStructuredCriteria,
    personSuggestions: searchFilterSuggestions?.people || [],
    placeSuggestions: searchFilterSuggestions?.places || [],
    routePlaceSuggestions: searchFilterSuggestions?.placeRoutes || [],
    routePeopleSuggestions: searchFilterSuggestions?.peopleRoutes || [],
    currentMinCountLabel,
    currentRangeLabel,
    graph,
    rowDiagnostics,
    viewMode,
    minCount,
    setMinCount,
    timelineMonths,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    setTimelineMode,
    setIsPlaying,
    setPlaybackIndex,
    // Results and Refine use the committed Search + timeline-window scope.
    // They intentionally ignore playback progress. The graph prop remains
    // playback-visible, so map/network animation continues independently.
    searchRows: filteredRowsForActiveFilters,
    browseRows: normalizedRows,
    evidenceBrowseRows: normalizedLetters,
    onInspectSearchResult: openInspectorSearchResult,
    onOpenVisualizations: openVisualizationsWorkspace,
  };

  const openHomeWorkspace = () => {
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.HOME);
    setIsSidePanelOpen(false);
  };

  const openExploreWorkspaceFromMenu = () => {
    // The hamburger Explore entry should open Advanced Search directly.
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.SEARCH);
    setIsSidePanelOpen(false);
  };
  const openLearnMoreWorkspaceFromMenu = () => {
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.LEARN_MORE);
    setIsSidePanelOpen(false);
  };
  const openThemeWorkspaceFromMenu = () => {
    setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.THEME);
    setIsSidePanelOpen(false);
  };

  const closeCurrentSidePanel = () => {
    setIsSidePanelOpen(false);
  };

  const inspectorWorkspaceProps = {
    inspectorPanelProps,
    inspectorShellComponents,
    inspectorViewComponents,
    inspectorPresentationMode,
    onCloseInspectorWorkspace: closeInspectorWorkspace,
  };

  const exploreWorkspaceProps = {
    visualizationAvailability,
    workspaceInspectorPanelProps: inspectorPanelProps,
    inspectorShellComponents,
    inspectorViewComponents,
    onOpenSearch: () => {
      setResolvedWorkspaceMode(PERIDOT_WORKSPACE_MODES.SEARCH);
      setIsSidePanelOpen(false);
    },
    onOpenVisualizations: openVisualizationsWorkspace,
  };

  const learnMoreWorkspaceProps = {
    onOpenVisualizations: openVisualizationsWorkspace,
    onStartTutorial: startTutorial,
  };

  return (
    <div className={`${museumShellClassName()} peridot-redesign-root`} style={themeStyleVars} data-peridot-menu-redesign="true">
      <style>{`
          .peridot-redesign-root .absolute.top-3.z-50.flex.flex-col.items-center.gap-3.transition-all.duration-150 { display: none !important; }
          .peridot-redesign-root [class*="left-0"][class*="top-0"][class*="h-full"][class*="w-16"],
          .peridot-redesign-root [class*="left-0"][class*="top-0"][class*="min-h"][class*="w-16"],
          .peridot-redesign-root [class*="left-0"][class*="inset-y-0"][class*="w-16"],
          .peridot-redesign-root [class*="bg-[var(--sidebar-bg)]"][class*="w-16"] {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
          }
          .peridot-redesign-root aside[class*="w-[420px]"] {
            background: var(--peridot-role-inspector-chrome-bg) !important;
            backdrop-filter: blur(10px) saturate(0.92) !important;
            border-right-color: var(--peridot-role-inspector-card-border) !important;
          }
          .peridot-redesign-root aside[class*="w-[420px]"] > div[class*="overflow-auto"] {
            padding-right: 1.25rem !important;
          }
          .peridot-redesign-root main > .flex.h-full.flex-col > .shrink-0 {
            background: var(--title-bar-bg) !important;
          }
          .peridot-analytics-workspace select,
          .peridot-analytics-workspace input {
            min-height: 2.35rem !important;
          }
        `}</style>
      <div className="relative h-full">
        {workspaceMode !== PERIDOT_WORKSPACE_MODES.HOME ? (
          <>
            {/*
              Themes and Accessibility remains an internal routed workspace for
              development, but it is intentionally hidden from the public
              hamburger menu until the user-facing page is ready again. Restore
              `onOpenTheme={openThemeWorkspaceFromMenu}` on this menu component
              to re-enable that entry without changing the workspace itself.
            */}
            <PeridotHamburgerMenu
              open={isMainMenuOpen}
              onToggle={() => setIsMainMenuOpen((value) => !value)}
              onClose={() => setIsMainMenuOpen(false)}
              workspaceMode={workspaceMode}
              onOpenData={openDataWorkspace}
              onOpenVisualizations={openVisualizationsWorkspace}
              onOpenExplore={openExploreWorkspaceFromMenu}
              onOpenLearnMore={openLearnMoreWorkspaceFromMenu}
            />
          </>
        ) : null}
        {/*
          CONTROL PANEL MOUNT POINT
          This is where the entire left control-panel subtree enters the app.
          If the app loads but fails when the cog is clicked, the problem is
          usually somewhere inside the props consumed below this mount point,
          not in the top-level workspace shell itself.
        */}
        <LeftControlPanel
          {...leftControlPanelProps}
          inspectorPanelProps={inspectorPanelProps}
          inspectorShellComponents={inspectorShellComponents}
          inspectorViewComponents={inspectorViewComponents}
        />

        <PeridotColumnMappingModal
          open={isColumnMappingModalOpen}
          staging={columnMappingStaging}
          onClose={discardColumnMappingStaging}
          onSaveMapping={handleSaveColumnMappingState}
          onConfirmImport={handleConfirmColumnMappingImport}
          onResetSampleMapping={resetPeridotSampleMapping}
        />

        <AppMainWorkspace
          pageTitle={pageTitle}
          setPageTitle={setPageTitle}
          mapStageProps={mapStageProps}
          workspaceMode={workspaceMode}
          homeWorkspaceProps={homeWorkspaceProps}
          dataWorkspaceProps={dataWorkspaceProps}
          themeWorkspaceProps={themeWorkspaceProps}
          visualizationWorkspaceProps={visualizationWorkspaceProps}
          exploreWorkspaceProps={exploreWorkspaceProps}
          learnMoreWorkspaceProps={learnMoreWorkspaceProps}
          searchWorkspaceProps={searchWorkspaceProps}
          inspectorWorkspaceProps={inspectorWorkspaceProps}
        />
        {isTutorialActive ? (
          <PeridotTutorial
            step={activeTutorialStep}
            canGoBack
            isLastStep={tutorialStepIndex === PERIDOT_TUTORIAL_STEPS.length - 1}
            inspectorSelection={selectedProps}
            inspectorPresentationMode={inspectorPresentationMode}
            workspaceMode={workspaceMode}
            tutorialCapabilities={{
              hasTimelineDates: timelineMonths.length > 0,
              hasSelectableVisualization: Boolean(graph.nodes.length || graph.edges.length),
              hasSearchRows: searchRecords.length > 0,
              hasExportableVisualization: Boolean(
                visualizationAvailability.hasPointMap
                || visualizationAvailability.hasRouteMap
                || visualizationAvailability.hasNetwork
                || visualizationAvailability.hasCharts
              ),
            }}
            isMainMenuOpen={isMainMenuOpen}
            onReturnToStepWorkspace={() => routeTutorialStepToWorkspace(activeTutorialStep)}
            onOpenMainMenu={() => setIsMainMenuOpen(true)}
            onOpenExplore={openExploreWorkspaceFromMenu}
            onCloseInspector={closeInspectorWorkspace}
            onExpandInspector={expandInspectorToWorkspace}
            onRestartTutorial={startTutorial}
            onOpenData={() => {
              closeTutorial();
              openDataWorkspace();
            }}
            onBack={goToPreviousTutorialStep}
            onClose={closeTutorial}
            onContinue={goToNextTutorialStep}
          />
        ) : null}
      </div>
    </div>
  );
}


