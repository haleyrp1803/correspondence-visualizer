/*
 * Data-management workspace.
 *
 * This component renders the public data-ingestion surface: template download,
 * sample-data entry, generalized table/workbook upload, mapping launch/editing,
 * staging summaries, and navigation into Visualizations.
 *
 * Important relationships:
 * - Parsing and normalization live in `peridotCsv*`, `peridotColumnMapping`, and
 *   `peridotWorkbook*` helpers, not here.
 * - `App.jsx` owns file input handlers, active mapped-source state, and transient
 *   mapping staging; this component only presents those actions and states.
 *
 * Maintenance cautions:
 * - The public landing surface intentionally has only three primary choices:
 *   template, sample data, and user data. Do not reintroduce profile selectors or
 *   experimental mapper entry points now that generalized mapping is authoritative.
 */

import React from 'react';
import dataDividerFiligree from '../assets/Adobe Stock Filigree 3.png';

export function PeridotDataWorkspace({
  peridotFileLabel,
  columnMappingStaging,
  activeMappedDataSource,
  handleDownloadPeridotTemplate,
  handleColumnMappingTableUpload,
  openColumnMappingModal,
  openActiveMappedDataEditor,
  clearColumnMappingStaging,
  onUseSampleData,
  sampleChooserOpen = false,
  sampleDatasets = [],
  onCloseSampleChooser,
  onExploreSample,
  onEditSampleMapping,
  sampleLoadingId = '',
  activeSampleDataSource = null,
}) {
  return (
    <section className="peridot-workspace-field flex min-h-full items-center text-[var(--peridot-color-hex-fbf7ea)]">
      <div className="peridot-workspace-frame w-full">
        <div className="peridot-appear-rise peridot-appear-delay-0 peridot-hero-card">
          <div>
            <p className="peridot-kicker">Data workspace</p>
            <h1 className="peridot-title-medium">Choose what data to use.</h1>
            <div className="mt-6 w-full space-y-5 text-base leading-8 text-[var(--peridot-role-interface-text-on-dark)]/90">
              <p>
                To use your own data in Peridot, please upload it as a CSV, TSV, XLS, or XLSX file. We'll help you assign variable roles that work best for your project, whether you are working with qualitative or quantitative information.
              </p>
              <p>
                Not sure where to start? Feel free to download a sample spreadsheet and adapt it to your data, or explore what Peridot can do with our sample data.
              </p>
            </div>
          </div>
        </div>

        <div className="relative left-1/2 mt-10 mb-10 w-[calc(100%+4rem)] max-w-[calc(100vw-3rem)] -translate-x-1/2" aria-hidden="true">
          <img
            src={dataDividerFiligree}
            alt=""
            className="peridot-appear-soft peridot-appear-delay-1 block h-auto w-full select-none object-contain opacity-95 drop-shadow-[0_12px_22px_var(--peridot-role-card-shadow)]"
            draggable="false"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="peridot-appear-rise peridot-appear-delay-2">
            <button
              type="button"
              onClick={handleDownloadPeridotTemplate}
              className="peridot-button-cream min-w-[18rem] whitespace-nowrap px-8 py-7 !border-[var(--peridot-data-button-border)] !bg-[var(--peridot-data-button-bg)] !text-[18px] !text-[var(--peridot-data-button-text)] hover:!border-[var(--peridot-role-ornament-corner)] hover:!bg-[linear-gradient(135deg,var(--peridot-role-button-primary-hover-bg),var(--peridot-role-ornament-line))] hover:!text-[var(--peridot-role-button-primary-text)] leading-tight"
              style={{
                '--peridot-data-button-bg': '#0f2912',
                '--peridot-data-button-border': 'var(--peridot-role-ornament-corner-muted)',
                '--peridot-data-button-text': 'color-mix(in srgb, var(--peridot-role-ornament-sparkle) 82%, #fff8e8 18%)',
              }}
            >
              Start with a Template
            </button>
          </div>

          <div className="peridot-appear-rise peridot-appear-delay-3">
            <button
              type="button"
              onClick={onUseSampleData}
              className="peridot-button-cream min-w-[18rem] whitespace-nowrap px-8 py-7 !border-[var(--peridot-data-button-border)] !bg-[var(--peridot-data-button-bg)] !text-[18px] !text-[var(--peridot-data-button-text)] hover:!border-[var(--peridot-role-ornament-corner)] hover:!bg-[linear-gradient(135deg,var(--peridot-role-button-primary-hover-bg),var(--peridot-role-ornament-line))] hover:!text-[var(--peridot-role-button-primary-text)] leading-tight"
              style={{
                '--peridot-data-button-bg': '#0f2912',
                '--peridot-data-button-border': 'var(--peridot-role-ornament-corner-muted)',
                '--peridot-data-button-text': 'color-mix(in srgb, var(--peridot-role-ornament-sparkle) 82%, #fff8e8 18%)',
              }}
            >
              Start with Sample Data
            </button>
          </div>

          <div className="peridot-appear-rise peridot-appear-delay-4">
            <label
              className="peridot-button-cream min-w-[18rem] cursor-pointer whitespace-nowrap px-8 py-7 !border-[var(--peridot-data-button-border)] !bg-[var(--peridot-data-button-bg)] !text-[18px] !text-[var(--peridot-data-button-text)] hover:!border-[var(--peridot-role-ornament-corner)] hover:!bg-[linear-gradient(135deg,var(--peridot-role-button-primary-hover-bg),var(--peridot-role-ornament-line))] hover:!text-[var(--peridot-role-button-primary-text)] leading-tight"
              style={{
                '--peridot-data-button-bg': '#0f2912',
                '--peridot-data-button-border': 'var(--peridot-role-ornament-corner-muted)',
                '--peridot-data-button-text': 'color-mix(in srgb, var(--peridot-role-ornament-sparkle) 82%, #fff8e8 18%)',
              }}
            >
              Upload Your Data
              <input type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values" onChange={handleColumnMappingTableUpload} className="sr-only" />
            </label>
          </div>
        </div>

        {sampleChooserOpen ? (
          <div className="mx-auto mt-8 max-w-5xl peridot-cream-card peridot-card-inner">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="peridot-section-label">Sample data</p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--peridot-color-hex-26352b)]">Choose an ordinary sample file.</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peridot-color-hex-42533f)]">
                  Each sample passes through the same generalized mapping system as your own uploads. Explore it with its saved mapping, edit that interpretation to see how different choices change the result, or download the original source file and adapt it for your own project.
                </p>
              </div>
              <button type="button" onClick={onCloseSampleChooser} className="peridot-button-cream">Close samples</button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {sampleDatasets.map((sample) => {
                const isLoading = sampleLoadingId === sample.id;
                return (
                  <article key={sample.id} className="rounded-2xl border border-[var(--peridot-role-card-border)] bg-[var(--peridot-role-card-bg)] p-5">
                    <p className="peridot-section-label">{sample.format}</p>
                    <h3 className="mt-2 text-xl font-bold text-[var(--peridot-color-hex-26352b)]">{sample.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--peridot-color-hex-42533f)]">{sample.description}</p>
                    <p className="mt-3 text-xs leading-5 text-[var(--peridot-color-hex-42533f)]/80">{sample.teachingNote}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onExploreSample?.(sample.id)}
                        disabled={isLoading}
                        className="peridot-button-primary disabled:cursor-wait disabled:opacity-60"
                      >
                        {isLoading ? 'Loading…' : 'Explore sample'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSampleMapping?.(sample.id)}
                        disabled={isLoading}
                        className="peridot-button-cream disabled:cursor-wait disabled:opacity-60"
                      >
                        Edit mapping
                      </button>
                      <a
                        href={sample.downloadUrl}
                        download={sample.fileName}
                        className="peridot-button-cream inline-flex items-center justify-center"
                      >
                        Download source
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {columnMappingStaging ? (
          <div className="mx-auto mt-8 max-w-3xl peridot-cream-card peridot-card-inner">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="peridot-section-label">Staged data</p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--peridot-color-hex-26352b)]">
                  {columnMappingStaging.editingActiveData ? 'Mapped data ready to edit' : 'Data staged for mapping'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--peridot-color-hex-42533f)]">
                  {columnMappingStaging.fileLabel} contains {columnMappingStaging.rowCount || 0} rows and {columnMappingStaging.columnCount || 0} columns{columnMappingStaging.sheetCount > 1 ? ` across ${columnMappingStaging.sheetCount} sheets` : ''}.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openColumnMappingModal}
                  disabled={columnMappingStaging.status !== 'ready'}
                  className="peridot-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {columnMappingStaging.editingActiveData ? 'Continue editing' : 'Open mapping workspace'}
                </button>
                <button type="button" onClick={clearColumnMappingStaging} className="peridot-button-cream">
                  {columnMappingStaging.editingActiveData ? 'Cancel edit' : 'Clear staged data'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--peridot-color-hex-f7f2df-a70)]">
            <span>
              Current source: <strong className="text-[var(--peridot-color-hex-fbf7ea)]">{peridotFileLabel}</strong>
            </span>
            {activeSampleDataSource ? (
              <button
                type="button"
                onClick={() => onEditSampleMapping?.(activeSampleDataSource.sampleDatasetId)}
                className="rounded-full border border-[var(--peridot-role-ornament-line)] px-4 py-2 font-semibold text-[var(--peridot-color-hex-fbf7ea)] transition hover:bg-[var(--peridot-role-button-primary-hover-bg)]"
              >
                Edit sample mapping
              </button>
            ) : activeMappedDataSource ? (
              <button
                type="button"
                onClick={openActiveMappedDataEditor}
                className="rounded-full border border-[var(--peridot-role-ornament-line)] px-4 py-2 font-semibold text-[var(--peridot-color-hex-fbf7ea)] transition hover:bg-[var(--peridot-role-button-primary-hover-bg)]"
              >
                Edit mapped data
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
