use std::process::Command;
use std::sync::Mutex;
use tauri::State;

// Track if we've already spawned the MCP to avoid duplicates
struct McpState {
    spawned: Mutex<bool>,
}

#[tauri::command]
fn spawn_mcp_server(state: State<McpState>) -> Result<String, String> {
    let mut spawned = state.spawned.lock().map_err(|e| e.to_string())?;

    if *spawned {
        return Ok("MCP server already spawned this session".to_string());
    }

    // Path to the MCP server executable (same directory as overlay)
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let exe_dir = exe_path.parent()
        .ok_or("Failed to get exe directory")?;

    // Platform-specific executable name
    #[cfg(target_os = "windows")]
    let mcp_path = exe_dir.join("context-canary-mcp.exe");

    #[cfg(not(target_os = "windows"))]
    let mcp_path = exe_dir.join("context-canary-mcp");

    if !mcp_path.exists() {
        return Err(format!("MCP server not found at: {:?}", mcp_path));
    }

    // Spawn the MCP server as a detached process
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new(&mcp_path)
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP: {}", e))?;
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        use std::os::unix::process::CommandExt;
        use std::process::Stdio;

        // Detach from parent process group and redirect stdio to null
        Command::new(&mcp_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .process_group(0)  // Create new process group (detach)
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP: {}", e))?;
    }

    *spawned = true;
    Ok("MCP server spawned successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(McpState {
            spawned: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![spawn_mcp_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
