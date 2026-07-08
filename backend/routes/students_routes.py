"""
routes/students_routes.py
Blueprint: /admin/students/*

Endpoints:
  GET  /admin/students              — list all students with last login
  PATCH /admin/students/<id>/toggle — activate / deactivate
  POST  /admin/students/<id>/reset-password — set new password
  DELETE /admin/students/<id>       — delete student account
"""

import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from database.db import SessionLocal
from database.models import User
from services.auth_service import hash_password

try:
    from database.models_v2 import StudentSession
    HAS_SESSION_MODEL = True
except ImportError:
    HAS_SESSION_MODEL = False

students_bp = Blueprint("students", __name__, url_prefix="/admin/students")


def _require_admin():
    if not get_jwt().get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


@students_bp.route("", methods=["GET"])
@jwt_required()
def list_students():
    """List all student accounts with metadata."""
    guard = _require_admin()
    if guard: return guard

    session = SessionLocal()
    try:
        students = session.query(User)\
                          .filter(User.is_admin == False)\
                          .order_by(User.created_at.desc()).all()

        result = []
        for s in students:
            last_login  = None
            login_count = 0
            if HAS_SESSION_MODEL:
                sess = session.query(StudentSession)\
                              .filter_by(user_id=s.id).first()
                if sess:
                    last_login  = sess.last_login.isoformat()
                    login_count = sess.login_count

            result.append({
                "id":          s.id,
                "name":        s.name,
                "email":       s.email,
                "is_active":   getattr(s, "is_active", True),
                "created_at":  s.created_at.isoformat() if s.created_at else None,
                "last_login":  last_login,
                "login_count": login_count,
            })

        return jsonify({"students": result, "total": len(result)}), 200
    finally:
        session.close()


@students_bp.route("/<int:student_id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_active(student_id: int):
    """Activate or deactivate a student account."""
    guard = _require_admin()
    if guard: return guard

    session = SessionLocal()
    try:
        student = session.query(User).filter_by(id=student_id, is_admin=False).first()
        if not student:
            return jsonify({"error": "Student not found."}), 404

        # Toggle is_active (add column to User model if not present)
        current = getattr(student, "is_active", True)
        student.is_active = not current
        session.commit()

        return jsonify({
            "message":   f"Account {'activated' if student.is_active else 'deactivated'}.",
            "is_active": student.is_active,
            "student_id": student_id,
        }), 200
    finally:
        session.close()


@students_bp.route("/<int:student_id>/reset-password", methods=["POST"])
@jwt_required()
def reset_password(student_id: int):
    """
    Admin sets a new password for a student.
    Body: { "new_password": str }
    """
    guard = _require_admin()
    if guard: return guard

    data     = request.get_json(silent=True) or {}
    new_pass = (data.get("new_password") or "").strip()

    if len(new_pass) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    session = SessionLocal()
    try:
        student = session.query(User).filter_by(id=student_id, is_admin=False).first()
        if not student:
            return jsonify({"error": "Student not found."}), 404

        student.password_hash = hash_password(new_pass)
        session.commit()
        return jsonify({"message": f"Password reset for {student.name}."}), 200
    finally:
        session.close()


@students_bp.route("/<int:student_id>", methods=["DELETE"])
@jwt_required()
def delete_student(student_id: int):
    """Permanently delete a student account and their chat history."""
    guard = _require_admin()
    if guard: return guard

    session = SessionLocal()
    try:
        student = session.query(User).filter_by(id=student_id, is_admin=False).first()
        if not student:
            return jsonify({"error": "Student not found."}), 404

        name = student.name
        session.delete(student)
        session.commit()
        return jsonify({"message": f"Student '{name}' deleted."}), 200
    finally:
        session.close()
