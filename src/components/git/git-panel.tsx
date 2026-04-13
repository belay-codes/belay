import { useState, useCallback } from "react";
import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Check,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { useGitStatus } from "@/hooks/use-git";
import type { GitFileEntry } from "@/types/git";

// ── Helpers ──────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

interface StatusBadge {
  letter: string;
  colorClass: string;
}

function getStagedBadge(entry: GitFileEntry): StatusBadge {
  switch (entry.indexStatus) {
    case "M":
      return { letter: "M", colorClass: "text-green-400" };
    case "A":
      return { letter: "A", colorClass: "text-green-400" };
    case "D":
      return { letter: "D", colorClass: "text-red-400" };
    case "R":
      return { letter: "R", colorClass: "text-blue-400" };
    default:
      return {
        letter: entry.indexStatus || "?",
        colorClass: "text-muted-foreground",
      };
  }
}

type ChangeType = "modified" | "created" | "untracked" | "conflicted";

function getChangeBadge(type: ChangeType): StatusBadge {
  switch (type) {
    case "modified":
      return { letter: "M", colorClass: "text-amber-400" };
    case "created":
      return { letter: "A", colorClass: "text-amber-300" };
    case "conflicted":
      return { letter: "C", colorClass: "text-red-400" };
    case "untracked":
      return { letter: "U", colorClass: "text-muted-foreground" };
  }
}

// ── File entry row ───────────────────────────────────────────────────

interface FileRowProps {
  filePath: string;
  badge: StatusBadge;
  onAction: () => void;
  actionIcon: "plus" | "minus";
  disabled?: boolean;
}

function FileRow({ filePath, badge, onAction, actionIcon, disabled }: FileRowProps) {
  const ActionIcon = actionIcon === "plus" ? Plus : Minus;
  // Show only the filename, with the parent path dimmed
  const parts = filePath.split("/");
  const fileName = parts.pop() ?? filePath;
  const parent = parts.length > 0 ? parts.join("/") + "/" : "";

  return (
    <div className="group flex items-center gap-1 px-3 py-[2px] text-[12px] hover:bg-muted/40">
      {/* Stage/unstage button */}
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground disabled:opacity-0"
        aria-label={actionIcon === "plus" ? "Stage file" : "Unstage file"}
      >
        <ActionIcon className="size-3" />
      </button>

      {/* Status badge */}
      <span
        className={`inline-block w-3 shrink-0 text-center text-[10px] font-bold ${badge.colorClass}`}
      >
        {badge.letter}
      </span>

      {/* File path */}
      <span className="truncate text-muted-foreground" title={filePath}>
        {parent && (
          <span className="text-muted-foreground/50">{parent}</span>
        )}
        <span className="text-foreground/80">{fileName}</span>
      </span>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  count: number;
  onActionAll?: () => void;
  actionAllLabel?: string;
  disabled?: boolean;
}

function SectionHeader({
  label,
  count,
  onActionAll,
  actionAllLabel,
  disabled,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      <span>{label}</span>
      <span className="text-muted-foreground/50">({count})</span>
      {onActionAll && count > 0 && (
        <button
          type="button"
          onClick={onActionAll}
          disabled={disabled}
          className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-40"
          title={actionAllLabel}
        >
          {actionAllLabel}
        </button>
      )}
    </div>
  );
}

// ── Change entry (unified type for display) ──────────────────────────

interface ChangeEntry {
  path: string;
  type: ChangeType;
}

// ── GitPanel ─────────────────────────────────────────────────────────

export interface GitPanelProps {
  projectPath: string;
}

export function GitPanel({ projectPath }: GitPanelProps) {
  const {
    isRepo,
    loading,
    status,
    log,
    branches,
    error,
    refresh,
    refreshing,
  } = useGitStatus(projectPath);

  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const hasStaged = status && status.staged.length > 0;
  const currentBranch = branches.find((b) => b.isCurrent);

  // ── Actions ───────────────────────────────────────────────────────

  const handleStage = useCallback(
    async (filePath: string) => {
      await window.electronAPI?.gitStage(projectPath, filePath);
      refresh();
    },
    [projectPath, refresh],
  );

  const handleUnstage = useCallback(
    async (filePath: string) => {
      await window.electronAPI?.gitUnstage(projectPath, filePath);
      refresh();
    },
    [projectPath, refresh],
  );

  const handleStageAll = useCallback(async () => {
    await window.electronAPI?.gitStage(projectPath);
    refresh();
  }, [projectPath, refresh]);

  const handleUnstageAll = useCallback(async () => {
    await window.electronAPI?.gitUnstage(projectPath);
    refresh();
  }, [projectPath, refresh]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || !hasStaged) return;
    setCommitting(true);
    try {
      const result = await window.electronAPI?.gitCommit(
        projectPath,
        commitMessage.trim(),
      );
      if (result?.error) {
        // Error will be surfaced via the hook's error state on next refresh
        console.error("Commit failed:", result.error.message);
      } else {
        setCommitMessage("");
      }
      refresh();
    } finally {
      setCommitting(false);
    }
  }, [projectPath, commitMessage, hasStaged, refresh]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    try {
      await window.electronAPI?.gitPush(projectPath);
      refresh();
    } finally {
      setPushing(false);
    }
  }, [projectPath, refresh]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    try {
      await window.electronAPI?.gitPull(projectPath);
      refresh();
    } finally {
      setPulling(false);
    }
  }, [projectPath, refresh]);

  // ── Build changes list ────────────────────────────────────────────

  const changes: ChangeEntry[] = status
    ? [
        ...status.modified.map((e) => ({
          path: e.path,
          type: "modified" as const,
        })),
        ...status.created.map((e) => ({
          path: e.path,
          type: "created" as const,
        })),
        ...status.conflicted.map((p) => ({
          path: p,
          type: "conflicted" as const,
        })),
        ...status.notAdded.map((p) => ({
          path: p,
          type: "untracked" as const,
        })),
      ]
    : [];

  // ── Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8">
        <RefreshCw className="size-4 animate-spin text-muted-foreground/40" />
        <span className="text-[11px] text-muted-foreground/50">
          Loading git status…
        </span>
      </div>
    );
  }

  // ── Not a repo ────────────────────────────────────────────────────

  if (!isRepo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <CircleDot className="size-5 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground/50">
          Not a git repository
        </p>
        <p className="text-[10px] text-muted-foreground/30">
          Initialize a repo to see git status here
        </p>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Branch header ── */}
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-1.5">
        <GitBranch className="size-3 shrink-0 text-muted-foreground/70" />
        <span className="truncate text-[12px] font-medium text-foreground">
          {currentBranch?.name ?? status?.current ?? "HEAD"}
        </span>

        {/* Ahead / behind indicators */}
        {(status?.ahead ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-green-400">
            <ArrowUp className="size-2.5" />
            {status!.ahead}
          </span>
        )}
        {(status?.behind ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
            <ArrowDown className="size-2.5" />
            {status!.behind}
          </span>
        )}

        <div className="flex-1" />

        {/* Sync buttons */}
        <button
          type="button"
          onClick={handlePull}
          disabled={pulling}
          className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          title="Pull"
        >
          <ArrowDown className="size-3" />
        </button>
        <button
          type="button"
          onClick={handlePush}
          disabled={pushing}
          className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          title="Push"
        >
          <ArrowUp className="size-3" />
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw
            className={`size-3 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* ── Commit input ── */}
        <div className="border-b border-border/40 px-3 py-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message…"
            rows={2}
            className="w-full resize-none rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleCommit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleCommit}
            disabled={!hasStaged || !commitMessage.trim() || committing}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground/10 px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/15 disabled:opacity-30 disabled:hover:bg-foreground/10"
          >
            <Check className="size-3" />
            {committing ? "Committing…" : "Commit"}
          </button>
          <p className="mt-1 text-center text-[10px] text-muted-foreground/30">
            {hasStaged
              ? "Ctrl+Enter to commit"
              : "Stage changes to commit"}
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-3 mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {error.message}
          </div>
        )}

        {/* ── Staged changes ── */}
        {status && status.staged.length > 0 && (
          <div className="border-b border-border/30">
            <SectionHeader
              label="Staged"
              count={status.staged.length}
              onActionAll={handleUnstageAll}
              actionAllLabel="Unstage All"
            />
            {status.staged.map((entry) => (
              <FileRow
                key={entry.path}
                filePath={entry.path}
                badge={getStagedBadge(entry)}
                onAction={() => handleUnstage(entry.path)}
                actionIcon="minus"
              />
            ))}
          </div>
        )}

        {/* ── Unstaged changes ── */}
        {changes.length > 0 && (
          <div className="border-b border-border/30">
            <SectionHeader
              label="Changes"
              count={changes.length}
              onActionAll={handleStageAll}
              actionAllLabel="Stage All"
            />
            {changes.map((entry) => (
              <FileRow
                key={entry.path}
                filePath={entry.path}
                badge={getChangeBadge(entry.type)}
                onAction={() => handleStage(entry.path)}
                actionIcon="plus"
              />
            ))}
          </div>
        )}

        {/* ── Clean state ── */}
        {status?.isClean && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
            <CircleDot className="size-4 text-green-400/50" />
            <p className="text-[11px] text-muted-foreground/50">
              Working tree clean
            </p>
          </div>
        )}

        {/* ── Recent commits ── */}
        {log.length > 0 && (
          <div>
            <SectionHeader label="Recent Commits" count={log.length} />
            <div className="pb-1">
              {log.slice(0, 20).map((entry) => (
                <div
                  key={entry.hash}
                  className="flex items-start gap-2 px-3 py-1 text-[12px] hover:bg-muted/30"
                >
                  {/* Hash */}
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground/50">
                    {entry.hashAbbrev}
                  </span>
                  {/* Message + time */}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-foreground/80">
                      {entry.message.split("\n")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {entry.authorName} · {relativeTime(entry.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
