import { useState, useEffect, useCallback } from "react";
import type { AcpAvailableCommand } from "@/types/acp";

type AcpConnectionState = "disconnected" | "initializing" | "ready" | "error";

interface HarnessConfig {
  agentId: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

interface AcpAgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  distribution: Record<string, unknown>;
}

interface AcpSessionInfo {
  sessionId: string;
  agentName: string;
  agentId: string;
}

const api = () => window.electronAPI;

export function useConnectionState() {
  const [state, setState] = useState<AcpConnectionState>("disconnected");

  useEffect(() => {
    api()?.acpGetConnectionState().then(setState);
    return api()?.acpOnConnectionStateChange((s) =>
      setState(s as AcpConnectionState),
    );
  }, []);

  return state;
}

export function useActiveSession() {
  const [session, setSession] = useState<AcpSessionInfo | null>(null);

  useEffect(() => {
    api()?.acpGetActiveSession().then(setSession);
  }, []);

  return session;
}

export function useInstalledHarnesses() {
  const [harnesses, setHarnesses] = useState<HarnessConfig[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await api()?.acpListInstalled();
      if (!cancelled) setHarnesses(list ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const list = await api()?.acpListInstalled();
    setHarnesses(list ?? []);
  }, []);

  return { harnesses, refresh };
}

export function useRegistryAgents() {
  const [agents, setAgents] = useState<AcpAgentManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api()?.acpListRegistry();
      setAgents(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch registry");
    } finally {
      setLoading(false);
    }
  }, []);

  return { agents, loading, error, fetch };
}

interface AcpUpdatePayload {
  type?: string;
  content?: string;
  [key: string]: unknown;
}

export function useAcpUpdates() {
  const [updates, setUpdates] = useState<AcpUpdatePayload[]>([]);

  useEffect(() => {
    return api()?.acpOnUpdate((update) => {
      setUpdates((prev) => [...prev, update as unknown as AcpUpdatePayload]);
    });
  }, []);

  const clearUpdates = useCallback(() => setUpdates([]), []);

  return { updates, clearUpdates };
}

export function useAcpError() {
  const [error, setError] = useState<{
    message: string;
    stderr: string;
  } | null>(null);

  useEffect(() => {
    return api()?.acpOnError((err) => {
      setError(err);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { error, clearError };
}

// ── Shared slash commands (module-level singleton) ────────────────────
// Commands come from the connected agent (global, not per-session).
// We register ONE listener and broadcast to all hook consumers.

type CommandsListener = (cmds: AcpAvailableCommand[]) => void;

let sharedCommands: AcpAvailableCommand[] = [];
const sharedListeners = new Set<CommandsListener>();
let commandsListenerRegistered = false;

function broadcastCommands(cmds: AcpAvailableCommand[]) {
  sharedCommands = cmds;
  for (const fn of sharedListeners) fn(cmds);
}

function registerCommandsListener() {
  if (commandsListenerRegistered) return;
  commandsListenerRegistered = true;

  api()?.acpOnUpdate((raw: unknown) => {
    const notification = raw as Record<string, unknown>;
    const inner = notification.update as Record<string, unknown> | undefined;
    if (!inner) return;

    const sessionUpdate = inner.sessionUpdate as string | undefined;
    if (sessionUpdate === "available_commands_update") {
      const cmds = inner.availableCommands as AcpAvailableCommand[] | undefined;
      if (cmds) broadcastCommands(cmds);
    }
  });

  // Clear commands when the agent disconnects
  api()?.acpOnConnectionStateChange((state) => {
    if (state === "disconnected") broadcastCommands([]);
  });
}

export function useSlashCommands(): AcpAvailableCommand[] {
  const [commands, setCommands] =
    useState<AcpAvailableCommand[]>(sharedCommands);

  // Sync in case commands arrived before this hook mounted (render-time)
  if (sharedCommands !== commands) {
    setCommands(sharedCommands);
  }

  useEffect(() => {
    registerCommandsListener();
    sharedListeners.add(setCommands);
    return () => {
      sharedListeners.delete(setCommands);
    };
  }, []);

  return commands;
}

export function useAcpActions() {
  const connect = useCallback(async (agentId: string) => {
    await api()?.acpConnect(agentId);
  }, []);

  const disconnect = useCallback(async () => {
    await api()?.acpDisconnect();
  }, []);

  const createSession = useCallback(async (cwd?: string) => {
    return api()?.acpCreateSession(cwd);
  }, []);

  const sendPrompt = useCallback(async (sessionId: string, content: string) => {
    await api()?.acpSendPrompt(sessionId, content);
  }, []);

  const cancelPrompt = useCallback(async (sessionId: string) => {
    await api()?.acpCancelPrompt(sessionId);
  }, []);

  const respondPermission = useCallback(
    async (requestId: string, optionId: string) => {
      await api()?.acpRespondPermission(requestId, optionId);
    },
    [],
  );

  return {
    connect,
    disconnect,
    createSession,
    sendPrompt,
    cancelPrompt,
    respondPermission,
  };
}
