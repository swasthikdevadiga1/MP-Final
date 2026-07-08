"""app.py — Flask factory v3 (all blueprints registered)."""
import os
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

from config import Config
from database.db import init_db, SessionLocal
from services.auth_service import seed_admin
from routes.auth_routes      import auth_bp
from routes.admin_routes     import admin_bp
from routes.chat_routes      import chat_bp
from routes.download_routes  import download_bp
from routes.analytics_routes import analytics_bp
from routes.students_routes  import students_bp
from routes.system_routes    import system_bp
from routes.notices_routes   import notices_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"]         = Config.SECRET_KEY
    app.config["JWT_SECRET_KEY"]     = Config.JWT_SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH

    JWTManager(app)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    with app.app_context():
        init_db()
        # Also create new v2 tables
        try:
            from database.models_v2 import Announcement, StudentSession
            from database.db import Base, engine
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"[init] models_v2 skipped: {e}")
        session = SessionLocal()
        try:   seed_admin(session)
        finally: session.close()

    for bp in [auth_bp, admin_bp, chat_bp, download_bp,
               analytics_bp, students_bp, system_bp, notices_bp]:
        app.register_blueprint(bp)

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "version": "3.0"}), 200

    @app.errorhandler(404)
    def not_found(e): return jsonify({"error": "Not found."}), 404

    @app.errorhandler(413)
    def too_large(e): return jsonify({"error": "File too large (max 50 MB)."}), 413

    @app.errorhandler(500)
    def server_error(e): return jsonify({"error": "Internal server error."}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=Config.DEBUG)
