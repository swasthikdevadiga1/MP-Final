"""
app.py — Flask application factory and entry point.

Startup sequence:
  1. Create Flask app with config.
  2. Initialize JWT extension.
  3. Initialize database (create tables + seed admin).
  4. Register route blueprints.
  5. Enable CORS for React frontend.
"""

import os
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from config import Config
from database.db import init_db, SessionLocal
from services.auth_service import seed_admin

# ── Route blueprints ───────────────────────────────────────────────────────
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.chat_routes import chat_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Core config ────────────────────────────────────────────────────────
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["JWT_SECRET_KEY"] = Config.JWT_SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH
    app.config["UPLOAD_FOLDER"] = Config.UPLOAD_FOLDER

    # ── Extensions ─────────────────────────────────────────────────────────
    JWTManager(app)
    CORS(app, resources={r"/*": {"origins": "*"}},
         supports_credentials=True)

    # ── Database ───────────────────────────────────────────────────────────
    with app.app_context():
        init_db()
        session = SessionLocal()
        try:
            seed_admin(session)
        finally:
            session.close()

    # ── Blueprints ─────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(chat_bp)

    # ── Health check ───────────────────────────────────────────────────────
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "College Chatbot API"}), 200

    # ── Global error handlers ──────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found."}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File too large. Maximum size is 50 MB."}), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error."}), 500

    return app


# ── Entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=Config.DEBUG)
