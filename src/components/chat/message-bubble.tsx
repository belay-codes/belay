import { Bot, User } from "lucide-react";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallDisplay } from "./tool-call-display";
import { renderMarkdown } from "./markdown";
import type { Message, MessageBlock, ToolCallInfo } from "./types";

export type { Message, MessageBlock, ToolCallInfo };

// ── Block renderer ────────────────────────────────────────────────────

function BlockRenderer({
  block,
  isStreaming,
}: {
  block: MessageBlock;
  isStreaming?: boolean;
}) {
  switch (block.type) {
    case "thinking":
      return (
        <ThinkingBlock content={block.content} isStreaming={isStreaming} />
      );

    case "text":
      if (!block.content) return null;
      return (
        <div className="wrap-break-word text-[14px] leading-relaxed">
          {renderMarkdown(block.content)}
        </div>
      );

    case "tool_call":
      return <ToolCallDisplay toolCall={block.toolCall} />;
  }
}

// ── MessageBubble ─────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // ── User messages: simple text bubble ────────────────────────────
  if (isUser) {
    const textBlock = message.blocks.find((b) => b.type === "text");
    const content = textBlock?.type === "text" ? textBlock.content : "";

    return (
      <div className="flex flex-row-reverse gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="size-4" />
        </div>

        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground">
          <p className="whitespace-pre-wrap wrap-break-word">{content}</p>
          <span className="mt-1 block text-right text-[11px] opacity-50">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    );
  }

  // ── Assistant messages: avatar + sequential blocks ───────────────
  const hasContent = message.blocks.some(
    (b) =>
      (b.type === "thinking" && b.content.length > 0) ||
      (b.type === "text" && b.content.length > 0) ||
      b.type === "tool_call",
  );

  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="size-4" />
      </div>

      <div className="min-w-0 max-w-[75%]">
        {hasContent ? (
          <div className="space-y-2">
            {message.blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                isStreaming={
                  message.isStreaming &&
                  block.id === message.blocks[message.blocks.length - 1]?.id
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
              <span className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <span className="mt-1 block text-left text-[11px] opacity-50">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
