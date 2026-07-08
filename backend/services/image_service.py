"""
services/image_service.py — Image processing pipeline.

Supports JPG, JPEG, PNG, WEBP, BMP uploads by admin.
Extracts text via Tesseract OCR with OpenAI Vision API fallback.
Extracted text is chunked and stored in FAISS like PDFs.

System requirement:
  Windows: https://github.com/UB-Mannheim/tesseract/wiki
  Linux:   sudo apt install tesseract-ocr
  Mac:     brew install tesseract

Python requirement (add to requirements.txt):
  pytesseract==0.3.10
  Pillow>=10.0.0
"""

import os, re, uuid, datetime
from PIL import Image
from config import Config

ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "bmp"}


def allowed_image(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_IMAGE_EXT


def save_image_upload(file) -> dict:
    """Save uploaded image to disk. Returns dict with path info."""
    if not allowed_image(file.filename):
        raise ValueError(
            f"Unsupported image type. Allowed: {', '.join(ALLOWED_IMAGE_EXT)}"
        )
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    img_dir  = os.path.join(base_dir, Config.UPLOAD_FOLDER, "images")
    os.makedirs(img_dir, exist_ok=True)

    ext       = file.filename.rsplit(".", 1)[-1].lower()
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(img_dir, safe_name)
    file.save(file_path)

    return {"filename": safe_name, "original_name": file.filename,
            "file_path": file_path, "file_type": "image"}


def extract_text_from_image(image_path: str) -> str:
    """Extract text via OCR, with Vision API fallback if OCR is too short."""
    text = _ocr_extract(image_path)
    if len(text.strip()) < 50:
        print(f"[ImageService] OCR short ({len(text)} chars), trying Vision API…")
        vision = _vision_extract(image_path)
        if vision and len(vision.strip()) > len(text.strip()):
            text = vision
    return text.strip()


def _ocr_extract(image_path: str) -> str:
    try:
        import pytesseract
        img = Image.open(image_path).convert("RGB")
        w, h = img.size
        if w < 1000:
            img = img.resize((int(w * 1000 / w), int(h * 1000 / w)), Image.LANCZOS)
        raw = pytesseract.image_to_string(img, lang="eng")
        cleaned = re.sub(r"\n{3,}", "\n\n", raw).strip()
        print(f"[ImageService] OCR: {len(cleaned)} chars")
        return cleaned
    except ImportError:
        print("[ImageService] pytesseract not installed — skipping OCR.")
        return ""
    except Exception as e:
        print(f"[ImageService] OCR error: {e}")
        return ""


def _vision_extract(image_path: str) -> str:
    try:
        import base64
        from openai import OpenAI
        client = OpenAI(api_key=Config.OPENAI_API_KEY)
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext  = image_path.rsplit(".", 1)[-1].lower()
        mime = f"image/{'jpeg' if ext in ('jpg','jpeg') else ext}"
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": [
                {"type": "text", "text":
                    "Extract ALL visible text from this image exactly as written. "
                    "Preserve headings, tables, codes and structure. "
                    "Output extracted text only."},
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ]}],
            max_tokens=1500,
        )
        text = resp.choices[0].message.content.strip()
        print(f"[ImageService] Vision API: {len(text)} chars")
        return text
    except Exception as e:
        print(f"[ImageService] Vision API error: {e}")
        return ""


def process_image_document(document_id: int) -> None:
    """Full pipeline: extract → chunk → embed → FAISS. Runs in background thread."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from services.embedding_service import add_chunks_to_faiss
    from database.db import SessionLocal
    from database.models import Document

    session = SessionLocal()
    try:
        doc = session.query(Document).filter_by(id=document_id).first()
        if not doc:
            return
        doc.status = "processing"
        session.commit()

        raw = extract_text_from_image(doc.file_path)
        if not raw:
            raise ValueError("No readable text found in image.")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=Config.CHUNK_SIZE,
            chunk_overlap=Config.CHUNK_OVERLAP,
        )
        lc_docs = splitter.create_documents(
            [raw], [{"source": doc.original_name, "type": "image"}]
        )
        chunks = [{"content": d.page_content, "metadata": d.metadata} for d in lc_docs]
        if not chunks:
            raise ValueError("Chunking produced no output.")

        total = add_chunks_to_faiss(chunks)
        doc.chunk_count  = len(chunks)
        doc.status       = "processed"
        doc.processed_at = datetime.datetime.utcnow()
        session.commit()
        print(f"[ImageService] ✓ {doc.original_name} → {len(chunks)} chunks, {total} total")
    except Exception as e:
        session.rollback()
        doc = session.query(Document).filter_by(id=document_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(e)
            session.commit()
        print(f"[ImageService] ✗ doc {document_id}: {e}")
    finally:
        session.close()
