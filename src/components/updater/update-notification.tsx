import { useEffect, useState, useCallback } from "react";
import { Download, RefreshCw, AlertCircle, ArrowUpCircle } from "lucide-react";

// ── Types (mirrors preload.ts UpdateStatus) ──────────────────────────

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; info: { version: string; releaseNotes?: string } }
  | { state: "not-available" }
  | { state: "downloading"; progress: { percent: number } }
  | { state: "downloaded"; info: { version: string } }
  | { state: "error"; message: string };

// ── Component ────────────────────────────────────────────────────────

export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanup = window.electronAPI?.updaterOnStatus(setStatus);
    return () => cleanup?.();
  }, []);

  // Reset dismissed state when a new update appears
  useEffect(() => {
    if (status.state === "downloaded") {
      setDismissed(false);
    }
  }, [status.state]);

  const handleInstall = useCallback(() => {
    window.electronAPI?.updaterQuitAndInstall();
  }, []);

  const handleCheck = useCallback(() => {
    window.electronAPI?.updaterCheckForUpdates();
  }, []);

  // Don't render anything for states the user doesn't need to see
  if (!window.electronAPI?.updaterOnStatus) return null;
  if (status.state === "idle" || status.state === "not-available") return null;
  if (dismissed) return null;

  // ── Downloaded — ready to install ────────────────────────────────

  if (status.state === "downloaded") {
    return (
      <div className="mx-2 mb-1 rounded-lg border border-green-500/30 bg-green-500/10 p-2.5">
        <div className="flex items-start gap-2">
          <ArrowUpCircle className="mt-0.5 size-4 shrink-0 text-green-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-green-300">
              Update ready
            </p>
            <p className="mt-0.5 text-[10px] text-green-300/70">
              v{status.info.version} will be installed on restart
            </p>
            <button
              onClick={handleInstall}
              className="mt-2 w-full rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-green-500"
            >
              Restart &amp; Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Downloading ──────────────────────────────────────────────────

  if (status.state === "downloading") {
    return (
      <div className="mx-2 mb-1 rounded-lg border border-border/50 bg-muted/50 p-2.5">
        <div className="flex items-center gap-2">
          <Download className="size-3.5 shrink-0 animate-pulse text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              Downloading update… {status.progress.percent}%
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${status.progress.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Available ────────────────────────────────────────────────────

  if (status.state === "available") {
    return (
      <div className="mx-2 mb-1 rounded-lg border border-border/50 bg-muted/50 p-2.5">
        <div className="flex items-center gap-2">
          <Download className="size-3.5 shrink-0 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Update to v{status.info.version} downloading…
          </p>
        </div>
      </div>
    );
  }

  // ── Checking ─────────────────────────────────────────────────────

  if (status.state === "checking") {
    return (
      <div className="mx-2 mb-1 p-2.5">
        <div className="flex items-center justify-center gap-1.5">
          <RefreshCw className="size-3 animate-spin text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50">
            Checking for updates…
          </span>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────

  if (status.state === "error") {
    return (
      <div className="mx-2 mb-1 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-destructive">
              Update check failed
            </p>
            <div className="mt-1 flex gap-2">
              <button
                onClick={handleCheck}
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Retry
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
