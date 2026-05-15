import { useState } from "react";
import { Copy, Check, FileText, Bot } from "lucide-react";

function formatText(text) {
  // Convert markdown-ish patterns to readable format
  return text
    .split("\n")
    .map((line, i) => {
      if (line.startsWith("• ") || line.startsWith("- ")) {
        return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
      }
      if (line.trim() === "") return <br key={i} />;
      return <span key={i} className="block">{line}</span>;
    });
}

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copyText = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 animate-slide-up">
        <div className="chat-bubble-user">
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-slide-up group">
      {/* Bot avatar */}
      <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-brand-400" />
      </div>

      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="chat-bubble-bot relative">
          <ul className="space-y-0.5">{formatText(message.content)}</ul>

          {/* Copy button */}
          <button
            onClick={copyText}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-surface-hover transition-all duration-150"
            title="Copy"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy className="w-3.5 h-3.5 text-gray-500" />}
          </button>
        </div>

        {/* Source badges */}
        {message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <span key={i} className="badge bg-surface-card border border-surface-border text-gray-500">
                <FileText className="w-2.5 h-2.5" />
                {src}
              </span>
            ))}
          </div>
        )}

        {/* Agent tag */}
        {message.agent && (
          <span className="text-[10px] text-gray-600">
            via {message.agent} agent
            {message.chunks_used ? ` · ${message.chunks_used} chunks` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
