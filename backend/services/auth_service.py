"""
services/auth_service.py — Business logic for user registration, login,
password hashing (bcrypt), and JWT token generation.
"""

import bcrypt
from datetime import timedelta
from flask_jwt_extended import create_access_token
from sqlalchemy.orm import Session
from database.models import User
from config import Config


def hash_password(plain: str) -> str:
    """Return bcrypt hash of plain-text password."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_user(session: Session, name: str, email: str,
                password: str, is_admin: bool = False) -> User:
    """
    Create and persist a new user.
    Raises ValueError if email already exists.
    """
    existing = session.query(User).filter_by(email=email).first()
    if existing:
        raise ValueError(f"Email '{email}' is already registered.")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        is_admin=is_admin,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(session: Session, email: str, password: str) -> User | None:
    """Return User if credentials are valid, else None."""
    user = session.query(User).filter_by(email=email).first()
    if user and verify_password(password, user.password_hash):
        return user
    return None


def generate_token(user: User) -> str:
    """Generate a JWT access token encoding user identity."""
    identity = {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "name": user.name,
    }
    return create_access_token(
        identity=str(user.id),
        additional_claims=identity,
        expires_delta=timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES),
    )


def seed_admin(session: Session) -> None:
    """
    Seed a default admin account on first launch if none exists.
    Credentials come from .env → Config.
    """
    admin = session.query(User).filter_by(is_admin=True).first()
    if not admin:
        create_user(
            session,
            name="Admin",
            email=Config.ADMIN_EMAIL,
            password=Config.ADMIN_PASSWORD,
            is_admin=True,
        )
        print(f"[seed] Admin account created: {Config.ADMIN_EMAIL}")
