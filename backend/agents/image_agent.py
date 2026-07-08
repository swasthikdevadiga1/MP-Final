"""
agents/image_agent.py
Handles queries with an attached image using OpenAI Vision + RAG.
"""

import base64, os
from openai import OpenAI
from services.embedding_service import similarity_search
from config import Config

_client = OpenAI(api_key=Config.OPENAI_API_KEY)

_SYSTEM = """You are EduBot, a smart college information assistant.
A student has shared an image (notice, timetable, question paper, or document).
1. Describe what you see clearly.
2. Extract any text visible in the image.
3. Answer the student question using BOTH the image content AND the document context below.
Be concise and accurate."""


def image_agent_run(query: str, image_b64: str = None, image_path: str = None) -> dict:
    """Process a query + image. Returns standard agent dict with agent='image'."""
    # Prepare base64 image
    if image_b64:
        b64, mime = image_b64, "image/jpeg"
    elif image_path and os.path.isfile(image_path):
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext  = image_path.rsplit(".", 1)[-1].lower()
        mime = f"image/{'jpeg' if ext in ('jpg','jpeg') else ext}"
    else:
        return {"answer": "No image provided or file not found.",
                "sources": [], "chunks_used": 0, "agent": "image", "has_download": False}

    # RAG context
    docs    = similarity_search(query, k=4)
    context = "\n\n---\n\n".join(
        f"[Source: {d.metadata.get('source','Unknown')}]\n{d.page_content}"
        for d in docs
    ) if docs else "No relevant documents found."
    sources = list({d.metadata.get("source","Unknown") for d in docs})

    # Vision + RAG call
    try:
        resp = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": [
                    {"type": "text",
                     "text": f"Document context:\n{context}\n\nStudent question: {query}"},
                    {"type": "image_url",
                     "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ]},
            ],
            max_tokens=1000, temperature=0.2,
        )
        answer = resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ImageAgent] Vision error: {e}")
        answer = "Unable to process the image right now. Please try again."

    return {"answer": answer, "sources": sources,
            "chunks_used": len(docs), "agent": "image", "has_download": False}
