import { useState } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HarnessSettingsProps {
  agentId: string;
  currentCwd?: string;
  currentEnv?: Record<string, string>;
  onClose: () => void;
}

export function HarnessSettings({
  currentCwd,
  currentEnv,
  onClose,
}: HarnessSettingsProps) {
  const [cwd, setCwd] = useState(currentCwd || "");
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>(
    Object.entries(currentEnv || {}).map(([key, value]) => ({ key, value })),
  );

  function addEnvPair() {
    setEnvPairs([...envPairs, { key: "", value: "" }]);
  }

  function removeEnvPair(index: number) {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  }

  function updateEnvPair(index: number, field: "key" | "value", val: string) {
    const updated = [...envPairs];
    updated[index] = { ...updated[index], [field]: val };
    setEnvPairs(updated);
  }

  async function handleSave() {
    const env: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value;
      }
    }
    // In a real implementation, we'd call a dedicated IPC for this
    // For now, close the settings
    onClose();
  }

  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Agent Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Working Directory */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Working Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm focus:border-ring focus:outline-none"
              />
              <Button variant="outline" size="icon-sm">
                <FolderOpen className="size-4" />
              </Button>
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Environment Variables
            </label>
            <div className="space-y-2">
              {envPairs.map((pair, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => updateEnvPair(i, "key", e.target.value)}
                    placeholder="KEY"
                    className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
                  />
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => updateEnvPair(i, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvPair(i)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="xs"
                onClick={addEnvPair}
                className="gap-1"
              >
                <Plus className="size-3" />
                Add Variable
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>,
    document.getElementById("app-container")!,
  );
}
