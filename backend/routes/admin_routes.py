"""
routes/admin_routes.py — Admin endpoints (v2).
Now supports image uploads alongside PDF uploads.
"""

import threading, os
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt
from database.db import SessionLocal
from database.models import Document
from services.document_service import save_upload, process_document
from services.image_service import save_image_upload, process_image_document, allowed_image
from services.embedding_service import get_index_stats

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PDF_DIR  = os.path.join(_BASE_DIR, "data", "generated_pdfs")


def _require_admin():
    if not get_jwt().get("is_admin"):
        return jsonify({"error": "Admin access required."}), 403
    return None


@admin_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_document():
    """
    POST /admin/upload
    Accepts: PDF files  OR  image files (PNG/JPG/WEBP/BMP).
    Auto-detects type and routes to correct processing pipeline.
    """
    guard = _require_admin()
    if guard: return guard

    if "file" not in request.files:
        return jsonify({"error": "No file in request."}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    session = SessionLocal()
    try:
        # Detect file type
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        is_image = allowed_image(file.filename)
        is_pdf   = ext == "pdf"

        if not is_image and not is_pdf:
            return jsonify({"error": "Only PDF and image files (PNG/JPG/WEBP/BMP) are supported."}), 400

        # Save to disk
        if is_image:
            saved = save_image_upload(file)
        else:
            saved = save_upload(file)

        # Create DB record
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

        # Process in background (pick correct pipeline)
        processor = process_image_document if is_image else process_document
        threading.Thread(target=processor, args=(doc_id,), daemon=True).start()

        return jsonify({
            "message": f"{'Image' if is_image else 'PDF'} uploaded. Processing in background.",
            "document": {"id": doc_id, "original_name": saved["original_name"],
                         "status": "pending", "type": "image" if is_image else "pdf"},
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
    guard = _require_admin()
    if guard: return guard
    session = SessionLocal()
    try:
        docs  = session.query(Document).order_by(Document.uploaded_at.desc()).all()
        stats = get_index_stats()
        return jsonify({
            "documents": [{
                "id": d.id, "original_name": d.original_name,
                "status": d.status, "chunk_count": d.chunk_count,
                "error_message": d.error_message,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "processed_at": d.processed_at.isoformat() if d.processed_at else None,
                "type": "image" if d.filename.rsplit(".",1)[-1].lower()
                        in {"png","jpg","jpeg","webp","bmp"} else "pdf",
            } for d in docs],
            "faiss_stats": stats,
        }), 200
    finally:
        session.close()


@admin_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@jwt_required()
def delete_document(doc_id: int):
    guard = _require_admin()
    if guard: return guard
    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=doc_id).first()
        if not doc: return jsonify({"error": "Not found."}), 404
        session.delete(doc); session.commit()
        return jsonify({"message": f"Document {doc_id} deleted."}), 200
    finally:
        session.close()


@admin_bp.route("/reprocess/<int:doc_id>", methods=["POST"])
@jwt_required()
def reprocess(doc_id: int):
    guard = _require_admin()
    if guard: return guard
    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=doc_id).first()
        if not doc: return jsonify({"error": "Not found."}), 404
        ext = doc.filename.rsplit(".",1)[-1].lower() if "." in doc.filename else ""
        is_image = ext in {"png","jpg","jpeg","webp","bmp"}
        doc.status = "pending"; doc.error_message = None
        session.commit()
        processor = process_image_document if is_image else process_document
        threading.Thread(target=processor, args=(doc_id,), daemon=True).start()
        return jsonify({"message": f"Reprocessing started for {doc.original_name}"}), 202
    finally:
        session.close()


@admin_bp.route("/faiss-stats", methods=["GET"])
@jwt_required()
def faiss_stats():
    guard = _require_admin()
    if guard: return guard
    return jsonify(get_index_stats()), 200
