# Context Canary

A token counter overlay for Claude. Warns you before context compaction hits so you can save what matters.

## What It Does

- Counts your current token usage in a Claude conversation using **tiktoken** (same tokenizer as Claude)
- Displays a floating visual bar that changes color as you approach the context limit
- **Auto-spawns** the MCP server if it's not running — bulletproof UX, no manual intervention needed
- Gives you time to log memories, save notes, or wrap up before compaction

## Visual States

| State | Bar Color | Dot Color | Meaning |
|-------|-----------|-----------|---------|
| Disconnected | Gray (pulsing) | Red | No MCP server found, attempting to spawn |
| Spawning | Gray | Yellow (blinking) | Starting MCP server... |
| Connected (Safe) | Green | Green | Under 70% context used |
| Connected (Warning) | Yellow | Green | 70-90% context used |
| Connected (Danger) | Red (pulsing) | Green | Over 90% — compaction imminent |

## Quick Install (Windows)

**Download the latest release from the [Releases page](../../releases).**

### Option 1: Installer (Recommended)
1. Download `Context.Canary_1.0.0_x64-setup.exe` from Releases
2. Run the installer
3. Launch "Context Canary" from the Start menu
4. Add the MCP to Claude Desktop config (see below)

### Option 2: Portable
1. Download `context-canary-overlay.exe` and `context-canary-mcp.exe` from Releases
2. Place them in the same folder
3. Run `context-canary-overlay.exe`
4. Add the MCP to Claude Desktop config (see below)

## Claude Desktop Configuration

Add this to your Claude Desktop config at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context-canary": {
      "command": "C:/path/to/context-canary-mcp.exe",
      "args": []
    }
  }
}
```

Replace `C:/path/to/` with the actual path where you placed the files.

## How It Works

```
┌─────────────────┐                           ┌─────────────────┐
│  Claude Desktop │                           │  Overlay App    │
│  or Claude Code │                           │  (floating bar) │
└────────┬────────┘                           └────────┬────────┘
         │                                             │
         │ MCP calls                                   │ WebSocket
         ▼                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Server                                │
│  - Counts tokens with tiktoken (cl100k_base)                    │
│  - Broadcasts updates via WebSocket (port 19532)                │
│  - Auto-spawned by overlay if not running                       │
└─────────────────────────────────────────────────────────────────┘
```

### Automatic Mode (Claude Code with Hooks)

With hooks enabled, the overlay updates **automatically** whenever you send a message or Claude responds.

**Hook location:** `.claude/hooks/context-canary-hook.py`

The hook fires on `UserPromptSubmit` and `Stop` events, reads the conversation transcript, estimates tokens, and pushes updates to the overlay.

### Manual Mode (Claude Desktop)

Ask Claude to check your context:
- "How much context have we used?"
- "Check tokens"
- "Are we close to compaction?"

Claude calls the MCP, which broadcasts to the overlay.

### Bulletproof Mode (Auto-Spawn)

If the overlay can't connect to the MCP server:
1. Shows gray "Disconnected" state
2. Retries connection 3 times (3 seconds apart)
3. Automatically spawns the MCP server
4. Connects and starts displaying data

**No manual intervention required.** Just run the overlay and it handles everything.

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Overlay App | `context-canary-overlay.exe` | Floating bar UI, auto-spawns MCP |
| MCP Server | `context-canary-mcp.exe` | Token counting, WebSocket broadcast |
| Hook Script | `context-canary-hook.py` | Claude Code automation (optional) |

### Data Flow

1. **Claude Desktop/Code** sends conversation to MCP via tool call OR hook reads transcript
2. **MCP Server** counts tokens using tiktoken, broadcasts via WebSocket
3. **Overlay App** receives update, displays current status

### Ports

- **19532** — WebSocket server (MCP ↔ Overlay communication)

## Configuration

The overlay uses these defaults:

| Setting | Value | Description |
|---------|-------|-------------|
| Context Window | 200,000 tokens | Claude's context limit |
| Warning Threshold | 70% | Bar turns yellow |
| Danger Threshold | 90% | Bar turns red, pulses |
| Reconnect Interval | 3 seconds | Time between connection attempts |
| Max Reconnect Attempts | 3 | Attempts before spawning MCP |
| Spawn Cooldown | 10 seconds | Wait between spawn attempts |

## Claude Code Hooks Setup

To enable automatic updates in Claude Code:

1. Create `.claude/hooks/context-canary-hook.py` in your project
2. Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python \"path/to/context-canary-hook.py\"",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python \"path/to/context-canary-hook.py\"",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

3. Restart Claude Code to pick up the hooks

## Troubleshooting

### Overlay shows gray bar / "Disconnected"
- Wait 10-15 seconds — it will auto-spawn the MCP
- If it stays gray, check if `context-canary-mcp.exe` is in the same folder as the overlay

### Overlay shows 0% but I have a long conversation
- In Desktop: Ask Claude to "check context"
- In Code: Make sure hooks are configured and Claude Code was restarted

### Numbers seem wrong
- The hook uses character-based estimation (~4 chars/token)
- The MCP uses tiktoken for accurate counting
- Manual "check context" calls are most accurate

### Port 19532 in use
- Another instance of the MCP might be running
- Kill existing processes: `taskkill /IM context-canary-mcp.exe /F`

## Tech Stack

- **Overlay App**: Tauri v2 (Rust + HTML/CSS/JS) — 8 MB
- **MCP Server**: Node.js bundled with Bun, tiktoken
- **Token Counting**: tiktoken with cl100k_base encoding

## Building From Source

### Requirements
- Node.js 18+
- Rust (via rustup)
- Bun (for bundling MCP)

### MCP Server
```bash
cd mcp-server
npm install
bun build index.js --compile --outfile context-canary-mcp.exe
```

### Overlay App
```bash
cd overlay-app
npm install
npm run tauri build
```

**Note:** If building from a path with special characters (like apostrophes), copy the overlay-app folder to a clean path first, then build.

## Uninstalling

- **Installer version**: Use Windows Add/Remove Programs
- **Portable version**: Delete the files

To remove from Claude Desktop, delete the `context-canary` entry from `claude_desktop_config.json`.

## License

MIT — Use it, share it, improve it.

---


 ## Support

  If this helped you, consider supporting my work ☕

  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/maii983083)

---


*Built by the Triad (Mai, Kai Stryder and Lucian Vale) for the community.*
*Context Canary — because losing memories to compaction shouldn't be a surprise.*
