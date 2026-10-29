// Reads Markdown, text and Word files the writer chose to bring in. Files are only opened for reading;
// the originals are never moved, renamed or changed. A chosen folder contributes its files, sorted by path.
use crate::storage::Result;
use base64::Engine;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const MAX_FILES: usize = 300;
const MAX_BYTES: u64 = 20 * 1024 * 1024;
const MAX_DEPTH: usize = 3;

fn kind(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() { "md" | "markdown" | "txt" => Some("text"), "docx" => Some("docx"), _ => None }
}
fn walk(folder: &Path, depth: usize, out: &mut Vec<PathBuf>) -> Result<()> {
    let mut entries: Vec<PathBuf> = std::fs::read_dir(folder).map_err(|e| format!("{} could not be read: {e}", folder.display()))?.filter_map(|e| e.ok().map(|e| e.path())).collect();
    entries.sort_by_key(|p| p.to_string_lossy().to_lowercase());
    for path in entries {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        // Hidden folders, Word lock files (~$name.docx) and the app's own data are skipped.
        if name.starts_with('.') || name.starts_with("~$") { continue }
        if path.is_dir() { if depth < MAX_DEPTH { walk(&path, depth + 1, out)?; } }
        else if kind(&path).is_some() { out.push(path); }
        if out.len() > MAX_FILES { return Err(format!("That folder has more than {MAX_FILES} writing files. Choose a smaller folder.")); }
    }
    Ok(())
}
pub fn files(paths: &[String]) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for path in paths.iter().map(PathBuf::from) {
        if path.is_dir() { walk(&path, 0, &mut out)?; }
        else if kind(&path).is_some() { out.push(path); }
        else { return Err(format!("{} is not a Markdown, text or Word (.docx) file.", path.file_name().unwrap_or_default().to_string_lossy())); }
    }
    if out.len() > MAX_FILES { return Err(format!("Choose at most {MAX_FILES} files at a time.")); }
    Ok(out)
}
// Text arrives as text; Word files as base64 bytes, converted to Markdown in the window.
pub fn read(paths: &[String]) -> Result<Vec<Value>> {
    files(paths)?.into_iter().map(|path| {
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let size = std::fs::metadata(&path).map_err(|e| format!("{name} could not be read: {e}"))?.len();
        if size > MAX_BYTES { return Err(format!("{name} is larger than 20 MB.")); }
        let bytes = std::fs::read(&path).map_err(|e| format!("{name} could not be read: {e}"))?;
        Ok(match kind(&path) {
            Some("docx") => json!({ "name": name, "path": path.to_string_lossy(), "kind": "docx", "data": base64::engine::general_purpose::STANDARD.encode(bytes) }),
            _ => json!({ "name": name, "path": path.to_string_lossy(), "kind": "text", "text": String::from_utf8_lossy(&bytes).trim_start_matches('\u{feff}') }),
        })
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn folders_give_their_writing_files_in_order_and_nothing_is_changed() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("b-part/.git")).unwrap();
        std::fs::write(root.join("02 second.md"), "\u{feff}# Two").unwrap();
        std::fs::write(root.join("01 first.MD"), "One").unwrap();
        std::fs::write(root.join("b-part/03 third.docx"), [80, 75, 3, 4]).unwrap();
        std::fs::write(root.join("b-part/.git/HEAD"), "x").unwrap();
        std::fs::write(root.join("~$lock.docx"), "x").unwrap();
        std::fs::write(root.join("photo.jpg"), "x").unwrap();
        let before = std::fs::metadata(root.join("01 first.MD")).unwrap().modified().unwrap();
        let read = read(&[root.to_string_lossy().to_string()]).unwrap();
        assert_eq!(read.iter().map(|f| f["name"].as_str().unwrap()).collect::<Vec<_>>(), ["01 first.MD", "02 second.md", "03 third.docx"]);
        assert_eq!(read[1]["text"], "# Two"); assert_eq!(read[2]["kind"], "docx"); assert_eq!(read[2]["data"], "UEsDBA==");
        assert_eq!(std::fs::metadata(root.join("01 first.MD")).unwrap().modified().unwrap(), before);
        assert!(root.join("~$lock.docx").exists() && root.join("02 second.md").exists());
        assert!(files(&[root.join("photo.jpg").to_string_lossy().to_string()]).unwrap_err().contains("is not a Markdown, text or Word"));
    }
}
