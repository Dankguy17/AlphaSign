"use client";

import { FormEvent, useMemo, useState } from "react";

const defaultTickers = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "GOOGL",
  "META",
  "AMD",
  "NFLX",
  "SPY",
];

type TickerCommandProps = {
  disabled?: boolean;
  disabledReason?: string | null;
  onSubmit: (ticker: string) => void;
};

export function TickerCommand({
  disabled,
  disabledReason,
  onSubmit,
}: TickerCommandProps) {
  const [ticker, setTicker] = useState("NVDA");
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem("alphasign.recentTickers");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const suggestions = useMemo(() => {
    const query = ticker.trim().toUpperCase();
    return [...new Set([...recent, ...defaultTickers])]
      .filter((item) => !query || item.includes(query))
      .slice(0, 8);
  }, [recent, ticker]);

  function submit(nextTicker = ticker) {
    if (disabled) return;
    const normalized = nextTicker.trim().toUpperCase();
    if (!normalized) return;
    const nextRecent = [normalized, ...recent.filter((item) => item !== normalized)].slice(
      0,
      6,
    );
    setRecent(nextRecent);
    window.localStorage.setItem(
      "alphasign.recentTickers",
      JSON.stringify(nextRecent),
    );
    setTicker(normalized);
    onSubmit(normalized);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="panel-title">Start analysis</h2>
          <p className="panel-sub mt-1.5">
            Submit a ticker to launch a Band agent session.
          </p>
        </div>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="ticker">
          Ticker
        </label>
        <input
          id="ticker"
          value={ticker}
          maxLength={10}
          onChange={(event) => setTicker(event.target.value.toUpperCase())}
          placeholder="AAPL"
          className="h-11 min-w-0 flex-1 rounded-md border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-3.5 font-mono text-[15px] font-medium tracking-tight text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--primary-focus)]"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-describedby={disabledReason ? "ticker-submit-status" : undefined}
          className="btn-primary h-11 px-5 text-sm"
        >
          {disabled ? "Start unavailable" : "Run Band analysis"}
        </button>
      </form>
      {disabledReason ? (
        <p id="ticker-submit-status" className="mt-2.5 text-xs text-[var(--ink-subtle)]">
          {disabledReason}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Ticker suggestions">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => submit(item)}
            disabled={disabled}
            className="rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--primary-line)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
