#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod storage;
use serde_json::{json, Value};
use std::{io::Write, path::PathBuf, process::{Command, Stdio}, sync::{Arc, Mutex}};
use tauri::Manager;
use storage::{Result, Store};
struct AppState(Arc<Mutex<Store>>);

#[tauri::command]
fn library(state: tauri::State<AppState>) -> Result<Value> { state.0.lock().map_err(|e| e.to_string())?.library() }
#[tauri::command]
fn save_project(state: tauri::State<AppState>, data: Value, expected: Option<String>) -> Result<Value> { state.0.lock().map_err(|e| e.to_string())?.save_project(data, expected) }
#[tauri::command]
fn save_idea(state: tauri::State<AppState>, data: Value, expected: Option<String>) -> Result<Value> { state.0.lock().map_err(|e| e.to_string())?.save_idea(data, expected) }
#[tauri::command]
fn save_settings(state: tauri::State<AppState>, data: Value) -> Result<()> { state.0.lock().map_err(|e| e.to_string())?.save_settings(data) }
#[tauri::command]
fn import_image(state: tauri::State<AppState>, source: String, key: String) -> Result<Value> { state.0.lock().map_err(|e| e.to_string())?.import_image(&PathBuf::from(source), &key) }
#[tauri::command]
fn image_data(state: tauri::State<AppState>, key: String) -> Result<String> { state.0.lock().map_err(|e| e.to_string())?.image_data(&key) }
#[tauri::command]
fn trash(state: tauri::State<AppState>, kind: String, key: String, title: String) -> Result<()> { state.0.lock().map_err(|e| e.to_string())?.trash(&kind, &key, &title) }
#[tauri::command]
fn restore(state: tauri::State<AppState>, key: String) -> Result<()> { state.0.lock().map_err(|e| e.to_string())?.restore(&key) }

#[tauri::command]
async fn site_action(app: tauri::AppHandle, state: tauri::State<'_, AppState>, action: String, project_id: String, expected_revision: Option<String>) -> Result<Value> {
    if action != "plan" && action != "publish" { return Err("Invalid site action".into()); }
    let request = {
        let store = state.0.lock().map_err(|e| e.to_string())?;
        let library = store.library()?;
        let project = store.project(&project_id)?;
        if project["type"] != "blog" { return Err("Stories and books use Export. Only blog posts are sent to the site.".into()); }
        if expected_revision.as_deref() != project["revision"].as_str() { return Err("This draft changed on disk after you opened it. Reload and review the current text before sending.".into()); }
        if project["published"].is_object() { return Err("This draft has already been sent. Review its branch in the site repository.".into()); }
        json!({"action":action,"repo":library["settings"]["siteRepo"],"project":project,"images":library["images"],"dataRoot":store.root.to_string_lossy()})
    };
    let source_revision = request["project"]["revision"].clone();
    let output = call_bridge(&app, "site-bridge.mjs", request).await?;
    if action == "publish" {
        let store = state.0.lock().map_err(|e| e.to_string())?;
        let mut project = store.project(&project_id)?;
        if project["revision"] != source_revision { return Err(format!("The site commit succeeded on {}, but the local draft changed during transfer. Your newer draft is kept and was not marked Published.", output["branch"].as_str().unwrap_or("the post branch"))); }
        let expected = project["revision"].as_str().map(String::from);
        project["published"] = output.clone();
        store.save_project(project.clone(), expected).map_err(|e| format!("The site commit succeeded, but the local status could not be saved: {e}"))?;
        if let Some(idea_id) = project["ideaId"].as_str() {
            let library = store.library()?;
            if let Some(idea) = library["ideas"].as_array().and_then(|a| a.iter().find(|i| i["id"] == idea_id)) {
                let mut idea = idea.clone(); let expected = idea["revision"].as_str().map(String::from);
                idea["status"] = json!("Published"); store.save_idea(idea, expected)?;
            }
        }
    }
    Ok(output)
}
fn bridge_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf> {
    Ok(if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts").join(name) } else { app.path().resource_dir().map_err(|e| e.to_string())?.join(name) })
}
fn run_bridge(script: PathBuf, request: Value) -> Result<Value> {
        let mut cmd = Command::new("node");
        cmd.arg(script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
        let mut child = cmd.spawn().map_err(|e| format!("Could not start Node.js. Install Node 22 for local exports and site transfer. {e}"))?;
        child.stdin.take().ok_or("Could not open bridge input")?.write_all(request.to_string().as_bytes()).map_err(|e| e.to_string())?;
        let output = child.wait_with_output().map_err(|e| e.to_string())?;
        let result: Value = serde_json::from_slice(&output.stdout).map_err(|_| format!("Local helper failed: {}", String::from_utf8_lossy(&output.stderr)))?;
        if result["ok"] != true { return Err(result["error"].as_str().unwrap_or("Site operation failed").to_string()); }
        Ok(result["result"].clone())
}
async fn call_bridge(app: &tauri::AppHandle, script_name: &str, request: Value) -> Result<Value> {
    let script = bridge_path(app, script_name)?;
    tauri::async_runtime::spawn_blocking(move || run_bridge(script, request)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn backup_action(app: tauri::AppHandle, state: tauri::State<'_, AppState>, reason: String) -> Result<Value> {
    if !["status","daily","close","manual"].contains(&reason.as_str()) { return Err("Invalid backup reason".into()); }
    let shared = state.0.clone();
    let script = bridge_path(&app, "backup-bridge.mjs")?;
    tauri::async_runtime::spawn_blocking(move || -> Result<Value> {
        let store = shared.lock().map_err(|e| e.to_string())?;
        let library = store.library()?;
        let folder = library["settings"]["backupFolder"].as_str().unwrap_or("");
        if folder.is_empty() { return Ok(json!({"enabled":false,"lastBackupAt":null})); }
        let result = run_bridge(script, json!({"dataRoot":store.root.to_string_lossy(),"folder":folder,"reason":reason}));
        drop(store); // Serialize the complete ZIP against all application file writes.
        result
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_action(app: tauri::AppHandle, state: tauri::State<'_, AppState>, action: String, project_id: Option<String>, expected_revision: Option<String>, format: Option<String>, include_sources: Option<bool>) -> Result<Value> {
    if action != "status" && action != "export" { return Err("Invalid export action".into()); }
    let request = if action == "status" { json!({"action":"status"}) } else {
        let store = state.0.lock().map_err(|e| e.to_string())?;
        let project = store.project(project_id.as_deref().ok_or("Choose a project")?)?;
        if expected_revision.as_deref() != project["revision"].as_str() { return Err("This project changed on disk. Review the current version before exporting.".into()); }
        let library = store.library()?;
        json!({"action":"export","format":format.ok_or("Choose an export format")?,"project":project,"images":library["images"],"dataRoot":store.root.to_string_lossy(),"outputRoot":store.root.join("exports").to_string_lossy(),"includeSources":include_sources.unwrap_or(false)})
    };
    call_bridge(&app, "export-bridge.mjs", request).await
}

const RESEARCH_ACTIONS: [&str; 9] = ["load", "read-source", "add-source", "update-source", "save-annotations", "scan-inbox", "pending", "fetch-page", "add-request"];
#[tauri::command]
async fn research_action(app: tauri::AppHandle, state: tauri::State<'_, AppState>, project_id: String, action: String, payload: Option<Value>) -> Result<Value> {
    if !RESEARCH_ACTIONS.contains(&action.as_str()) { return Err("Invalid research action".into()); }
    let key = storage::id(&project_id)?.to_string();
    let shared = state.0.clone();
    let script = bridge_path(&app, "research-bridge.mjs")?;
    tauri::async_runtime::spawn_blocking(move || -> Result<Value> {
        if action == "fetch-page" {
            // A slow page must not hold the storage lock while the writer keeps typing.
            let url = payload.as_ref().and_then(|p| p["url"].as_str()).ok_or("Paste a web address first.")?.to_string();
            return run_bridge(script, json!({"action":"fetch-page","url":url}));
        }
        let store = shared.lock().map_err(|e| e.to_string())?;
        let project = store.root.join("projects").join(&key);
        if !project.is_dir() { return Err("This project is no longer in the library.".into()); }
        if action == "pending" {
            // Polled while a project is open: count inbox files without starting Node.
            let inbox = project.join("research").join("inbox");
            let count = std::fs::read_dir(&inbox).map(|items| items.filter_map(|item| item.ok())
                .filter(|item| item.file_type().map(|t| t.is_file()).unwrap_or(false) && item.path().extension().is_some_and(|e| e.eq_ignore_ascii_case("md"))).count()).unwrap_or(0);
            return Ok(json!(count));
        }
        let mut request = match payload { Some(Value::Object(map)) => Value::Object(map), None => json!({}), Some(_) => return Err("Invalid research request".into()) };
        request["dataRoot"] = json!(store.root.to_string_lossy());
        request["projectId"] = json!(key);
        request["action"] = json!(action);
        request["createProject"] = json!(false);
        let result = run_bridge(script, request);
        drop(store); // Research files are written under the same lock as the writing.
        result
    }).await.map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| { if let Some(window) = app.get_webview_window("main") { let _ = window.set_focus(); } }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = dirs::document_dir().ok_or("Could not locate your Documents folder")?.join("Yazi");
            app.manage(AppState(Arc::new(Mutex::new(Store::new(root).map_err(std::io::Error::other)?))));
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale = monitor.scale_factor();
                    let width = (monitor.size().width as f64 / scale - 64.0).clamp(760.0, 1440.0);
                    let height = (monitor.size().height as f64 / scale - 100.0).clamp(580.0, 950.0);
                    let _ = window.set_size(tauri::LogicalSize::new(width, height));
                    let _ = window.center();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![library, save_project, save_idea, save_settings, import_image, image_data, trash, restore, site_action, export_action, backup_action, research_action])
        .run(tauri::generate_context!()).expect("Could not start Yazı");
}
