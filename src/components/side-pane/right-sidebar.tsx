import { useState, useEffect } from "react";
import {
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
const COLLAPSED_WIDTH = 40;

// ── RightSidebar component ───────────────────────────────────────────

export function RightSidebar({
  isOpen,
  onToggle,
  projectPath,
  projectName,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("explorer");

  const handleTabClick = (tabId: SidebarTab) => {
    if (isOpen && activeTab === tabId) {
      // Clicking the active tab while open collapses the sidebar
      onToggle();
    } else {
      setActiveTab(tabId);
      if (!isOpen) {
        onToggle();
      }
    }
  };

  return (
    <div
      className="flex h-full shrink-0 border-l border-border/40 transition-[width] duration-200 ease-in-out"
      style={{ width: isOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH }}
    >
      {/* ── Icon rail ── */}
      <div className="flex shrink-0 flex-col items-center pt-2" style={{ width: COLLAPSED_WIDTH }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={[
                "group relative flex size-8 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
                isOpen && isActive ? "bg-muted/60" : "hover:bg-muted/30",
              ].join(" ")}
              aria-label={tab.label}
              title={tab.label}
            >
              <Icon className="size-4" />
              {/* Tooltip label for collapsed state */}
              {!isOpen && (
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100" style={{ zIndex: 50 }}>
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content panel ── */}
      <div
        className={[
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          isOpen
            ? "opacity-100"
            : "pointer-events-none w-0 opacity-0",
          "transition-opacity duration-200",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/40 px-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {TABS.find((t) => t.id === activeTab)?.label}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
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
          {activeTab === "git" && projectPath && (
            <GitPanel projectPath={projectPath} />
          )}
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
