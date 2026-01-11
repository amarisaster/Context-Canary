// Context Canary - Overlay Frontend
// Connects to MCP server via WebSocket and displays token usage

import { invoke } from '@tauri-apps/api/core';

const CONFIG = {
  wsPort: 19532,
  reconnectInterval: 3000,
  contextWindow: 200000,
  maxReconnectAttempts: 3,  // Attempts before trying to spawn MCP
  spawnCooldown: 10000,     // Wait 10s between spawn attempts
};

// DOM Elements
const barFill = document.getElementById('bar-fill');
const percentage = document.getElementById('percentage');
const statusIcon = document.getElementById('status-icon');
const connection = document.getElementById('connection');
const canaryBar = document.getElementById('canary-bar');

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastSpawnAttempt = 0;
let isConnected = false;
let hasReceivedData = false;

// Show disconnected state
function showDisconnected(reason = 'Disconnected') {
  isConnected = false;
  barFill.className = 'bar-fill disconnected';
  percentage.textContent = '--';
  statusIcon.textContent = '⚫';
  connection.classList.remove('connected', 'spawning');
  connection.title = reason;
  canaryBar.dataset.tooltip = reason;
}

// Show spawning state
function showSpawning() {
  connection.classList.remove('connected');
  connection.classList.add('spawning');
  connection.title = 'Starting MCP server...';
  canaryBar.dataset.tooltip = 'Starting MCP server...';
}

// Update the visual bar with data
function updateBar(data) {
  hasReceivedData = true;
  const { tokens, percentage: pct, status, contextWindow } = data;

  // Remove disconnected state
  barFill.classList.remove('disconnected');

  // Update fill width
  const fillPercent = Math.min(pct * 100, 100);
  barFill.style.width = `${fillPercent}%`;

  // Update percentage text
  percentage.textContent = `${fillPercent.toFixed(1)}%`;

  // Update status class and icon
  barFill.className = 'bar-fill ' + status;

  switch (status) {
    case 'danger':
      statusIcon.textContent = '🔴';
      canaryBar.dataset.tooltip = `${tokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens - DANGER!`;
      break;
    case 'warning':
      statusIcon.textContent = '🟡';
      canaryBar.dataset.tooltip = `${tokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens - Getting full`;
      break;
    default:
      statusIcon.textContent = '🟢';
      canaryBar.dataset.tooltip = `${tokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens - OK`;
  }
}

// Try to spawn the MCP server
async function trySpawnMCP() {
  const now = Date.now();
  if (now - lastSpawnAttempt < CONFIG.spawnCooldown) {
    console.log('[Canary] Spawn cooldown active, waiting...');
    return false;
  }

  lastSpawnAttempt = now;
  showSpawning();

  try {
    console.log('[Canary] Attempting to spawn MCP server via Tauri...');
    const result = await invoke('spawn_mcp_server');
    console.log('[Canary] MCP spawn result:', result);

    // Wait a moment for the server to start, then try connecting
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (err) {
    console.error('[Canary] Failed to spawn MCP:', err);
    return false;
  }
}

// WebSocket connection
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`ws://localhost:${CONFIG.wsPort}`);

    ws.onopen = () => {
      console.log('[Canary] Connected to MCP server');
      isConnected = true;
      reconnectAttempts = 0;
      connection.classList.remove('spawning');
      connection.classList.add('connected');
      connection.title = 'Connected to MCP';

      // If we haven't received data yet, show waiting state
      if (!hasReceivedData) {
        canaryBar.dataset.tooltip = 'Connected - waiting for data...';
      }

      // Clear any reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'context_update') {
          updateBar(data);
        }
      } catch (err) {
        console.error('[Canary] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[Canary] Disconnected from MCP server');
      isConnected = false;
      connection.classList.remove('connected', 'spawning');

      if (!hasReceivedData) {
        showDisconnected('No MCP server found');
      } else {
        connection.title = 'Disconnected - reconnecting...';
      }

      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[Canary] WebSocket error:', err);
      isConnected = false;
      connection.classList.remove('connected', 'spawning');
    };

  } catch (err) {
    console.error('[Canary] Failed to connect:', err);
    scheduleReconnect();
  }
}

async function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectAttempts++;
  console.log(`[Canary] Reconnect attempt ${reconnectAttempts}/${CONFIG.maxReconnectAttempts}`);

  // After max attempts, try spawning MCP
  if (reconnectAttempts >= CONFIG.maxReconnectAttempts) {
    console.log('[Canary] Max reconnect attempts reached, trying to spawn MCP...');
    const spawned = await trySpawnMCP();

    if (spawned) {
      reconnectAttempts = 0; // Reset counter after spawn attempt
    } else {
      showDisconnected('MCP server unavailable');
    }
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, CONFIG.reconnectInterval);
}

// Initialize
function init() {
  // Set initial state - disconnected until we connect
  showDisconnected('Connecting...');

  // Connect to MCP server
  connect();

  // Handle window drag (Tauri)
  canaryBar.addEventListener('mousedown', (e) => {
    if (e.target === canaryBar || e.target.closest('.bar-container')) {
      // Tauri handles this via CSS -webkit-app-region: drag
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
