/*
 * Dependency-free fixtures for Pass 3B.2 genealogy mapping schema.
 */

import {
  applyPeridotGenealogyMapping,
  applyPeridotGenealogyWorkbookMapping,
  buildInitialPeridotGenealogyMappingState,
  buildInitialPeridotGenealogyWorkbookMappingState,
  validatePeridotGenealogyMapping,
} from './peridotGenealogyMapping.js';

const HEADERS=Object.freeze([
  'Person ID','Name','Mother ID','Father ID','Partner ID','Former Partner IDs',
  'Birth Year','Birthplace','Birth Coordinates','Occupation','Wikidata',
]);
const ROWS=Object.freeze([
  Object.freeze({'Person ID':'P1',Name:'Parent One','Partner ID':'P2','Birth Year':'1600',Birthplace:'Florence','Birth Coordinates':'43.7696,11.2558',Occupation:'Ruler',Wikidata:'Q1'}),
  Object.freeze({'Person ID':'P2',Name:'Parent Two','Partner ID':'P1'}),
  Object.freeze({'Person ID':'C1',Name:'Child One','Mother ID':'P1','Father ID':'P2','Former Partner IDs':'MISSING'}),
]);

export function runPeridotGenealogyMappingSelfAudit() {
  const state=buildInitialPeridotGenealogyMappingState(HEADERS,ROWS,{datasetProfileId:'peridot.genealogy-person-centered'});
  const mapped=applyPeridotGenealogyMapping(ROWS,state.fieldMapping);
  const duplicateValidation=validatePeridotGenealogyMapping(HEADERS,[
    {'Person ID':'DUP',Name:'First'},
    {'Person ID':'DUP',Name:'Second'},
  ],state.fieldMapping);
  const workbook={sheets:[{sheetName:'People',headers:HEADERS,rows:ROWS,rowCount:ROWS.length,columnCount:HEADERS.length}]};
  const workbookState=buildInitialPeridotGenealogyWorkbookMappingState(workbook,{datasetProfileId:'peridot.genealogy-person-centered'});
  const workbookMapped=applyPeridotGenealogyWorkbookMapping(workbook,workbookState);

  const checks=Object.freeze({
    personIdSuggested:state.fieldMapping.Person_ID==='Person ID',
    fullNameSuggested:state.fieldMapping.Full_Name==='Name',
    parentRolesSuggested:state.fieldMapping.Mother_ID==='Mother ID'&&state.fieldMapping.Father_ID==='Father ID',
    formerPartnerSuggested:state.fieldMapping.Ex_Partner_IDs==='Former Partner IDs',
    birthFieldsSuggested:state.fieldMapping.Birth_Year==='Birth Year'&&state.fieldMapping.Birth_Place==='Birthplace',
    attributeSuggested:state.fieldMapping.Profession==='Occupation',
    exactProfileVocabularyProduced:mapped[0].ID==='P1'&&mapped[0]['Full name']==='Parent One'&&mapped[0].Profession==='Ruler',
    unresolvedReferenceWarned:state.validation.issues.some((item)=>item.code==='unresolved_genealogy_reference'&&item.relatedIds?.includes('MISSING')),
    warningDoesNotBlock:state.validation.isValid===true,
    duplicateIdBlocks:duplicateValidation.isValid===false&&duplicateValidation.issues.some((item)=>item.code==='duplicate_person_id'),
    capabilitySummaryDetected:state.capabilitySummary.personIdentityReady===true&&state.capabilitySummary.parentRelationshipsReady===true&&state.capabilitySummary.birthEventsReady===true,
    workbookPersonSheetSelected:workbookState.primarySheetName==='People',
    workbookMappingValid:workbookState.validation.isValid===true,
    workbookOutputMatchesFlat:JSON.stringify(workbookMapped)===JSON.stringify(mapped),
    schemaRemainsNonImporting:workbookState.assemblyScope==='primary-person-sheet-only',
  });

  return Object.freeze({
    passed:Object.values(checks).every(Boolean),
    checks,
    validation:state.validation,
    duplicateValidation,
    counts:Object.freeze({mappedRows:mapped.length,mappedFields:Object.values(state.fieldMapping).filter(Boolean).length}),
  });
}
