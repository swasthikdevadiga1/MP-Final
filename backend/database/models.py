"""
database/models.py — ORM models for Users, Documents, and Chat History.
"""

import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey
)
from sqlalchemy.orm import relationship
from database.db import Base


class User(Base):
    """Represents a student or admin account."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # One user → many chat messages
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete")


class Document(Base):
    """Tracks every PDF uploaded by the admin."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    chunk_count = Column(Integer, default=0)
    status = Column(String(50), default="pending")   # pending | processed | error
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)


class ChatHistory(Base):
    """Stores every user ↔ bot turn."""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    agent_used = Column(String(50), default="document")   # document | faq
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_history")
