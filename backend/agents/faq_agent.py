"""
agents/faq_agent.py — Handles simple, common college FAQs directly
without hitting FAISS (fast path for greetings & trivial questions).
"""

import re

# Static FAQ map: regex pattern → answer
_FAQ_MAP = [
    (
        r"\b(hi|hello|hey|good\s*(morning|afternoon|evening))\b",
        "Hello! 👋 I'm your College Information Assistant. How can I help you today?",
    ),
    (
        r"\b(who are you|what are you|what can you do)\b",
        (
            "I'm a Smart College Information Chatbot powered by AI. "
            "I can answer questions about admissions, courses, fees, faculty, "
            "hostel, exams, and more — all based on official college documents. "
            "Just ask me anything!"
        ),
    ),
    (
        r"\b(thank you|thanks|thank u|thx)\b",
        "You're welcome! 😊 Feel free to ask if you have more questions.",
    ),
    (
        r"\b(bye|goodbye|see you|cya)\b",
        "Goodbye! Best of luck with your studies. 🎓",
    ),
    (
        r"\b(help|what can i ask)\b",
        (
            "You can ask me about:\n"
            "• Admission procedures and deadlines\n"
            "• Course details and eligibility\n"
            "• Fee structure and scholarships\n"
            "• Hostel and campus facilities\n"
            "• Exam schedules and results\n"
            "• Faculty and departments\n"
            "• And much more from the uploaded documents!"
        ),
    ),
]


def faq_answer(query: str) -> str | None:
    """
    Try to match query against known FAQ patterns.
    Returns a static answer string, or None if no match.
    """
    q = query.lower().strip()
    for pattern, answer in _FAQ_MAP:
        if re.search(pattern, q, re.IGNORECASE):
            return answer
    return None
