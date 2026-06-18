"use client";

import { useState } from "react";
import type { ReportPayload } from "@/lib/types";

type ReportViewerProps = {
  report: ReportPayload | null;
};

export function ReportViewer({ report }: ReportViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Investment report</h2>
          <p className="text-xs text-slate-500">
            Parsed sections with raw output preserved.
          </p>
        </div>
        <button
          type="button"
          disabled={!report?.raw_report}
          onClick={() => setShowRaw((value) => !value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {showRaw ? "Show parsed" : "Show raw"}
        </button>
      </div>

      {!report ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No report yet. Start a session and wait for the executive agent to publish a
          final report.
        </div>
      ) : showRaw ? (
        <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
          {report.raw_report || "Raw report unavailable."}
        </pre>
      ) : (
        <div className="mt-4 space-y-3">
          {report.sections.map((section) => (
            <article key={section.id} className="rounded-md border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-950">{section.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {section.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
