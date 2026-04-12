import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTheme } from "@/hooks/use-theme";

import "@xterm/xterm/css/xterm.css";

// ── CSS custom property → hex colour resolution ─────────────────────

/**
 * Hidden probe element used to resolve CSS custom properties (including
 * oklch, hsl, etc.) to computed `rgb()` values. Created lazily, kept
 * for the lifetime of the page.
 */
let _probe: HTMLDivElement | null = null;

function getProbe(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!_probe) {
    _probe = document.createElement("div");
    _probe.style.display = "none";
    _probe.style.position = "absolute";
    _probe.style.pointerEvents = "none";
    document.body.appendChild(_probe);
  }
  return _probe;
}

/**
 * Read a CSS custom property from `:root` and return the value as
 * `#rrggbb`.  Uses a real DOM element so the browser resolves every
 * colour format (hex, oklch, hsl, named colours…) through the cascade.
 */
function cssVarToHex(name: string): string {
  const probe = getProbe();
  if (!probe) return "#000000";

  probe.style.color = `var(${name})`;
  const computed = getComputedStyle(probe).color;

  const match = computed.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";

  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/** Convert `#rrggbb` + alpha → `rgba(r, g, b, a)`. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build an xterm.js theme by mapping the app's CSS custom properties to
 * ANSI colour slots.  Because it reads live computed values from the DOM,
 * it works with **every** current and future theme — no manual mapping
 * required.
 *
 * Colour mapping:
 *
 * | ANSI slot       | CSS variable      | Rationale                              |
 * |-----------------|-------------------|----------------------------------------|
 * | background      | --background      | matches the app surface                |
 * | foreground      | --foreground      | matches the app text                   |
 * | cursor          | --foreground      | visible against background              |
 * | black           | --card            | slightly darker than bg                 |
 * | red             | --destructive     | semantic "error" colour                 |
 * | green           | --chart-3         | green-ish accent in most themes         |
 * | yellow          | --chart-4         | warm accent in most themes              |
 * | blue            | --primary         | main accent colour                     |
 * | magenta         | --chart-2         | purple-ish accent in most themes        |
 * | cyan            | --sidebar-ring    | cool secondary accent                  |
 * | white           | --muted-foreground| mid-grey, good for "white" in ANSI ctx |
 * | bright variants | chart/ring vars   | the vivid accent colours               |
 */
function buildXtermTheme() {
  const background = cssVarToHex("--background");
  const foreground = cssVarToHex("--foreground");
  const card = cssVarToHex("--card");
  const primary = cssVarToHex("--primary");
  const destructive = cssVarToHex("--destructive");
  const muted = cssVarToHex("--muted");
  const mutedFg = cssVarToHex("--muted-foreground");
  const chart1 = cssVarToHex("--chart-1");
  const chart2 = cssVarToHex("--chart-2");
  const chart3 = cssVarToHex("--chart-3");
  const chart4 = cssVarToHex("--chart-4");
  const chart5 = cssVarToHex("--chart-5");
  const ring = cssVarToHex("--ring");
  const sidebarRing = cssVarToHex("--sidebar-ring");

  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: hexToRgba(foreground, 0.2),
    selectionInactiveBackground: hexToRgba(foreground, 0.1),

    // Standard ANSI (0–7)
    black: card,
    red: destructive,
    green: chart3,
    yellow: chart4,
    blue: primary,
    magenta: chart2,
    cyan: sidebarRing,
    white: mutedFg,

    // Bright ANSI (8–15)
    brightBlack: muted,
    brightRed: chart5,
    brightGreen: chart3,
    brightYellow: chart4,
    brightBlue: chart1,
    brightMagenta: chart2,
    brightCyan: ring,
    brightWhite: foreground,
  };
}

// ── Props ───────────────────────────────────────────────────────────

interface TerminalProps {
  id: string;
  cwd?: string;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────

export function TerminalView({ id, cwd, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Re-read whenever the user picks a new theme or the system
  // preference changes while "System" is active.
  const { theme, isDark } = useTheme();

  // ── Create terminal instance (once per id) ─────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: buildXtermTheme(),
      fontFamily:
        "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Keep terminal sized to its container
    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    // Terminal input → PTY
    const dataDisposable = terminal.onData((data) => {
      window.electronAPI?.terminalWrite(id, data);
    });

    // Terminal resize → PTY
    const resizeDisposable = terminal.onResize(() => {
      window.electronAPI?.terminalResize(id, terminal.cols, terminal.rows);
    });

    // PTY output → terminal
    const unregisterData = window.electronAPI?.onTerminalData(
      id,
      (data: string) => {
        terminal.write(data);
      },
    );

    // PTY exit → close
    const unregisterExit = window.electronAPI?.onTerminalExit(id, () => {
      onClose();
    });

    // Spawn the PTY process
    window.electronAPI?.terminalSpawn(id, cwd);

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      unregisterData?.();
      unregisterExit?.();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [id, cwd, onClose]);

  // ── Reactively update terminal theme when app theme changes ────
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = buildXtermTheme();
  }, [theme, isDark]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export default TerminalView;
