// Where the library lives. Documents\<app folder> by default; the writer may choose another folder
// (for example inside OneDrive or Dropbox). The choice is remembered outside the library, in the app's
// config folder. Moving copies every file, compares each copy byte for byte, and only then switches;
// the old folder is never deleted.
use crate::storage::{stamp, Result};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}};

pub fn pointer(config_dir: &Path) -> PathBuf { config_dir.join("library.json") }
pub fn chosen(config_dir: &Path) -> Option<PathBuf> {
    let value: Value = serde_json::from_str(&fs::read_to_string(pointer(config_dir)).ok()?).ok()?;
    value["dataRoot"].as_str().filter(|s| !s.is_empty()).map(PathBuf::from)
}
pub fn remember(config_dir: &Path, root: &Path) -> Result<()> {
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    crate::storage::atomic(&pointer(config_dir), &serde_json::to_vec_pretty(&json!({ "dataRoot": root.to_string_lossy() })).map_err(|e| e.to_string())?)
}
// A folder counts as a library when it has the folders and files the app writes.
pub fn is_library(root: &Path) -> bool { root.join("projects").is_dir() && (root.join("settings.json").is_file() || root.join("ideas").is_dir()) }

fn files(root: &Path, base: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(root).map_err(|e| format!("{} could not be read: {e}", root.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.is_dir() { files(&path, base, out)?; } else { out.push(path.strip_prefix(base).map_err(|e| e.to_string())?.to_path_buf()); }
    }
    Ok(())
}
fn newest(root: &Path) -> Option<std::time::SystemTime> {
    let mut list = Vec::new(); files(root, root, &mut list).ok()?;
    list.iter().filter_map(|p| fs::metadata(root.join(p)).and_then(|m| m.modified()).ok()).max()
}
// What choosing `parent` would mean: the library folder inside it, and whether one is already there.
pub fn inspect(parent: &Path, current: &Path, folder_name: &str) -> Result<Value> {
    if !parent.is_absolute() { return Err("Choose a folder on this computer.".into()); }
    let target = parent.join(folder_name);
    let (a, b) = (normal(&target), normal(current));
    if a == b { return Err("Your library is already in that folder.".into()); }
    if a.starts_with(&b) { return Err("Choose a folder outside your current library.".into()); }
    if b.starts_with(&a) { return Err("Choose a folder that does not contain your current library.".into()); }
    let existing = target.exists() && fs::read_dir(&target).map(|mut d| d.next().is_some()).unwrap_or(false);
    if existing && !is_library(&target) { return Err(format!("{} already exists and is not a library. Choose another folder.", target.display())); }
    let projects = if existing { fs::read_dir(target.join("projects")).map(|d| d.filter(|e| e.as_ref().is_ok_and(|e| e.path().is_dir())).count()).unwrap_or(0) } else { 0 };
    let changed = if existing { newest(&target).map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64) } else { None };
    Ok(json!({ "root": target.to_string_lossy(), "existing": existing, "projects": projects, "changedAt": changed }))
}
fn normal(path: &Path) -> PathBuf { PathBuf::from(path.to_string_lossy().to_lowercase().trim_end_matches(['\\', '/'])) }

// The one-time move from Documents\Yazi (the app's old name) to Documents\Divit: copy, verify, switch.
// Returns how many files were copied, or None when there is nothing to move. The old folder is kept.
pub fn migrate_documents(old: &Path, new: &Path) -> Result<Option<usize>> {
    if new.exists() || !is_library(old) { return Ok(None); }
    copy_verified(old, new).map(Some)
}
// Copies the whole library into `target` through a staging folder, compares every file, then renames
// the staging folder into place. Returns how many files were copied.
pub fn copy_verified(from: &Path, target: &Path) -> Result<usize> {
    if target.exists() { return Err(format!("{} already exists. Nothing was copied.", target.display())); }
    let parent = target.parent().ok_or("Choose another folder.")?;
    fs::create_dir_all(parent).map_err(|e| format!("The folder could not be created: {e}"))?;
    let staging = parent.join(format!(".{}-moving-{}", target.file_name().unwrap_or_default().to_string_lossy(), stamp()));
    let result = (|| -> Result<usize> {
        let mut list = Vec::new(); files(from, from, &mut list)?;
        for relative in &list {
            let (source, copy) = (from.join(relative), staging.join(relative));
            fs::create_dir_all(copy.parent().unwrap()).map_err(|e| e.to_string())?;
            fs::copy(&source, &copy).map_err(|e| format!("{} could not be copied: {e}", relative.display()))?;
        }
        for dir in ["ideas", "projects", "images", "_trash"] { fs::create_dir_all(staging.join(dir)).map_err(|e| e.to_string())?; }
        for relative in &list {
            let same = fs::read(from.join(relative)).ok().zip(fs::read(staging.join(relative)).ok()).is_some_and(|(a, b)| a == b);
            if !same { return Err(format!("The copy of {} did not match. Nothing was switched; your library is where it was.", relative.display())); }
        }
        fs::rename(&staging, target).map_err(|e| format!("The copied library could not be put in place: {e}"))?;
        Ok(list.len())
    })();
    if result.is_err() { let _ = fs::remove_dir_all(&staging); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn library(root: &Path) {
        fs::create_dir_all(root.join("projects/a")).unwrap(); fs::create_dir_all(root.join("ideas")).unwrap(); fs::create_dir_all(root.join("images/i")).unwrap();
        fs::write(root.join("projects/a/draft.md"), "İstanbul, sabah.").unwrap(); fs::write(root.join("images/i/original.png"), [137, 80, 78, 71]).unwrap();
        fs::write(root.join("settings.json"), "{}").unwrap();
    }
    #[test]
    fn a_library_is_copied_and_verified_before_switching_and_the_old_folder_stays() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("Documents/Divit"); library(&old);
        let cloud = dir.path().join("OneDrive");
        let plan = inspect(&cloud, &old, "Divit").unwrap();
        assert_eq!((plan["existing"].as_bool(), plan["root"].as_str().map(PathBuf::from)), (Some(false), Some(cloud.join("Divit"))));
        assert_eq!(copy_verified(&old, &cloud.join("Divit")).unwrap(), 3);
        assert_eq!(fs::read_to_string(cloud.join("Divit/projects/a/draft.md")).unwrap(), "İstanbul, sabah.");
        assert!(old.join("projects/a/draft.md").exists(), "the old library is kept");
        assert!(fs::read_dir(&cloud).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().contains("moving")));
        let again = inspect(&cloud, &old, "Divit").unwrap();
        assert_eq!((again["existing"].as_bool(), again["projects"].as_u64()), (Some(true), Some(1)));
        assert!(copy_verified(&old, &cloud.join("Divit")).is_err(), "never copies over an existing library");
        let config = dir.path().join("config"); remember(&config, &cloud.join("Divit")).unwrap();
        assert_eq!(chosen(&config), Some(cloud.join("Divit")));
    }
    #[test]
    fn the_old_yazi_folder_is_copied_once_to_divit_and_kept() {
        let dir = tempfile::tempdir().unwrap();
        let (old, new) = (dir.path().join("Yazi"), dir.path().join("Divit"));
        assert_eq!(migrate_documents(&old, &new).unwrap(), None, "nothing to move on a fresh computer");
        library(&old);
        assert_eq!(migrate_documents(&old, &new).unwrap(), Some(3));
        assert_eq!(fs::read_to_string(new.join("projects/a/draft.md")).unwrap(), "İstanbul, sabah.");
        assert!(old.join("projects/a/draft.md").exists());
        fs::write(old.join("projects/a/draft.md"), "changed in the old folder later").unwrap();
        assert_eq!(migrate_documents(&old, &new).unwrap(), None, "runs once: an existing Divit folder is never overwritten");
        assert_eq!(fs::read_to_string(new.join("projects/a/draft.md")).unwrap(), "İstanbul, sabah.");
    }
    #[test]
    fn folders_inside_the_library_or_holding_other_files_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("Divit"); library(&root);
        assert!(inspect(&root, &root, "Divit").unwrap_err().contains("outside your current library"));
        assert!(inspect(dir.path(), &root, "Divit").unwrap_err().contains("already in that folder"));
        let other = dir.path().join("Other"); fs::create_dir_all(other.join("Divit")).unwrap(); fs::write(other.join("Divit/notes.txt"), "x").unwrap();
        assert!(inspect(&other, &root, "Divit").unwrap_err().contains("is not a library"));
        assert!(inspect(Path::new("relative"), &root, "Divit").is_err());
        assert_eq!(chosen(&dir.path().join("none")), None);
    }
}
