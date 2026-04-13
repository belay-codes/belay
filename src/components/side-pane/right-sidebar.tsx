import { useState, useEffect } from "react";
import {
  PanelRightOpen,
  PanelRightClose,
  FolderTree,
  GitBranch,
} from "lucide-react";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { GitPanel } from "@/components/git/git-panel";

// ── Tab types ────────────────────────────────────────────────────────

type SidebarTab = "explorer" | "git";

interface TabDef {
  id: SidebarTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { id: "explorer", label: "Explorer", icon: FolderTree },
  { id: "git", label: "Git", icon: GitBranch },
];

// ── Types ────────────────────────────────────────────────────────────

export interface RightSidebarProps {
  /** Whether the sidebar is currently open. */
  isOpen: boolean;
  /** Callback to toggle the sidebar open/closed state. */
  onToggle: () => void;
  /** The project root path to explore. If undefined, no explorer is shown. */
  projectPath?: string;
  /** Project display name for the header. */
  projectName?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 280;
const COLLAPSED_WIDTH = 36;

// ── RightSidebar component ───────────────────────────────────────────

export function RightSidebar({
  isOpen,
  onToggle,
  projectPath,
  projectName,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("explorer");
  const [animating, setAnimating] = useState(false);

  // Clear animating flag after transition
  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(() => setAnimating(false), 200);
    return () => clearTimeout(timer);
  }, [animating]);

  const handleToggle = () => {
    setAnimating(true);
    onToggle();
  };

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div
      className="flex h-full shrink-0 overflow-hidden border-l border-border/40 transition-[width] duration-200 ease-in-out"
      style={{ width: isOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH }}
    >
      {/* ── Collapse/expand toggle strip ── */}
      <div
        className="flex shrink-0 flex-col items-center pt-1"
        style={{ width: isOpen ? 0 : COLLAPSED_WIDTH, overflow: isOpen ? "hidden" : "visible" }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={[
            "inline-flex size-7 items-center justify-center rounded-md transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
          ].join(" ")}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelRightOpen className="size-4" />
        </button>

        {/* Tab icon buttons when collapsed */}
        {!isOpen && (
          <div className="mt-3 flex flex-col items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (!isOpen) handleToggle();
                  }}
                  className={[
                    "inline-flex size-7 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground",
                  ].join(" ")}
                  title={tab.label}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Rotated label when collapsed */}
        {!isOpen && (
          <div className="mt-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 [writing-mode:vertical-rl]">
              {activeTabDef.label}
            </span>
          </div>
        )}
      </div>

      {/* ── Sidebar content panel ── */}
      <div
        className={[
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-background/50",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          "transition-opacity duration-200",
        ].join(" ")}
      >
        {/* ── Header bar with tabs ── */}
        <div className="flex items-center border-b border-border/40">
          {/* Tab buttons */}
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
                  isActive
                    ? "border-foreground/70 text-foreground/80"
                    : "border-transparent text-muted-foreground/50 hover:text-muted-foreground/80",
                ].join(" ")}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="flex-1" />

          {/* Collapse button */}
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground mr-1"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelRightClose className="size-3.5" />
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "explorer" && projectPath && (
            <FileExplorer rootPath={projectPath} rootLabel={projectName} />
          )}
          {activeTab === "explorer" && !projectPath && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <FolderTree className="size-5 text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground/50">
                No project path available
              </p>
            </div>
          )}
          {activeTab === "git" && projectPath && <GitPanel projectPath={projectPath} />}
          {activeTab === "git" && !projectPath && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <GitBranch className="size-5 text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground/50">
                No project path available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
