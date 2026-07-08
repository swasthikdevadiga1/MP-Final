"""
app.py — Flask application factory (v2).
Added: download_bp for serving generated PDFs.
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
from routes.auth_routes     import auth_bp
from routes.admin_routes    import admin_bp
from routes.chat_routes     import chat_bp
from routes.download_routes import download_bp   # NEW


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"]          = Config.SECRET_KEY
    app.config["JWT_SECRET_KEY"]      = Config.JWT_SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"]  = Config.MAX_CONTENT_LENGTH
    app.config["UPLOAD_FOLDER"]       = Config.UPLOAD_FOLDER

    JWTManager(app)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    with app.app_context():
        init_db()
        session = SessionLocal()
        try:    seed_admin(session)
        finally: session.close()

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(download_bp)   # NEW

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "College Chatbot API v2"}), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found."}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File too large. Max 50 MB."}), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error."}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=Config.DEBUG)
