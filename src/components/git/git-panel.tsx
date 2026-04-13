import { useState, useCallback } from "react";
import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Check,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Circle,
  GitCommitHorizontal,
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

type FileStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?";

function getStagedStatus(entry: GitFileEntry): FileStatus {
  const s = entry.indexStatus;
  if (s === "M") return "M";
  if (s === "A") return "A";
  if (s === "D") return "D";
  if (s === "R") return "R";
  if (s === "C") return "C";
  return "?";
}

function getChangeStatus(type: ChangeType): FileStatus {
  switch (type) {
    case "modified":
      return "M";
    case "created":
      return "A";
    case "conflicted":
      return "C";
    case "untracked":
      return "?";
  }
}

const STATUS_COLORS: Record<FileStatus, string> = {
  M: "text-amber-400",
  A: "text-green-400",
  D: "text-red-400",
  R: "text-blue-400",
  C: "text-red-400",
  U: "text-muted-foreground/50",
  "?": "text-muted-foreground/40",
};

type ChangeType = "modified" | "created" | "untracked" | "conflicted";

interface ChangeEntry {
  path: string;
  type: ChangeType;
}

// ── Collapsible section ──────────────────────────────────────────────

interface SectionProps {
  label: string;
  count: number;
  defaultOpen?: boolean;
  action?: { label: string; onAction: () => void };
  children: React.ReactNode;
}

function Section({
  label,
  count,
  defaultOpen = true,
  action,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground/80"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <span className="uppercase tracking-wider">{label}</span>
        <span className="text-muted-foreground/40">{count}</span>
        {action && count > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              action.onAction();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                action.onAction();
              }
            }}
            className="ml-auto text-[10px] font-normal normal-case tracking-normal text-muted-foreground/30 transition-colors hover:text-foreground"
          >
            {action.label}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

// ── File row ─────────────────────────────────────────────────────────

interface FileRowProps {
  filePath: string;
  status: FileStatus;
  onAction: () => void;
  actionIcon: "stage" | "unstage";
}

function FileRow({ filePath, status, onAction, actionIcon }: FileRowProps) {
  const ActionIcon = actionIcon === "stage" ? Plus : Minus;
  const parts = filePath.split("/");
  const fileName = parts.pop() ?? filePath;
  const parent = parts.length > 0 ? parts.join("/") + "/" : "";

  return (
    <div className="group flex items-center gap-1 px-3 py-[2px] text-[12px] transition-colors hover:bg-muted/30">
      {/* Action button */}
      <button
        type="button"
        onClick={onAction}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        aria-label={actionIcon === "stage" ? "Stage" : "Unstage"}
      >
        <ActionIcon className="size-3" />
      </button>

      {/* Status letter */}
      <span
        className={`w-3 shrink-0 text-center text-[10px] font-bold tabular-nums ${STATUS_COLORS[status]}`}
      >
        {status}
      </span>

      {/* Path */}
      <span className="min-w-0 truncate text-foreground/70" title={filePath}>
        {parent && (
          <span className="text-muted-foreground/30">{parent}</span>
        )}
        <span>{fileName}</span>
      </span>
    </div>
  );
}

// ── Commit row ───────────────────────────────────────────────────────

interface CommitRowProps {
  hash: string;
  message: string;
  author: string;
  date: number;
  isHead: boolean;
}

function CommitRow({ hash, message, author, date, isHead }: CommitRowProps) {
  const firstLine = message.split("\n")[0];
  return (
    <div className="flex items-start gap-2 px-3 py-[3px] text-[12px]">
      {/* Hash */}
      <span className="shrink-0 pt-px font-mono text-[10px] text-muted-foreground/30">
        {hash}
      </span>
      {/* Message */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-foreground/60">{firstLine}</span>
          {isHead && (
            <span className="shrink-0 rounded bg-foreground/10 px-1 py-px text-[9px] font-medium text-foreground/40">
              HEAD
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/25">
          {author} · {relativeTime(date)}
        </span>
      </div>
    </div>
  );
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
  const [commitExpanded, setCommitExpanded] = useState(false);

  const hasStaged = (status?.staged.length ?? 0) > 0;
  const currentBranch = branches.find((b) => b.isCurrent);
  const ahead = status?.ahead ?? 0;
  const behind = status?.behind ?? 0;

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
      if (!result?.error) {
        setCommitMessage("");
        setCommitExpanded(false);
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

  const stagedCount = status?.staged.length ?? 0;
  const changesCount = changes.length;

  // ── Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <RefreshCw className="size-4 animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  // ── Not a repo ────────────────────────────────────────────────────

  if (!isRepo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Circle className="size-4 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40">
          Not a git repository
        </p>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* ── Branch bar ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground/50" />
        <span className="min-w-0 truncate text-[12px] font-medium text-foreground/80">
          {currentBranch?.name ?? status?.current ?? "HEAD"}
        </span>

        {/* Ahead / behind */}
        {ahead > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-green-400/70">
            <ArrowUp className="size-2.5" />
            {ahead}
          </span>
        )}
        {behind > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-amber-400/70">
            <ArrowDown className="size-2.5" />
            {behind}
          </span>
        )}

        <div className="flex-1" />

        {/* Sync */}
        <button
          type="button"
          onClick={handlePull}
          disabled={pulling}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          title="Pull"
        >
          <ArrowDown className="size-3" />
        </button>
        <button
          type="button"
          onClick={handlePush}
          disabled={pushing}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          title="Push"
        >
          <ArrowUp className="size-3" />
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="shrink-0 border-b border-border/30 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive/80">
          {error.message}
        </div>
      )}

      {/* ── Commit input (collapsed pill when no staged, expanded when staged) ── */}
      <div className="shrink-0 border-b border-border/30">
        {hasStaged && !commitExpanded ? (
          // Prompt to expand commit area
          <button
            type="button"
            onClick={() => setCommitExpanded(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted/20 hover:text-muted-foreground/70"
          >
            <GitCommitHorizontal className="size-3.5 shrink-0" />
            <span>
              Commit {stagedCount} staged change{stagedCount !== 1 ? "s" : ""}
            </span>
            <span className="ml-auto text-[10px]">⏎</span>
          </button>
        ) : hasStaged || commitExpanded ? (
          // Full commit input
          <div className="px-3 pb-2 pt-1.5">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message…"
              rows={2}
              autoFocus={commitExpanded}
              className="w-full resize-none rounded-md border border-border/50 bg-transparent px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleCommit();
                }
                if (e.key === "Escape") {
                  setCommitExpanded(false);
                }
              }}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || committing}
                className="flex items-center gap-1.5 rounded-md bg-foreground/[0.08] px-2.5 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.12] hover:text-foreground disabled:opacity-30"
              >
                <Check className="size-3" />
                {committing ? "Committing…" : "Commit"}
              </button>
              <span className="text-[10px] text-muted-foreground/25">
                ctrl+enter
              </span>
            </div>
          </div>
        ) : (
          // No staged changes — subtle hint
          <div className="px-3 py-2 text-[11px] text-muted-foreground/25">
            Stage changes to commit
          </div>
        )}
      </div>

      {/* ── Scrollable sections ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Staged changes */}
        {stagedCount > 0 && (
          <Section
            label="Staged"
            count={stagedCount}
            action={{ label: "Unstage All", onAction: handleUnstageAll }}
          >
            {status!.staged.map((entry) => (
              <FileRow
                key={entry.path}
                filePath={entry.path}
                status={getStagedStatus(entry)}
                onAction={() => handleUnstage(entry.path)}
                actionIcon="unstage"
              />
            ))}
          </Section>
        )}

        {/* Unstaged changes */}
        {changesCount > 0 && (
          <Section
            label="Changes"
            count={changesCount}
            action={{ label: "Stage All", onAction: handleStageAll }}
          >
            {changes.map((entry) => (
              <FileRow
                key={entry.path}
                filePath={entry.path}
                status={getChangeStatus(entry.type)}
                onAction={() => handleStage(entry.path)}
                actionIcon="stage"
              />
            ))}
          </Section>
        )}

        {/* Clean state */}
        {status?.isClean && (
          <div className="flex items-center justify-center gap-1.5 py-6 text-[11px] text-muted-foreground/30">
            <Circle className="size-2.5 fill-green-400/30 text-green-400/30" />
            <span>Clean working tree</span>
          </div>
        )}

        {/* Commit log */}
        {log.length > 0 && (
          <Section label="History" count={Math.min(log.length, 20)} defaultOpen={stagedCount === 0 && changesCount === 0}>
            <div className="pb-1">
              {log.slice(0, 20).map((entry, i) => (
                <CommitRow
                  key={entry.hash}
                  hash={entry.hashAbbrev}
                  message={entry.message}
                  author={entry.authorName}
                  date={entry.date}
                  isHead={i === 0}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
