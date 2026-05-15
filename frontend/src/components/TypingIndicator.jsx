export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-brand-400 text-xs">🎓</span>
      </div>
      <div className="chat-bubble-bot flex items-center gap-1.5 py-4 px-5">
        {[0, 0.2, 0.4].map((d, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-dot"
            style={{ animationDelay: d + "s" }}
          />
        ))}
      </div>
    </div>
  );
}
