import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { RegistryAgent } from "./registry";

export interface HarnessConfig {
  agentId: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  mcpServers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

interface NpxDistribution {
  package: string;
  args?: string[];
  env?: Record<string, string>;
}

interface BinaryPlatformEntry {
  cmd: string;
  args?: string[];
}

interface UvxDistribution {
  package: string;
  args?: string[];
}

interface Distribution {
  npx?: NpxDistribution;
  binary?: Record<string, BinaryPlatformEntry>;
  uvx?: UvxDistribution;
}

const CONFIG_DIR = path.join(os.homedir(), ".belay");
const CONFIG_FILE = path.join(CONFIG_DIR, "harnesses.json");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig(): Record<string, HarnessConfig> {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config: Record<string, HarnessConfig>): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function listInstalled(): HarnessConfig[] {
  return Object.values(readConfig());
}

export function getHarness(agentId: string): HarnessConfig | undefined {
  return readConfig()[agentId];
}

export function installHarness(agent: RegistryAgent): void {
  console.log(`[ACP] Installing harness: ${agent.name} (${agent.id})`);
  console.log(
    `[ACP] Agent distribution keys: ${Object.keys(agent.distribution).join(", ")}`,
  );

  const config = readConfig();
  const dist = agent.distribution as unknown as Distribution;

  let command = "";
  let args: string[] = [];
  let env: Record<string, string> = {};

  // Prefer npx distribution
  if (dist.npx) {
    command = "npx";
    args = [dist.npx.package, ...(dist.npx.args || [])];
    env = dist.npx.env || {};
    console.log(`[ACP] Using npx distribution: ${dist.npx.package}`);
  } else if (dist.binary) {
    // For binary distribution, store a placeholder — user will need to install manually
    const platform = `${process.platform}-${process.arch}`;
    const platKey = Object.keys(dist.binary).find(
      (k) => k.includes(process.platform) && k.includes(process.arch),
    );
    if (platKey) {
      command = dist.binary[platKey].cmd;
      args = dist.binary[platKey].args || [];
    } else {
      command = `echo "Platform ${platform} not supported for ${agent.name}"`;
    }
  } else if (dist.uvx) {
    command = "uvx";
    args = [dist.uvx.package, ...(dist.uvx.args || [])];
  }

  config[agent.id] = {
    agentId: agent.id,
    name: agent.name,
    version: agent.version,
    description: agent.description,
    icon: agent.icon,
    command,
    args,
    env,
  };

  writeConfig(config);
  console.log(
    `[ACP] Harness installed: ${agent.name} → command: ${command} ${args.join(" ")}`,
  );
  console.log(`[ACP] Config written to ${CONFIG_FILE}`);
}

export function uninstallHarness(agentId: string): void {
  const config = readConfig();
  delete config[agentId];
  writeConfig(config);
}

export function updateHarness(
  agentId: string,
  updates: Partial<Pick<HarnessConfig, "cwd" | "env" | "mcpServers" | "args">>,
): void {
  const config = readConfig();
  if (!config[agentId]) return;
  Object.assign(config[agentId], updates);
  writeConfig(config);
}
