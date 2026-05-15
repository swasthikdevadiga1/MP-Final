# EduBot — Smart College Information Chatbot

A production-ready RAG-powered college chatbot with multi-agent architecture.

## Tech Stack
- **Backend**: Python, Flask, LangChain, OpenAI, FAISS, SQLite/MySQL
- **Frontend**: React (Vite), Tailwind CSS, Axios
- **Voice**: Web Speech API

## Project Structure
```
college-chatbot/
├── backend/
│   ├── app.py                    # Flask app factory + entry point
│   ├── config.py                 # Centralized config (reads .env)
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── auth_routes.py        # /login /register /logout /me
│   │   ├── admin_routes.py       # /admin/upload /admin/documents
│   │   └── chat_routes.py        # /chat /voice /history
│   ├── services/
│   │   ├── auth_service.py       # bcrypt + JWT
│   │   ├── document_service.py   # PDF → chunks pipeline
│   │   ├── embedding_service.py  # FAISS vector store (append-only)
│   │   └── rag_service.py        # OpenAI RAG query
│   ├── agents/
│   │   ├── supervisor_agent.py   # Router: FAQ vs Document
│   │   ├── document_agent.py     # RAG agent
│   │   └── faq_agent.py          # Static FAQ fast-path
│   ├── database/
│   │   ├── db.py                 # SQLAlchemy engine + session
│   │   └── models.py             # User, Document, ChatHistory
│   ├── utils/
│   │   └── helpers.py
│   └── data/
│       ├── uploads/              # Uploaded PDFs
│       └── faiss_index/          # Persisted FAISS index
└── frontend/
    └── src/
        ├── pages/
        │   ├── LoginPage.jsx     # Login + Registration
        │   ├── ChatPage.jsx      # Chat UI with voice + history
        │   └── AdminPage.jsx     # Document upload + management
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── ChatMessage.jsx
        │   └── TypingIndicator.jsx
        ├── services/
        │   └── api.js            # All Axios API calls
        ├── context/
        │   └── AuthContext.jsx   # JWT auth state
        └── App.jsx               # Router + guards
```

## Setup Instructions

### 1. Clone / Download
```bash
cd college-chatbot
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# Run the server
python app.py
# → Flask starts on http://localhost:5000
# → Admin account auto-seeded: admin@college.edu / Admin@123
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure API URL (optional — defaults to localhost:5000)
cp .env.example .env

# Start dev server
npm run dev
# → Opens on http://localhost:5173
```

### 4. First Run Workflow
1. Open http://localhost:5173
2. Log in as admin: `admin@college.edu` / `Admin@123`
3. Go to **Admin Panel** → Upload college PDF documents
4. Documents are auto-processed: text → chunks → FAISS embeddings
5. Log out and create a student account (or use different browser)
6. Log in as student → start chatting!

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /login | — | Login |
| POST | /register | — | Student registration |
| POST | /logout | JWT | Logout |
| GET | /me | JWT | Current user info |
| POST | /chat | JWT | Send message, get RAG response |
| POST | /voice | JWT | Voice transcript → chat |
| GET | /history | JWT | Last 50 messages |
| POST | /admin/upload | JWT+Admin | Upload PDF |
| GET | /admin/documents | JWT+Admin | List documents |
| DELETE | /admin/documents/:id | JWT+Admin | Delete document |
| GET | /health | — | Health check |

## Environment Variables

### Backend (.env)
```env
OPENAI_API_KEY=sk-...           # Required
JWT_SECRET_KEY=...              # Change in production
SECRET_KEY=...                  # Flask secret
DATABASE_URL=sqlite:///college_chatbot.db
UPLOAD_FOLDER=data/uploads
FAISS_INDEX_PATH=data/faiss_index
ADMIN_EMAIL=admin@college.edu
ADMIN_PASSWORD=Admin@123
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
```

## Multi-Agent Architecture
```
User Query
    │
    ▼
Supervisor Agent
    ├─→ FAQ Agent       (greetings, simple Q&A → instant response)
    ├─→ Clarify         (too vague → asks for more detail)
    └─→ Document Agent  (RAG pipeline)
            │
            ▼
        FAISS Search (top-5 chunks)
            │
            ▼
        OpenAI GPT (grounded answer)
            │
            ▼
        Response + Sources
```

## Production Notes
- Replace SQLite with MySQL/PostgreSQL for production
- Use gunicorn: `gunicorn app:create_app() -w 4 -b 0.0.0.0:5000`
- Set `FLASK_DEBUG=0` in production
- Rotate JWT_SECRET_KEY on first production deploy
- Use object storage (S3/GCS) for uploaded PDFs at scale
