"""
agents/document_agent.py — RAG-powered document retrieval agent.
Delegates to rag_service and formats the final response payload.
"""

from services.rag_service import rag_query


def document_agent_run(query: str) -> dict:
    """
    Run the document retrieval agent on a user query.

    Returns:
        {
          "answer": str,
          "sources": list[str],
          "chunks_used": int,
          "agent": "document"
        }
    """
    result = rag_query(query)
    result["agent"] = "document"
    return result
