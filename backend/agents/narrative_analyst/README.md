# Narrative Analyst Agent

This agent researches ticker news, builds a structured Narrative Radar, and asks the Signal Processing and Latent State agents targeted follow-up questions.

## Why this is unique

Instead of returning a plain news summary, the agent produces:

- bullish thesis
- bearish thesis
- catalysts
- risk flags
- missing evidence
- Signal Processing request
- Latent State request

That gives judges a visible multi-agent reasoning loop: the News agent does research, forms hypotheses, and asks the quant agents to verify or reject them.

## Free-first data path

1. `NEWS_API_KEY`, if available.
2. Yahoo Finance RSS, no key.
3. `yfinance.Ticker.news`, no key.
4. Optional Featherless/AI-ML API model for polished synthesis. The default
   Featherless model is `deepseek-ai/DeepSeek-V3-0324`, matching the hackathon
   setup guide's sample call.

## Local test

From `backend/`:

```bash
python scripts/test_narrative_agent_local.py
```

Live ticker test:

```bash
python scripts/test_narrative_agent_local.py --live MSFT
```

Run the Band-connected agent:

```bash
python -m agents.narrative_analyst.agent
```
