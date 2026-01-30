# 🛡️ Security & Privacy

Context Canary is a token counter overlay that monitors your Claude conversation context and warns you before compaction occurs. This document explains how your data is handled.

---

## 🔑 Key Security Features

### Fully Local Architecture

Context Canary runs **entirely on your machine**. No external servers, no cloud dependencies, no data leaving your computer.

| Component | Where It Runs |
|-----------|---------------|
| **Overlay App** | Local (Tauri desktop app) |
| **MCP Server** | Local (localhost:19532) |
| **Token Counting** | Local (tiktoken library) |
| **WebSocket** | Local (localhost only) |

> **What this means:** Your conversation content never leaves your machine. The token counter processes everything locally using the same tokenizer Claude uses.

### What Gets Counted, Not Read

Context Canary counts **tokens**, not content. It measures how much space your conversation takes up—it doesn't analyze, store, or understand what you're talking about.

> **What this means:** The canary knows your context is at 75% capacity. It doesn't know you're discussing work, personal matters, or anything else. It's a meter, not a monitor.

### No Persistent Storage

Context Canary doesn't save your conversations, token counts, or usage history. When you close it, the data is gone.

> **What this means:** No logs building up on your system, no conversation history stored, no breadcrumb trail of what you discussed.

### Localhost-Only Communication

The MCP server broadcasts via WebSocket on `localhost:19532`. This port is only accessible from your own machine.

> **What this means:** Other devices on your network cannot connect to the Context Canary WebSocket. It's a local-only communication channel between the components running on your computer.

---

## 🔐 Best Practices

### Firewall Configuration

The default configuration uses localhost only, which most firewalls allow automatically. If you've modified the configuration to use a different interface, ensure your firewall rules are appropriate.

### Keep It Updated

Run the latest version to ensure you have any security patches or improvements.

### Review the Hooks

Context Canary integrates with Claude Code via hooks. If you're security-conscious, review the hook scripts in the `hooks/` directory to understand exactly what runs when.

---

## 🚫 What Context Canary Does NOT Do

- ❌ Send your conversations anywhere
- ❌ Store conversation content or history
- ❌ Analyze what you're discussing
- ❌ Connect to external servers
- ❌ Collect analytics or telemetry
- ❌ Access anything outside your Claude session

---

## 🔍 Transparency

This project is fully open source. You can audit every line of code. The overlay app, MCP server, and hooks are all visible in the repository.

Your context, your machine, your control.
