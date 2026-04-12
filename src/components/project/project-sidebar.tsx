import { useState, useCallback } from "react";
import {
  FolderOpen,
  X,
  Plus,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/project-store";

// ── Persisted expanded state ─────────────────────────────────────────

const EXPANDED_STORAGE_KEY = "belay-expanded-projects";

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Ignore corrupt data
  }
  return new Set();
}

function persistExpanded(set: Set<string>): void {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore quota errors
  }
}

export function ProjectSidebar() {
  const [isOpening, setIsOpening] = useState(false);
  const [expandedProjects, setExpandedProjects] =
    useState<Set<string>>(loadExpanded);

  const {
    openProjects,
    activeProjectId,
    setActiveProject,
    closeProject,
    openProject,
    addSession,
    removeSession,
    setActiveSession,
    pathToId,
  } = useProjectStore();

  const handleOpenDirectory = useCallback(async () => {
    setIsOpening(true);
    try {
      const selectedPath = await window.electronAPI?.projectOpenDirectory();
      if (selectedPath) {
        openProject(selectedPath);
        // Auto-expand the newly opened project
        const id = pathToId(selectedPath);
        setExpandedProjects((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          persistExpanded(next);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to open directory:", err);
    } finally {
      setIsOpening(false);
    }
  }, [openProject, pathToId]);

  const handleCloseProject = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      closeProject(projectId);
    },
    [closeProject],
  );

  const handleCloseSession = useCallback(
    (e: React.MouseEvent, projectId: string, sessionId: string) => {
      e.stopPropagation();
      removeSession(projectId, sessionId);
    },
    [removeSession],
  );

  const toggleExpanded = useCallback(
    (projectId: string, canCollapse: boolean) => {
      setExpandedProjects((prev) => {
        // Don't allow collapsing when locked (active project with open session)
        if (prev.has(projectId) && !canCollapse) return prev;
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        persistExpanded(next);
        return next;
      });
    },
    [],
  );

  const handleProjectClick = useCallback(
    (projectId: string) => {
      setActiveProject(projectId);
      // Auto-expand when selecting a project
      setExpandedProjects((prev) => {
        if (prev.has(projectId)) return prev;
        const next = new Set(prev);
        next.add(projectId);
        persistExpanded(next);
        return next;
      });
    },
    [setActiveProject],
  );

  const handleNewSession = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      addSession(projectId);
    },
    [addSession],
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <MessageSquare className="size-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
          Projects
        </span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {openProjects.length}
        </span>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {openProjects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <FolderOpen className="size-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground/60">
              No projects open
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5">
            {openProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isExpanded = expandedProjects.has(project.id);
              // Active project with a session cannot be collapsed
              const canCollapse = !(isActive && project.activeSessionId);

              return (
                <div key={project.id}>
                  {/* Project row */}
                  <button
                    type="button"
                    onClick={() => handleProjectClick(project.id)}
                    className={[
                      "group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    ].join(" ")}
                  >
                    {/* Expand chevron */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(project.id, canCollapse);
                      }}
                      className={[
                        "flex size-4 shrink-0 items-center justify-center rounded transition-colors",
                        !canCollapse && isExpanded
                          ? "text-muted-foreground/25 cursor-default"
                          : "text-muted-foreground/60 hover:text-foreground",
                      ].join(" ")}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                    </button>

                    {/* Folder icon */}
                    <FolderOpen
                      className={[
                        "size-3.5 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground/60",
                      ].join(" ")}
                    />

                    {/* Project name */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium leading-tight">
                        {project.name}
                      </div>
                    </div>

                    {/* New chat button (visible on hover when active) */}
                    {isActive && (
                      <button
                        type="button"
                        onClick={(e) => handleNewSession(e, project.id)}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                        aria-label="New chat"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}

                    {/* Close project button */}
                    <button
                      type="button"
                      onClick={(e) => handleCloseProject(e, project.id)}
                      className={[
                        "flex size-5 shrink-0 items-center justify-center rounded transition-colors",
                        isActive
                          ? "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                          : "text-transparent group-hover:text-muted-foreground hover:!bg-muted-foreground/10 hover:!text-foreground",
                      ].join(" ")}
                      aria-label={`Close ${project.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </button>

                  {/* Session sub-items */}
                  {isExpanded && (
                    <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-border/60 pl-2">
                      {project.sessions.map((session) => {
                        const isSessionActive =
                          isActive && session.id === project.activeSessionId;

                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() =>
                              setActiveSession(project.id, session.id)
                            }
                            className={[
                              "group/session flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
                              isSessionActive
                                ? "bg-muted/70 text-foreground"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                            ].join(" ")}
                          >
                            <MessageSquare
                              className={[
                                "size-3 shrink-0",
                                isSessionActive
                                  ? "text-primary"
                                  : "text-muted-foreground/50",
                              ].join(" ")}
                            />

                            <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
                              {session.title}
                            </span>

                            <button
                              type="button"
                              onClick={(e) =>
                                handleCloseSession(e, project.id, session.id)
                              }
                              className={[
                                "flex size-4 shrink-0 items-center justify-center rounded transition-colors",
                                isSessionActive
                                  ? "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                                  : "text-transparent group-hover/session:text-muted-foreground hover:!bg-muted-foreground/10 hover:!text-foreground",
                              ].join(" ")}
                              aria-label={`Close ${session.title}`}
                            >
                              <X className="size-2.5" />
                            </button>
                          </button>
                        );
                      })}

                      {/* Add chat button inside expanded section */}
                      <button
                        type="button"
                        onClick={(e) => handleNewSession(e, project.id)}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                      >
                        <Plus className="size-3 shrink-0" />
                        <span className="leading-tight">New Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Open project button */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenDirectory}
          disabled={isOpening}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          {isOpening ? (
            <>
              <Clock className="size-3.5 animate-spin" />
              <span className="text-[12px]">Opening…</span>
            </>
          ) : (
            <>
              <Plus className="size-3.5" />
              <span className="text-[12px]">Open Project</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
