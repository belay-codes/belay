import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AcpAvailableCommand } from "@/types/acp";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Slash commands exposed by the connected ACP agent. */
  slashCommands?: AcpAvailableCommand[];
}

const MAX_HEIGHT = 200;

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Message Belay…",
  slashCommands = [],
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [prevFilteredLen, setPrevFilteredLen] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Derive autocomplete state from input ──────────────────────────
  const { showMenu, filteredCommands } = useMemo(() => {
    if (slashCommands.length === 0 || disabled || menuDismissed) {
      return { showMenu: false, filteredCommands: [] };
    }

    // Trigger when input starts with / and has no spaces yet
    const match = value.match(/^\/([^\s]*)$/);
    if (!match) {
      return { showMenu: false, filteredCommands: [] };
    }

    const filter = match[1].toLowerCase();
    const filtered = slashCommands.filter((cmd) =>
      cmd.name.toLowerCase().startsWith(filter),
    );

    return { showMenu: filtered.length > 0, filteredCommands: filtered };
  }, [value, slashCommands, disabled, menuDismissed]);

  // Reset selection when the filtered list changes (render-time adjustment)
  if (filteredCommands.length !== prevFilteredLen) {
    setPrevFilteredLen(filteredCommands.length);
    if (selectedIndex !== 0) setSelectedIndex(0);
  }

  // Scroll the selected item into view
  useEffect(() => {
    if (!showMenu || !menuRef.current) return;
    const selected = menuRef.current.querySelector("[data-selected]");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showMenu]);

  // Keep textarea height in sync with content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  // ── Select a command from the dropdown ────────────────────────────
  const selectCommand = useCallback((cmd: AcpAvailableCommand) => {
    setValue(`/${cmd.name} `);
    setMenuDismissed(false);
    setSelectedIndex(0);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // ── Keyboard handling ─────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showMenu && filteredCommands.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : 0,
          );
          return;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredCommands.length - 1,
          );
          return;
        case "Tab":
        case "Enter":
          e.preventDefault();
          selectCommand(filteredCommands[selectedIndex]);
          return;
        case "Escape":
          e.preventDefault();
          setMenuDismissed(true);
          return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    setMenuDismissed(false);
  }

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setMenuDismissed(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const canSend = !disabled && value.trim().length > 0;
  const dynamicPlaceholder =
    slashCommands.length > 0 ? "Type / for commands, or message…" : placeholder;

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="relative">
        {/* ── Autocomplete dropdown ──────────────────────────────── */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
          >
            <div className="p-1">
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  type="button"
                  data-selected={i === selectedIndex ? "" : undefined}
                  onClick={() => selectCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={[
                    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors",
                    i === selectedIndex
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  <span className="shrink-0 pt-px font-mono text-[13px] font-medium text-primary/80">
                    /{cmd.name}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug">
                      {cmd.description}
                    </p>
                    {cmd.input?.hint && (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground/60">
                        {cmd.input.hint}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input row ──────────────────────────────────────────── */}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={dynamicPlaceholder}
            rows={1}
            className="max-h-50 min-h-6 flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          <Button
            size="icon-sm"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            className="shrink-0 rounded-lg"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
        Belay can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}
