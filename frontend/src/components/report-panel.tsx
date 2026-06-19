"use client";

import { relativeTime, reportUrl } from "@/lib/alphasign";

type ReportPanelProps = {
  reportReady: boolean;
  reportTs: string | null;
};

export function ReportPanel({ reportReady, reportTs }: ReportPanelProps) {
  return (
    <section className="panel p-5">
      <h2 className="panel-title">Final report</h2>
      <p className="panel-sub mt-2">Executive PDF, compiled when the loop concludes.</p>

      {reportReady ? (
        <div className="mt-4 space-y-3">
          <div className="inset flex items-center gap-3 border-l-2 border-l-[var(--primary)] p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-hover)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 2h9l5 5v15H6z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--ink)]">
                alphasign_report.pdf
              </div>
              <div className="text-[11px] text-[var(--ink-subtle)]">
                Ready {relativeTime(reportTs)}
              </div>
            </div>
          </div>
          <a
            href={reportUrl}
            download="alphasign_report.pdf"
            className="btn-primary flex h-10 items-center justify-center text-sm"
          >
            Download report
          </a>
        </div>
      ) : (
        <div className="empty-well mt-4 flex items-center gap-3 p-4 text-sm">
          <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-[var(--ink-tertiary)]" />
          <span>Report pending — agents are still deliberating.</span>
        </div>
      )}
    </section>
  );
}
