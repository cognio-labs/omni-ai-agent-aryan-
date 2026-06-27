"""
search.py — Deep multi-step web search module for OmniClient.

Uses the duckduckgo-search library (no API key required).
Implements multi-step aggregation:
  1. Initial search
  2. Extract sub-topics from snippets
  3. Follow-up searches on sub-topics
  4. Deduplicate + relevance-rank results
  5. Cache results in SQLite for 1 hour
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional

from sqlalchemy.orm import Session

from config import get_settings
from models import SearchCache

settings = get_settings()

CACHE_TTL_HOURS = 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def deep_search(
    query: str,
    db: Session,
    max_results: int = None,
) -> Dict:
    """
    Perform a multi-step deep web search and return structured results.

    Returns:
        {
            "query": str,
            "results": [{ title, url, snippet, source, relevance_score }],
            "sub_searches": [str],
            "cached": bool,
            "timestamp": str,
        }
    """
    if max_results is None:
        max_results = settings.max_search_results

    # Check cache
    cached = _get_cached(db, query)
    if cached:
        data = json.loads(cached.results_json)
        data["cached"] = True
        return data

    results: List[Dict] = []
    sub_topics_searched: List[str] = []

    # Step 1: Initial search
    initial = _ddg_search(query, max_results=max_results)
    results.extend(initial)

    # Step 2: Extract sub-topics from snippets
    sub_topics = _extract_sub_topics(query, initial)

    # Step 3: Follow-up searches (max 2)
    for topic in sub_topics[:2]:
        if topic and topic.lower() != query.lower():
            follow_up = _ddg_search(topic, max_results=3)
            results.extend(follow_up)
            sub_topics_searched.append(topic)

    # Step 4: Deduplicate + rank
    results = _deduplicate(results)
    results = _rank_by_relevance(query, results)
    results = results[:max_results + 4]  # Keep a few extra for context

    output = {
        "query": query,
        "results": results,
        "sub_searches": sub_topics_searched,
        "cached": False,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Cache result
    _store_cache(db, query, output)

    return output


def format_search_for_context(search_result: Dict) -> str:
    """Format deep search results as a markdown string for injection into AI context."""
    if not search_result.get("results"):
        return "No search results found."

    lines = [f"**Web Search Results for:** _{search_result['query']}_\n"]
    for i, r in enumerate(search_result["results"][:5], 1):
        lines.append(f"{i}. **{r.get('title', 'No title')}**")
        lines.append(f"   {r.get('snippet', '')}")
        lines.append(f"   🔗 {r.get('url', '')}\n")

    if search_result.get("sub_searches"):
        lines.append(f"\n*Also searched:* {', '.join(search_result['sub_searches'])}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ddg_search(query: str, max_results: int = 5) -> List[Dict]:
    """Run a DuckDuckGo text search and normalise results."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=max_results))
        results = []
        for r in raw:
            results.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
                "source": _extract_domain(r.get("href", "")),
                "relevance_score": 0.0,
            })
        return results
    except Exception as e:
        return [{"title": f"Search error: {e}", "url": "", "snippet": "", "source": "", "relevance_score": 0.0}]


def _extract_sub_topics(query: str, results: List[Dict]) -> List[str]:
    """
    Simple heuristic: extract noun phrases / keywords from snippets that
    are NOT in the original query and could be useful sub-topics.
    """
    query_words = set(re.findall(r"\w+", query.lower()))
    candidates: Dict[str, int] = {}

    for r in results:
        text = f"{r.get('title', '')} {r.get('snippet', '')}"
        # Extract 2-3 word phrases
        words = re.findall(r"[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?", text)
        for w in words:
            wl = w.lower()
            tokens = set(re.findall(r"\w+", wl))
            if not tokens.issubset(query_words) and len(wl) > 4:
                candidates[w] = candidates.get(w, 0) + 1

    # Sort by frequency
    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    return [f"{query} {c[0]}" for c in sorted_candidates[:3]]


def _deduplicate(results: List[Dict]) -> List[Dict]:
    """Remove duplicate URLs."""
    seen_urls: set = set()
    unique = []
    for r in results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(r)
    return unique


def _rank_by_relevance(query: str, results: List[Dict]) -> List[Dict]:
    """Score each result by simple keyword overlap with the query."""
    query_tokens = set(re.findall(r"\w+", query.lower()))
    for r in results:
        text = f"{r.get('title', '')} {r.get('snippet', '')}".lower()
        doc_tokens = set(re.findall(r"\w+", text))
        if query_tokens:
            overlap = len(query_tokens & doc_tokens) / len(query_tokens)
        else:
            overlap = 0.0
        r["relevance_score"] = round(overlap, 4)
    return sorted(results, key=lambda x: x["relevance_score"], reverse=True)


def _extract_domain(url: str) -> str:
    m = re.search(r"https?://(?:www\.)?([^/]+)", url)
    return m.group(1) if m else url


def _get_cached(db: Session, query: str) -> Optional[SearchCache]:
    cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)
    return (
        db.query(SearchCache)
        .filter(SearchCache.query == query, SearchCache.timestamp >= cutoff)
        .first()
    )


def _store_cache(db: Session, query: str, data: Dict) -> None:
    # Remove old entries for this query
    db.query(SearchCache).filter(SearchCache.query == query).delete()
    entry = SearchCache(query=query, results_json=json.dumps(data))
    db.add(entry)
    db.commit()
