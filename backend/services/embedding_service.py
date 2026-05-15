"""
services/embedding_service.py — OpenAI embeddings + FAISS vector store.

Key design decisions:
  • FAISS index is loaded once at module level (singleton).
  • New chunks are APPENDED — never overwrite existing data.
  • Index is persisted to disk after every update.
  • Thread-safe via a module-level Lock.
"""

import os
import threading
import pickle
from typing import List

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document as LCDocument

from config import Config

# ── Module-level singletons ────────────────────────────────────────────────

_lock = threading.Lock()
_vector_store: FAISS | None = None

_INDEX_DIR = Config.FAISS_INDEX_PATH
_INDEX_FILE = os.path.join(_INDEX_DIR, "index.faiss")
_PKL_FILE = os.path.join(_INDEX_DIR, "index.pkl")

# ── Embeddings model ─────────────────────────────────────────────────────

def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=Config.EMBEDDING_MODEL,
        openai_api_key=Config.OPENAI_API_KEY,
    )


# ── Load / save helpers ────────────────────────────────────────────────────

def _load_store() -> FAISS | None:
    """Load persisted FAISS index from disk. Returns None if not found."""
    if os.path.exists(_INDEX_FILE) and os.path.exists(_PKL_FILE):
        try:
            store = FAISS.load_local(
                _INDEX_DIR,
                _get_embeddings(),
                allow_dangerous_deserialization=True,
            )
            print(f"[FAISS] Loaded existing index from {_INDEX_DIR}")
            return store
        except Exception as e:
            print(f"[FAISS] Failed to load index: {e}")
    return None


def _save_store(store: FAISS) -> None:
    """Persist FAISS index to disk."""
    os.makedirs(_INDEX_DIR, exist_ok=True)
    store.save_local(_INDEX_DIR)
    print(f"[FAISS] Index saved → {_INDEX_DIR}")


# ── Public API ─────────────────────────────────────────────────────────────

def get_vector_store() -> FAISS | None:
    """Return the in-memory FAISS store (lazy-loaded on first call)."""
    global _vector_store
    if _vector_store is None:
        with _lock:
            if _vector_store is None:
                _vector_store = _load_store()
    return _vector_store


def add_chunks_to_faiss(chunks: List[dict]) -> None:
    """
    Embed a list of chunk dicts and add them to the FAISS store.

    Each chunk dict: { "content": str, "metadata": dict }
    New docs are APPENDED to the existing index.
    """
    global _vector_store

    if not chunks:
        return

    embeddings = _get_embeddings()

    # Convert to LangChain Document objects
    lc_docs = [
        LCDocument(page_content=c["content"], metadata=c["metadata"])
        for c in chunks
    ]

    with _lock:
        if _vector_store is None:
            # First upload ever — create the store from scratch
            _vector_store = FAISS.from_documents(lc_docs, embeddings)
        else:
            # Subsequent uploads — add without overwriting
            _vector_store.add_documents(lc_docs)

        _save_store(_vector_store)

    print(f"[FAISS] Added {len(chunks)} new chunks. Index updated.")


def similarity_search(query: str, k: int = None) -> List[LCDocument]:
    """
    Retrieve the top-k most relevant document chunks for a query.

    Returns a list of LangChain Documents with .page_content + .metadata.
    """
    k = k or Config.TOP_K_RESULTS
    store = get_vector_store()

    if store is None:
        return []

    results = store.similarity_search(query, k=k)
    return results


def index_exists() -> bool:
    """Return True if a persisted FAISS index exists on disk."""
    return os.path.exists(_INDEX_FILE)
