"""
routes/chat_routes.py — /chat and /voice endpoints.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from agents.supervisor_agent import route_query
from database.db import SessionLocal
from database.models import ChatHistory

chat_bp = Blueprint("chat", __name__)


def _save_history(user_id: int, user_msg: str, bot_resp: str, agent: str):
    """Persist a chat turn to the database (best-effort)."""
    session = SessionLocal()
    try:
        entry = ChatHistory(
            user_id=user_id,
            user_message=user_msg,
            bot_response=bot_resp,
            agent_used=agent,
        )
        session.add(entry)
        session.commit()
    except Exception as e:
        print(f"[chat] Failed to save history: {e}")
    finally:
        session.close()


@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    """
    POST /chat
    Body: { "message": str }
    Returns: { "answer": str, "sources": [...], "chunks_used": int, "agent": str }
    """
    claims = get_jwt()
    user_id = claims.get("id")

    data = request.get_json(silent=True) or {}
    query = (data.get("message") or "").strip()

    if not query:
        return jsonify({"error": "Message cannot be empty."}), 400

    result = route_query(query)

    # Persist asynchronously (non-blocking for UX)
    import threading
    t = threading.Thread(
        target=_save_history,
        args=(user_id, query, result["answer"], result.get("agent", "document")),
        daemon=True,
    )
    t.start()

    return jsonify(result), 200


@chat_bp.route("/voice", methods=["POST"])
@jwt_required()
def voice():
    """
    POST /voice — identical to /chat but semantically for voice input.
    The frontend already converts speech → text via Web Speech API
    and sends the transcript here.
    """
    return chat()


@chat_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    """GET /history — return last 50 messages for the current user."""
    claims = get_jwt()
    user_id = claims.get("id")

    session = SessionLocal()
    try:
        rows = (
            session.query(ChatHistory)
            .filter_by(user_id=user_id)
            .order_by(ChatHistory.created_at.asc())
            .limit(50)
            .all()
        )
        return jsonify({
            "history": [
                {
                    "id": r.id,
                    "user_message": r.user_message,
                    "bot_response": r.bot_response,
                    "agent_used": r.agent_used,
                    "created_at": r.created_at.isoformat(),
                }
                for r in rows
            ]
        }), 200
    finally:
        session.close()
