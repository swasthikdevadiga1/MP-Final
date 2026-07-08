"""
routes/system_routes.py
Blueprint: /admin/system/*

Endpoints:
  GET  /admin/system/health          — server uptime, DB size, FAISS size, OpenAI ping
  GET  /admin/system/doc-preview/<id>— extracted text + chunks for a document
  GET  /admin/system/query-test      — test a query and see raw chunks returned
"""

import os, time, datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from database.db import SessionLocal
from database.models import Document
from services.embedding_service import similarity_search, get_index_stats

system_bp  = Blueprint("system", __name__, url_prefix="/admin/system")
_START_TIME = time.time()   # module-level: set when Flask starts


def _require_admin():
    if not get_jwt().get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


def _dir_size_mb(path: str) -> float:
    """Return total size of a directory in MB."""
    total = 0
    if not os.path.isdir(path):
        return 0.0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.isfile(fp):
                total += os.path.getsize(fp)
    return round(total / (1024 * 1024), 2)


def _file_size_mb(path: str) -> float:
    if os.path.isfile(path):
        return round(os.path.getsize(path) / (1024 * 1024), 2)
    return 0.0


@system_bp.route("/health", methods=["GET"])
@jwt_required()
def health():
    """
    System health dashboard data.
    Returns uptime, DB size, FAISS stats, last processed doc, OpenAI ping.
    """
    guard = _require_admin()
    if guard: return guard

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Uptime
    uptime_secs = int(time.time() - _START_TIME)
    hours, rem  = divmod(uptime_secs, 3600)
    mins, secs  = divmod(rem, 60)
    uptime_str  = f"{hours}h {mins}m {secs}s"

    # DB size
    db_path  = os.path.join(base_dir, "college_chatbot.db")
    db_size  = _file_size_mb(db_path)

    # Upload folder size
    upload_dir  = os.path.join(base_dir, "data", "uploads")
    upload_size = _dir_size_mb(upload_dir)

    # Generated PDFs size
    pdf_dir   = os.path.join(base_dir, "data", "generated_pdfs")
    pdf_count = len([f for f in os.listdir(pdf_dir)
                     if os.path.isfile(os.path.join(pdf_dir, f))]) if os.path.isdir(pdf_dir) else 0

    # FAISS stats
    faiss = get_index_stats()

    # Last processed document
    session = SessionLocal()
    try:
        last_doc = session.query(Document)\
                          .filter(Document.status == "processed")\
                          .order_by(Document.processed_at.desc()).first()
        last_processed = {
            "name":         last_doc.original_name if last_doc else None,
            "processed_at": last_doc.processed_at.isoformat() if last_doc and last_doc.processed_at else None,
            "chunks":       last_doc.chunk_count if last_doc else 0,
        }

        # Document counts
        total_docs     = session.query(Document).count()
        processed_docs = session.query(Document).filter_by(status="processed").count()
        error_docs     = session.query(Document).filter_by(status="error").count()
    finally:
        session.close()

    # OpenAI API ping
    openai_status = "unknown"
    openai_latency_ms = None
    try:
        from openai import OpenAI
        from config import Config
        client = OpenAI(api_key=Config.OPENAI_API_KEY)
        t0 = time.time()
        client.models.list()
        openai_latency_ms = round((time.time() - t0) * 1000)
        openai_status = "ok"
    except Exception as e:
        openai_status  = f"error: {str(e)[:60]}"

    return jsonify({
        "server": {
            "uptime":       uptime_str,
            "uptime_secs":  uptime_secs,
            "started_at":   datetime.datetime.utcfromtimestamp(_START_TIME).isoformat(),
        },
        "database": {
            "size_mb":       db_size,
            "total_docs":    total_docs,
            "processed_docs": processed_docs,
            "error_docs":    error_docs,
        },
        "storage": {
            "uploads_mb":      upload_size,
            "generated_pdfs":  pdf_count,
        },
        "faiss": faiss,
        "last_processed": last_processed,
        "openai": {
            "status":     openai_status,
            "latency_ms": openai_latency_ms,
        },
    }), 200


@system_bp.route("/doc-preview/<int:doc_id>", methods=["GET"])
@jwt_required()
def doc_preview(doc_id: int):
    """
    Return extracted text preview + first N chunks for a document.
    Query param: chunks (default 5, max 20)
    """
    guard = _require_admin()
    if guard: return guard

    n_chunks = min(20, max(1, int(request.args.get("chunks", 5))))

    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=doc_id).first()
        if not doc:
            return jsonify({"error": "Document not found."}), 404

        # Try to read raw text from file for preview
        raw_preview = None
        if os.path.isfile(doc.file_path):
            ext = doc.filename.rsplit(".", 1)[-1].lower()
            try:
                if ext == "pdf":
                    import pdfplumber
                    with pdfplumber.open(doc.file_path) as pdf:
                        pages_text = [p.extract_text() or "" for p in pdf.pages[:3]]
                    raw_preview = "\n\n".join(pages_text)[:2000]
                elif ext in {"png","jpg","jpeg","webp","bmp"}:
                    raw_preview = "[Image file — text extracted via OCR/Vision API]"
            except Exception as e:
                raw_preview = f"[Could not read file: {e}]"

        # Retrieve chunks from FAISS that belong to this document
        chunks_data = []
        if doc.status == "processed":
            try:
                results = similarity_search(
                    query=doc.original_name,
                    k=n_chunks,
                )
                # Filter to chunks from this document
                chunks_data = [
                    {
                        "chunk_index": i + 1,
                        "source":      r.metadata.get("source", "Unknown"),
                        "preview":     r.page_content[:500] + ("…" if len(r.page_content) > 500 else ""),
                        "char_count":  len(r.page_content),
                    }
                    for i, r in enumerate(results)
                    if r.metadata.get("source", "") == doc.original_name
                ][:n_chunks]
            except Exception as e:
                chunks_data = [{"error": str(e)}]

        return jsonify({
            "document": {
                "id":            doc.id,
                "original_name": doc.original_name,
                "status":        doc.status,
                "chunk_count":   doc.chunk_count,
                "file_path":     doc.file_path,
                "uploaded_at":   doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "processed_at":  doc.processed_at.isoformat() if doc.processed_at else None,
                "error_message": doc.error_message,
                "type": "image" if doc.filename.rsplit(".",1)[-1].lower()
                         in {"png","jpg","jpeg","webp","bmp"} else "pdf",
            },
            "raw_preview": raw_preview,
            "chunks":      chunks_data,
            "chunks_shown": len(chunks_data),
        }), 200
    finally:
        session.close()


@system_bp.route("/query-test", methods=["POST"])
@jwt_required()
def query_test():
    """
    Admin test panel: run a query and see raw retrieved chunks + agent routing.
    Body: { "query": str, "k": int (default 5) }
    """
    guard = _require_admin()
    if guard: return guard

    data  = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    k     = min(10, max(1, int(data.get("k", 5))))

    if not query:
        return jsonify({"error": "Query is required."}), 400

    # Check which agent would handle it
    from agents.faq_agent          import faq_answer
    from agents.pdf_download_agent import is_syllabus_query

    faq_hit      = faq_answer(query)
    syllabus_hit = is_syllabus_query(query)

    if faq_hit:
        agent_route = "faq"
    elif syllabus_hit:
        agent_route = "pdf_download"
    elif len(query.split()) < 2:
        agent_route = "supervisor (clarify)"
    else:
        agent_route = "document"

    # Retrieve chunks
    t0     = time.time()
    chunks = similarity_search(query, k=k)
    elapsed_ms = round((time.time() - t0) * 1000)

    return jsonify({
        "query":        query,
        "agent_route":  agent_route,
        "retrieval_ms": elapsed_ms,
        "chunks_found": len(chunks),
        "chunks": [
            {
                "rank":      i + 1,
                "source":    c.metadata.get("source", "Unknown"),
                "type":      c.metadata.get("type", "pdf"),
                "preview":   c.page_content[:400] + ("…" if len(c.page_content) > 400 else ""),
                "char_count": len(c.page_content),
            }
            for i, c in enumerate(chunks)
        ],
    }), 200
