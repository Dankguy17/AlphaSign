import type { ReportPayload, ReportSection } from "@/lib/types";

const headingPattern =
  /^(#{1,3}\s*)?(executive summary|recommendation|confidence|bullish case|bearish case|risk case|catalysts|quantitative signals|narrative themes|news themes|source reliability|agent findings)\s*:?\s*$/i;

const sectionIds: Record<string, string> = {
  "executive summary": "summary",
  recommendation: "recommendation",
  confidence: "confidence",
  "bullish case": "bullish-case",
  "bearish case": "bearish-case",
  "risk case": "risk-case",
  catalysts: "catalysts",
  "quantitative signals": "quantitative-signals",
  "narrative themes": "narrative-themes",
  "news themes": "news-themes",
  "source reliability": "source-reliability",
  "agent findings": "agent-findings",
};

export function normalizeReport(payload: ReportPayload | null): ReportPayload | null {
  if (!payload) return null;
  if (payload.sections.length > 0) return payload;
  return {
    ...payload,
    sections: parseReportSections(payload.raw_report),
  };
}

export function parseReportSections(rawReport: string): ReportSection[] {
  const raw = rawReport.trim();
  if (!raw) return [];

  const sections: ReportSection[] = [];
  let activeTitle = "Executive Summary";
  let activeId = "summary";
  let content: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(headingPattern);
    if (match?.[2]) {
      pushSection(sections, activeId, activeTitle, content);
      activeTitle = toDisplayTitle(match[2]);
      activeId = sectionIds[match[2].toLowerCase()] ?? slugify(match[2]);
      content = [];
      continue;
    }
    content.push(line);
  }

  pushSection(sections, activeId, activeTitle, content);
  return sections.length > 0
    ? sections
    : [{ id: "raw-analysis", title: "Analysis", content: raw }];
}

function pushSection(
  sections: ReportSection[],
  id: string,
  title: string,
  content: string[],
) {
  const cleaned = content.join("\n").trim();
  if (cleaned) sections.push({ id, title, content: cleaned });
}

function toDisplayTitle(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
