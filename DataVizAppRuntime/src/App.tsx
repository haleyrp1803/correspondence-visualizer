// Core React hooks used throughout the app.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';

import { THEME_DEFAULTS, MAP_STYLE_PRESETS } from './theme/theme';
import {
  museumShellClassName,
  sidebarSurfaceClassName,
  groupCardClassName,
  sectionCardClassName,
  floatingCardClassName,
  panelHeadingClassName,
  groupHeadingClassName,
  sectionTitleClassName,
  detailLabelClassName,
  serifHeadingClassName,
  buttonClassName,
} from './components/ui/styleHelpers';
import {
  SAMPLE_GEOGRAPHY_CSV,
  SAMPLE_LETTERS_CSV,
  SAMPLE_PERSON_METADATA_CSV,
} from './data/defaultData';



// Static fallback data now lives in ./data/defaultData.

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

// Basic text normalization helpers.
function asText(value) {
  return String(value ?? '').trim();
}

function normalizeHeaderName(header) {
  return asText(header)
    .replace(/^﻿/, '')
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

// Historical date parser used by the timeline and sorting logic.
function parseHistoricalDate(rawValue) {
  const raw = asText(rawValue);
  if (!raw || raw === '0' || raw === '0000/00/00') {
    return {
      raw,
      isKnown: false,
      isTimelineUsable: false,
      monthKey: null,
      sortKey: null,
      label: 'Unknown date',
    };
  }

  const exact = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!exact) {
    return {
      raw,
      isKnown: true,
      isTimelineUsable: false,
      monthKey: null,
      sortKey: null,
      label: raw,
    };
  }

  const year = Number(exact[1]);
  const month = Number(exact[2]);
  const day = Number(exact[3]);
  const hasKnownYear = year > 0;
  const hasKnownMonth = month >= 1 && month <= 12;
  const hasKnownDay = day >= 1 && day <= 31;
  const isTimelineUsable = hasKnownYear && hasKnownMonth;
  const monthKey = isTimelineUsable ? `${year}-${String(month).padStart(2, '0')}` : null;

  return {
    raw,
    year: hasKnownYear ? year : null,
    month: hasKnownMonth ? month : null,
    day: hasKnownDay ? day : null,
    isKnown: hasKnownYear,
    isTimelineUsable,
    precision: hasKnownDay ? 'day' : hasKnownMonth ? 'month' : 'year',
    monthKey,
    sortKey: isTimelineUsable ? year * 100 + month : null,
    label: raw,
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
  const cleaned = rows.map((row) => ({
    date: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.date)),
    parsedDate: parseHistoricalDate(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.date)),
    sourceLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLoc)),
    sourceLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLat)),
    sourceLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLon)),
    sourcePerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourcePerson)),
    targetPerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetPerson)),
    targetLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLoc)),
    targetLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLat)),
    targetLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLon)),
  }));

  const placeMap = new Map();

  const addPlace = (label, lat, lon, roleHint) => {
    if (!label || !validCoord(lat, lon) || (lat === 0 && lon === 0)) return null;
    const key = makePlaceKey(label, lat, lon);
    if (!placeMap.has(key)) {
      placeMap.set(key, { id: key, label, lat, lon, type: 'place', roleHint });
    }
    return key;
  };

  const normalizedRows = cleaned.map((row, idx) => {
    const sourcePlaceId = addPlace(row.sourceLoc, row.sourceLat, row.sourceLon, 'source');
    const targetPlaceId = addPlace(row.targetLoc, row.targetLat, row.targetLon, 'target');
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

// Raw-letters-table normalization: maps uploaded headers into the inspector schema.
function normalizeLettersRows(rows) {
  return rows.map((row, idx) => {
    const source = asText(getFieldValue(row, LETTER_HEADER_ALIASES.source));
    const target = asText(getFieldValue(row, LETTER_HEADER_ALIASES.target));
    return {
      id: `letter_${idx + 1}`,
      archivalCollection: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalCollection)),
      archivalPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalPage)),
      pdfPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.pdfPage)),
      date: asText(getFieldValue(row, LETTER_HEADER_ALIASES.date)),
      parsedDate: parseHistoricalDate(getFieldValue(row, LETTER_HEADER_ALIASES.date)),
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
    if (row.date) bucket.dates.add(row.date);
    if (row.parsedDate?.monthKey) bucket.monthKeys.add(row.parsedDate.monthKey);
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
      const aDate = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
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

// Geographic graph builder: projected place nodes plus curved route paths.
function buildGraph(places, aggregatedEdges, width, height) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const edgeCountsByPlaceId = new Map();

  aggregatedEdges.forEach((edge) => {
    edgeCountsByPlaceId.set(edge.sourcePlaceId, (edgeCountsByPlaceId.get(edge.sourcePlaceId) || 0) + edge.count);
    edgeCountsByPlaceId.set(edge.targetPlaceId, (edgeCountsByPlaceId.get(edge.targetPlaceId) || 0) + edge.count);
  });

  const nodes = places.map((place) => {
    const projected = projectToSvg(place.lon, place.lat, width, height);
    const degree = edgeCountsByPlaceId.get(place.id) || 0;
    return {
      ...place,
      x: projected.x,
      y: projected.y,
      degree,
      radius: Math.max(5, Math.min(18, 5 + degree * 1.2)),
    };
  });

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

// Person-network graph builder for the alternate analytic view.
function buildPersonGraph(rows, width, height, layoutMode, minCount = 1, searchQuery = '') {
  const personMap = new Map();
  const edgeMap = new Map();

  rows.forEach((row) => {
    const source = row.sourcePerson;
    const target = row.targetPerson;
    if (!source || !target) return;

    if (!personMap.has(source)) {
      personMap.set(source, { id: source, label: source, appearances: 0, locationCounts: new Map() });
    }
    if (!personMap.has(target)) {
      personMap.set(target, { id: target, label: target, appearances: 0, locationCounts: new Map() });
    }

    const sourcePerson = personMap.get(source);
    const targetPerson = personMap.get(target);
    sourcePerson.appearances += 1;
    targetPerson.appearances += 1;

    if (validCoord(row.sourceLat, row.sourceLon) && !(row.sourceLat === 0 && row.sourceLon === 0)) {
      const key = `${row.sourceLoc}__${row.sourceLat}__${row.sourceLon}`;
      sourcePerson.locationCounts.set(key, (sourcePerson.locationCounts.get(key) || 0) + 1);
    }
    if (validCoord(row.targetLat, row.targetLon) && !(row.targetLat === 0 && row.targetLon === 0)) {
      const key = `${row.targetLoc}__${row.targetLat}__${row.targetLon}`;
      targetPerson.locationCounts.set(key, (targetPerson.locationCounts.get(key) || 0) + 1);
    }

    const edgeKey = `${source}-->${target}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, { id: edgeKey, source, target, count: 0, dates: new Set(), rows: [] });
    }
    const edge = edgeMap.get(edgeKey);
    edge.count += 1;
    if (row.date) edge.dates.add(row.date);
    edge.rows.push(row);
  });

  const q = searchQuery.trim().toLowerCase();
  const filteredEdgeRecords = Array.from(edgeMap.values()).filter((edge) => {
    if (edge.count < minCount) return false;
    if (!q) return true;
    const haystack = [
      edge.source,
      edge.target,
      ...Array.from(edge.dates),
      ...edge.rows.flatMap((row) => [row.sourceLoc, row.targetLoc, row.sourcePerson, row.targetPerson]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const peopleInUse = new Set();
  filteredEdgeRecords.forEach((edge) => {
    peopleInUse.add(edge.source);
    peopleInUse.add(edge.target);
  });

  let people = Array.from(personMap.values())
    .filter((person) => peopleInUse.has(person.id))
    .map((person, index, arr) => {
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
      } else {
        const angle = (index / Math.max(arr.length, 1)) * Math.PI * 2;
        const ring = 210 + (index % 5) * 24;
        x = width / 2 + Math.cos(angle) * ring;
        y = height / 2 + Math.sin(angle) * ring;
      }

      return {
        ...person,
        x,
        y,
        anchorLabel,
        isMappable,
        degree: 0,
        radius: Math.max(6, Math.min(20, 6 + Math.sqrt(person.appearances) * 1.4)),
      };
    });

  if (layoutMode === 'geographic') {
    people = people.filter((person) => person.isMappable);
  }

  const personById = new Map(people.map((p) => [p.id, p]));

  const edges = filteredEdgeRecords
    .map((edge) => {
      const source = personById.get(edge.source);
      const target = personById.get(edge.target);
      if (!source || !target) return null;
      source.degree += edge.count;
      target.degree += edge.count;
      return {
        ...edge,
        sourceLabel: source.label,
        targetLabel: target.label,
        path: curvedPath({ x: source.x, y: source.y }, { x: target.x, y: target.y }, layoutMode === 'geographic' ? 0.12 : 0.22),
        width: Math.max(1.5, Math.min(14, 1.5 + edge.count * 0.8)),
        letterMetadata: edge.rows,
        samplePairs: [`${edge.source} → ${edge.target}`],
        sources: [edge.source],
        targets: [edge.target],
        dates: Array.from(edge.dates),
      };
    })
    .filter(Boolean);

  people.forEach((p) => {
    p.radius = Math.max(6, Math.min(20, 6 + Math.sqrt(Math.max(p.degree, 1)) * 1.2));
  });

  return { nodes: people, edges };
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function slugifyFilenamePart(value, fallback = 'export') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function makeDownloadUrl(blob) {
  return URL.createObjectURL(blob);
}

function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  const needsQuotes = text.includes(',') || text.includes('"') || text.includes(String.fromCharCode(10));
  if (!needsQuotes) return text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return lines.join(String.fromCharCode(10));
}

function serializeSvgForExport(svgElement, options = {}) {
  const clone = svgElement.cloneNode(true);
  const viewBox = svgElement.viewBox?.baseVal;
  const baseWidth = Math.max(1, Math.round(viewBox?.width || svgElement.clientWidth || 1100));
  const baseHeight = Math.max(1, Math.round(viewBox?.height || svgElement.clientHeight || 760));
  const padding = 28;
  const subtitleLines = Array.isArray(options.subtitleLines) ? options.subtitleLines.filter(Boolean) : [];
  const titleText = String(options.title || '').trim();
  const headerHeight = titleText || subtitleLines.length ? 86 : 0;
  const width = baseWidth + padding * 2;
  const height = baseHeight + padding * 2 + headerHeight;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const movedContent = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (clone.firstChild) {
    movedContent.appendChild(clone.firstChild);
  }
  movedContent.setAttribute('transform', `translate(${padding} ${padding + headerHeight})`);
  clone.appendChild(movedContent);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', '#f8fafc');
  clone.insertBefore(background, clone.firstChild);

  if (headerHeight) {
    const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleNode.setAttribute('x', String(padding));
    titleNode.setAttribute('y', '38');
    titleNode.setAttribute('fill', '#0f172a');
    titleNode.setAttribute('font-size', '24');
    titleNode.setAttribute('font-weight', '700');
    titleNode.setAttribute('font-family', 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
    titleNode.textContent = titleText || 'Network map export';
    clone.appendChild(titleNode);

    subtitleLines.forEach((line, index) => {
      const subtitleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subtitleNode.setAttribute('x', String(padding));
      subtitleNode.setAttribute('y', String(62 + index * 16));
      subtitleNode.setAttribute('fill', '#475569');
      subtitleNode.setAttribute('font-size', '12');
      subtitleNode.setAttribute('font-weight', '500');
      subtitleNode.setAttribute('font-family', 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
      subtitleNode.textContent = line;
      clone.appendChild(subtitleNode);
    });
  }

  const markup = `<?xml version="1.0" encoding="UTF-8"?>
${new XMLSerializer().serializeToString(clone)}`;
  return { markup, width, height };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

function svgMarkupToDataUrl(svgMarkup) {
  const encoded = window.btoa(unescape(encodeURIComponent(svgMarkup)));
  return `data:image/svg+xml;base64,${encoded}`;
}

async function renderSvgElementToPngBlob(svgElement, options = {}) {
  const serialized = serializeSvgForExport(svgElement, options);
  let image;
  try {
    image = await loadImage(svgMarkupToDataUrl(serialized.markup));
  } catch (primaryError) {
    const svgBlob = new Blob([serialized.markup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = makeDownloadUrl(svgBlob);
    try {
      image = await loadImage(blobUrl);
    } finally {
      revokeObjectUrl(blobUrl);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = serialized.width;
  canvas.height = serialized.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context unavailable');
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, serialized.width, serialized.height);
  context.drawImage(image, 0, 0, serialized.width, serialized.height);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('PNG blob unavailable');
  return pngBlob;
}


// Shared theme tokens now live in ./theme/theme.
// Shared class/style helpers now live in ./components/ui/styleHelpers.


