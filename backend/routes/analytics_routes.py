"""
routes/analytics_routes.py
Blueprint: /admin/analytics/*

Endpoints:
  GET  /admin/analytics/overview      — query counts, agent breakdown, top questions
  GET  /admin/analytics/chat-history  — paginated full chat history viewer
  GET  /admin/analytics/export-csv    — download all history as CSV
"""

import csv, io, datetime
from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import func
from database.db import SessionLocal
from database.models import ChatHistory, User

analytics_bp = Blueprint("analytics", __name__, url_prefix="/admin/analytics")


def _require_admin():
    if not get_jwt().get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


@analytics_bp.route("/overview", methods=["GET"])
@jwt_required()
def overview():
    """
    Returns:
      total_queries, queries_today, queries_week,
      agent_breakdown {faq, document, pdf_download, image},
      top_questions [ {question, count} × 10 ],
      daily_counts  [ {date, count} × 30 ]
    """
    guard = _require_admin()
    if guard: return guard

    session = SessionLocal()
    try:
        now   = datetime.datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week  = today - datetime.timedelta(days=7)

        total   = session.query(func.count(ChatHistory.id)).scalar() or 0
        t_today = session.query(func.count(ChatHistory.id))\
                         .filter(ChatHistory.created_at >= today).scalar() or 0
        t_week  = session.query(func.count(ChatHistory.id))\
                         .filter(ChatHistory.created_at >= week).scalar() or 0

        # Agent breakdown
        agent_rows = session.query(
            ChatHistory.agent_used,
            func.count(ChatHistory.id).label("cnt")
        ).group_by(ChatHistory.agent_used).all()
        agent_breakdown = {r.agent_used or "unknown": r.cnt for r in agent_rows}

        # Top 10 questions (most repeated exact messages)
        top_rows = session.query(
            ChatHistory.user_message,
            func.count(ChatHistory.id).label("cnt")
        ).group_by(ChatHistory.user_message)\
         .order_by(func.count(ChatHistory.id).desc())\
         .limit(10).all()
        top_questions = [{"question": r.user_message[:120], "count": r.cnt}
                         for r in top_rows]

        # Daily counts for last 30 days
        thirty = today - datetime.timedelta(days=30)
        daily_rows = session.query(
            func.date(ChatHistory.created_at).label("day"),
            func.count(ChatHistory.id).label("cnt")
        ).filter(ChatHistory.created_at >= thirty)\
         .group_by(func.date(ChatHistory.created_at))\
         .order_by(func.date(ChatHistory.created_at)).all()
        daily_counts = [{"date": str(r.day), "count": r.cnt} for r in daily_rows]

        # Total students
        total_students = session.query(func.count(User.id))\
                                .filter(User.is_admin == False).scalar() or 0

        return jsonify({
            "total_queries":   total,
            "queries_today":   t_today,
            "queries_week":    t_week,
            "total_students":  total_students,
            "agent_breakdown": agent_breakdown,
            "top_questions":   top_questions,
            "daily_counts":    daily_counts,
        }), 200
    finally:
        session.close()


@analytics_bp.route("/chat-history", methods=["GET"])
@jwt_required()
def chat_history():
    """
    Paginated full chat history.
    Query params: page (default 1), per_page (default 20), agent, search
    """
    guard = _require_admin()
    if guard: return guard

    page     = max(1, int(request.args.get("page", 1)))
    per_page = min(50, max(5, int(request.args.get("per_page", 20))))
    agent    = request.args.get("agent", "").strip()
    search   = request.args.get("search", "").strip()

    session = SessionLocal()
    try:
        q = session.query(ChatHistory, User)\
                   .join(User, ChatHistory.user_id == User.id)

        if agent:
            q = q.filter(ChatHistory.agent_used == agent)
        if search:
            q = q.filter(ChatHistory.user_message.ilike(f"%{search}%"))

        total = q.count()
        rows  = q.order_by(ChatHistory.created_at.desc())\
                 .offset((page - 1) * per_page)\
                 .limit(per_page).all()

        return jsonify({
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    (total + per_page - 1) // per_page,
            "history":  [{
                "id":           r.ChatHistory.id,
                "student_name": r.User.name,
                "student_email":r.User.email,
                "user_message": r.ChatHistory.user_message,
                "bot_response": r.ChatHistory.bot_response[:300] + "…"
                                if len(r.ChatHistory.bot_response) > 300
                                else r.ChatHistory.bot_response,
                "agent_used":   r.ChatHistory.agent_used,
                "created_at":   r.ChatHistory.created_at.isoformat(),
            } for r in rows],
        }), 200
    finally:
        session.close()


@analytics_bp.route("/export-csv", methods=["GET"])
@jwt_required()
def export_csv():
    """Download all chat history as a CSV file."""
    guard = _require_admin()
    if guard: return guard

    session = SessionLocal()
    try:
        rows = session.query(ChatHistory, User)\
                      .join(User, ChatHistory.user_id == User.id)\
                      .order_by(ChatHistory.created_at.desc()).all()

        buf    = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["ID","Student Name","Email","Question",
                         "Answer","Agent","Timestamp"])
        for r in rows:
            writer.writerow([
                r.ChatHistory.id,
                r.User.name,
                r.User.email,
                r.ChatHistory.user_message,
                r.ChatHistory.bot_response,
                r.ChatHistory.agent_used,
                r.ChatHistory.created_at.isoformat(),
            ])

        buf.seek(0)
        filename = f"chat_history_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
        return Response(
            buf.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        session.close()
