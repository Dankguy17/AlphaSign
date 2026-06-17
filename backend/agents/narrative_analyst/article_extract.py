"""
agents/narrative_analyst/article_extract.py

Article text extraction helpers. This is optional enrichment for the News
agent: headlines and descriptions are enough for a quick demo, but extracted
article text makes the narrative summary more grounded when available.
"""

from __future__ import annotations

import re
from typing import Any

import httpx


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?>.*?</\\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    return " ".join(html.split())


def extract_article_text(url: str, max_chars: int = 5000) -> dict[str, Any]:
    """
    Fetch and extract readable text from an article URL.

    Trafilatura is used when installed. If not installed or extraction fails,
    a basic HTML-stripping fallback is used. Returns a small dict instead of
    raising so the agent can continue even when a publisher blocks scraping.
    """
    if not url:
        return {"url": url, "text": "", "ok": False, "error": "missing url"}

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(
                url,
                headers={"User-Agent": "AlphaSignNarrativeAgent/0.1"},
            )
            response.raise_for_status()
            html = response.text
    except Exception as exc:
        return {"url": url, "text": "", "ok": False, "error": str(exc)}

    text = ""
    try:
        import trafilatura

        extracted = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
        text = extracted or ""
    except Exception:
        text = ""

    if not text:
        text = _strip_html(html)

    text = " ".join(text.split())[:max_chars]
    return {
        "url": url,
        "text": text,
        "ok": bool(text),
        "error": None if text else "no extractable text",
    }


if __name__ == "__main__":
    import json
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else ""
    print(json.dumps(extract_article_text(target), indent=2))
