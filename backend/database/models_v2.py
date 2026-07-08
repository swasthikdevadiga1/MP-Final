"""
database/models_v2.py
Additional models:
  • Announcement  — admin notice board
  • StudentSession — last-login tracking (auto-updated on login)
"""

import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database.db import Base


class Announcement(Base):
    """Admin-posted notices shown to students in chat welcome message."""
    __tablename__ = "announcements"

    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(200), nullable=False)
    body       = Column(Text, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    author = relationship("User", foreign_keys=[created_by])


class StudentSession(Base):
    """Tracks last login time per student (upserted on every login)."""
    __tablename__ = "student_sessions"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    last_login = Column(DateTime, default=datetime.datetime.utcnow)
    login_count= Column(Integer, default=1)

    user = relationship("User")
