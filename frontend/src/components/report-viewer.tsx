"use client";

import { useState } from "react";
import type { ReportPayload } from "@/lib/types";

type ReportViewerProps = {
  report: ReportPayload | null;
};

export function ReportViewer({ report }: ReportViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Investment report</h2>
          <p className="panel-sub mt-1.5">Parsed sections with raw output preserved.</p>
        </div>
        <button
          type="button"
          disabled={!report?.raw_report}
          onClick={() => setShowRaw((value) => !value)}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          {showRaw ? "Show parsed" : "Show raw"}
        </button>
      </div>

      {!report ? (
        <div className="empty-well mt-4 p-6 text-sm">
          No report yet. Start a session and wait for the executive agent to publish a final
          report.
        </div>
      ) : showRaw ? (
        <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--hairline)] bg-[var(--canvas)] p-4 font-mono text-xs leading-6 text-[var(--ink-muted)]">
          {report.raw_report || "Raw report unavailable."}
        </pre>
      ) : (
        <div className="mt-4 space-y-2.5">
          {report.sections.map((section) => (
            <article key={section.id} className="inset p-4">
              <h3 className="text-[13px] font-semibold tracking-tight text-[var(--ink)]">
                {section.title}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--ink-muted)]">
                {section.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
