"""
services/rag_service.py — Core RAG logic.

Retrieves relevant chunks from FAISS, builds a context-enriched prompt,
and calls the OpenAI chat model to generate a grounded answer.
"""

from openai import OpenAI
from services.embedding_service import similarity_search
from config import Config

_client = OpenAI(api_key=Config.OPENAI_API_KEY)

SYSTEM_PROMPT = """You are a helpful and knowledgeable college information assistant.
Your job is to answer student questions accurately using ONLY the provided context from
official college documents. 

Guidelines:
- Be friendly, clear, and concise.
- If the answer is not in the context, say: "I don't have that information in the uploaded documents. 
  Please contact the college office for details."
- Never make up facts or hallucinate.
- Cite document names when relevant (use the 'source' from metadata).
- Format lists and steps clearly with bullet points or numbers.
"""


def build_context(docs: list) -> str:
    """Combine retrieved chunks into a single context block."""
    parts = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "Unknown")
        parts.append(f"[Chunk {i} — Source: {source}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def rag_query(query: str) -> dict:
    """
    Full RAG pipeline:
      1. Embed query → retrieve top-K chunks from FAISS.
      2. Build prompt with context.
      3. Call GPT and return the response.

    Returns: { "answer": str, "sources": list[str], "chunks_used": int }
    """
    # Step 1 — Retrieve
    docs = similarity_search(query)

    if not docs:
        return {
            "answer": (
                "I don't have enough information in the knowledge base yet. "
                "Please ask the admin to upload relevant college documents."
            ),
            "sources": [],
            "chunks_used": 0,
        }

    # Step 2 — Build context
    context = build_context(docs)
    sources = list({doc.metadata.get("source", "Unknown") for doc in docs})

    # Step 3 — Call LLM
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Context from college documents:\n\n{context}\n\n"
                f"Student Question: {query}\n\n"
                "Please answer based on the context above."
            ),
        },
    ]

    response = _client.chat.completions.create(
        model=Config.CHAT_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=800,
    )

    answer = response.choices[0].message.content.strip()

    return {
        "answer": answer,
        "sources": sources,
        "chunks_used": len(docs),
    }
