import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Mic, MicOff, Sparkles } from "lucide-react";
import Sidebar from "../components/Sidebar";
import ChatMessage from "../components/ChatMessage";
import TypingIndicator from "../components/TypingIndicator";
import { sendMessageAPI, getChatHistoryAPI } from "../services/api";
import toast from "react-hot-toast";

const WELCOME = {
  id: "welcome",
  role: "bot",
  content: "👋 Hello! I'm EduBot — your Smart College Information Assistant.\n\nI can answer questions about:\n• Admissions & eligibility\n• Fee structure & scholarships\n• Courses & departments\n• Hostel & campus facilities\n• Exam schedules & results\n\nAsk me anything!",
  agent: null,
};

export default function ChatPage() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    getChatHistoryAPI().then((r) => {
      if (r.data.history?.length > 0) {
        const hist = r.data.history.flatMap((h) => [
          { id: "u-" + h.id, role: "user", content: h.user_message },
          { id: "b-" + h.id, role: "bot", content: h.bot_response, agent: h.agent_used },
        ]);
        setMessages([WELCOME, ...hist]);
      }
    }).catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { id: Date.now() + "-u", role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendMessageAPI(q);
      const d = res.data;
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + "-b",
          role: "bot",
          content: d.answer,
          sources: d.sources,
          agent: d.agent,
          chunks_used: d.chunks_used,
        },
      ]);
    } catch (err) {
      toast.error("Failed to get response. Please try again.");
      setMessages((m) => [
        ...m,
        { id: Date.now() + "-err", role: "bot", content: "⚠️ Something went wrong. Please try again.", agent: null },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading]);

  // Voice input via Web Speech API
  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in your browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      toast.error("Voice error: " + e.error);
      setListening(false);
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setTimeout(() => sendMessage(transcript), 200);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = [
    "What are the admission requirements?",
    "Tell me about the fee structure",
    "What courses are available?",
    "How do I apply for scholarships?",
  ];

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 px-6 py-4 border-b border-surface-border flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <div>
            <h1 className="font-display font-semibold text-white text-sm">College Assistant</h1>
            <p className="text-[10px] text-gray-500">RAG-powered · Multi-agent</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-500">Online</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-400 hover:text-white hover:border-brand-500/50 hover:bg-brand-600/10 transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="shrink-0 px-6 pb-6">
          <div className="flex items-end gap-3 bg-surface-input border border-surface-border rounded-2xl px-4 py-3 focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all duration-200">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about admissions, fees, courses…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 outline-none resize-none max-h-32 leading-relaxed"
              style={{ scrollbarWidth: "none" }}
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleVoice}
                title={listening ? "Stop listening" : "Voice input"}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  listening
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                    : "text-gray-500 hover:text-gray-300 hover:bg-surface-hover"
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </main>
    </div>
  );
}
