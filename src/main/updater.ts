import { BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";

let mainWindow: BrowserWindow | null = null;

// ── State broadcast to renderer ────────────────────────────────────

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; info: { version: string; releaseNotes?: string } }
  | { state: "not-available" }
  | { state: "downloading"; progress: { percent: number } }
  | { state: "downloaded"; info: { version: string } }
  | { state: "error"; message: string };

function sendStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send("updater:status", status);
}

// ── Setup ──────────────────────────────────────────────────────────

export function initUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Don't check for updates in development
  if (!window.webContents.session || !require("electron").app.isPackaged) {
    return;
  }

  // Configure auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Events ─────────────────────────────────────────────────────

  autoUpdater.on("checking-for-update", () => {
    sendStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendStatus({
      state: "available",
      info: {
        version: info.version,
        releaseNotes:
          typeof info.releaseNotes === "string"
            ? info.releaseNotes
            : Array.isArray(info.releaseNotes)
              ? info.releaseNotes.map((n) => n.note).join("\n")
              : undefined,
      },
    });
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
      info: { version: info.version },
    });
  });

  autoUpdater.on("error", (err) => {
    sendStatus({ state: "error", message: err?.message ?? "Unknown error" });
  });

  // ── IPC handlers ───────────────────────────────────────────────

  ipcMain.handle("updater:checkForUpdates", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      // Error event will be emitted and sent to renderer
    }
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    autoUpdater.quitAndInstall();
  });

  // ── Initial check (delayed so the app loads first) ─────────────

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore — the error event handler will notify the renderer
    });
  }, 10_000);

  // ── Periodic check every 4 hours ──────────────────────────────

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);

  // Clean up reference when the window closes
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
