"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, AGENT_BY_ID, AgentId, AgentMessage, relativeTime } from "@/lib/alphasign";
import { formatDateTime } from "@/lib/formatters";
import { Skeleton } from "@/components/skeleton";
import type { StreamStatus } from "@/hooks/use-alphasign-stream";
import type { ProtocolCardEvent } from "@/lib/alphasign";

type MessageStreamProps = {
  messages: AgentMessage[];
  cards: ProtocolCardEvent[];
  selected: AgentId | "all";
  onSelect: (agent: AgentId | "all") => void;
  status: StreamStatus;
};

const CLAMP_CHARS = 320;

export function MessageStream({
  messages,
  cards,
  selected,
  onSelect,
  status,
}: MessageStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const filtered =
    selected === "all" ? messages : messages.filter((m) => m.agent === selected);
  const filteredCards = selected === "all" ? cards : cards.filter((event) => event.agent === selected);

  // Keep pinned to the newest message while the user hasn't scrolled away.
  useEffect(() => {
    if (autoFollow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoFollow]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setAutoFollow(nearBottom);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAutoFollow(true);
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const filters: { id: AgentId | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...AGENTS.map((a) => ({ id: a.id, label: a.short })),
  ];

  return (
    <section className="panel flex max-h-[calc(100vh-8rem)] min-h-[28rem] flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Live transcript</h2>
          <p className="panel-sub mt-2">
            Streaming agent messages from the Band room ·{" "}
            <span className="font-mono text-[var(--ink-muted)]">{status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by agent">
          {filters.map((f) => {
            const active = selected === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(f.id)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]"
                    : "border-[var(--hairline)] bg-[var(--surface-2)] text-[var(--ink-subtle)] hover:text-[var(--ink)]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative mt-4 flex-1 space-y-2.5 overflow-auto rounded-md border border-[var(--hairline)] p-3"
      >
        {filteredCards.length === 0 && status === "connecting" ? (
          <div className="min-h-[16rem] space-y-3 p-2" aria-busy="true" aria-label="Connecting to agent stream">
            {[0, 1, 2].map((item) => (
              <div key={item} className="inset space-y-3 p-4">
                <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="empty-well flex h-full min-h-[16rem] items-center justify-center p-6 text-center text-sm">
            {status === "disconnected"
              ? "Adapter offline. Start the backend, then reconnect."
              : "Waiting for agents to post into the Band room…"}
          </div>
        ) : (
          filteredCards.map((event, index) => {
            const message = messages.find((item) => item.agent === event.agent && item.ts === event.source_ts);
            const card = event.card;
            const meta = AGENT_BY_ID[event.agent];
            const key = `${event.agent}-${event.source_ts}-${index}`;
            const rawText = message?.text ?? "";
            const long = rawText.length > 0;
            const isOpen = expanded.has(key);
            const text =
              rawText.length > CLAMP_CHARS && !isOpen ? `${rawText.slice(0, CLAMP_CHARS)}…` : rawText;
            return (
              <article
                key={key}
                className="rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-hover)]">
                      {meta?.name ?? event.agent} · {card.kind}
                    </span>
                    <span className="text-[11px] text-[var(--ink-tertiary)]">
                      {formatDateTime(event.ts)} · {relativeTime(event.ts)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(key, card.summary)}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--ink-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
                  >
                    {copied === key ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div><h3 className="text-sm font-semibold text-[var(--ink)]">{card.title}</h3><p className="mt-1 text-[13px] leading-6 text-[var(--ink-muted)]">{card.summary}</p></div>
                  <span className="chip shrink-0 capitalize">{card.stance}</span>
                </div>
                {card.metrics.length ? <dl className="mt-3 grid grid-cols-2 gap-2">{card.metrics.map((metric) => <div key={`${metric.label}-${metric.value}`} className="inset p-2.5"><dt className="text-[10px] uppercase text-[var(--ink-tertiary)]">{metric.label}</dt><dd className="mt-1 text-xs font-medium text-[var(--ink)]">{metric.value}</dd></div>)}</dl> : null}
                {card.evidence.length ? <ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--ink-muted)]">{card.evidence.map((item) => <li key={item}>• {item}</li>)}</ul> : null}
                {card.next_action ? <p className="mt-3 border-l-2 border-[var(--primary)] pl-2.5 text-xs text-[var(--ink-subtle)]">Next: {card.next_action}</p> : null}
                {long ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    className="mt-1.5 text-[12px] font-medium text-[var(--primary-hover)] hover:underline"
                  >
                    {isOpen ? "Hide raw transcript" : "Show raw transcript"}
                  </button>
                ) : null}
                {isOpen ? <pre className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--surface-3)] p-3 text-[11px] leading-5 text-[var(--ink-subtle)]">{text}</pre> : null}
              </article>
            );
          })
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--ink-tertiary)]">
        <span>
          {filteredCards.length} {selected === "all" ? "cards" : "from " + AGENT_BY_ID[selected]?.short}
        </span>
        {!autoFollow && filtered.length > 0 ? (
          <button
            type="button"
            onClick={jumpToLatest}
            className="btn-secondary px-2.5 py-1 text-[11px]"
          >
            ↓ Jump to latest
          </button>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
            Following
          </span>
        )}
      </div>
    </section>
  );
}
