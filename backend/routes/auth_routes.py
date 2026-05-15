"""
routes/auth_routes.py — /login and /logout endpoints.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from database.db import SessionLocal
from services.auth_service import authenticate_user, create_user, generate_token

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /login
    Body: { "email": str, "password": str }
    Returns: { "token": str, "user": {...} }
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    session = SessionLocal()
    try:
        user = authenticate_user(session, email, password)
        if not user:
            return jsonify({"error": "Invalid email or password."}), 401

        token = generate_token(user)
        return jsonify({
            "token": token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": user.is_admin,
            },
        }), 200
    finally:
        session.close()


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    POST /register (student self-registration)
    Body: { "name": str, "email": str, "password": str }
    """
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not all([name, email, password]):
        return jsonify({"error": "Name, email and password are required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    session = SessionLocal()
    try:
        user = create_user(session, name=name, email=email, password=password)
        token = generate_token(user)
        return jsonify({
            "token": token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "is_admin": user.is_admin,
            },
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    finally:
        session.close()


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    POST /logout — client should discard the token.
    (Stateless JWT: server-side revocation not implemented here.)
    """
    return jsonify({"message": "Logged out successfully."}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """GET /me — return current user info from JWT claims."""
    claims = get_jwt()
    return jsonify({
        "id": claims.get("id"),
        "name": claims.get("name"),
        "email": claims.get("email"),
        "is_admin": claims.get("is_admin"),
    }), 200
