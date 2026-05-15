"""
config.py — Centralized application configuration.
Loads environment variables and exposes typed settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── Flask core ──────────────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "0") == "1"

    # ── JWT ─────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES: int = 3600  # 1 hour

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///college_chatbot.db")

    # ── OpenAI ───────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    CHAT_MODEL: str = "gpt-4o-mini"

    # ── File Storage ─────────────────────────────────────────────────────────
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "data/uploads")
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", "data/faiss_index")
    ALLOWED_EXTENSIONS: set = {"pdf"}
    MAX_CONTENT_LENGTH: int = 50 * 1024 * 1024  # 50 MB

    # ── RAG / Chunking ────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    TOP_K_RESULTS: int = 5

    # ── Admin seed ────────────────────────────────────────────────────────────
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@college.edu")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@123")
