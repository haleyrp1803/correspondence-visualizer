/*
 * Home / welcome workspace.
 *
 * This component provides Peridot's first orientation surface. The home page is
 * intentionally sparse: it establishes the tool's identity, gives a one-sentence
 * description, and routes users toward either the embedded sample dataset or
 * their own uploaded data.
 */

import React from 'react';

import peridotLogoTransparent from '../assets/Peridot Logo Gilded Transparent.png';
import homepageFiligree from '../assets/Adobe Stock Filigree 1.png';

function HomeTextureBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[var(--peridot-color-hex-03120c)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,var(--peridot-color-rgba-rgba-99-136-99-0-18),transparent_24%),radial-gradient(circle_at_72%_24%,var(--peridot-color-rgba-rgba-67-102-79-0-16),transparent_28%),radial-gradient(circle_at_50%_54%,var(--peridot-color-rgba-rgba-124-153-95-0-10),transparent_26%),linear-gradient(135deg,var(--peridot-role-interface-app-background)_0%,var(--peridot-role-interface-app-background-alt)_44%,var(--peridot-role-interface-app-background)_100%)]" />
      <div className="absolute inset-[-10%] opacity-50 blur-3xl bg-[linear-gradient(90deg,transparent_0%,var(--peridot-color-rgba-rgba-171-208-170-0-08)_16%,transparent_30%,var(--peridot-color-rgba-rgba-110-148-116-0-10)_52%,transparent_70%,var(--peridot-color-rgba-rgba-171-208-170-0-06)_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(135deg,var(--peridot-color-rgba-rgba-228-239-218-0-18)_0px,var(--peridot-color-rgba-rgba-228-239-218-0-18)_1px,transparent_1px,transparent_12px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--peridot-color-rgba-rgba-1-10-7-0-10)_55%,var(--peridot-color-rgba-rgba-1-10-7-0-38)_100%)]" />
    </div>
  );
}

function StageOrnament({ side = 'left' }) {
  const isRight = side === 'right';
  const xPosition = isRight ? 'left-[92.2%]' : 'left-[7.8%]';
  const rotationClass = isRight ? '-rotate-90' : 'rotate-90';
  const entranceClass = isRight ? 'peridot-appear-frame-right' : 'peridot-appear-frame-left';

  return (
    <div
      className={`${entranceClass} peridot-appear-delay-home-frame pointer-events-none absolute top-1/2 z-[1] ${xPosition}`}
      aria-hidden="true"
    >
      <img
        src={homepageFiligree}
        alt=""
        className={`block w-[73cqh] max-w-none -translate-x-1/2 -translate-y-1/2 ${rotationClass} opacity-100 drop-shadow-[0_0_18px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]`}
        draggable="false"
      />
    </div>
  );
}

const homeActionClass = [
  'group inline-flex h-[4.05cqw] w-[17.2cqw] shrink-0 items-center justify-center whitespace-nowrap rounded-full border text-center',
  'px-[1.6cqw] text-[0.82cqw] font-black uppercase tracking-[0.18em] shadow-[0_18px_46px_var(--peridot-color-rgba-rgba-0-0-0-0-28)]',
  'border-[var(--peridot-color-rgba-rgba-223-233-200-0-48)] bg-[var(--peridot-color-rgba-rgba-223-233-200-0-10)] text-[var(--peridot-color-hex-fbf7ea)]',
  'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--peridot-color-rgba-rgba-245-236-210-0-68)] focus:ring-offset-2 focus:ring-offset-[var(--peridot-color-hex-03120c)]',
  'hover:-translate-y-0.5 hover:border-[var(--peridot-color-rgba-rgba-245-236-210-0-88)] hover:bg-[var(--peridot-role-button-primary-hover-bg)] hover:text-[var(--peridot-color-hex-fff8e8)] hover:shadow-[0_22px_58px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]',
].join(' ');

export function PeridotHomeWorkspace({ onUploadData, onUseSampleData }) {
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-[var(--peridot-color-hex-03120c)] text-[var(--peridot-color-hex-f4f6df)]">
      <HomeTextureBackdrop />

      <div className="relative z-10 flex h-full w-full items-center justify-center px-[clamp(1rem,3vw,3rem)] py-[clamp(1rem,3vh,2.5rem)]">
        <div
          className="relative w-full max-w-[94rem] [container-type:size]"
          style={{
            aspectRatio: '2.22 / 1',
            width: 'min(92vw, calc((100vh - 4rem) * 2.22), 94rem)',
          }}
        >
          <StageOrnament side="left" />
          <StageOrnament side="right" />

          <div className="peridot-appear-soft peridot-appear-delay-1 pointer-events-none absolute left-[30%] top-1/2 z-[2] w-[30%]">
            <img
              src={peridotLogoTransparent}
              alt="Peridot"
              className="block h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_14px_26px_var(--peridot-color-rgba-rgba-0-0-0-0-38)]"
              draggable="false"
            />
          </div>

          <div className="absolute left-[66.4%] top-1/2 flex w-[38%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[6.2cqw]">
            <p className="peridot-appear-rise peridot-appear-delay-2 m-0 w-[88%] text-center font-[Georgia,'Palatino_Linotype','Book_Antiqua',Palatino,serif] text-[1.82cqw] font-normal leading-[1.28] tracking-[-0.012em] text-[var(--peridot-color-hex-f4f6df)] drop-shadow-[0_2px_14px_var(--peridot-color-rgba-rgba-0-0-0-0-34)]">
              Your go-to tool for exploring, visualizing, and presenting humanistic data.
            </p>

            <div className="peridot-appear-rise peridot-appear-delay-3 flex w-full flex-col items-center justify-center gap-[1.35cqw]">
              <div className="flex w-full flex-row items-center justify-center gap-[2.1cqw]">
                <button
                  type="button"
                  onClick={onUseSampleData}
                  className={homeActionClass}
                  aria-label="Start visualizing with Peridot sample data"
                >
                  Use sample data
                </button>

                <button
                  type="button"
                  onClick={onUploadData}
                  className={homeActionClass}
                  aria-label="Upload your own data"
                >
                  Upload your data
                </button>
              </div>

              <div className="group/tutorial relative flex items-center justify-center" tabIndex={0}>
                <button
                  type="button"
                  aria-disabled="true"
                  aria-describedby="peridot-home-tutorial-coming-soon"
                  className={`${homeActionClass} pointer-events-none opacity-40 grayscale`}
                  style={{ height: '3.15cqw' }}
                >
                  Tutorial
                </button>
                <span
                  id="peridot-home-tutorial-coming-soon"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-[calc(100%+0.7cqw)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--peridot-color-rgba-rgba-223-233-200-0-38)] bg-[var(--peridot-color-hex-03120c)] px-[0.9cqw] py-[0.42cqw] text-[0.68cqw] font-bold tracking-[0.08em] text-[var(--peridot-color-hex-f4f6df)] opacity-0 shadow-[0_12px_30px_var(--peridot-color-rgba-rgba-0-0-0-0-34)] transition-opacity duration-150 group-hover/tutorial:opacity-100 group-focus/tutorial:opacity-100"
                >
                  Tutorial coming soon.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
