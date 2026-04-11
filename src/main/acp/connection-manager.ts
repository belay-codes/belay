import { BrowserWindow } from "electron";
import { AcpClient } from "./acp-client.js";
import { getHarness } from "./harness-store.js";
import type { HarnessConfig } from "./harness-store.js";
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";

/** Manages active ACP connections (at most one for now) */
class ConnectionManager {
  private client: AcpClient | null = null;
  private mainWindow: BrowserWindow | null = null;
  private activeHarness: HarnessConfig | null = null;
  private _pendingPermissions = new Map<
    string,
    (response: RequestPermissionResponse) => void
  >();

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  getConnectionState(): string {
    return this.client?.state ?? "disconnected";
  }

  getActiveHarness(): HarnessConfig | null {
    return this.activeHarness;
  }

  getActiveSessionId(): string | null {
    return this.client?.sessionId ?? null;
  }

  getClient(): AcpClient | null {
    return this.client;
  }

  async connect(agentId: string): Promise<void> {
    // Disconnect existing
    if (this.client) {
      await this.disconnect();
    }

    const harness = getHarness(agentId);
    if (!harness) throw new Error(`Harness not found: ${agentId}`);

    this.client = new AcpClient();
    this.activeHarness = harness;

    // Forward state changes to renderer
    this.client.onStateChange = (state: string) => {
      this.mainWindow?.webContents.send("acp:onConnectionStateChange", state);
    };

    // Forward session updates to renderer
    this.client.onUpdate = (update: unknown) => {
      this.mainWindow?.webContents.send("acp:onUpdate", update);
    };

    // Forward agent errors to renderer
    this.client.onError = (error: { message: string; stderr: string }) => {
      console.error(`[ACP] Agent error: ${error.message}`);
      this.mainWindow?.webContents.send("acp:onError", error);
    };

    // Forward permission requests to renderer
    this.client.onPermissionRequest = async (
      request: RequestPermissionRequest,
    ) => {
      return new Promise((resolve) => {
        const requestId = crypto.randomUUID();

        // Store the resolver to be called when the user responds
        this._pendingPermissions.set(requestId, resolve);

        this.mainWindow?.webContents.send("acp:onPermissionRequest", {
          requestId,
          sessionId: request.sessionId,
          options: request.options,
        });
      });
    };

    await this.client.connect(harness);
  }

  respondPermission(requestId: string, optionId: string): void {
    const resolver = this._pendingPermissions.get(requestId);
    if (!resolver) return;

    if (optionId === "cancelled") {
      resolver({ outcome: { outcome: "cancelled" } });
    } else {
      resolver({ outcome: { outcome: "selected", optionId } });
    }
    this._pendingPermissions.delete(requestId);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.activeHarness = null;
    }
  }

  async createSession(cwd?: string): Promise<string> {
    if (!this.client) throw new Error("Not connected to an agent");
    return this.client.createSession(cwd);
  }

  async sendPrompt(sessionId: string, content: string): Promise<void> {
    if (!this.client) throw new Error("Not connected to an agent");
    return this.client.sendPrompt(sessionId, content);
  }

  async cancelPrompt(sessionId: string): Promise<void> {
    if (!this.client) throw new Error("Not connected to an agent");
    return this.client.cancelPrompt(sessionId);
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }
}

// Singleton
export const connectionManager = new ConnectionManager();
