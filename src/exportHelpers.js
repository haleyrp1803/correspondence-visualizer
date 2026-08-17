import { PERIDOT_COLORS } from './peridotColorPalette.js';
/*
 * Pure export helper utilities.
 * 
 * This module contains reusable routines for CSV serialization, SVG serialization, SVG-to-PNG rasterization, filename slugging, object URL lifecycle management, and node/edge row builders.
 * 
 * Important relationships:
 * - `App.jsx` and `PeridotVisualizationsWorkspace.jsx` wire these helpers into the header Export menu.
 * - Chart PNG export relies on SVG serialization behavior that is parallel to, but distinct from, map/network export.
 * - CSS variable inlining is needed so exported SVG/PNG files preserve the visible Peridot theme rather than losing CSS-driven colors.
 * 
 * Maintenance cautions:
 * - Always revoke object URLs after downloads.
 * - When changing SVG serialization, test both SVG download and PNG rendering in browser.
 *
 * Scope contract:
 * - This file serializes whatever rows/elements the caller passes. It does not
 *   know whether data is full-dataset, filtered, timeline-scoped, or playback-
 *   scoped.
 * - App/Visualizations must therefore pass the correct currently visible graph
 *   nodes/edges or chart SVG. Do not add filtering decisions here; keep export
 *   helpers pure and caller-driven.
 */

export function slugifyFilenamePart(value, fallback = 'export') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function makeDownloadUrl(blob) {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  const needsQuotes = text.includes(',') || text.includes('"') || text.includes(String.fromCharCode(10));
  if (!needsQuotes) return text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return lines.join(String.fromCharCode(10));
}

function resolveCssVariables(text, computedStyle, fallbackStyle) {
  if (typeof text !== 'string' || !text.includes('var(')) return text;

  return text.replace(/var\((--[^)\s,]+)(?:,[^)]+)?\)/g, (_, variableName) => {
    const resolved =
      computedStyle?.getPropertyValue(variableName)?.trim() ||
      fallbackStyle?.getPropertyValue(variableName)?.trim() ||
      '';
    return resolved || 'transparent';
  });
}

function inlineSvgVariables(originalNode, cloneNode, fallbackStyle) {
  if (!originalNode || !cloneNode || originalNode.nodeType !== 1 || cloneNode.nodeType !== 1) {
    return;
  }

  const computedStyle = window.getComputedStyle(originalNode);

  for (const attr of Array.from(cloneNode.attributes || [])) {
    const nextValue = resolveCssVariables(attr.value, computedStyle, fallbackStyle);
    if (nextValue !== attr.value) {
      cloneNode.setAttribute(attr.name, nextValue);
    }
  }

  const styleText = cloneNode.getAttribute('style');
  if (styleText) {
    const nextStyleText = resolveCssVariables(styleText, computedStyle, fallbackStyle);
    if (nextStyleText !== styleText) {
      cloneNode.setAttribute('style', nextStyleText);
    }
  }

  const cssBackedAttributes = [
    ['fill', 'fill'],
    ['stroke', 'stroke'],
    ['stop-color', 'stopColor'],
    ['color', 'color'],
    ['font-family', 'fontFamily'],
    ['font-style', 'fontStyle'],
    ['font-weight', 'fontWeight'],
  ];

  cssBackedAttributes.forEach(([attrName, styleName]) => {
    const attrValue = cloneNode.getAttribute(attrName);
    if (attrValue && attrValue !== 'none' && !attrValue.includes('var(')) return;

    const computedValue = computedStyle?.[styleName];
    if (computedValue && computedValue !== 'none') {
      cloneNode.setAttribute(attrName, computedValue);
    }
  });

  const originalChildren = Array.from(originalNode.children || []);
  const cloneChildren = Array.from(cloneNode.children || []);
  const childCount = Math.min(originalChildren.length, cloneChildren.length);

  for (let index = 0; index < childCount; index += 1) {
    inlineSvgVariables(originalChildren[index], cloneChildren[index], fallbackStyle);
  }
}

export function serializeSvgForExport(svgElement, options = {}) {
  const clone = svgElement.cloneNode(true);
  const rootComputedStyle = window.getComputedStyle(svgElement);
  inlineSvgVariables(svgElement, clone, rootComputedStyle);

  const viewBox = svgElement.viewBox?.baseVal;
  const baseWidth = Math.max(1, Math.round(viewBox?.width || svgElement.clientWidth || 1100));
  const baseHeight = Math.max(1, Math.round(viewBox?.height || svgElement.clientHeight || 760));
  const titleText = String(options.title || '').trim();
  const subtitleLines = Array.isArray(options.subtitleLines) ? options.subtitleLines.map((line) => String(line).trim()).filter(Boolean) : [];
  const footerLines = Array.isArray(options.footerLines) ? options.footerLines.map((line) => String(line).trim()).filter(Boolean) : [];

  /*
   * Export composition is opt-in. With no title or metadata selected, PNG/SVG
   * exports should be the visualization itself rather than a branded page
   * capture. When users opt into title/metadata, the annotation bands stay
   * attached to the visualization frame: the optional title sits directly above
   * the image and optional metadata sits directly below it. This avoids the
   * page-like white-space problem that made early map exports feel detached
   * from the rendered map.
   */
  const hasHeaderContent = Boolean(titleText || subtitleLines.length);
  const hasFooterContent = footerLines.length > 0;
  const annotationInset = hasHeaderContent || hasFooterContent ? 24 : 0;
  const titleFontSize = 34;
  const subtitleFontSize = 18;
  const footerFontSize = 18;
  const titleLineHeight = 40;
  const subtitleLineHeight = 24;
  const footerLineHeight = 24;
  const headerTopInset = hasHeaderContent ? 10 : 0;
  const headerBottomGap = hasHeaderContent ? 12 : 0;
  const titleBandHeight = titleText ? titleLineHeight : 0;
  const subtitleBandHeight = subtitleLines.length ? subtitleLines.length * subtitleLineHeight : 0;
  const headerHeight = hasHeaderContent ? headerTopInset + titleBandHeight + subtitleBandHeight + headerBottomGap : 0;
  const footerTopGap = hasFooterContent ? 12 : 0;
  const footerBottomInset = hasFooterContent ? 12 : 0;
  const footerHeight = hasFooterContent ? footerTopGap + footerLines.length * footerLineHeight + footerBottomInset : 0;
  const width = baseWidth;
  const height = baseHeight + headerHeight + footerHeight;
  const serifFont = "Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, serif";
  const uiFont = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const movedContent = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (clone.firstChild) {
    movedContent.appendChild(clone.firstChild);
  }
  movedContent.setAttribute('transform', `translate(0 ${headerHeight})`);
  clone.appendChild(movedContent);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', PERIDOT_COLORS.HEX_F8FAFC);
  clone.insertBefore(background, clone.firstChild);

  if (hasHeaderContent) {
    let currentY = headerTopInset;

    if (titleText) {
      const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleNode.setAttribute('x', String(annotationInset));
      titleNode.setAttribute('y', String(currentY + titleFontSize));
      titleNode.setAttribute('fill', PERIDOT_COLORS.HEX_0A2616 || PERIDOT_COLORS.HEX_0F172A);
      titleNode.setAttribute('font-size', String(titleFontSize));
      titleNode.setAttribute('font-weight', '700');
      titleNode.setAttribute('font-family', serifFont);
      titleNode.setAttribute('text-anchor', 'start');
      titleNode.textContent = titleText;
      clone.appendChild(titleNode);
      currentY += titleLineHeight;
    }

    subtitleLines.forEach((line) => {
      const subtitleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subtitleNode.setAttribute('x', String(annotationInset));
      subtitleNode.setAttribute('y', String(currentY + subtitleFontSize));
      subtitleNode.setAttribute('fill', PERIDOT_COLORS.HEX_475569);
      subtitleNode.setAttribute('font-size', String(subtitleFontSize));
      subtitleNode.setAttribute('font-weight', '600');
      subtitleNode.setAttribute('font-family', uiFont);
      subtitleNode.setAttribute('text-anchor', 'start');
      subtitleNode.textContent = line;
      clone.appendChild(subtitleNode);
      currentY += subtitleLineHeight;
    });
  }

  if (hasFooterContent) {
    let currentY = headerHeight + baseHeight + footerTopGap;

    footerLines.forEach((line) => {
      const footerNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      footerNode.setAttribute('x', String(annotationInset));
      footerNode.setAttribute('y', String(currentY + footerFontSize));
      footerNode.setAttribute('fill', PERIDOT_COLORS.HEX_475569);
      footerNode.setAttribute('font-size', String(footerFontSize));
      footerNode.setAttribute('font-weight', '600');
      footerNode.setAttribute('font-family', uiFont);
      footerNode.setAttribute('text-anchor', 'start');
      footerNode.textContent = line;
      clone.appendChild(footerNode);
      currentY += footerLineHeight;
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

export async function renderSvgElementToPngBlob(svgElement, options = {}) {
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
  context.fillStyle = PERIDOT_COLORS.HEX_F8FAFC;
  context.fillRect(0, 0, serialized.width, serialized.height);
  context.drawImage(image, 0, 0, serialized.width, serialized.height);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('PNG blob unavailable');
  return pngBlob;
}

// Convert the caller-provided graph edges to CSV rows. In current app flow the
// caller passes edges from the visible graph, so this exports the scoped
// visualization rather than the entire uploaded dataset.
export function buildExportEdgeRows(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceLabel,
    target: edge.targetLabel,
    weight: edge.count,
    direction: edge.direction || '',
    relationship_type: edge.relationshipType || '',
    relationship_label: edge.relationshipLabel || '',
    source_role: edge.sourceRole || '',
    target_role: edge.targetRole || '',
    dates: (edge.dates || []).join('; '),
    sources: (edge.sources || []).join('; '),
    targets: (edge.targets || []).join('; '),
    sample_pairs: (edge.samplePairs || []).join('; '),
    linked_letters: (edge.letterMetadata || []).length,
  }));
}

export function buildExportNodeRows(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    degree: node.degree,
    cluster_size: node.clusterSize || 1,
    is_cluster: node.isCluster ? 'yes' : 'no',
    latitude: node.lat ?? '',
    longitude: node.lon ?? '',
    anchor_location: node.anchorLabel || '',
  }));
}
