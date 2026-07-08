"""
routes/chat_routes.py — /chat, /voice, /history endpoints (v2).
Now accepts optional image_b64 field for image queries.
"""

import threading
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from agents.supervisor_agent import route_query
from database.db import SessionLocal
from database.models import ChatHistory

chat_bp = Blueprint("chat", __name__)


def _save_history(user_id, user_msg, bot_resp, agent):
    session = SessionLocal()
    try:
        session.add(ChatHistory(
            user_id=user_id, user_message=user_msg,
            bot_response=bot_resp, agent_used=agent,
        ))
        session.commit()
    except Exception as e:
        print(f"[chat] History save error: {e}")
    finally:
        session.close()


@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    """
    POST /chat
    Body: {
      "message":   str,
      "image_b64": str | null   # optional base64 image from student
    }
    """
    claims  = get_jwt()
    user_id = claims.get("id")
    data    = request.get_json(silent=True) or {}

    query     = (data.get("message") or "").strip()
    image_b64 = data.get("image_b64") or None   # base64 string from frontend

    if not query and not image_b64:
        return jsonify({"error": "Message or image is required."}), 400

    result = route_query(query=query, image_b64=image_b64)

    threading.Thread(
        target=_save_history,
        args=(user_id, query, result["answer"], result.get("agent","document")),
        daemon=True,
    ).start()

    return jsonify(result), 200


@chat_bp.route("/voice", methods=["POST"])
@jwt_required()
def voice():
    """POST /voice — same as /chat (speech already transcribed by frontend)."""
    return chat()


@chat_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    """GET /history — last 50 messages for current user."""
    claims  = get_jwt()
    user_id = claims.get("id")
    session = SessionLocal()
    try:
        rows = (session.query(ChatHistory)
                .filter_by(user_id=user_id)
                .order_by(ChatHistory.created_at.asc())
                .limit(50).all())
        return jsonify({"history": [
            {"id": r.id, "user_message": r.user_message,
             "bot_response": r.bot_response, "agent_used": r.agent_used,
             "created_at": r.created_at.isoformat()}
            for r in rows
        ]}), 200
    finally:
        session.close()
