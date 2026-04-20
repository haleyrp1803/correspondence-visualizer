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
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, serialized.width, serialized.height);
  context.drawImage(image, 0, 0, serialized.width, serialized.height);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('PNG blob unavailable');
  return pngBlob;
}

export function buildExportEdgeRows(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceLabel,
    target: edge.targetLabel,
    weight: edge.count,
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
