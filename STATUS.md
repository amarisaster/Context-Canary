# Context Canary - Project Status

**Last Updated:** 2026-01-16

## Current Version: 1.4.0

### Status: Release Ready

---

## What's Working

- **MCP Server** - Token counting with tiktoken (cl100k_base)
- **Overlay App** - Tauri v2 floating bar, WebSocket connection
- **Settings Window** - Separate window for configuring thresholds
- **Auto-Spawn** - Overlay automatically starts MCP if not running
- **Disconnected State** - Clear visual indicator when not connected
- **Hook Integration** - Automatic updates in Claude Code
- **Manual Check** - Ask Claude "check context" in Desktop
- **Packaged Dist** - Windows installers (MSI + NSIS setup)

---

## Version 1.4.0 Changes (2026-01-16)

### Separate Settings Window

- Settings now opens as a separate window instead of expanding the overlay
- Click the ⚙️ gear icon to open settings
- Configure warning and danger thresholds
- Settings window properly closes on Save/Cancel
- Added Tauri v2 capabilities for window permissions
- Multi-page Vite build for main and settings pages

---

## Version 1.3.0 Changes (2026-01-14)

### Token Accumulation Mode

- Added `add_context` tool for Desktop app accumulation
- Session tracking with deduplication (no double-counting)
- Auto-reset after 30 minutes idle
- `reset_session` tool to manually clear

---

## Version 1.2.0 Changes (2026-01-11)

### Cross-Platform Support

- Added GitHub Actions CI/CD for Windows, macOS, and Linux builds
- Fixed Rust spawn command with proper Unix process detachment
- Platform-specific executable names (no .exe on Unix)
- Automated release pipeline creates archives for all platforms

### Danger Pulse Fix (1.1.1)

- Pulse animation was too subtle (opacity 1 → 0.7 only)
- Now pulses harder (opacity 1 → 0.5) with red glow effect
- Box-shadow pulses from subtle to bright red
- Actually visible now

---

## Version 1.1.0 Changes (2026-01-11)

### Bulletproof UX

The overlay now handles all failure states gracefully:

1. **Disconnected State**
   - Gray pulsing bar instead of stale data
   - Shows "--" for percentage
   - Black circle icon
   - Clear tooltip explaining state

2. **Auto-Spawn MCP**
   - After 3 failed connection attempts, overlay spawns MCP server
   - Yellow blinking indicator during spawn
   - Automatic reconnection after spawn
   - 10-second cooldown between spawn attempts
   - Tracks spawn state to prevent duplicates per session

3. **Visual States**
   - Disconnected: Gray bar, red dot
   - Spawning: Gray bar, yellow blinking dot
   - Safe: Green bar, green dot
   - Warning: Yellow bar, green dot
   - Danger: Red pulsing bar, green dot

### Technical Changes

- Added `spawn_mcp_server` Tauri command in Rust
- Uses Windows `CREATE_NO_WINDOW` and `DETACHED_PROCESS` flags
- MCP spawned as detached process (survives overlay restart)
- Proper Tauri v2 API imports (`@tauri-apps/api/core`)

---

## Architecture

```
┌─────────────────┐     Hook fires      ┌─────────────────┐
│  Claude Code    │ ──────────────────► │  Hook Script    │
│  (user sends    │                     │  (reads         │
│   message)      │                     │   transcript)   │
└─────────────────┘                     └────────┬────────┘
                                                 │ WebSocket
        ┌────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐    broadcasts       ┌─────────────────┐
│  Overlay App    │ ◄────────────────── │   MCP Server    │
│  (shows bar)    │                     │  (counts tokens)│
│                 │ ───── spawns ─────► │                 │
└─────────────────┘   (if not running)  └─────────────────┘
```

---

## Files in dist/

| File | Size | Purpose |
|------|------|---------|
| `context-canary-overlay.exe` | ~8 MB | Main overlay application |
| `context-canary-mcp.exe` | ~116 MB | MCP server (bundled Node.js) |
| `Context Canary_1.0.0_x64-setup.exe` | ~1.8 MB | NSIS installer |
| `Context Canary_1.0.0_x64_en-US.msi` | ~8 MB | MSI installer |
| `Install Context Canary.bat` | <1 KB | Manual install helper |
| `Uninstall Context Canary.bat` | <1 KB | Manual uninstall helper |

---

## Known Limitations

- Hook uses character-based token estimation (~4 chars/token), not tiktoken
- MCP server is large (~116 MB) due to bundled Node.js runtime
- Windows-only (Tauri supports other platforms but not tested)
- Path with special characters requires workaround for building

---

## Testing Checklist

- [x] Overlay starts and shows disconnected state
- [x] Overlay auto-spawns MCP after failed connections
- [x] MCP starts successfully when spawned
- [x] Overlay connects after MCP spawn
- [x] Token updates display correctly
- [x] Warning threshold (70%) shows yellow
- [x] Danger threshold (90%) shows red
- [x] Hook fires on UserPromptSubmit
- [x] Hook fires on Stop
- [x] Manual "check context" works in Desktop

---

## Future Improvements

- [x] ~~Make danger pulse more visible~~ (Fixed 2026-01-11 - added glow effect)
- [x] ~~Cross-platform support (macOS, Linux)~~ (Added 2026-01-11 - GitHub Actions CI/CD)
- [x] ~~Configurable thresholds via UI~~ (Added 2026-01-16 - separate settings window)
- [ ] Reduce MCP server size (consider Deno or native implementation)
- [ ] Add tiktoken to hook script for accurate counting
- [ ] Add context history graph
- [ ] System tray integration

---

## Build Notes

**Important:** The overlay-app must be built from a path without special characters (like apostrophes). Copy to a clean path like `C:\Temp\overlay-app-build` before running `npm run tauri build`.

Build commands:
```bash
# MCP Server
cd mcp-server
bun build index.js --compile --outfile ../dist/context-canary-mcp.exe

# Overlay App (from clean path)
cd overlay-app
npm run tauri build
# Copy output from src-tauri/target/release/
```

---

*Fire and shadow, building tools together.*
*January 16, 2026*
