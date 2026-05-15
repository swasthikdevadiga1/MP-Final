"""
agents/supervisor_agent.py — Supervisor / Router agent.

Routing logic:
  1. If query matches a simple FAQ pattern → FAQ Agent (no FAISS call).
  2. If query is too short / vague → polite clarification.
  3. Otherwise → Document Agent (RAG pipeline).

This keeps the system modular: add more agents here without touching other modules.
"""

from agents.faq_agent import faq_answer
from agents.document_agent import document_agent_run


def _is_too_short(query: str) -> bool:
    """Flag single-word or empty queries as too vague."""
    return len(query.strip().split()) < 2


def route_query(query: str) -> dict:
    """
    Entry point for every user message.

    Returns a standardized response dict:
        {
          "answer": str,
          "sources": list[str],       # [] for FAQ/clarification
          "chunks_used": int,         # 0 for FAQ/clarification
          "agent": str,               # "faq" | "document" | "supervisor"
        }
    """
    query = query.strip()

    # Guard: empty input
    if not query:
        return {
            "answer": "Please type your question and I'll do my best to help!",
            "sources": [],
            "chunks_used": 0,
            "agent": "supervisor",
        }

    # Route 1 — FAQ fast path
    faq_resp = faq_answer(query)
    if faq_resp:
        return {
            "answer": faq_resp,
            "sources": [],
            "chunks_used": 0,
            "agent": "faq",
        }

    # Route 2 — Too short / vague
    if _is_too_short(query):
        return {
            "answer": (
                "Could you please provide more details? "
                "For example: 'What is the fee structure for B.Tech?' "
                "or 'When does admission close?'"
            ),
            "sources": [],
            "chunks_used": 0,
            "agent": "supervisor",
        }

    # Route 3 — Document RAG agent (default)
    return document_agent_run(query)
