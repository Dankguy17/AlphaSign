"use client";

import { reportDownloadUrl } from "@/lib/api";

export function ReportDownload({ sessionId }: { sessionId: string }) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = reportDownloadUrl(sessionId);
    a.download = `alphasign-report-${sessionId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <button
      onClick={handleDownload}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        backgroundColor: "var(--ds-primary)",
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: 500,
        cursor: "pointer",
        lineHeight: 1.2,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "var(--ds-primary-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "var(--ds-primary)";
      }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path
          d="M6.5 1v7.5M4 6l2.5 2.5L9 6M1.5 11h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Download Report
    </button>
  );
}
