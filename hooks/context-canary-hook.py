#!/usr/bin/env python3
"""
Context Canary Hook - Reads conversation transcript and pushes token count to overlay.
Triggers on UserPromptSubmit and Stop events.
"""

import json
import sys
import os
import asyncio
import websockets

CONFIG = {
    "ws_port": 19532,
    "context_window": 200000,
    "warning_threshold": 0.7,
    "danger_threshold": 0.9,
}

def count_tokens_approximate(text):
    """Approximate token count (~4 chars per token for English/code mix)."""
    if not text:
        return 0
    return len(text) // 4

def get_status(percentage):
    """Determine status based on thresholds."""
    if percentage >= CONFIG["danger_threshold"]:
        return "danger"
    elif percentage >= CONFIG["warning_threshold"]:
        return "warning"
    return "safe"

def read_transcript(transcript_path):
    """Read JSONL transcript and extract all text content."""
    if not transcript_path or not os.path.exists(transcript_path):
        return ""

    content_parts = []
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    # Extract text from various message formats
                    if isinstance(entry, dict):
                        # User messages
                        if 'message' in entry:
                            msg = entry['message']
                            if isinstance(msg, str):
                                content_parts.append(msg)
                            elif isinstance(msg, dict) and 'content' in msg:
                                content_parts.append(str(msg['content']))
                        # Assistant messages
                        if 'content' in entry:
                            content = entry['content']
                            if isinstance(content, str):
                                content_parts.append(content)
                            elif isinstance(content, list):
                                for item in content:
                                    if isinstance(item, dict) and 'text' in item:
                                        content_parts.append(item['text'])
                                    elif isinstance(item, str):
                                        content_parts.append(item)
                        # Tool results
                        if 'tool_result' in entry:
                            content_parts.append(str(entry['tool_result']))
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"[Canary Hook] Error reading transcript: {e}", file=sys.stderr)

    return '\n'.join(content_parts)

async def send_to_overlay(data):
    """Send token data to overlay via WebSocket."""
    uri = f"ws://localhost:{CONFIG['ws_port']}"
    try:
        async with websockets.connect(uri, close_timeout=2) as ws:
            await ws.send(json.dumps(data))
    except Exception as e:
        # Silently fail - overlay might not be running
        pass

def main():
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        hook_event = input_data.get("hook_event_name", "")
        transcript_path = input_data.get("transcript_path", "")

        # Read transcript and count tokens
        transcript_content = read_transcript(transcript_path)
        tokens = count_tokens_approximate(transcript_content)
        percentage = tokens / CONFIG["context_window"]
        status = get_status(percentage)

        # Prepare data for overlay
        overlay_data = {
            "type": "context_update",
            "tokens": tokens,
            "percentage": percentage,
            "status": status,
            "contextWindow": CONFIG["context_window"],
            "source": "hook",
            "event": hook_event,
        }

        # Send to overlay
        asyncio.run(send_to_overlay(overlay_data))

        # Success
        sys.exit(0)

    except Exception as e:
        print(f"[Canary Hook] Error: {e}", file=sys.stderr)
        sys.exit(0)  # Exit 0 to not block Claude

if __name__ == "__main__":
    main()
