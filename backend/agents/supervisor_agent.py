"""
agents/supervisor_agent.py — Supervisor / Router Agent (v2)

Routing:
  0. Empty            → clarification
  1. Too short        → clarification
  2. Image attached   → Image Agent   (Vision + RAG)
  3. FAQ match        → FAQ Agent     (instant)
  4. Syllabus query   → PDF Download Agent (RAG + PDF)
  5. Default          → Document Agent (standard RAG)
"""

from agents.faq_agent          import faq_answer
from agents.document_agent     import document_agent_run
from agents.pdf_download_agent import pdf_download_agent_run, is_syllabus_query
from agents.image_agent        import image_agent_run

_BASE = {
    "answer": "", "sources": [], "chunks_used": 0,
    "agent": "supervisor", "has_download": False,
    "download_url": None, "pdf_filename": None, "pdf_size_kb": None,
}


def route_query(query: str = "", image_b64: str = None, image_path: str = None) -> dict:
    """Main entry point for all user messages."""
    query = (query or "").strip()

    if not query:
        return {**_BASE, "answer":
            "Please type your question and I will do my best to help!"}

    if len(query.split()) < 2:
        return {**_BASE, "answer": (
            "Could you provide more details? For example:\n"
            "• What is the syllabus for B.Tech Computer Science?\n"
            "• When does admission close for MBA?\n"
            "• What is the fee structure for MCA?"
        )}

    # Image attached
    if image_b64 or image_path:
        return {**_BASE, **image_agent_run(query, image_b64, image_path)}

    # FAQ fast path
    faq = faq_answer(query)
    if faq:
        return {**_BASE, "answer": faq, "agent": "faq"}

    # Syllabus → PDF download
    if is_syllabus_query(query):
        return {**_BASE, **pdf_download_agent_run(query)}

    # Default RAG
    return {**_BASE, **document_agent_run(query)}
