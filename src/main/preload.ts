import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Project
  projectOpenDirectory: () => ipcRenderer.invoke("project:openDirectory"),

  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximize: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("window:onMaximize", handler);
    return () => ipcRenderer.removeListener("window:onMaximize", handler);
  },
  onUnmaximize: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("window:onUnmaximize", handler);
    return () => ipcRenderer.removeListener("window:onUnmaximize", handler);
  },

  // ACP - Registry & Harness
  acpListRegistry: () => ipcRenderer.invoke("acp:listRegistry"),
  acpListInstalled: () => ipcRenderer.invoke("acp:listInstalled"),
  acpInstallHarness: (manifest: unknown) =>
    ipcRenderer.invoke("acp:installHarness", manifest),
  acpUninstallHarness: (agentId: string) =>
    ipcRenderer.invoke("acp:uninstallHarness", agentId),
  acpUpdateHarness: (
    agentId: string,
    updates: {
      cwd?: string;
      env?: Record<string, string>;
      mcpServers?: unknown[];
      args?: string[];
    },
  ) => ipcRenderer.invoke("acp:updateHarness", agentId, updates),

  // ACP - Connection lifecycle
  acpConnect: (agentId: string) => ipcRenderer.invoke("acp:connect", agentId),
  acpDisconnect: () => ipcRenderer.invoke("acp:disconnect"),
  acpGetConnectionState: () => ipcRenderer.invoke("acp:getConnectionState"),
  acpOnConnectionStateChange: (callback: (state: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string) =>
      callback(state);
    ipcRenderer.on("acp:onConnectionStateChange", handler);
    return () =>
      ipcRenderer.removeListener("acp:onConnectionStateChange", handler);
  },

  // ACP - Errors
  acpOnError: (
    callback: (error: { message: string; stderr: string }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: { message: string; stderr: string },
    ) => callback(error);
    ipcRenderer.on("acp:onError", handler);
    return () => ipcRenderer.removeListener("acp:onError", handler);
  },

  // ACP - Session
  acpCreateSession: (cwd?: string) =>
    ipcRenderer.invoke("acp:createSession", cwd),
  acpGetActiveSession: () => ipcRenderer.invoke("acp:getActiveSession"),

  // ACP - Prompt
  acpSendPrompt: (sessionId: string, content: string) =>
    ipcRenderer.invoke("acp:sendPrompt", sessionId, content),
  acpCancelPrompt: (sessionId: string) =>
    ipcRenderer.invoke("acp:cancelPrompt", sessionId),

  // ACP - Streaming updates
  acpOnUpdate: (callback: (update: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: unknown) =>
      callback(update);
    ipcRenderer.on("acp:onUpdate", handler);
    return () => ipcRenderer.removeListener("acp:onUpdate", handler);
  },

  // ACP - Permissions
  acpOnPermissionRequest: (callback: (request: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: unknown) =>
      callback(request);
    ipcRenderer.on("acp:onPermissionRequest", handler);
    return () => ipcRenderer.removeListener("acp:onPermissionRequest", handler);
  },
  acpRespondPermission: (requestId: string, optionId: string) =>
    ipcRenderer.invoke("acp:respondPermission", requestId, optionId),
});
