"""
routes/admin_routes.py — Admin-only endpoints for document management.

All routes are protected by JWT + admin-role check.
"""

import threading
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from database.db import SessionLocal
from database.models import Document
from services.document_service import save_upload, process_document

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


def _require_admin():
    """Return 403 JSON if current JWT user is not an admin."""
    claims = get_jwt()
    if not claims.get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


@admin_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_document():
    """
    POST /admin/upload
    Form-data: file (PDF)
    Saves file, creates DB record, triggers async processing.
    """
    guard = _require_admin()
    if guard:
        return guard

    if "file" not in request.files:
        return jsonify({"error": "No file part in request."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    session = SessionLocal()
    try:
        # 1. Save to disk
        saved = save_upload(file)

        # 2. Create DB record (status = pending)
        doc = Document(
            filename=saved["filename"],
            original_name=saved["original_name"],
            file_path=saved["file_path"],
            status="pending",
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        doc_id = doc.id

        # 3. Process asynchronously so we don't block the HTTP response
        t = threading.Thread(target=process_document, args=(doc_id,), daemon=True)
        t.start()

        return jsonify({
            "message": "File uploaded successfully. Processing in background.",
            "document": {
                "id": doc_id,
                "original_name": saved["original_name"],
                "status": "pending",
            },
        }), 202

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500
    finally:
        session.close()


@admin_bp.route("/documents", methods=["GET"])
@jwt_required()
def list_documents():
    """GET /admin/documents — list all uploaded documents."""
    guard = _require_admin()
    if guard:
        return guard

    session = SessionLocal()
    try:
        docs = session.query(Document).order_by(Document.uploaded_at.desc()).all()
        return jsonify({
            "documents": [
                {
                    "id": d.id,
                    "original_name": d.original_name,
                    "status": d.status,
                    "chunk_count": d.chunk_count,
                    "error_message": d.error_message,
                    "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                    "processed_at": d.processed_at.isoformat() if d.processed_at else None,
                }
                for d in docs
            ]
        }), 200
    finally:
        session.close()


@admin_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@jwt_required()
def delete_document(doc_id: int):
    """DELETE /admin/documents/<id> — remove document record (file stays on disk)."""
    guard = _require_admin()
    if guard:
        return guard

    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=doc_id).first()
        if not doc:
            return jsonify({"error": "Document not found."}), 404

        session.delete(doc)
        session.commit()
        return jsonify({"message": f"Document {doc_id} deleted."}), 200
    finally:
        session.close()
