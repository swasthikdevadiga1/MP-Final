"""
routes/download_routes.py — Serve generated PDFs for download.
Register blueprint in app.py:
    from routes.download_routes import download_bp
    app.register_blueprint(download_bp)
"""

import os
from flask import Blueprint, send_from_directory, jsonify
from flask_jwt_extended import jwt_required

download_bp = Blueprint("downloads", __name__)

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PDF_DIR  = os.path.join(_BASE_DIR, "data", "generated_pdfs")


@download_bp.route("/downloads/<filename>", methods=["GET"])
@jwt_required()
def download_pdf(filename: str):
    """
    GET /downloads/<filename>
    Serves a generated syllabus PDF to the authenticated student.
    Validates filename to prevent path traversal.
    """
    # Security: allow only expected filename format
    if not filename.startswith("syllabus_") or not filename.endswith(".pdf"):
        return jsonify({"error": "Invalid file."}), 400
    if not os.path.isfile(os.path.join(_PDF_DIR, filename)):
        return jsonify({"error": "File not found or expired."}), 404

    return send_from_directory(
        _PDF_DIR, filename,
        as_attachment=True,
        download_name=filename,
    )
