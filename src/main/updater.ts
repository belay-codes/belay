import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";

let mainWindow: BrowserWindow | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

// ── Cached renderer preference ──────────────────────────────────────
// Stored in localStorage on the renderer side; sent to main via IPC.

let updateMode: "auto" | "manual" = "auto";

// ── State broadcast to renderer ────────────────────────────────────

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; breaking: boolean; releaseNotes?: string }
  | { state: "not-available" }
  | { state: "downloading"; progress: { percent: number } }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

function sendStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send("updater:status", status);
}

// ── Helpers ─────────────────────────────────────────────────────────

function isBreakingChange(currentVersion: string, newVersion: string): boolean {
  const cur = currentVersion.replace(/^v/, "").split(".").map(Number);
  const next = newVersion.replace(/^v/, "").split(".").map(Number);
  if (cur.some(isNaN) || next.some(isNaN)) return false;

  // 1.x → 2.x is always breaking
  if (next[0] > cur[0]) return true;

  // Per semver, 0.x treats minor bumps as breaking:
  //   0.1.0 → 0.2.0 is breaking, 0.1.0 → 0.1.1 is not.
  if (cur[0] === 0 && next[0] === 0 && next[1] > cur[1]) return true;

  return false;
}

function extractReleaseNotes(info: UpdateInfo): string | undefined {
  const notes = info.releaseNotes;
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) return notes.map((n) => n.note).join("\n");
  return undefined;
}

// ── Setup ──────────────────────────────────────────────────────────

export function initUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Only run in packaged builds
  if (!app.isPackaged) return;

  // We control downloads manually so we can gate on user preference
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Events ─────────────────────────────────────────────────────

  autoUpdater.on("checking-for-update", () => {
    sendStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    const breaking = isBreakingChange(app.getVersion(), info.version);

    sendStatus({
      state: "available",
      version: info.version,
      breaking,
      releaseNotes: extractReleaseNotes(info),
    });

    // Auto-download only when the user has opted in AND it's not a
    // breaking change.  Breaking changes always require explicit user
    // consent so they have a chance to back up first.
    if (updateMode === "auto" && !breaking) {
      autoUpdater.downloadUpdate().catch(() => {
        // download-progress / error events handle the rest
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus({ state: "not-available" });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendStatus({
      state: "downloading",
      progress: { percent: Math.round(progress.percent) },
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    sendStatus({
      state: "downloaded",
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    sendStatus({ state: "error", message: err?.message ?? "Unknown error" });
  });

  // ── IPC handlers ───────────────────────────────────────────────

  // Renderer sends the user's preference from localStorage
  ipcMain.on("updater:setMode", (_event, mode: "auto" | "manual") => {
    updateMode = mode;
  });

  ipcMain.handle("updater:checkForUpdates", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // error event will be emitted
    }
  });

  // Explicitly trigger a download (manual mode or breaking change)
  ipcMain.handle("updater:downloadUpdate", async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch {
      // error event will be emitted
    }
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    autoUpdater.quitAndInstall();
  });

  // ── Initial check (delayed so the app loads first) ─────────────

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 10_000);

  // ── Periodic check every 4 hours ──────────────────────────────

  checkInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);

  // ── Cleanup ────────────────────────────────────────────────────

  mainWindow.on("closed", () => {
    if (checkInterval !== null) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    mainWindow = null;
  });
}
