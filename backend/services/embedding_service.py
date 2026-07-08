"""
services/embedding_service.py — OpenAI embeddings + FAISS vector store.

Fixes applied:
  • Always reload index from disk before adding chunks (prevents overwrite bug)
  • Absolute path resolution for FAISS index files
  • Explicit error logging on every save/load operation
  • Merge strategy: load disk → add new chunks → save back (atomic pattern)
  • Thread-safe via module-level Lock
"""

import os
import threading
from typing import List

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document as LCDocument

from config import Config

# ── Module-level singletons ───────────────────────────────────────────────────
_lock   = threading.Lock()
_vector_store: FAISS | None = None

# Use absolute paths to avoid CWD-dependent failures
_BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_INDEX_DIR  = os.path.join(_BASE_DIR, Config.FAISS_INDEX_PATH)
_INDEX_FILE = os.path.join(_INDEX_DIR, "index.faiss")
_PKL_FILE   = os.path.join(_INDEX_DIR, "index.pkl")


# ── Embeddings ────────────────────────────────────────────────────────────────
def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=Config.EMBEDDING_MODEL,
        openai_api_key=Config.OPENAI_API_KEY,
    )


# ── Disk helpers ──────────────────────────────────────────────────────────────
def _index_on_disk() -> bool:
    """Return True only when BOTH index files exist and are non-empty."""
    return (
        os.path.isfile(_INDEX_FILE) and os.path.getsize(_INDEX_FILE) > 0 and
        os.path.isfile(_PKL_FILE)   and os.path.getsize(_PKL_FILE)   > 0
    )


def _load_from_disk() -> "FAISS | None":
    """
    Load FAISS index from disk.
    Returns None if files are absent, empty, or corrupt.
    """
    if not _index_on_disk():
        print(f"[FAISS] No valid index found on disk at {_INDEX_DIR}")
        return None
    try:
        store = FAISS.load_local(
            _INDEX_DIR,
            _get_embeddings(),
            allow_dangerous_deserialization=True,
        )
        # Sanity check: index must have at least one vector
        if store.index.ntotal == 0:
            print("[FAISS] Disk index is empty (0 vectors) — treating as missing.")
            return None
        print(f"[FAISS] Loaded index from disk — {store.index.ntotal} vectors")
        return store
    except Exception as exc:
        print(f"[FAISS] ERROR loading index: {exc}")
        return None


def _save_to_disk(store: FAISS) -> bool:
    """
    Persist FAISS index to disk.
    Returns True on success, False on failure.
    """
    try:
        os.makedirs(_INDEX_DIR, exist_ok=True)
        store.save_local(_INDEX_DIR)
        # Verify files were actually written
        if not _index_on_disk():
            print("[FAISS] ERROR: save_local() ran but files are missing/empty!")
            return False
        print(f"[FAISS] Saved index → {_INDEX_DIR} ({store.index.ntotal} vectors total)")
        return True
    except Exception as exc:
        print(f"[FAISS] ERROR saving index: {exc}")
        return False


# ── Public API ────────────────────────────────────────────────────────────────
def get_vector_store() -> "FAISS | None":
    """
    Return the in-memory FAISS store.
    Lazy-loads from disk on first call.
    Always reloads from disk if in-memory store is None.
    """
    global _vector_store
    if _vector_store is None:
        with _lock:
            if _vector_store is None:          # double-checked locking
                _vector_store = _load_from_disk()
    return _vector_store


def add_chunks_to_faiss(chunks: List[dict]) -> int:
    """
    Embed a list of chunk dicts and APPEND them to the FAISS store.

    Strategy (prevents overwrite bug):
      1. Lock
      2. Always reload from disk to get latest state
      3. Add new chunks on top
      4. Save back to disk
      5. Update in-memory singleton

    Returns: total vector count after update, or -1 on failure.
    """
    global _vector_store

    if not chunks:
        print("[FAISS] add_chunks_to_faiss called with empty list — skipping.")
        return 0

    embeddings = _get_embeddings()

    # Convert dicts to LangChain Documents
    lc_docs = [
        LCDocument(page_content=c["content"], metadata=c["metadata"])
        for c in chunks
    ]

    with _lock:
        # ── Step 1: always read current state from disk ─────────────────────
        # This is the key fix: even if _vector_store exists in memory,
        # re-reading from disk ensures we never miss chunks added by a
        # previous upload in a different thread or after a partial restart.
        current = _load_from_disk()

        # ── Step 2: merge new chunks ────────────────────────────────────────
        if current is None:
            # No existing index — create fresh from this batch
            print(f"[FAISS] Creating new index from {len(lc_docs)} documents…")
            updated = FAISS.from_documents(lc_docs, embeddings)
        else:
            # Existing index — append without reconstruction
            before = current.index.ntotal
            print(f"[FAISS] Appending {len(lc_docs)} chunks to existing "
                  f"index ({before} vectors)…")
            current.add_documents(lc_docs)
            updated = current
            print(f"[FAISS] Index grew: {before} → {updated.index.ntotal} vectors")

        # ── Step 3: persist to disk ─────────────────────────────────────────
        if not _save_to_disk(updated):
            print("[FAISS] CRITICAL: failed to save updated index to disk!")
            return -1

        # ── Step 4: refresh in-memory singleton ────────────────────────────
        _vector_store = updated
        return updated.index.ntotal


def similarity_search(query: str, k: int = None) -> List[LCDocument]:
    """
    Embed query and retrieve the top-k most relevant chunks from FAISS.
    Always ensures the in-memory store reflects the latest disk state.
    """
    global _vector_store
    k = k or Config.TOP_K_RESULTS

    with _lock:
        # Reload from disk if in-memory store is stale / None
        if _vector_store is None:
            _vector_store = _load_from_disk()

        if _vector_store is None:
            print("[FAISS] similarity_search: no index available.")
            return []

        total = _vector_store.index.ntotal
        # Don't ask for more results than vectors exist
        k_actual = min(k, total)
        if k_actual == 0:
            return []

        results = _vector_store.similarity_search(query, k=k_actual)
        print(f"[FAISS] Query retrieved {len(results)} chunks "
              f"from {total} total vectors.")
        return results


def get_index_stats() -> dict:
    """Return diagnostic info about the current FAISS index."""
    store = get_vector_store()
    return {
        "index_dir":     _INDEX_DIR,
        "files_on_disk": _index_on_disk(),
        "total_vectors": store.index.ntotal if store else 0,
        "index_file":    _INDEX_FILE,
        "pkl_file":      _PKL_FILE,
    }


def index_exists() -> bool:
    """Return True if a valid FAISS index exists on disk."""
    return _index_on_disk()