import { type ReactNode } from "react";

// ── Inline formatting ─────────────────────────────────────────────────

/** Render inline markdown: `code`, **bold**, *italic*, [links](url). */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenise: inline code → bold → italic → links
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]*\]\([^)]*\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={idx++}>{text.slice(last, match.index)}</span>);
    }

    if (match[1]) {
      // Inline code
      nodes.push(
        <code
          key={idx++}
          className="rounded bg-black/10 px-1.5 py-0.5 text-xs font-mono"
        >
          {match[1].slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      // Bold
      nodes.push(
        <strong key={idx++} className="font-semibold">
          {match[2].slice(2, -2)}
        </strong>,
      );
    } else if (match[3]) {
      // Italic
      nodes.push(<em key={idx++}>{match[3].slice(1, -1)}</em>);
    } else if (match[4]) {
      // Link [text](url)
      const linkMatch = match[4].match(/^\[([^\]]*)\]\(([^)]*)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={idx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {linkMatch[1]}
          </a>,
        );
      }
    }

    last = regex.lastIndex;
  }

  if (last < text.length) {
    nodes.push(<span key={idx++}>{text.slice(last)}</span>);
  }

  return nodes;
}

// ── Table helpers ─────────────────────────────────────────────────────

/** Does `line` look like a pipe-delimited table row? */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2;
}

/** Does `line` look like a table separator (`| --- | :---: | ---: |`)? */
function isSeparatorRow(line: string): boolean {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

/** Parse alignment from a separator cell like `:---`, `:---:`, `---:`. */
function parseAlignment(cell: string): "left" | "center" | "right" {
  const t = cell.trim();
  if (t.startsWith(":") && t.endsWith(":")) return "center";
  if (t.endsWith(":")) return "right";
  return "left";
}

/** Split `| a | b | c |` into `["a","b","c"]`. */
function splitTableRow(line: string): string[] {
  return line
    .trim()
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

// ── Block-level parsing ───────────────────────────────────────────────

type Alignment = "left" | "center" | "right";

interface Block {
  kind:
    | "code"
    | "heading"
    | "bullet"
    | "ordered"
    | "blockquote"
    | "hr"
    | "paragraph"
    | "table";
  content: string;
  level?: number; // heading level
  // Table-specific fields
  headers?: string[];
  alignments?: Alignment[];
  rows?: string[][];
}

/**
 * Split raw text into block-level elements.
 * Fenced code blocks are extracted first (they may contain blank lines).
 */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  // Extract fenced code blocks first
  const codeBlockRegex = /```[\s\S]*?```/g;
  let lastEnd = 0;
  let codeMatch: RegExpExecArray | null;

  const segments: { isCode: boolean; text: string }[] = [];

  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    if (codeMatch.index > lastEnd) {
      segments.push({
        isCode: false,
        text: text.slice(lastEnd, codeMatch.index),
      });
    }
    segments.push({ isCode: true, text: codeMatch[0] });
    lastEnd = codeMatch.index + codeMatch[0].length;
  }
  if (lastEnd < text.length) {
    segments.push({ isCode: false, text: text.slice(lastEnd) });
  }

  // Process segments
  for (const seg of segments) {
    if (seg.isCode) {
      blocks.push({ kind: "code", content: seg.text });
      continue;
    }

    // Process non-code text line-by-line (index-based for table look-ahead)
    const lines = seg.text.split("\n");
    let buffer: string[] = [];

    const flushParagraph = () => {
      const joined = buffer.join("\n").trim();
      if (joined) {
        blocks.push({ kind: "paragraph", content: joined });
      }
      buffer = [];
    };

    let li = 0;
    while (li < lines.length) {
      const line = lines[li];

      // ── Table detection ──────────────────────────────────────────
      // A table starts with a header row followed by a separator row.
      if (
        isTableRow(line) &&
        li + 1 < lines.length &&
        isSeparatorRow(lines[li + 1])
      ) {
        flushParagraph();
        const headers = splitTableRow(line);
        const alignments = splitTableRow(lines[li + 1]).map(parseAlignment);
        const rows: string[][] = [];
        li += 2; // skip header + separator

        while (li < lines.length && isTableRow(lines[li])) {
          rows.push(splitTableRow(lines[li]));
          li++;
        }

        blocks.push({
          kind: "table",
          content: "",
          headers,
          alignments,
          rows,
        });
        continue;
      }

      // Heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        blocks.push({
          kind: "heading",
          content: headingMatch[2],
          level: headingMatch[1].length,
        });
        li++;
        continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
        flushParagraph();
        blocks.push({ kind: "hr", content: "" });
        li++;
        continue;
      }

      // Bullet list item
      if (/^(\s*)[-*]\s+/.test(line)) {
        flushParagraph();
        const content = line.replace(/^\s*[-*]\s+/, "");
        blocks.push({ kind: "bullet", content });
        li++;
        continue;
      }

      // Ordered list item
      if (/^(\s*)\d+\.\s+/.test(line)) {
        flushParagraph();
        const content = line.replace(/^\s*\d+\.\s+/, "");
        blocks.push({ kind: "ordered", content });
        li++;
        continue;
      }

      // Blockquote
      if (/^>\s?/.test(line)) {
        flushParagraph();
        const content = line.replace(/^>\s?/, "");
        blocks.push({ kind: "blockquote", content });
        li++;
        continue;
      }

      // Blank line — break paragraph
      if (line.trim() === "") {
        flushParagraph();
        li++;
        continue;
      }

      // Regular text — accumulate into paragraph
      buffer.push(line);
      li++;
    }

    flushParagraph();
  }

  return blocks;
}

// ── Group consecutive list items into list wrappers ───────────────────

interface RenderItem {
  type:
    | "heading"
    | "code"
    | "bullet-list"
    | "ordered-list"
    | "blockquote"
    | "hr"
    | "paragraph"
    | "table";
  items?: Block[];
  content?: string;
  level?: number;
  headers?: string[];
  alignments?: Alignment[];
  rows?: string[][];
}

function groupBlocks(blocks: Block[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Group consecutive blockquote lines
    if (block.kind === "blockquote") {
      const grouped: Block[] = [];
      while (i < blocks.length && blocks[i].kind === "blockquote") {
        grouped.push(blocks[i]);
        i++;
      }
      items.push({ type: "blockquote", items: grouped });
      continue;
    }

    // Group consecutive bullet items
    if (block.kind === "bullet") {
      const grouped: Block[] = [];
      while (i < blocks.length && blocks[i].kind === "bullet") {
        grouped.push(blocks[i]);
        i++;
      }
      items.push({ type: "bullet-list", items: grouped });
      continue;
    }

    // Group consecutive ordered items
    if (block.kind === "ordered") {
      const grouped: Block[] = [];
      while (i < blocks.length && blocks[i].kind === "ordered") {
        grouped.push(blocks[i]);
        i++;
      }
      items.push({ type: "ordered-list", items: grouped });
      continue;
    }

    // Simple pass-through blocks
    switch (block.kind) {
      case "heading":
        items.push({
          type: "heading",
          content: block.content,
          level: block.level,
        });
        break;
      case "code":
        items.push({ type: "code", content: block.content });
        break;
      case "hr":
        items.push({ type: "hr" });
        break;
      case "paragraph":
        items.push({ type: "paragraph", content: block.content });
        break;
      case "table":
        items.push({
          type: "table",
          headers: block.headers,
          alignments: block.alignments,
          rows: block.rows,
        });
        break;
    }

    i++;
  }

  return items;
}

// ── Render helpers ────────────────────────────────────────────────────

const headingSizes: Record<number, string> = {
  1: "text-[20px] font-bold",
  2: "text-[18px] font-bold",
  3: "text-[16px] font-semibold",
  4: "text-[15px] font-semibold",
  5: "text-[14px] font-semibold",
  6: "text-[13px] font-semibold",
};

const alignClass: Record<Alignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function renderCodeBlock(raw: string, keyBase: number): ReactNode {
  const inner = raw.slice(3, -3); // strip ```…```
  const firstNewline = inner.indexOf("\n");
  const lang = firstNewline === -1 ? "" : inner.slice(0, firstNewline).trim();
  const code = firstNewline === -1 ? inner : inner.slice(firstNewline + 1);

  return (
    <div
      key={`code-${keyBase}`}
      className="my-2 overflow-hidden rounded-lg border border-border/50"
    >
      {lang && (
        <div className="border-b border-border/50 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto bg-black/5 p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderTable(
  headers: string[],
  alignments: Alignment[],
  rows: string[][],
  keyBase: number,
): ReactNode {
  // Pad alignments to match header count
  const aligns = headers.map((_, i) => alignments[i] ?? "left");

  return (
    <div key={`tbl-${keyBase}`} className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map((h, ci) => (
              <th
                key={ci}
                className={`${alignClass[aligns[ci]]} px-3 py-1.5 font-semibold text-foreground`}
              >
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/40 last:border-b-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`${alignClass[aligns[ci]]} px-3 py-1.5 text-foreground`}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main render function ──────────────────────────────────────────────

/**
 * Render markdown text as React nodes.
 *
 * Handles: headings, fenced code blocks (with language tag), bullet lists,
 * numbered lists, blockquotes, horizontal rules, paragraphs, tables,
 * **bold**, *italic*, `code`, and [links](url).
 */
export function renderMarkdown(text: string): ReactNode[] {
  if (!text) return [];

  const blocks = parseBlocks(text);
  const items = groupBlocks(blocks);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    switch (item.type) {
      case "heading":
        nodes.push(
          <div
            key={`h-${i}`}
            className={headingSizes[item.level ?? 3] ?? "font-semibold"}
          >
            {renderInline(item.content ?? "")}
          </div>,
        );
        break;

      case "code":
        nodes.push(renderCodeBlock(item.content ?? "", i));
        break;

      case "bullet-list":
        nodes.push(
          <ul
            key={`ul-${i}`}
            className="my-1 ml-4 list-disc space-y-1 text-[13px]"
          >
            {item.items?.map((li, j) => (
              <li key={j}>{renderInline(li.content)}</li>
            ))}
          </ul>,
        );
        break;

      case "ordered-list":
        nodes.push(
          <ol
            key={`ol-${i}`}
            className="my-1 ml-4 list-decimal space-y-1 text-[13px]"
          >
            {item.items?.map((li, j) => (
              <li key={j}>{renderInline(li.content)}</li>
            ))}
          </ol>,
        );
        break;

      case "blockquote":
        nodes.push(
          <blockquote
            key={`bq-${i}`}
            className="my-1 border-l-2 border-border pl-3 text-[13px] italic text-muted-foreground"
          >
            {item.items?.map((line, j) => (
              <p key={j}>{renderInline(line.content)}</p>
            ))}
          </blockquote>,
        );
        break;

      case "hr":
        nodes.push(<hr key={`hr-${i}`} className="my-3 border-border" />);
        break;

      case "paragraph":
        nodes.push(
          <p key={`p-${i}`} className="my-1">
            {renderInline(item.content ?? "")}
          </p>,
        );
        break;

      case "table":
        nodes.push(
          renderTable(
            item.headers ?? [],
            item.alignments ?? [],
            item.rows ?? [],
            i,
          ),
        );
        break;
    }
  }

  return nodes;
}
