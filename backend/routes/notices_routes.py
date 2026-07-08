"""
routes/notices_routes.py
Blueprint: /notices/* and /admin/notices/*

Public:
  GET  /notices/active      — fetch active announcements (for chat welcome)

Admin:
  GET  /admin/notices       — list all notices
  POST /admin/notices       — create notice
  PATCH /admin/notices/<id> — edit notice
  DELETE /admin/notices/<id>— delete notice
  PATCH /admin/notices/<id>/toggle — activate/deactivate
"""

import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request
from database.db import SessionLocal

notices_bp = Blueprint("notices", __name__)


def _require_admin():
    if not get_jwt().get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


def _get_model():
    """Lazy import to avoid circular deps."""
    try:
        from database.models_v2 import Announcement
        return Announcement
    except ImportError:
        return None


# ── Public endpoint (used by frontend chat welcome) ───────────────────────────

@notices_bp.route("/notices/active", methods=["GET"])
@jwt_required()
def active_notices():
    """Return currently active, non-expired announcements."""
    Announcement = _get_model()
    if not Announcement:
        return jsonify({"notices": []}), 200

    session = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        rows = session.query(Announcement)\
                      .filter(Announcement.is_active == True)\
                      .filter(
                          (Announcement.expires_at == None) |
                          (Announcement.expires_at > now)
                      )\
                      .order_by(Announcement.created_at.desc()).all()

        return jsonify({"notices": [
            {"id": r.id, "title": r.title, "body": r.body,
             "created_at": r.created_at.isoformat()}
            for r in rows
        ]}), 200
    finally:
        session.close()


# ── Admin CRUD ────────────────────────────────────────────────────────────────

@notices_bp.route("/admin/notices", methods=["GET"])
@jwt_required()
def list_notices():
    guard = _require_admin()
    if guard: return guard

    Announcement = _get_model()
    if not Announcement:
        return jsonify({"notices": []}), 200

    session = SessionLocal()
    try:
        rows = session.query(Announcement)\
                      .order_by(Announcement.created_at.desc()).all()
        return jsonify({"notices": [
            {"id": r.id, "title": r.title, "body": r.body,
             "is_active": r.is_active,
             "created_at": r.created_at.isoformat(),
             "expires_at": r.expires_at.isoformat() if r.expires_at else None}
            for r in rows
        ]}), 200
    finally:
        session.close()


@notices_bp.route("/admin/notices", methods=["POST"])
@jwt_required()
def create_notice():
    """
    Body: { "title": str, "body": str, "expires_at": "YYYY-MM-DD" | null }
    """
    guard = _require_admin()
    if guard: return guard

    claims = get_jwt()
    data   = request.get_json(silent=True) or {}
    title  = (data.get("title") or "").strip()
    body   = (data.get("body")  or "").strip()
    exp    = data.get("expires_at")

    if not title or not body:
        return jsonify({"error": "Title and body are required."}), 400

    expires_at = None
    if exp:
        try:
            expires_at = datetime.datetime.strptime(exp, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "expires_at must be YYYY-MM-DD."}), 400

    Announcement = _get_model()
    if not Announcement:
        return jsonify({"error": "Announcement model not available. Run DB migration."}), 500

    session = SessionLocal()
    try:
        ann = Announcement(
            title=title, body=body,
            is_active=True,
            created_by=claims.get("id"),
            expires_at=expires_at,
        )
        session.add(ann)
        session.commit()
        session.refresh(ann)
        return jsonify({"message": "Notice created.", "id": ann.id}), 201
    finally:
        session.close()


@notices_bp.route("/admin/notices/<int:notice_id>", methods=["PATCH"])
@jwt_required()
def update_notice(notice_id: int):
    guard = _require_admin()
    if guard: return guard

    Announcement = _get_model()
    if not Announcement:
        return jsonify({"error": "Model not available."}), 500

    data    = request.get_json(silent=True) or {}
    session = SessionLocal()
    try:
        ann = session.query(Announcement).filter_by(id=notice_id).first()
        if not ann:
            return jsonify({"error": "Notice not found."}), 404

        if "title" in data: ann.title = data["title"].strip()
        if "body"  in data: ann.body  = data["body"].strip()
        if "expires_at" in data:
            ann.expires_at = (
                datetime.datetime.strptime(data["expires_at"], "%Y-%m-%d")
                if data["expires_at"] else None
            )
        session.commit()
        return jsonify({"message": "Notice updated."}), 200
    finally:
        session.close()


@notices_bp.route("/admin/notices/<int:notice_id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_notice(notice_id: int):
    guard = _require_admin()
    if guard: return guard

    Announcement = _get_model()
    if not Announcement:
        return jsonify({"error": "Model not available."}), 500

    session = SessionLocal()
    try:
        ann = session.query(Announcement).filter_by(id=notice_id).first()
        if not ann:
            return jsonify({"error": "Notice not found."}), 404
        ann.is_active = not ann.is_active
        session.commit()
        return jsonify({"message": f"Notice {'activated' if ann.is_active else 'deactivated'}.",
                        "is_active": ann.is_active}), 200
    finally:
        session.close()


@notices_bp.route("/admin/notices/<int:notice_id>", methods=["DELETE"])
@jwt_required()
def delete_notice(notice_id: int):
    guard = _require_admin()
    if guard: return guard

    Announcement = _get_model()
    if not Announcement:
        return jsonify({"error": "Model not available."}), 500

    session = SessionLocal()
    try:
        ann = session.query(Announcement).filter_by(id=notice_id).first()
        if not ann:
            return jsonify({"error": "Notice not found."}), 404
        session.delete(ann)
        session.commit()
        return jsonify({"message": "Notice deleted."}), 200
    finally:
        session.close()
