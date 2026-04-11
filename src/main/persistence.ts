import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ── Paths ──────────────────────────────────────────────────────────────

let sessionsDir: string | null = null;

async function getSessionsDir(): Promise<string> {
  if (!sessionsDir) {
    sessionsDir = path.join(app.getPath("userData"), "sessions");
  }
  await fs.mkdir(sessionsDir, { recursive: true });
  return sessionsDir;
}

function sessionFilePath(sessionId: string): string {
  if (!sessionsDir) {
    sessionsDir = path.join(app.getPath("userData"), "sessions");
  }
  return path.join(sessionsDir, `${sessionId}.json`);
}

// ── Types (mirrors renderer Message types, but serializable) ───────────

interface SerializedToolCallInfo {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  arguments?: string;
  output?: string;
}

interface SerializedThinkingBlock {
  id: string;
  type: "thinking";
  content: string;
}

interface SerializedTextBlock {
  id: string;
  type: "text";
  content: string;
}

interface SerializedToolCallBlock {
  id: string;
  type: "tool_call";
  toolCall: SerializedToolCallInfo;
}

type SerializedBlock =
  | SerializedThinkingBlock
  | SerializedTextBlock
  | SerializedToolCallBlock;

interface SerializedMessage {
  id: string;
  role: "user" | "assistant";
  blocks: SerializedBlock[];
  timestamp: string; // ISO string
  // isStreaming is intentionally omitted — never persisted
}

interface SessionFile {
  sessionId: string;
  messages: SerializedMessage[];
  savedAt: string;
}

// ── Serialization helpers ──────────────────────────────────────────────

/**
 * Prepare messages for storage.
 * Strips `isStreaming` and converts Date objects to ISO strings.
 */
function serializeMessages(
  messages: Record<string, unknown>[],
): SerializedMessage[] {
  return messages.map((msg) => {
    const blocks = (msg.blocks as Record<string, unknown>[]) ?? [];
    return {
      id: msg.id as string,
      role: msg.role as "user" | "assistant",
      blocks: blocks.map((block) => {
        if (block.type === "tool_call") {
          const tc = block.toolCall as Record<string, unknown>;
          return {
            id: block.id as string,
            type: "tool_call" as const,
            toolCall: {
              id: tc.id as string,
              name: tc.name as string,
              status: tc.status as
                | "pending"
                | "in_progress"
                | "completed"
                | "failed",
              arguments: tc.arguments as string | undefined,
              output: tc.output as string | undefined,
            },
          };
        }
        return {
          id: block.id as string,
          type: block.type as "thinking" | "text",
          content: block.content as string,
        };
      }),
      timestamp:
        msg.timestamp instanceof Date
          ? (msg.timestamp as Date).toISOString()
          : String(msg.timestamp),
      // isStreaming intentionally omitted
    };
  });
}

/**
 * Parse stored messages back into the shape the renderer expects.
 * Converts ISO timestamp strings back to Date objects.
 */
function deserializeMessages(
  data: SerializedMessage[],
): Record<string, unknown>[] {
  return data.map((msg) => ({
    id: msg.id,
    role: msg.role,
    blocks: msg.blocks.map((block) => {
      if (block.type === "tool_call") {
        return { ...block };
      }
      return { ...block };
    }),
    timestamp: new Date(msg.timestamp),
    // isStreaming is absent — will be undefined/falsy in the renderer
  }));
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Load messages for a session from disk.
 * Returns an empty array if the session file doesn't exist.
 */
export async function loadSessionMessages(
  sessionId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const filePath = sessionFilePath(sessionId);
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as SessionFile;
    const messages = deserializeMessages(data.messages ?? []);
    console.log(
      `[Persistence] Loaded ${messages.length} messages for session ${sessionId.slice(0, 8)}… from ${filePath}`,
    );
    return messages;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      console.log(
        `[Persistence] No saved messages for session ${sessionId.slice(0, 8)}… (file not found — expected for new sessions)`,
      );
      return [];
    }
    console.error(`[Persistence] Failed to load session ${sessionId}:`, err);
    return [];
  }
}

/**
 * Save messages for a session to disk.
 * Creates the sessions directory if it doesn't exist.
 */
export async function saveSessionMessages(
  sessionId: string,
  messages: Record<string, unknown>[],
): Promise<void> {
  try {
    const dir = await getSessionsDir();
    const filePath = path.join(dir, `${sessionId}.json`);

    const serialized = serializeMessages(messages);
    const data: SessionFile = {
      sessionId,
      messages: serialized,
      savedAt: new Date().toISOString(),
    };

    // Write to a temp file first, then rename — prevents corruption if
    // the app crashes mid-write.
    const tempPath = filePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);

    console.log(
      `[Persistence] Saved ${serialized.length} messages for session ${sessionId.slice(0, 8)}… to ${filePath}`,
    );
  } catch (err) {
    console.error(`[Persistence] Failed to save session ${sessionId}:`, err);
  }
}

/**
 * Delete a session's message file from disk.
 */
export async function deleteSessionMessages(sessionId: string): Promise<void> {
  try {
    const filePath = sessionFilePath(sessionId);
    await fs.unlink(filePath);
    console.log(`[Persistence] Deleted session file ${sessionId.slice(0, 8)}…`);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      console.error(
        `[Persistence] Failed to delete session ${sessionId}:`,
        err,
      );
    }
  }
}

/**
 * List all session IDs that have persisted message files.
 */
export async function listPersistedSessions(): Promise<string[]> {
  try {
    const dir = await getSessionsDir();
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  } catch {
    return [];
  }
}
