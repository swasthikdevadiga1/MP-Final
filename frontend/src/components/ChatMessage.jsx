import { useState } from "react";
import { Copy, Check, FileText, Bot, Download, Image as ImageIcon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function formatText(text) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- "))
      return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
    if (/^\d+\.\s/.test(line))
      return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
    if (line.trim() === "") return <br key={i} />;
    return <span key={i} className="block">{line}</span>;
  });
}

// Agent badge colours
const AGENT_STYLES = {
  faq:          "bg-green-400/10 text-green-400 border-green-400/20",
  document:     "bg-blue-400/10 text-blue-400 border-blue-400/20",
  pdf_download: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  image:        "bg-purple-400/10 text-purple-400 border-purple-400/20",
  supervisor:   "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copyText = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!message.download_url) return;
    const token = localStorage.getItem("token");
    // Open in new tab with auth header via fetch + blob
    fetch(`${API_BASE}${message.download_url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = message.pdf_filename || "syllabus.pdf";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert("Download failed. Please try again."));
  };

  // ── User bubble ─────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end gap-2 animate-slide-up">
        <div className="flex flex-col items-end gap-1.5 max-w-[75%]">
          {/* Image preview (if user attached an image) */}
          {message.imagePreview && (
            <div className="rounded-2xl rounded-br-sm overflow-hidden border border-surface-border shadow-md">
              <img src={message.imagePreview} alt="attached"
                className="max-w-[220px] max-h-[160px] object-cover" />
            </div>
          )}
          {/* Text bubble */}
          {message.content && message.content !== "📎 Image attached" && (
            <div className="chat-bubble-user">
              <p>{message.content}</p>
            </div>
          )}
          {message.content === "📎 Image attached" && !message.imagePreview && (
            <div className="chat-bubble-user flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              <span>Image attached</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Bot bubble ──────────────────────────────────────────────────────────────
  return (
    <div className="flex items-start gap-3 animate-slide-up group">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/30
        flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-brand-400" />
      </div>

      <div className="flex flex-col gap-1.5 min-w-0 max-w-[80%]">
        {/* Main bubble */}
        <div className="chat-bubble-bot relative">
          <ul className="space-y-0.5">{formatText(message.content)}</ul>

          {/* Copy button */}
          <button onClick={copyText}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1
              rounded-lg hover:bg-surface-hover transition-all"
            title="Copy">
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy  className="w-3.5 h-3.5 text-gray-500" />}
          </button>
        </div>

        {/* ── PDF Download button (syllabus queries) ───────────────────── */}
        {message.has_download && message.download_url && (
          <button onClick={handleDownload}
            className="flex items-center gap-2 self-start px-4 py-2 rounded-xl
              bg-orange-500/10 border border-orange-500/30 text-orange-400
              hover:bg-orange-500/20 hover:border-orange-500/50
              transition-all duration-200 text-xs font-semibold group/dl">
            <Download className="w-3.5 h-3.5 group-hover/dl:animate-bounce" />
            Download Syllabus PDF
            {message.pdf_size_kb && (
              <span className="text-orange-400/60 font-normal">
                ({message.pdf_size_kb} KB)
              </span>
            )}
          </button>
        )}

        {/* Source badges */}
        {message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <span key={i} className="badge bg-surface-card border border-surface-border text-gray-500">
                <FileText className="w-2.5 h-2.5" />{src}
              </span>
            ))}
          </div>
        )}

        {/* Agent tag */}
        {message.agent && (
          <div className="flex items-center gap-2">
            <span className={`badge border text-[10px] ${AGENT_STYLES[message.agent] || AGENT_STYLES.supervisor}`}>
              {message.agent === "pdf_download" ? "📄 PDF Agent"
               : message.agent === "image"       ? "🖼️ Image Agent"
               : message.agent === "faq"         ? "⚡ FAQ Agent"
               : message.agent === "document"    ? "🔍 Document Agent"
               : "🤖 Agent"}
            </span>
            {message.chunks_used > 0 && (
              <span className="text-[10px] text-gray-600">
                {message.chunks_used} chunks retrieved
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
