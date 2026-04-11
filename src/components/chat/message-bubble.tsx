import { Bot, User } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Very small markdown→React renderer for assistant messages.
 * Handles: fenced code blocks, inline code, bold, and newlines.
 */
function renderMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on fenced code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  let key = 0;
  for (const part of parts) {
    if (part.startsWith("```")) {
      // Fenced code block
      const inner = part.slice(3, -3); // strip opening/closing ```
      const firstNewline = inner.indexOf("\n");
      const code = firstNewline === -1 ? inner : inner.slice(firstNewline + 1);
      nodes.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg bg-black/10 p-3 text-xs"
        >
          <code>{code}</code>
        </pre>,
      );
    } else {
      // Regular text — split into lines and handle inline formatting
      const lines = part.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) nodes.push(<br key={`br-${key}-${i}`} />);
        nodes.push(
          <span key={`ln-${key}-${i}`}>{renderInline(lines[i])}</span>,
        );
      }
    }
    key++;
  }
  return nodes;
}

/** Handle inline code and bold within a single line */
function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenise on inline code (`...`) and bold (**...**)
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(line)) !== null) {
    // Text before the match
    if (match.index > last) {
      nodes.push(<span key={idx++}>{line.slice(last, match.index)}</span>);
    }
    if (match[1]) {
      // Inline code
      nodes.push(
        <code key={idx++} className="rounded bg-black/10 px-1.5 py-0.5 text-xs">
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      // Bold
      nodes.push(<strong key={idx++}>{match[2].slice(2, -2)}</strong>);
    }
    last = regex.lastIndex;
  }
  if (last < line.length) {
    nodes.push(<span key={idx++}>{line.slice(last)}</span>);
  }
  return nodes;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={[
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* Bubble */}
      <div
        className={[
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="break-words text-[14px] leading-relaxed">
            {renderMarkdown(message.content)}
          </div>
        )}
        <span
          className={`mt-1 block text-[11px] opacity-50 ${isUser ? "text-right" : "text-left"}`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
