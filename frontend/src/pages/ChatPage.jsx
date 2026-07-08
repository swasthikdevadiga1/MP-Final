import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Mic, MicOff, Sparkles, Trash2,
  Paperclip, X, Image as ImageIcon
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import ChatMessage from "../components/ChatMessage";
import TypingIndicator from "../components/TypingIndicator";
import { sendMessageAPI, getChatHistoryAPI } from "../services/api";
import toast from "react-hot-toast";

const WELCOME = {
  id: "welcome", role: "bot", agent: null,
  content: "👋 Hello! I'm EduBot — your Smart College Information Assistant.\n\nI can answer questions about:\n• Admissions & eligibility\n• Fee structure & scholarships\n• Courses & departments\n• Hostel & campus facilities\n• Exam schedules & results\n\nYou can also 📎 attach an image (notice, timetable, question paper) and ask me about it!\n\nAsk me anything!",
};

const toBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function ChatPage() {
  const [messages,     setMessages]     = useState([WELCOME]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [listening,    setListening]    = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [attachedImg,  setAttachedImg]  = useState(null);   // { file, previewUrl, b64 }

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);
  const imgInputRef    = useRef(null);

  // Load history
  useEffect(() => {
    getChatHistoryAPI().then((r) => {
      if (r.data.history?.length > 0) {
        const hist = r.data.history.flatMap((h) => [
          { id: "u-" + h.id, role: "user", content: h.user_message },
          { id: "b-" + h.id, role: "bot",  content: h.bot_response, agent: h.agent_used },
        ]);
        setMessages([WELCOME, ...hist]);
      }
    }).catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Image attachment ──────────────────────────────────────────────────────
  const handleImageAttach = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["png","jpg","jpeg","webp","bmp","gif"].includes(ext)) {
      toast.error("Only image files supported (PNG, JPG, WEBP, BMP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    try {
      const b64        = await toBase64(file);
      const previewUrl = URL.createObjectURL(file);
      setAttachedImg({ file, previewUrl, b64 });
      inputRef.current?.focus();
    } catch {
      toast.error("Failed to read image.");
    }
  };

  const removeImage = () => {
    if (attachedImg?.previewUrl) URL.revokeObjectURL(attachedImg.previewUrl);
    setAttachedImg(null);
    if (imgInputRef.current) imgInputRef.current.value = "";
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim();
    if ((!q && !attachedImg) || loading) return;

    const imgToSend = attachedImg;
    const displayText = q || "📎 Image attached";

    setMessages((m) => [
      ...m,
      {
        id: Date.now() + "-u", role: "user",
        content: displayText,
        imagePreview: imgToSend?.previewUrl || null,
      },
    ]);
    setInput("");
    removeImage();
    setLoading(true);

    try {
      const res = await sendMessageAPI(q, imgToSend?.b64 || null);
      const d   = res.data;
      setMessages((m) => [
        ...m,
        {
          id:           Date.now() + "-b",
          role:         "bot",
          content:      d.answer,
          sources:      d.sources,
          agent:        d.agent,
          chunks_used:  d.chunks_used,
          has_download: d.has_download,
          download_url: d.download_url,
          pdf_filename: d.pdf_filename,
          pdf_size_kb:  d.pdf_size_kb,
        },
      ]);
    } catch {
      toast.error("Failed to get response. Please try again.");
      setMessages((m) => [
        ...m,
        { id: Date.now() + "-err", role: "bot",
          content: "⚠️ Something went wrong. Please try again.", agent: null },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, attachedImg]);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const handleClearChat = () => {
    setMessages([WELCOME]);
    setShowConfirm(false);
    setInput("");
    removeImage();
    toast.success("Chat cleared.");
    inputRef.current?.focus();
  };

  // ── Voice ─────────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = (e) => { toast.error("Voice error: " + e.error); setListening(false); };
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setTimeout(() => sendMessage(t), 200);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape" && showConfirm) setShowConfirm(false);
  };

  const suggestions = [
    "What is the syllabus for B.Tech CSE?",
    "What are the admission requirements?",
    "Tell me about the fee structure",
    "What courses are available?",
  ];

  const showSuggestions = messages.length === 1;
  const hasMessages     = messages.length > 1;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="shrink-0 px-6 py-4 border-b border-surface-border flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <div>
            <h1 className="font-display font-semibold text-white text-sm">College Assistant</h1>
            <p className="text-[10px] text-gray-500">RAG · Multi-agent · Self-reflective</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
            {hasMessages && (
              <div className="relative">
                {showConfirm && (
                  <div className="absolute right-0 top-10 z-50 w-56 bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-4 animate-fade-in">
                    <p className="text-sm text-white font-medium mb-1">Clear chat?</p>
                    <p className="text-xs text-gray-500 mb-4">Visual history only — server keeps records.</p>
                    <div className="flex gap-2">
                      <button onClick={handleClearChat}
                        className="flex-1 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all">
                        Clear
                      </button>
                      <button onClick={() => setShowConfirm(false)}
                        className="flex-1 py-1.5 rounded-xl border border-surface-border text-gray-400 hover:text-white text-xs transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <button onClick={() => setShowConfirm(s => !s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                    ${showConfirm
                      ? "bg-red-600/20 border-red-500/40 text-red-400"
                      : "border-surface-border text-gray-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                    }`}>
                  <Trash2 className="w-3.5 h-3.5" />Clear
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5"
          onClick={() => showConfirm && setShowConfirm(false)}>
          {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-400
                    hover:text-white hover:border-brand-500/50 hover:bg-brand-600/10 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image preview strip */}
        {attachedImg && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-surface-input border border-purple-500/30 rounded-xl w-fit">
              <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
              <img src={attachedImg.previewUrl} alt="attachment"
                className="h-10 w-10 object-cover rounded-lg border border-surface-border" />
              <span className="text-xs text-gray-400 max-w-[160px] truncate">
                {attachedImg.file.name}
              </span>
              <button onClick={removeImage}
                className="p-1 rounded-lg hover:bg-surface-hover text-gray-500 hover:text-red-400 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="shrink-0 px-6 pb-6">
          <div className="flex items-end gap-2 bg-surface-input border border-surface-border rounded-2xl
            px-3 py-3 focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">

            {/* Image attach button */}
            <button onClick={() => imgInputRef.current?.click()}
              title="Attach image"
              className="p-2 rounded-xl text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all shrink-0">
              <Paperclip className="w-4 h-4" />
            </button>
            <input ref={imgInputRef} type="file"
              accept=".png,.jpg,.jpeg,.webp,.bmp,.gif" className="hidden"
              onChange={(e) => handleImageAttach(e.target.files[0])} />

            <textarea ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedImg
                ? "Ask something about the image…"
                : "Ask about admissions, syllabus, fees…"}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600
                outline-none resize-none max-h-32 leading-relaxed"
              style={{ scrollbarWidth: "none" }} />

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Voice */}
              <button onClick={toggleVoice} title={listening ? "Stop" : "Voice input"}
                className={`p-2 rounded-xl transition-all ${listening
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                  : "text-gray-500 hover:text-gray-300 hover:bg-surface-hover"}`}>
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              {/* Send */}
              <button onClick={() => sendMessage()}
                disabled={(!input.trim() && !attachedImg) || loading}
                className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white
                  transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  shadow-lg shadow-brand-600/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-2">
            Enter to send · Shift+Enter for new line · 📎 attach images
          </p>
        </div>

      </main>
    </div>
  );
}
