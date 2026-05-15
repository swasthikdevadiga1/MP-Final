"""
utils/helpers.py — Shared utility functions used across modules.
"""

import re
import os


def sanitize_filename(name: str) -> str:
    """Remove unsafe characters from a filename."""
    name = os.path.basename(name)
    name = re.sub(r"[^\w\s\-.]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name[:200]  # hard cap at 200 chars


def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text to max_len characters with ellipsis."""
    return text if len(text) <= max_len else text[:max_len] + "…"


def success_response(data: dict, code: int = 200):
    """Wrap data in a standard success envelope."""
    from flask import jsonify
    return jsonify({"success": True, **data}), code


def error_response(message: str, code: int = 400):
    """Wrap message in a standard error envelope."""
    from flask import jsonify
    return jsonify({"success": False, "error": message}), code
