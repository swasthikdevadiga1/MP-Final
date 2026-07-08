"""
agents/pdf_download_agent.py
Triggers on syllabus/course queries — runs RAG then generates a downloadable PDF.
"""

import re
from services.rag_service import rag_query
from services.pdf_generator_service import generate_syllabus_pdf
from services.embedding_service import similarity_search

_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r"\bsyllabus\b", r"\bcurriculum\b", r"\bsubjects?\b",
    r"\bcourse\s+content\b", r"\btopics?\s+covered\b",
    r"\bmodules?\b", r"\bunits?\b", r"\bexam\s+pattern\b",
    r"\bpaper\s+structure\b", r"\bmark\s+scheme\b",
    r"\btimetable\b", r"\bschedule\b", r"\bclass\s+timing\b",
    r"\blecture\s+plan\b", r"\bstudy\s+plan\b",
]]


def is_syllabus_query(query: str) -> bool:
    return any(p.search(query) for p in _PATTERNS)


def pdf_download_agent_run(query: str) -> dict:
    """RAG + PDF generation. Returns answer with download_url."""
    rag   = rag_query(query)
    raw   = similarity_search(query, k=3)

    try:
        info = generate_syllabus_pdf(
            query=query, answer=rag["answer"],
            sources=rag["sources"], chunks=raw)
        return {
            "answer": rag["answer"], "sources": rag["sources"],
            "chunks_used": rag["chunks_used"], "agent": "pdf_download",
            "has_download": True,  "download_url": info["download_url"],
            "pdf_filename": info["filename"], "pdf_size_kb": info["size_kb"],
        }
    except Exception as e:
        print(f"[PDFAgent] PDF gen failed: {e}")
        return {
            "answer": rag["answer"], "sources": rag["sources"],
            "chunks_used": rag["chunks_used"], "agent": "pdf_download",
            "has_download": False, "download_url": None,
            "pdf_filename": None,  "pdf_size_kb": 0,
        }
