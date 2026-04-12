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

  // ── User messages: terminal-style input ──────────────────────────
  if (isUser) {
    const textBlock = message.blocks.find((b) => b.type === "text");
    const content = textBlock?.type === "text" ? textBlock.content : "";

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2 text-[14px] leading-relaxed text-primary-foreground">
          <p className="whitespace-pre-wrap wrap-break-word">{content}</p>
        </div>
      </div>
    );
  }

  // ── Assistant messages: full-width block output ──────────────────
  const hasContent = message.blocks.some(
    (b) =>
      (b.type === "thinking" && b.content.length > 0) ||
      (b.type === "text" && b.content.length > 0) ||
      b.type === "tool_call",
  );

  if (!hasContent) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
      </div>
    );
  }

  return (
    <div className="w-full">
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
    </div>
  );
}
