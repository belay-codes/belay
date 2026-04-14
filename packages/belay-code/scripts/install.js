#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = "belay-codes/belay";
const MAX_REDIRECTS = 5;

function getTarget() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return { os: "mac", arch: arch === "arm64" ? "arm64" : "x64" };
  }
  if (platform === "win32") {
    return { os: "win", arch: "x64" };
  }
  if (platform === "linux") {
    return { os: "linux", arch: arch === "x64" ? "x64" : arch };
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function httpsRequest(url, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      return reject(new Error(`Too many redirects (>${MAX_REDIRECTS})`));
    }

    const opts = {
      ...options,
      headers: {
        "User-Agent": "belay-code-installer",
        ...(options.headers || {}),
      },
    };
    const req = https.get(url, opts, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const location = res.headers.location;
        if (!location.startsWith("https://")) {
          return reject(new Error(`Redirect to non-HTTPS URL: ${location}`));
        }
        return httpsRequest(location, options, redirects + 1)
          .then(resolve)
          .catch(reject);
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

function fetchJSON(url) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = token ? { Authorization: `token ${token}` } : {};

  return httpsRequest(url, { headers }).then(
    (res) =>
      new Promise((resolve, reject) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }),
  );
}

function downloadFile(url, dest) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = token ? { Authorization: `token ${token}` } : {};

  return httpsRequest(url, { headers }).then(
    (res) =>
      new Promise((resolve, reject) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve();
        });
        stream.on("error", reject);
      }),
  );
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-Command",
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: "pipe" },
    );
  } else {
    // macOS and Linux — unzip is pre-installed on macOS and most Linux distros
    execFileSync("unzip", ["-o", "-q", zipPath, "-d", destDir], {
      stdio: "pipe",
    });
  }
}

function parseVersion(tag) {
  return tag.replace(/^(belay-)?v/, "");
}

function findAsset(assets, target) {
  let best = null;
  let bestScore = -1;

  for (const a of assets) {
    const name = a.name.toLowerCase();
    if (!name.endsWith(".zip")) continue;
    if (!name.includes(target.os)) continue;

    let score = 0;

    if (target.arch === "arm64") {
      if (name.includes("arm64")) {
        score = 2;
      } else {
        continue;
      }
    } else {
      // x64 or other arch
      if (name.includes("arm64")) {
        continue;
      }
      // Prefer explicit arch match (e.g., "mac-x64", "linux-x64")
      if (
        name.includes(`-${target.arch}`) ||
        name.includes(`.${target.arch}`)
      ) {
        score = 2;
      } else {
        score = 1; // Generic no-arch asset (e.g., "mac.zip")
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return best;
}

async function main() {
  const target = getTarget();
  console.log(`[belay] Platform: ${target.os}-${target.arch}`);

  const distDir = path.join(__dirname, "..", "dist");

  console.log("[belay] Fetching latest release...");
  const release = await fetchJSON(
    `https://api.github.com/repos/${REPO}/releases/latest`,
  );

  // Skip if already installed at this version
  const versionFile = path.join(distDir, ".version");
  if (fs.existsSync(versionFile)) {
    try {
      const installed = JSON.parse(fs.readFileSync(versionFile, "utf8"));
      const installedVer = parseVersion(installed.version || "");
      const releaseVer = parseVersion(release.tag_name || "");
      if (installedVer && installedVer === releaseVer) {
        console.log(
          `[belay] Already installed (${installed.version}), skipping.`,
        );
        return;
      }
    } catch {
      // Corrupted version file — re-download
    }
  }

  // Find matching zip asset using scoring
  const asset = findAsset(release.assets, target);

  if (!asset) {
    const available = release.assets.map((a) => a.name).join(", ");
    throw new Error(
      `No binary found for ${target.os}-${target.arch}. Available: ${available}`,
    );
  }

  fs.mkdirSync(distDir, { recursive: true });

  const zipPath = path.join(distDir, asset.name);

  console.log(`[belay] Downloading ${asset.name}...`);
  await downloadFile(asset.browser_download_url, zipPath);

  console.log("[belay] Extracting...");
  extractZip(zipPath, distDir);

  fs.unlinkSync(zipPath);

  fs.writeFileSync(
    versionFile,
    JSON.stringify({ version: release.tag_name, asset: asset.name }),
    "utf8",
  );

  console.log(`[belay] Installed ${release.tag_name}`);
}

main().catch((err) => {
  console.error("[belay] Install failed:", err.message);
  console.error(
    "[belay] Download manually from: https://github.com/belay-codes/belay/releases",
  );
  process.exit(1);
});
