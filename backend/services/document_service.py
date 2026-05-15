"""
services/document_service.py — PDF ingestion pipeline.

Flow:
  1. Save uploaded file to disk.
  2. Extract raw text with pdfplumber.
  3. Clean and split into chunks (LangChain RecursiveCharacterTextSplitter).
  4. Hand off chunks to embedding_service for FAISS storage.
  5. Update Document record in the DB.
"""

import os
import uuid
import datetime
import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter
from werkzeug.datastructures import FileStorage
from database.models import Document
from database.db import SessionLocal
from config import Config


# ── Helpers ────────────────────────────────────────────────────────────────

def _allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    )


def _safe_filename(original: str) -> str:
    """Prefix with UUID to avoid collisions and path traversal."""
    ext = original.rsplit(".", 1)[-1].lower()
    return f"{uuid.uuid4().hex}.{ext}"


# ── Public API ──────────────────────────────────────────────────────────────

def save_upload(file: FileStorage) -> dict:
    """
    Persist an uploaded FileStorage object to disk.

    Returns a dict with keys: filename, original_name, file_path.
    Raises ValueError on invalid extension.
    """
    if not _allowed_file(file.filename):
        raise ValueError("Only PDF files are allowed.")

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    safe_name = _safe_filename(file.filename)
    file_path = os.path.join(Config.UPLOAD_FOLDER, safe_name)
    file.save(file_path)

    return {
        "filename": safe_name,
        "original_name": file.filename,
        "file_path": file_path,
    }


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract all text from a PDF file using pdfplumber.
    Returns concatenated page text.
    """
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
    return "\n\n".join(text_parts)


def clean_text(raw: str) -> str:
    """
    Basic text cleaning:
      - collapse excessive whitespace / blank lines
      - remove non-printable characters
    """
    import re
    # Replace multiple blank lines with a single one
    text = re.sub(r"\n{3,}", "\n\n", raw)
    # Collapse multiple spaces
    text = re.sub(r"[ \t]{2,}", " ", text)
    # Strip non-printable chars (except newline/tab)
    text = re.sub(r"[^\x09\x0A\x20-\x7E\u00A0-\uFFFF]", "", text)
    return text.strip()


def split_into_chunks(text: str, source_name: str) -> list[dict]:
    """
    Split text into overlapping chunks using LangChain.
    Each chunk is a dict: { "content": str, "metadata": {...} }
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=Config.CHUNK_SIZE,
        chunk_overlap=Config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    docs = splitter.create_documents(
        texts=[text],
        metadatas=[{"source": source_name}],
    )
    return [{"content": d.page_content, "metadata": d.metadata} for d in docs]


def process_document(document_id: int) -> None:
    """
    Full pipeline for a Document row already saved in the DB:
      extract → clean → chunk → embed → update DB record.

    Designed to run in a background thread.
    """
    from services.embedding_service import add_chunks_to_faiss

    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=document_id).first()
        if not doc:
            print(f"[process_document] Document {document_id} not found.")
            return

        doc.status = "processing"
        session.commit()

        # Step 1 — Extract
        raw_text = extract_text_from_pdf(doc.file_path)
        if not raw_text.strip():
            raise ValueError("No readable text found in the PDF.")

        # Step 2 — Clean
        cleaned = clean_text(raw_text)

        # Step 3 — Chunk
        chunks = split_into_chunks(cleaned, source_name=doc.original_name)
        if not chunks:
            raise ValueError("Text splitting produced no chunks.")

        # Step 4 — Embed + store in FAISS
        add_chunks_to_faiss(chunks)

        # Step 5 — Update DB
        doc.chunk_count = len(chunks)
        doc.status = "processed"
        doc.processed_at = datetime.datetime.utcnow()
        session.commit()
        print(f"[process_document] ✓ '{doc.original_name}' → {len(chunks)} chunks.")

    except Exception as exc:
        session.rollback()
        doc = session.query(Document).filter_by(id=document_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(exc)
            session.commit()
        print(f"[process_document] ✗ Document {document_id}: {exc}")
    finally:
        session.close()
