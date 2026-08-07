/*
 * Phase 2.7 test harness for the universal upload prototype.
 *
 * This boundary is deliberately separate from Peridot's production import
 * pipeline. Files selected here are parsed with the existing workbook parser,
 * converted to the Phase 1 source-manifest shape, and handed to the universal
 * mapping prototype. No prototype mapping is committed to App.jsx, the active
 * dataset, correspondence/genealogy profiles, Search, Analytics, or Export.
 */

import React, { useMemo, useState } from 'react';
import { parsePeridotTableFile } from './peridotWorkbookParsing.js';
import { PeridotUniversalUploadPrototype } from './PeridotUniversalUploadPrototype.jsx';
import { buildPeridotUniversalPrototypeInput } from './peridotUniversalUploadTestHarness.js';

export function PeridotUniversalUploadTestHarness() {
  const [status, setStatus] = useState('idle');
  const [workbookModel, setWorkbookModel] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [latestInterpretation, setLatestInterpretation] = useState(null);

  const prototypeInput = useMemo(
    () => (workbookModel ? buildPeridotUniversalPrototypeInput(workbookModel) : null),
    [workbookModel],
  );

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMessage('');
    setWorkbookModel(null);
    setLatestInterpretation(null);

    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const parsed = await parsePeridotTableFile(file);
      if (parsed?.fileType === 'unsupported') {
        throw new Error(parsed?.warnings?.[0]?.message || 'Unsupported file type.');
      }
      setWorkbookModel(parsed);
      setStatus('ready');
      setIsOpen(true);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'The test file could not be read.');
      setIsOpen(false);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-dashed border-[var(--peridot-role-ornament-corner-muted)] bg-[#0d2911]/75 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="peridot-section-label">Experimental · Phase 2 test surface</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--peridot-role-interface-text-on-dark)]">Test the new universal mapper</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--peridot-role-interface-text-on-dark)]/80">
            Upload a CSV, TSV, XLS, or XLSX file here to try the new mapping workflow. This test does not import the file into Peridot or replace the current correspondence/genealogy mapper.
          </p>
          {status === 'ready' && workbookModel ? (
            <p className="mt-2 text-xs text-[var(--peridot-role-interface-text-on-dark)]/70">
              Ready: {workbookModel.fileName || 'uploaded file'} · {(workbookModel.sheets || []).length} sheet(s)
            </p>
          ) : null}
          {status === 'error' ? <p className="mt-2 text-sm text-rose-200">{errorMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="peridot-button-cream cursor-pointer whitespace-nowrap">
            {status === 'parsing' ? 'Reading file…' : 'Choose test file'}
            <input
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values"
              onChange={handleUpload}
              disabled={status === 'parsing'}
              className="sr-only"
            />
          </label>
          {prototypeInput ? (
            <button type="button" onClick={() => setIsOpen(true)} className="peridot-button-primary">
              Reopen prototype
            </button>
          ) : null}
        </div>
      </div>

      {latestInterpretation ? (
        <p className="mt-3 text-xs text-[var(--peridot-role-interface-text-on-dark)]/70">
          Prototype draft currently contains {latestInterpretation.savedVariables?.length || 0} saved variable(s). Nothing has been imported.
        </p>
      ) : null}

      {isOpen && prototypeInput ? (
        <div
          className="fixed inset-0 z-[10050] overflow-y-auto bg-[rgba(8,24,13,0.94)] p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Experimental universal upload mapper"
          style={{
            '--panel-bg': '#102d18',
            '--panel-card-bg': '#fbf7ea',
            '--panel-card-border': 'rgba(199, 155, 61, 0.44)',
            '--panel-card-text': '#102518',
            '--panel-card-muted-text': '#42533f',
            '--section-bg': '#f7f1dc',
            '--stat-card-bg': '#eee6c9',
            '--input-bg': '#fffaf0',
            '--input-border': 'rgba(74, 93, 62, 0.34)',
            '--input-text': '#102518',
            '--muted-text': '#66755f',
            '--button-primary-bg': '#c79b3d',
            '--button-primary-border': '#f0d27a',
            '--button-primary-text': '#07190c',
          }}
        >
          <div className="mx-auto max-w-[96rem] pb-10">
            <div className="sticky top-2 z-10 mb-3 flex items-center justify-between gap-4 rounded-xl border border-[var(--peridot-role-ornament-corner-muted)] bg-[var(--peridot-role-workspace-surface)] px-4 py-3 shadow-xl">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--peridot-role-interface-text-on-dark)]/70">Experimental test only</div>
                <div className="text-sm font-semibold text-[var(--peridot-role-interface-text-on-dark)]">Changes here do not alter the active Peridot dataset.</div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="peridot-button-cream">Close prototype</button>
            </div>
            <PeridotUniversalUploadPrototype
              key={workbookModel?.fileName || 'universal-prototype'}
              sourceManifest={prototypeInput.sourceManifest}
              sourceRowsByTableId={prototypeInput.sourceRowsByTableId}
              onChange={setLatestInterpretation}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
