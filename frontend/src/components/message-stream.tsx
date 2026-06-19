"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, AGENT_BY_ID, AgentId, AgentMessage, relativeTime } from "@/lib/alphasign";
import { formatDateTime } from "@/lib/formatters";
import type { StreamStatus } from "@/hooks/use-alphasign-stream";

type MessageStreamProps = {
  messages: AgentMessage[];
  selected: AgentId | "all";
  onSelect: (agent: AgentId | "all") => void;
  status: StreamStatus;
};

const CLAMP_CHARS = 320;

export function MessageStream({
  messages,
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
        {filtered.length === 0 ? (
          <div className="empty-well flex h-full min-h-[16rem] items-center justify-center p-6 text-center text-sm">
            {status === "disconnected"
              ? "Adapter offline. Start the backend, then reconnect."
              : "Waiting for agents to post into the Band room…"}
          </div>
        ) : (
          filtered.map((message, index) => {
            const meta = AGENT_BY_ID[message.agent];
            const key = `${message.agent}-${message.ts}-${index}`;
            const long = message.text.length > CLAMP_CHARS;
            const isOpen = expanded.has(key);
            const text =
              long && !isOpen ? `${message.text.slice(0, CLAMP_CHARS)}…` : message.text;
            return (
              <article
                key={key}
                className="rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-hover)]">
                      {meta?.name ?? message.agent}
                    </span>
                    <span className="text-[11px] text-[var(--ink-tertiary)]">
                      {formatDateTime(message.ts)} · {relativeTime(message.ts)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(key, message.text)}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--ink-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
                  >
                    {copied === key ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--ink-muted)]">
                  {text}
                </p>
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
                    {isOpen ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--ink-tertiary)]">
        <span>
          {filtered.length} {selected === "all" ? "messages" : "from " + AGENT_BY_ID[selected]?.short}
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
