/*
 * Pure genealogy mapping schema and validation helpers.
 *
 * Pass 3B.2 defines how arbitrary person-centered tables map into the exact
 * source-row vocabulary consumed by peridotGenealogyProfile.js. It does not
 * render mapping controls or activate genealogy import.
 */

export const PERIDOT_GENEALOGY_MAPPING_SCHEMA_VERSION = '1.0.0-draft';

export const PERIDOT_GENEALOGY_FIELD_GROUPS = Object.freeze({
  identity: Object.freeze(['Person_ID', 'Full_Name', 'WikiData', 'Image']),
  parents: Object.freeze(['Mother_ID', 'Mother_Name', 'Father_ID', 'Father_Name', 'Parents_Type']),
  partners: Object.freeze([
    'Partner_ID', 'Partner_Name', 'Partner_Title', 'Partnership_Type',
    'Partnership_Date_Type', 'Partnership_Year', 'Partnership_Month',
    'Partnership_Day', 'Partnership_Range_End', 'Ex_Partner_IDs',
  ]),
  birth: Object.freeze([
    'Birth_Date_Type', 'Birth_Year', 'Birth_Month', 'Birth_Day',
    'Birth_Range_End', 'Birth_Place', 'Birth_Coordinates',
  ]),
  death: Object.freeze([
    'Death_Date_Type', 'Death_Year', 'Death_Month', 'Death_Day',
    'Death_Range_End', 'Death_Place', 'Death_Coordinates',
  ]),
  attributes: Object.freeze([
    'Gender', 'Given_Names_Now', 'Surname_Now', 'Surname_At_Birth',
    'Profession', 'Company', 'Interests', 'Activities', 'Bio_Notes',
  ]),
});

const defs = [
  ['Person_ID', 'Person ID', 'ID', true, ['id','person id','person_id','individual id','individual_id','node id']],
  ['Full_Name', 'Full name', 'Full name', true, ['full name','name','person name','person_name','display name']],
  ['WikiData', 'Wikidata identifier', 'WikiData', false, ['wikidata','wikidata id','qid']],
  ['Image', 'Image URL', 'image', false, ['image','image url','portrait','portrait url']],
  ['Mother_ID', 'Mother ID', 'Mother ID', false, ['mother id','mother_id','maternal id']],
  ['Mother_Name', 'Mother name', 'Mother name', false, ['mother name','mother_name']],
  ['Father_ID', 'Father ID', 'Father ID', false, ['father id','father_id','paternal id']],
  ['Father_Name', 'Father name', 'Father name', false, ['father name','father_name']],
  ['Parents_Type', 'Parents type', 'Parents type', false, ['parents type','parent type','parent relationship type']],
  ['Partner_ID', 'Current partner ID', 'Partner ID', false, ['partner id','partner_id','spouse id','spouse_id']],
  ['Partner_Name', 'Current partner name', 'Partner name', false, ['partner name','spouse name']],
  ['Partner_Title', 'Partner title', 'Partner title', false, ['partner title','spouse title']],
  ['Partnership_Type', 'Partnership type', 'Partnership type', false, ['partnership type','relationship type','marriage type']],
  ['Partnership_Date_Type', 'Partnership date type', 'Partnership date type', false, ['partnership date type','marriage date type']],
  ['Partnership_Year', 'Partnership year', 'Partnership year', false, ['partnership year','marriage year','wedding year']],
  ['Partnership_Month', 'Partnership month', 'Partnership month', false, ['partnership month','marriage month','wedding month']],
  ['Partnership_Day', 'Partnership day', 'Partnership day', false, ['partnership day','marriage day','wedding day']],
  ['Partnership_Range_End', 'Partnership range end', 'Partnership range end', false, ['partnership range end','partnership end','marriage end']],
  ['Ex_Partner_IDs', 'Former partner IDs', 'Ex-partner IDs', false, ['ex partner ids','ex-partner ids','former partner ids','former_partner_ids']],
  ['Birth_Date_Type', 'Birth date type', 'Birth date type', false, ['birth date type']],
  ['Birth_Year', 'Birth year', 'Birth year', false, ['birth year','year of birth','born year']],
  ['Birth_Month', 'Birth month', 'Birth month', false, ['birth month','month of birth']],
  ['Birth_Day', 'Birth day', 'Birth day', false, ['birth day','day of birth']],
  ['Birth_Range_End', 'Birth range end', 'Birth range end', false, ['birth range end','birth end']],
  ['Birth_Place', 'Place of birth', 'place of birth', false, ['place of birth','birth place','birthplace']],
  ['Birth_Coordinates', 'Birth coordinates', 'coordinate location birth', false, ['coordinate location birth','birth coordinates','birth coordinate pair']],
  ['Death_Date_Type', 'Death date type', 'Death date type', false, ['death date type']],
  ['Death_Year', 'Death year', 'Death year', false, ['death year','year of death','died year']],
  ['Death_Month', 'Death month', 'Death month', false, ['death month','month of death']],
  ['Death_Day', 'Death day', 'Death day', false, ['death day','day of death']],
  ['Death_Range_End', 'Death range end', 'Death range end', false, ['death range end','death end']],
  ['Death_Place', 'Place of death', 'place of death', false, ['place of death','death place','deathplace']],
  ['Death_Coordinates', 'Death coordinates', 'coordinate location death', false, ['coordinate location death','death coordinates','death coordinate pair']],
  ['Gender', 'Gender', 'Gender', false, ['gender','sex']],
  ['Given_Names_Now', 'Given names now', 'Given names now', false, ['given names now','given names','first names']],
  ['Surname_Now', 'Surname now', 'Surname now', false, ['surname now','current surname','last name']],
  ['Surname_At_Birth', 'Surname at birth', 'Surname at birth', false, ['surname at birth','birth surname','maiden name']],
  ['Profession', 'Profession', 'Profession', false, ['profession','occupation','role']],
  ['Company', 'Company or institution', 'Company', false, ['company','institution','organization']],
  ['Interests', 'Interests', 'Interests', false, ['interests']],
  ['Activities', 'Activities', 'Activities', false, ['activities']],
  ['Bio_Notes', 'Biographical notes', 'Bio notes', false, ['bio notes','biographical notes','biography','notes']],
];

export const PERIDOT_GENEALOGY_FIELD_DEFINITIONS = Object.freeze(defs.map(([key,label,outputColumn,required,commonNames]) => Object.freeze({
  key, label, outputColumn, required, commonNames: Object.freeze(commonNames),
})));

export const PERIDOT_GENEALOGY_FIELDS = Object.freeze(PERIDOT_GENEALOGY_FIELD_DEFINITIONS.map((item) => item.key));
export const PERIDOT_GENEALOGY_REQUIRED_FIELDS = Object.freeze(PERIDOT_GENEALOGY_FIELD_DEFINITIONS.filter((item) => item.required).map((item) => item.key));
export const PERIDOT_GENEALOGY_DEFINITION_BY_KEY = Object.freeze(Object.fromEntries(PERIDOT_GENEALOGY_FIELD_DEFINITIONS.map((item) => [item.key,item])));

function asText(value) { return String(value ?? '').trim(); }
function normalize(value) {
  return asText(value).toLowerCase().replace(/["'’‘“”]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function unique(values=[]) { return Array.from(new Set(values.map(asText).filter(Boolean))); }

function score(header, definition) {
  const h=normalize(header), hl=h.replace(/\s+/g,'');
  if (!h) return 0;
  return [definition.key, definition.label, definition.outputColumn, ...(definition.commonNames||[])].reduce((best,candidate)=>{
    const c=normalize(candidate), cl=c.replace(/\s+/g,'');
    if (!c) return best;
    if (h===c) return Math.max(best,100);
    if (hl===cl) return Math.max(best,96);
    if (h.includes(c)||c.includes(h)) best=Math.max(best,72);
    const ht=new Set(h.split(' ')); const ct=c.split(' ');
    const shared=ct.filter((token)=>ht.has(token));
    if (shared.length) best=Math.max(best,Math.round(shared.length/ct.length*55));
    return best;
  },0);
}

export function suggestPeridotGenealogyFieldMappings(headers=[]) {
  const available=unique(headers); const used=new Set(); const suggestions={};
  PERIDOT_GENEALOGY_FIELD_DEFINITIONS.forEach((definition)=>{
    const candidates=available.filter((header)=>!used.has(header)).map((header)=>({header,score:score(header,definition)}))
      .filter((item)=>item.score>=55).sort((a,b)=>b.score-a.score||a.header.localeCompare(b.header));
    const best=candidates[0]||null;
    suggestions[definition.key]=Object.freeze({
      field:definition.key,
      sourceColumn:best?.header||'',
      confidence:!best?'none':best.score>=95?'high':best.score>=70?'medium':'low',
      score:best?.score||0,
      alternatives:Object.freeze(candidates.slice(1,5)),
    });
    if (best) used.add(best.header);
  });
  return Object.freeze(suggestions);
}

export function buildInitialPeridotGenealogyMappingState(headers=[], rows=[], options={}) {
  const suggestions=suggestPeridotGenealogyFieldMappings(headers);
  const fieldMapping=Object.fromEntries(PERIDOT_GENEALOGY_FIELDS.map((field)=>[field,suggestions[field]?.sourceColumn||'']));
  const validation=validatePeridotGenealogyMapping(headers, rows, fieldMapping);
  return Object.freeze({
    datasetProfileId:asText(options.datasetProfileId)||'peridot.genealogy-person-centered',
    schemaVersion:PERIDOT_GENEALOGY_MAPPING_SCHEMA_VERSION,
    fieldDefinitions:PERIDOT_GENEALOGY_FIELD_DEFINITIONS,
    fieldGroups:PERIDOT_GENEALOGY_FIELD_GROUPS,
    fieldSuggestions:suggestions,
    fieldMapping:Object.freeze(fieldMapping),
    validation,
    capabilitySummary:buildPeridotGenealogyCapabilitySummary(rows,fieldMapping,validation),
  });
}

function getMapped(row, mapping, field) {
  const column=asText(mapping?.[field]);
  return column ? row?.[column] ?? '' : '';
}

export function applyPeridotGenealogyMapping(rows=[], fieldMapping={}) {
  return rows.map((row)=>Object.fromEntries(PERIDOT_GENEALOGY_FIELD_DEFINITIONS.map((definition)=>[
    definition.outputColumn,
    getMapped(row,fieldMapping,definition.key),
  ])));
}

function parseRefTokens(value) { return asText(value).split(/\s+/).map(asText).filter(Boolean); }
function validCoordinatePair(value) {
  const text=asText(value); if (!text) return true;
  const parts=text.split(',').map((part)=>Number(part.trim()));
  return parts.length===2 && parts.every(Number.isFinite) && parts[0]>=-90 && parts[0]<=90 && parts[1]>=-180 && parts[1]<=180;
}

export function validatePeridotGenealogyMapping(headers=[], rows=[], fieldMapping={}) {
  const available=new Set(unique(headers)); const issues=[];
  Object.entries(fieldMapping||{}).forEach(([field,column])=>{
    if (!PERIDOT_GENEALOGY_FIELDS.includes(field)) issues.push({severity:'error',code:'unknown_genealogy_field',field,message:`${field} is not a supported genealogy role.`});
    if (asText(column)&&!available.has(column)) issues.push({severity:'error',code:'missing_genealogy_source_column',field,sourceColumn:column,message:`The mapped genealogy column “${column}” is not present in the uploaded table.`});
  });
  PERIDOT_GENEALOGY_REQUIRED_FIELDS.forEach((field)=>{
    if (!asText(fieldMapping?.[field])) issues.push({severity:'error',code:'missing_required_genealogy_mapping',field,message:`Map ${PERIDOT_GENEALOGY_DEFINITION_BY_KEY[field].label} before importing genealogy data.`});
  });

  const populated=rows.map((row,index)=>({row,index})).filter(({row})=>Object.values(row||{}).some((v)=>asText(v)));
  const idField=asText(fieldMapping?.Person_ID), nameField=asText(fieldMapping?.Full_Name);
  const ids=new Map();
  populated.forEach(({row,index})=>{
    const id=idField?asText(row?.[idField]):'';
    const name=nameField?asText(row?.[nameField]):'';
    if (idField&&!id) issues.push({severity:'error',code:'missing_person_id_value',rowNumber:index+2,message:`Populated row ${index+2} has no person ID.`});
    if (nameField&&!name) issues.push({severity:'warning',code:'missing_person_name_value',rowNumber:index+2,itemId:id,message:`Populated row ${index+2} has no full name; the source ID would become its label.`});
    if (id) {
      if (!ids.has(id)) ids.set(id,[]);
      ids.get(id).push(index+2);
    }
  });
  ids.forEach((rowNumbers,id)=>{
    if (rowNumbers.length>1) issues.push({severity:'error',code:'duplicate_person_id',itemId:id,rowNumbers,message:`Person ID “${id}” appears in rows ${rowNumbers.join(', ')}.`});
  });

  if (idField) {
    const known=new Set(ids.keys());
    const refs=[
      ['Mother_ID','mother'],['Father_ID','father'],['Partner_ID','partner']
    ];
    populated.forEach(({row,index})=>{
      refs.forEach(([field,label])=>{
        const value=getMapped(row,fieldMapping,field);
        if (asText(value)&&!known.has(asText(value))) issues.push({severity:'warning',code:'unresolved_genealogy_reference',field,rowNumber:index+2,relatedIds:[asText(value)],message:`Row ${index+2} references ${label} ID “${asText(value)}”, which is not present in the mapped person IDs.`});
      });
      parseRefTokens(getMapped(row,fieldMapping,'Ex_Partner_IDs')).forEach((value)=>{
        if (!known.has(value)) issues.push({severity:'warning',code:'unresolved_genealogy_reference',field:'Ex_Partner_IDs',rowNumber:index+2,relatedIds:[value],message:`Row ${index+2} references former partner ID “${value}”, which is not present in the mapped person IDs.`});
      });
      [['Birth_Coordinates','birth'],['Death_Coordinates','death']].forEach(([field,label])=>{
        const value=getMapped(row,fieldMapping,field);
        if (asText(value)&&!validCoordinatePair(value)) issues.push({severity:'warning',code:'invalid_genealogy_coordinate_pair',field,rowNumber:index+2,message:`Row ${index+2} has an invalid ${label} coordinate pair. Use latitude first, longitude second.`});
      });
    });
  }

  const errorCount=issues.filter((item)=>item.severity==='error').length;
  const warningCount=issues.filter((item)=>item.severity==='warning').length;
  return Object.freeze({
    isValid:errorCount===0,
    canContinue:errorCount===0,
    errorCount, warningCount,
    issues:Object.freeze(issues.map((item)=>Object.freeze(item))),
    populatedRowCount:populated.length,
    uniquePersonIdCount:ids.size,
  });
}

export function buildPeridotGenealogyCapabilitySummary(rows=[], fieldMapping={}, validation=null) {
  const mapped=(field)=>Boolean(asText(fieldMapping?.[field]));
  const result=validation||validatePeridotGenealogyMapping([],rows,fieldMapping);
  return Object.freeze({
    personIdentityReady:mapped('Person_ID')&&mapped('Full_Name')&&result.errorCount===0,
    parentRelationshipsReady:mapped('Person_ID')&&(mapped('Mother_ID')||mapped('Father_ID')),
    partnerRelationshipsReady:mapped('Person_ID')&&(mapped('Partner_ID')||mapped('Ex_Partner_IDs')),
    birthEventsReady:mapped('Person_ID')&&(mapped('Birth_Year')||mapped('Birth_Place')),
    deathEventsReady:mapped('Person_ID')&&(mapped('Death_Year')||mapped('Death_Place')),
    eventMapReady:mapped('Birth_Coordinates')||mapped('Death_Coordinates'),
    externalIdentifiersReady:mapped('WikiData'),
    imageReady:mapped('Image'),
    attributeCount:PERIDOT_GENEALOGY_FIELD_GROUPS.attributes.filter(mapped).length,
  });
}

export function makePeridotGenealogyWorkbookColumnRef(sheetName='',columnName='') {
  return Object.freeze({sheetName:asText(sheetName),columnName:asText(columnName)});
}
function workbookHeaders(workbookModel,sheetName) {
  return workbookModel?.sheets?.find((sheet)=>sheet.sheetName===sheetName)?.headers||[];
}
function workbookRows(workbookModel,sheetName) {
  return workbookModel?.sheets?.find((sheet)=>sheet.sheetName===sheetName)?.rows||[];
}

export function buildInitialPeridotGenealogyWorkbookMappingState(workbookModel, options={}) {
  const usable=(workbookModel?.sheets||[]).filter((sheet)=>(sheet.rowCount||0)>0&&(sheet.headers||[]).length);
  const scored=usable.map((sheet)=>{
    const suggestions=suggestPeridotGenealogyFieldMappings(sheet.headers||[]);
    const scoreTotal=(suggestions.Person_ID?.score||0)+(suggestions.Full_Name?.score||0)+Object.values(suggestions).filter((s)=>s.score>=95).length*5;
    return {sheetName:sheet.sheetName,rowCount:sheet.rowCount||0,score:scoreTotal};
  }).sort((a,b)=>b.score-a.score||b.rowCount-a.rowCount||a.sheetName.localeCompare(b.sheetName));
  const primarySheetName=scored[0]?.sheetName||usable[0]?.sheetName||'';
  const headers=workbookHeaders(workbookModel,primarySheetName);
  const rows=workbookRows(workbookModel,primarySheetName);
  const flat=buildInitialPeridotGenealogyMappingState(headers,rows,options);
  const fieldMappings=Object.fromEntries(Object.entries(flat.fieldMapping).map(([field,column])=>[
    field,column?makePeridotGenealogyWorkbookColumnRef(primarySheetName,column):makePeridotGenealogyWorkbookColumnRef('','')
  ]));
  const validation=validatePeridotGenealogyWorkbookMapping(workbookModel,{primarySheetName,fieldMappings});
  return Object.freeze({
    datasetProfileId:flat.datasetProfileId,
    schemaVersion:PERIDOT_GENEALOGY_MAPPING_SCHEMA_VERSION,
    primarySheetName,
    primaryPersonSheetSuggestions:Object.freeze(scored.map(Object.freeze)),
    fieldDefinitions:PERIDOT_GENEALOGY_FIELD_DEFINITIONS,
    fieldGroups:PERIDOT_GENEALOGY_FIELD_GROUPS,
    fieldMappings:Object.freeze(fieldMappings),
    validation,
    capabilitySummary:flat.capabilitySummary,
    assemblyScope:'primary-person-sheet-only',
  });
}

export function validatePeridotGenealogyWorkbookMapping(workbookModel,mappingState={}) {
  const primarySheetName=asText(mappingState.primarySheetName);
  const sheet=workbookModel?.sheets?.find((item)=>item.sheetName===primarySheetName);
  const issues=[];
  if (!primarySheetName) issues.push({severity:'error',code:'missing_genealogy_primary_sheet',message:'Choose the sheet whose rows represent people.'});
  else if (!sheet) issues.push({severity:'error',code:'invalid_genealogy_primary_sheet',message:`Genealogy person sheet “${primarySheetName}” is not present.`});
  const flat={};
  Object.entries(mappingState.fieldMappings||{}).forEach(([field,ref])=>{
    if (!PERIDOT_GENEALOGY_FIELDS.includes(field)) issues.push({severity:'error',code:'unknown_genealogy_field',field,message:`${field} is not a supported genealogy role.`});
    if (asText(ref?.sheetName)||asText(ref?.columnName)) {
      if (ref?.sheetName!==primarySheetName) issues.push({severity:'error',code:'genealogy_cross_sheet_mapping_not_yet_supported',field,message:`${field} must come from the primary person sheet during Pass 3B.2.`});
      else if (!(sheet?.headers||[]).includes(ref?.columnName)) issues.push({severity:'error',code:'missing_genealogy_workbook_column',field,message:`Column “${ref?.columnName}” is not present on sheet “${primarySheetName}”.`});
    }
    flat[field]=ref?.sheetName===primarySheetName?ref?.columnName||'':'';
  });
  const flatValidation=validatePeridotGenealogyMapping(sheet?.headers||[],sheet?.rows||[],flat);
  issues.push(...flatValidation.issues);
  const errorCount=issues.filter((item)=>item.severity==='error').length;
  return Object.freeze({isValid:errorCount===0,errorCount,warningCount:issues.filter((i)=>i.severity==='warning').length,issues:Object.freeze(issues.map(Object.freeze))});
}

export function applyPeridotGenealogyWorkbookMapping(workbookModel,mappingState={}) {
  const validation=validatePeridotGenealogyWorkbookMapping(workbookModel,mappingState);
  if (!validation.isValid) throw new Error(validation.issues.find((item)=>item.severity==='error')?.message||'Genealogy workbook mapping is invalid.');
  const sheet=workbookModel.sheets.find((item)=>item.sheetName===mappingState.primarySheetName);
  const flat=Object.fromEntries(Object.entries(mappingState.fieldMappings||{}).map(([field,ref])=>[field,ref?.columnName||'']));
  return applyPeridotGenealogyMapping(sheet?.rows||[],flat);
}


export const PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS = Object.freeze({
  unresolved: 'unresolved',
  exclude: 'exclude',
  attachPrevious: 'attach_previous',
});

export function getPeridotGenealogySupplementalRows(rows = [], fieldMapping = {}) {
  const idColumn = asText(fieldMapping?.Person_ID);
  if (!idColumn) return Object.freeze([]);
  let previousPersonRowIndex = null;
  const supplemental = [];

  rows.forEach((row = {}, index) => {
    const populated = Object.values(row).some((value) => asText(value));
    if (!populated) return;
    const personId = asText(row?.[idColumn]);
    if (personId) {
      previousPersonRowIndex = index;
      return;
    }
    supplemental.push(Object.freeze({
      rowIndex: index,
      rowNumber: index + 2,
      previousPersonRowIndex,
      previousPersonRowNumber: previousPersonRowIndex === null ? null : previousPersonRowIndex + 2,
      values: Object.freeze(Object.fromEntries(
        Object.entries(row).filter(([, value]) => asText(value))
      )),
    }));
  });

  return Object.freeze(supplemental);
}

export function applyPeridotGenealogySupplementalRowActions(
  rows = [],
  fieldMapping = {},
  supplementalRowActions = {},
) {
  const nextRows = rows.map((row) => ({ ...(row || {}) }));
  const supplementalRows = getPeridotGenealogySupplementalRows(rows, fieldMapping);
  const conflicts = [];
  const unresolved = [];
  const excluded = [];
  const attached = [];

  supplementalRows.forEach((item) => {
    const action = supplementalRowActions?.[item.rowIndex]
      || PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.unresolved;

    if (action === PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.exclude) {
      excluded.push(item.rowIndex);
      nextRows[item.rowIndex] = null;
      return;
    }

    if (action === PERIDOT_GENEALOGY_SUPPLEMENTAL_ROW_ACTIONS.attachPrevious) {
      if (item.previousPersonRowIndex === null || !nextRows[item.previousPersonRowIndex]) {
        unresolved.push(item.rowIndex);
        return;
      }

      const target = nextRows[item.previousPersonRowIndex];
      Object.entries(nextRows[item.rowIndex] || {}).forEach(([column, value]) => {
        const incoming = asText(value);
        if (!incoming) return;
        const existing = asText(target?.[column]);
        if (existing && existing !== incoming) {
          conflicts.push(Object.freeze({
            supplementalRowIndex: item.rowIndex,
            targetRowIndex: item.previousPersonRowIndex,
            column,
            existingValue: target[column],
            incomingValue: value,
          }));
          return;
        }
        if (!existing) target[column] = value;
      });
      attached.push(item.rowIndex);
      nextRows[item.rowIndex] = null;
      return;
    }

    unresolved.push(item.rowIndex);
  });

  return Object.freeze({
    rows: Object.freeze(nextRows.filter(Boolean).map((row) => Object.freeze(row))),
    supplementalRows,
    unresolvedRowIndexes: Object.freeze(unresolved),
    excludedRowIndexes: Object.freeze(excluded),
    attachedRowIndexes: Object.freeze(attached),
    conflicts: Object.freeze(conflicts),
    isResolved: unresolved.length === 0 && conflicts.length === 0,
  });
}

export function validatePeridotGenealogyMappingWithRowActions(
  headers = [],
  rows = [],
  fieldMapping = {},
  supplementalRowActions = {},
) {
  const resolution = applyPeridotGenealogySupplementalRowActions(
    rows,
    fieldMapping,
    supplementalRowActions,
  );
  const validation = validatePeridotGenealogyMapping(headers, resolution.rows, fieldMapping);
  const supplementalIssues = [];

  resolution.unresolvedRowIndexes.forEach((rowIndex) => {
    supplementalIssues.push({
      severity: 'error',
      code: 'unresolved_genealogy_supplemental_row',
      rowNumber: rowIndex + 2,
      message: `Choose whether populated row ${rowIndex + 2} should be excluded or attached to the preceding person.`,
    });
  });
  resolution.conflicts.forEach((conflict) => {
    supplementalIssues.push({
      severity: 'error',
      code: 'genealogy_supplemental_attachment_conflict',
      rowNumber: conflict.supplementalRowIndex + 2,
      message: `Row ${conflict.supplementalRowIndex + 2} conflicts with row ${conflict.targetRowIndex + 2} in column “${conflict.column}”; attachment will not overwrite the existing value.`,
    });
  });

  const issues = [...validation.issues, ...supplementalIssues];
  const errorCount = issues.filter((item) => item.severity === 'error').length;
  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  return Object.freeze({
    ...validation,
    isValid: errorCount === 0,
    canContinue: errorCount === 0,
    errorCount,
    warningCount,
    issues: Object.freeze(issues.map((item) => Object.freeze(item))),
    supplementalResolution: resolution,
  });
}
