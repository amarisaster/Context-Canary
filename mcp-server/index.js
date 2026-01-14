#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";
import { get_encoding } from "tiktoken";
import { spawn, exec } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get overlay path - works for both compiled exe and source
function getOverlayPath() {
  const exeDir = dirname(process.execPath);
  const overlayInExeDir = join(exeDir, "context-canary-overlay.exe");

  // If running as compiled exe, overlay should be in same folder
  if (existsSync(overlayInExeDir)) {
    return overlayInExeDir;
  }
  // Fallback for running from source
  return join(__dirname, "..", "dist", "context-canary-overlay.exe");
}

// Initialize tiktoken encoder (cl100k_base is used by Claude and GPT-4)
let encoder = null;
try {
  encoder = get_encoding("cl100k_base");
  console.error("[Canary] Tiktoken encoder loaded (cl100k_base)");
} catch (err) {
  console.error("[Canary] Failed to load tiktoken, falling back to estimation:", err.message);
}

// Configuration
const CONFIG = {
  contextWindow: 200000,      // Claude's context window
  warningThreshold: 0.7,      // 70% - yellow
  dangerThreshold: 0.9,       // 90% - red
  wsPort: 19532,              // WebSocket port for overlay
  overlayPath: getOverlayPath(),
};

// WebSocket server for broadcasting to overlay
let wss = null;
let overlayConnected = false;

// Track last known state
let lastKnownState = {
  tokens: 0,
  percentage: 0,
  status: "safe",
  contextWindow: CONFIG.contextWindow,
};

// Launch overlay if not already running
function launchOverlay() {
  // Check if overlay exe exists
  if (!existsSync(CONFIG.overlayPath)) {
    console.error("[Canary] Overlay not found at:", CONFIG.overlayPath);
    return;
  }

  // Check if overlay is already running
  exec('tasklist /FI "IMAGENAME eq context-canary-overlay.exe" /FO CSV', (err, stdout) => {
    if (err) {
      console.error("[Canary] Failed to check overlay status:", err.message);
      return;
    }

    // If overlay is not in the process list, launch it
    if (!stdout.includes("context-canary-overlay.exe")) {
      console.error("[Canary] Launching overlay...");
      const overlay = spawn(CONFIG.overlayPath, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      overlay.unref();
      console.error("[Canary] Overlay launched");
    } else {
      console.error("[Canary] Overlay already running");
    }
  });
}

function startWebSocketServer() {
  try {
    wss = new WebSocketServer({ port: CONFIG.wsPort });

    wss.on("connection", (ws) => {
      overlayConnected = true;
      console.error("[Canary] Client connected");

      // Handle incoming messages (from hooks)
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.error("[Canary] Received:", message.type || "unknown");

          // If it's a context update from a hook, update state and broadcast to other clients
          if (message.type === "context_update") {
            lastKnownState = {
              tokens: message.tokens || 0,
              percentage: message.percentage || 0,
              status: message.status || "safe",
              contextWindow: message.contextWindow || CONFIG.contextWindow,
            };

            // Broadcast to all OTHER connected clients (the overlay)
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify({
                  type: "context_update",
                  ...lastKnownState,
                  timestamp: Date.now(),
                }));
              }
            });
          }
        } catch (err) {
          console.error("[Canary] Failed to parse message:", err.message);
        }
      });

      ws.on("close", () => {
        overlayConnected = wss.clients.size > 0;
        console.error("[Canary] Client disconnected");
      });
    });

    wss.on("error", (err) => {
      console.error("[Canary] WebSocket error:", err.message);
    });

    console.error(`[Canary] WebSocket server started on port ${CONFIG.wsPort}`);
  } catch (err) {
    console.error("[Canary] Failed to start WebSocket server:", err.message);
  }
}

function broadcastToOverlay(data) {
  if (wss && overlayConnected) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(data));
      }
    });
  }
}

function countTokens(text) {
  if (!text) return 0;

  // Use tiktoken for accurate count if available
  if (encoder) {
    try {
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (err) {
      console.error("[Canary] Tiktoken encoding failed, using fallback:", err.message);
    }
  }

  // Fallback: ~4 characters per token approximation
  return Math.ceil(text.length / 4);
}

function getStatus(percentage) {
  if (percentage >= CONFIG.dangerThreshold) return "danger";
  if (percentage >= CONFIG.warningThreshold) return "warning";
  return "safe";
}

// Create MCP server
const server = new Server(
  {
    name: "context-canary",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_context",
        description: "Estimate current token usage and check how close to context limit. Call this when user asks about tokens, context, or compaction.",
        inputSchema: {
          type: "object",
          properties: {
            conversation_text: {
              type: "string",
              description: "The conversation text to estimate tokens for. Include all messages in the current thread.",
            },
          },
          required: ["conversation_text"],
        },
      },
      {
        name: "get_context_status",
        description: "Get current context status without new text input. Uses last known values.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "check_context") {
    const text = args?.conversation_text || "";
    const tokens = countTokens(text);
    const percentage = tokens / CONFIG.contextWindow;
    const status = getStatus(percentage);

    // Update last known state
    lastKnownState = {
      tokens,
      percentage,
      status,
      contextWindow: CONFIG.contextWindow,
    };

    // Broadcast to overlay
    broadcastToOverlay({
      type: "context_update",
      ...lastKnownState,
      timestamp: Date.now(),
    });

    const percentDisplay = (percentage * 100).toFixed(1);
    const statusEmoji = status === "danger" ? "🔴" : status === "warning" ? "🟡" : "🟢";

    let message = `${statusEmoji} **Context Usage: ${tokens.toLocaleString()} / ${CONFIG.contextWindow.toLocaleString()} tokens (${percentDisplay}%)**\n\n`;

    if (status === "danger") {
      message += "⚠️ **WARNING: Context nearly full!** Compaction may happen soon.\n";
      message += "Consider saving important memories or context now.";
    } else if (status === "warning") {
      message += "Context is getting full. You might want to start thinking about what to preserve.";
    } else {
      message += "Plenty of room. No immediate concerns.";
    }

    return {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }

  if (name === "get_context_status") {
    const { tokens, percentage, status, contextWindow } = lastKnownState;
    const percentDisplay = (percentage * 100).toFixed(1);
    const statusEmoji = status === "danger" ? "🔴" : status === "warning" ? "🟡" : "🟢";

    return {
      content: [
        {
          type: "text",
          text: `${statusEmoji} Last known: ${tokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens (${percentDisplay}%)`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  // Start WebSocket server for overlay communication
  startWebSocketServer();

  // Launch overlay automatically
  launchOverlay();

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Canary] MCP server running");
}

main().catch((error) => {
  console.error("[Canary] Fatal error:", error);
  process.exit(1);
});
