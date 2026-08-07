/*
 * Data-management workspace.
 * 
 * This component renders the public data-ingestion surface: template download, table/workbook upload, mapping launch, workbook/table staging summaries, upload validation summaries, and navigation into Visualizations.
 * 
 * Important relationships:
 * - Parsing and normalization live in `peridotCsv*`, `peridotColumnMapping`, and `peridotWorkbook*` helpers, not here.
 * - `App.jsx` owns file input handlers and upload state; this component presents that state and actions.
 * 
 * Maintenance cautions:
 * - Keep wording clear that Peridot is permissive and capability-based: incomplete rows may be accepted even when they cannot support every visualization.
 */

import React from 'react';
import dataDividerFiligree from '../assets/Adobe Stock Filigree 3.png';
import { PeridotUniversalUploadTestHarness } from './PeridotUniversalUploadTestHarness.jsx';

export function PeridotDataWorkspace({
  peridotFileLabel,
  peridotValidationSummary,
  columnMappingStaging,
  datasetProfiles,
  selectedDatasetProfileId,
  onSelectDatasetProfile,
  handleDownloadPeridotTemplate,
  handleColumnMappingTableUpload,
  openColumnMappingModal,
  clearColumnMappingStaging,
  onOpenVisualizations,
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

        {/* The Data landing page now mirrors the Home workspace's minimal title-card logic:
            one orientation card followed by one decorative divider and three equal actions.
            The detailed workflow guidance remains inside the template/download, upload, and
            mapping flows instead of being repeated as explanatory cards on the landing surface. */}
        <div className="relative left-1/2 mt-10 mb-10 w-[calc(100%+4rem)] max-w-[calc(100vw-3rem)] -translate-x-1/2" aria-hidden="true">
          <img
            src={dataDividerFiligree}
            alt=""
            className="peridot-appear-soft peridot-appear-delay-1 block h-auto w-full select-none object-contain opacity-95 drop-shadow-[0_12px_22px_var(--peridot-role-card-shadow)]"
            draggable="false"
          />
        </div>

        <div className="mx-auto mb-8 max-w-4xl peridot-cream-card peridot-card-inner">
          <p className="peridot-section-label">Dataset structure</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--peridot-color-hex-26352b)]">
            What does one row represent?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--peridot-color-hex-42533f)]">
            Choose the profile that matches the primary unit in your uploaded table. This selection travels with the staged file and determines which mapping workflow Peridot opens.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(datasetProfiles || []).map((profile) => {
              const selected = profile.id === selectedDatasetProfileId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onSelectDatasetProfile?.(profile.id)}
                  className={[
                    'rounded-2xl border px-4 py-4 text-left transition',
                    selected
                      ? 'border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)] shadow-[0_10px_22px_var(--peridot-role-card-shadow)]'
                      : 'border-[var(--panel-card-border)] bg-[var(--stat-card-bg)] text-[var(--panel-card-text)] hover:border-[var(--button-primary-border)]',
                  ].join(' ')}
                  aria-pressed={selected}
                >
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                    One row = {profile.primaryRowType === 'person' ? 'one person' : 'one record'}
                  </span>
                  <span className="mt-1 block text-lg font-bold">{profile.label}</span>
                  <span className="mt-2 block text-sm leading-6 opacity-85">{profile.description}</span>
                  {profile.canConfirmImport ? null : (
                    <span className="mt-3 inline-flex rounded-full border border-current/25 px-2.5 py-1 text-xs font-semibold">
                      Routing preview — mapping fields follow in Pass 3B.2
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
              onClick={onOpenVisualizations}
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

        {columnMappingStaging ? (
          <div className="mx-auto mt-8 max-w-3xl peridot-cream-card peridot-card-inner">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="peridot-section-label">Staged table</p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--peridot-color-hex-26352b)]">Table staged for mapping</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--peridot-color-hex-42533f)]">
                  {columnMappingStaging.fileLabel} is staged as {columnMappingStaging.fileType || 'a table'} with {columnMappingStaging.rowCount || 0} rows and {columnMappingStaging.columnCount || 0} columns.
                  {' '}Profile: {columnMappingStaging.datasetProfile?.label || 'Correspondence / Directed Record'}.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openColumnMappingModal}
                  disabled={columnMappingStaging.status !== 'ready'}
                  className="peridot-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Open mapping workspace
                </button>
                <button type="button" onClick={clearColumnMappingStaging} className="peridot-button-cream">
                  Clear staged table
                </button>
              </div>
            </div>
          </div>
        ) : null}


        {!columnMappingStaging ? (
          <p className="mt-6 text-center text-sm text-[var(--peridot-color-hex-f7f2df-a70)]">
            Current source: <strong className="text-[var(--peridot-color-hex-fbf7ea)]">{peridotFileLabel}</strong>
          </p>
        ) : null}

        <PeridotUniversalUploadTestHarness />
      </div>
    </section>
  );
}
