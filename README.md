# Belay

*A great harness deserves a great belay.*

In climbing, your harness keeps you connected to the rope — but without a trusted belay holding the other end, you're on your own. Belay is the other end of the rope: a desktop client that manages your AI coding harnesses so you can focus on the climb.

Belay speaks the [Agent Client Protocol (ACP)](https://agentclientprotocol.com) under the hood, but in practice you interact with **harnesses** — the AI coding tools you install, configure, and chat with. Open a project folder, pick a harness, and start climbing.

![Electron](https://img.shields.io/badge/Electron-41-black?logo=electron)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-Elastic%202.0-green)

---

## Features

- **Harness Registry** — Browse and install harnesses from the [ACP registry](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json) with one click.
- **Multi-Harness** — Connect to multiple harnesses simultaneously; each session is isolated.
- **Project-Based Sessions** — Open a folder, create sessions, and organize them with color-coded groups.
- **Streaming Chat** — Real-time message streaming with thinking blocks, text blocks, and tool-call display.
- **Permission Prompts** — Review and approve harness permission requests before they execute.
- **Session Modes** — Switch between harness-provided modes (e.g. code, architect, ask) on the fly.
- **Slash Commands** — Harnesses can expose slash commands with auto-completion hints.
- **WSL Support** — Run Linux-only harnesses on Windows via Windows Subsystem for Linux.
- **Session Persistence** — Chat history is automatically saved and restored per session.
- **Themes** — 14 built-in themes including Catppuccin, Dracula, Nord, Tokyo Night, Gruvbox, Rosé Pine, and more.

## The Climbing Analogy

| Climbing | Belay |
|---|---|
| **Harness** | The AI coding tool you connect to (e.g. Claude Code, Aider, Cline). It does the heavy lifting — reading files, running commands, writing code. |
| **Belay** | This app. It holds the rope: managing connections, streaming output, handling permissions, and keeping your sessions organized. |
| **Route** | A project folder. Each route has its own challenges, and you can work multiple routes in parallel. |
| **Pitch** | A session within a project. Tackle different parts of a route in separate pitches, grouped however you like. |
| **Rope** | The [Agent Client Protocol](https://agentclientprotocol.com) — the standardised connection between harness and belay. |

A harness on its own is powerful. Add a belay, and you have a partnership.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- npm ≥ 10
- (Optional) [WSL](https://learn.microsoft.com/en-us/windows/wsl/) on Windows for Linux-only harnesses

### Install

```bash
npm install
```

### Development

Run the Vite dev server and Electron together:

```bash
npm run dev:electron
```

Or just the renderer (browser-only, no Electron):

```bash
npm run dev
```

### Build & Package

```bash
npm run build          # Type-check and build
npm run package        # Build + create distributable installer
```

Packaged output lands in the `release/` directory.

## How It Works

Belay is an Electron app with a React frontend. When you connect a harness, Belay spawns it as a subprocess and communicates over stdin/stdout using the [ACP SDK](https://www.npmjs.com/package/@agentclientprotocol/sdk). Streaming updates — messages, tool calls, permission requests — flow back through the main process to the renderer in real time. Chat history is persisted per session so nothing is lost between restarts.

For the full architecture breakdown, IPC channel reference, and configuration details, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | [Electron](https://www.electronjs.org/) 41 |
| UI | [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/) 6 |
| Build | [Vite](https://vite.dev/) 8 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Components | [shadcn/ui](https://ui.shadcn.com/) (base-nova) |
| Icons | [Lucide React](https://lucide.dev/) |
| Protocol | [Agent Client Protocol](https://agentclientprotocol.com) via [@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk) |
| Fonts | [Geist Variable](https://github.com/vercel/geist-font) |

## License

Copyright (c) 2025 vlyth. Released under the [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license).

Third-party licenses are listed in [`THIRD_PARTY_LICENSES`](./THIRD_PARTY_LICENSES).