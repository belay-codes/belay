import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

// ── Constants ──────────────────────────────────────────────────────

const BELAY_DIR_NAME = ".belay";
const SESSIONS_DIR_NAME = "sessions";
const SETTINGS_FILE = "settings.json";
const STATE_FILE = "state.json";
const GITIGNORE_FILE = ".gitignore";

/** Content for the auto-generated .gitignore. Shares settings.json, ignores everything else. */
const GITIGNORE_CONTENT = `# Belay project data
# Settings (settings.json) can be committed for team sharing.
# Everything else is local user data.
*
!.gitignore
!settings.json
`;

// ── Types ──────────────────────────────────────────────────────────

export interface ProjectSettings {
  /** Default harness agent ID for new sessions in this project. */
  defaultAgentId?: string | null;
  /** MCP servers to pass to the harness during session creation. */
  mcpServers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  /** Additional workspace directories beyond cwd. */
  additionalDirectories?: string[];
  /** Arbitrary key-value settings for the project. */
  [key: string]: unknown;
}

export interface ProjectState {
  /** Sessions belonging to this project. */
  sessions: Array<{
    id: string;
    title: string;
    createdAt: string;
    agentId: string | null;
    path?: string;
  }>;
  /** Currently active session ID. */
  activeSessionId: string | null;
  /** Session groups for sidebar organisation. */
  groups: Array<{
    id: string;
    name: string;
    color: string;
    sessionIds: string[];
    collapsed: boolean;
  }>;
  /** Ordered IDs of groups and ungrouped sessions for sidebar rendering. */
  layout: string[];
}

export interface StorageLocation {
  /** The resolved root directory for this project's storage. */
  root: string;
  /** Whether the storage lives inside the project directory (true) or in the fallback (false). */
  isProjectLocal: boolean;
  /** The sessions subdirectory. */
  sessionsDir: string;
}

// ── Path helpers ───────────────────────────────────────────────────

/** Hash a project path to a safe directory name for the fallback location. */
function hashPath(projectPath: string): string {
  return crypto
    .createHash("sha256")
    .update(projectPath)
    .digest("hex")
    .slice(0, 16);
}

/** Get the global fallback base directory: ~/.belay/projects/ */
function getFallbackBase(): string {
  return path.join(os.homedir(), ".belay", "projects");
}

/** Get the .belay directory path inside a project. */
function getProjectBelayDir(projectPath: string): string {
  return path.join(projectPath, BELAY_DIR_NAME);
}

// ── Storage resolution ─────────────────────────────────────────────

/**
 * Determine whether we can write to the project directory.
 * Attempts to create `.belay/` and falls back gracefully.
 */
async function canWriteToProject(projectPath: string): Promise<boolean> {
  try {
    const testDir = getProjectBelayDir(projectPath);
    // If the directory already exists, we can write to it
    if (fsSync.existsSync(testDir)) return true;
    // Try creating it
    await fs.mkdir(testDir, { recursive: true });
    // Clean up — initStorage will recreate it properly
    await fs.rmdir(testDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the storage location for a project.
 * Prefers `<project>/.belay/` but falls back to `~/.belay/projects/<hash>/`
 * if the project directory is not writable.
 */
export async function resolveStorageLocation(
  projectPath: string,
): Promise<StorageLocation> {
  const normalizedPath = path.resolve(projectPath);
  const belayDir = getProjectBelayDir(normalizedPath);

  // If .belay/ already exists, use it (user has explicitly opted in or it was created before)
  if (fsSync.existsSync(belayDir)) {
    return {
      root: belayDir,
      isProjectLocal: true,
      sessionsDir: path.join(belayDir, SESSIONS_DIR_NAME),
    };
  }

  // Try to create it
  if (await canWriteToProject(normalizedPath)) {
    return {
      root: belayDir,
      isProjectLocal: true,
      sessionsDir: path.join(belayDir, SESSIONS_DIR_NAME),
    };
  }

  // Fallback to global location
  const fallbackDir = path.join(getFallbackBase(), hashPath(normalizedPath));
  return {
    root: fallbackDir,
    isProjectLocal: false,
    sessionsDir: path.join(fallbackDir, SESSIONS_DIR_NAME),
  };
}

// ── Initialization ─────────────────────────────────────────────────

/**
 * Initialize the storage directory for a project.
 * Creates the directory structure and a .gitignore if project-local.
 * Returns the resolved storage location.
 */
export async function initProjectStorage(
  projectPath: string,
): Promise<StorageLocation> {
  const loc = await resolveStorageLocation(projectPath);

  // Create root directory
  await fs.mkdir(loc.root, { recursive: true });

  // Create sessions directory
  await fs.mkdir(loc.sessionsDir, { recursive: true });

  // If project-local, create .gitignore (idempotent — won't overwrite)
  if (loc.isProjectLocal) {
    const gitignorePath = path.join(loc.root, GITIGNORE_FILE);
    if (!fsSync.existsSync(gitignorePath)) {
      await fs.writeFile(gitignorePath, GITIGNORE_CONTENT, "utf-8");
    }
  }

  return loc;
}

// ── Settings ───────────────────────────────────────────────────────

/**
 * Load project settings (team-shareable defaults like harness config, MCP servers).
 */
export async function loadProjectSettings(
  projectPath: string,
): Promise<ProjectSettings | null> {
  try {
    const loc = await resolveStorageLocation(projectPath);
    const filePath = path.join(loc.root, SETTINGS_FILE);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as ProjectSettings;
  } catch {
    return null;
  }
}

/**
 * Save project settings.
 */
export async function saveProjectSettings(
  projectPath: string,
  settings: ProjectSettings,
): Promise<void> {
  const loc = await resolveStorageLocation(projectPath);
  await fs.mkdir(loc.root, { recursive: true });
  const filePath = path.join(loc.root, SETTINGS_FILE);
  await atomicWriteJson(filePath, settings);
}

// ── Project state ──────────────────────────────────────────────────

/**
 * Load project state (sessions, groups, layout — user-specific data).
 */
export async function loadProjectState(
  projectPath: string,
): Promise<ProjectState | null> {
  try {
    const loc = await resolveStorageLocation(projectPath);
    const filePath = path.join(loc.root, STATE_FILE);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as ProjectState;
  } catch {
    return null;
  }
}

/**
 * Save project state.
 */
export async function saveProjectState(
  projectPath: string,
  state: ProjectState,
): Promise<void> {
  const loc = await resolveStorageLocation(projectPath);
  await fs.mkdir(loc.root, { recursive: true });
  const filePath = path.join(loc.root, STATE_FILE);
  await atomicWriteJson(filePath, state);
}

// ── Session messages ───────────────────────────────────────────────

/**
 * Load session messages from the project's storage location.
 */
export async function loadSessionMessages(
  projectPath: string,
  sessionId: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    const loc = await resolveStorageLocation(projectPath);
    const filePath = path.join(loc.sessionsDir, `${sessionId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as { messages?: Record<string, unknown>[] };
    return data.messages ?? [];
  } catch {
    return null;
  }
}

/**
 * Save session messages to the project's storage location.
 */
export async function saveSessionMessages(
  projectPath: string,
  sessionId: string,
  messages: Record<string, unknown>[],
): Promise<void> {
  const loc = await resolveStorageLocation(projectPath);
  await fs.mkdir(loc.sessionsDir, { recursive: true });
  const filePath = path.join(loc.sessionsDir, `${sessionId}.json`);
  await atomicWriteJson(filePath, {
    sessionId,
    messages,
    savedAt: new Date().toISOString(),
  });
}

/**
 * Delete a session's message file.
 */
export async function deleteSessionMessages(
  projectPath: string,
  sessionId: string,
): Promise<void> {
  try {
    const loc = await resolveStorageLocation(projectPath);
    const filePath = path.join(loc.sessionsDir, `${sessionId}.json`);
    await fs.unlink(filePath);
  } catch {
    // Ignore — file may not exist
  }
}

/**
 * List all session IDs that have persisted message files for a project.
 */
export async function listPersistedSessions(
  projectPath: string,
): Promise<string[]> {
  try {
    const loc = await resolveStorageLocation(projectPath);
    if (!fsSync.existsSync(loc.sessionsDir)) return [];
    const files = await fs.readdir(loc.sessionsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  } catch {
    return [];
  }
}

// ── Query ──────────────────────────────────────────────────────────

/**
 * Check whether a project has an existing .belay/ directory.
 */
export function hasProjectStorage(projectPath: string): boolean {
  return fsSync.existsSync(getProjectBelayDir(path.resolve(projectPath)));
}

/**
 * Get the storage location info without creating anything.
 */
export async function getStorageInfo(
  projectPath: string,
): Promise<StorageLocation> {
  return resolveStorageLocation(projectPath);
}

// ── Internal helpers ───────────────────────────────────────────────

/** Write JSON to a file atomically (temp file + rename). */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tempPath = filePath + ".tmp";
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}
