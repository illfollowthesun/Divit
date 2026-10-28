use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::hash_map::DefaultHasher, fs, hash::{Hash, Hasher}, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

pub type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }
pub fn stamp() -> String { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos().to_string() }
pub fn id(value: &str) -> Result<&str> {
    if value.is_empty() || value.len() > 100 || !value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { return Err("Invalid record identifier".into()) }
    Ok(value)
}
fn read(path: &Path) -> Result<String> { fs::read_to_string(path).map_err(err) }
fn json_file(path: &Path) -> Result<Value> { serde_json::from_str(&read(path)?).map_err(err) }
pub fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let temp = path.with_extension(format!("{}.pending", stamp()));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(err)?;
    use std::io::Write;
    file.write_all(bytes).map_err(err)?;
    file.sync_all().map_err(err)?;
    drop(file);
    fs::rename(temp, path).map_err(err)
}
fn write_json(path: &Path, value: &Value) -> Result<()> { atomic(path, &serde_json::to_vec_pretty(value).map_err(err)?) }
pub fn fingerprint(data: &Value) -> String {
    let mut clone = data.clone();
    if let Some(obj) = clone.as_object_mut() { obj.remove("revision"); }
    let mut hash = DefaultHasher::new();
    clone.to_string().hash(&mut hash);
    format!("{:x}", hash.finish())
}
fn revision(mut value: Value) -> Value { value["revision"] = json!(fingerprint(&value)); value }

#[derive(Clone)]
pub struct Store { pub root: PathBuf }
#[derive(Serialize, Deserialize)]
pub struct TrashEntry { pub key: String, pub kind: String, pub id: String, pub title: String }
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        for dir in ["ideas", "projects", "images", "_trash"] { fs::create_dir_all(root.join(dir)).map_err(err)?; }
        Ok(Self { root })
    }
    fn path(&self, kind: &str, key: &str) -> Result<PathBuf> {
        if !["projects", "ideas", "images"].contains(&kind) { return Err("Invalid collection".into()); }
        Ok(self.root.join(kind).join(id(key)?))
    }
    fn recover(&self, folder: &Path) -> Result<()> {
        let pending = folder.join(".recovery.json");
        if pending.exists() {
            let data = json_file(&pending)?;
            // A user may have edited Markdown or metadata while Yazı was closed
            // after an interrupted write. Keep both files before replaying it.
            let body_path = folder.join("draft.md");
            if body_path.exists() || folder.join("project.json").exists() {
                let backup = folder.join(".recovered").join(stamp());
                fs::create_dir_all(&backup).map_err(err)?;
                if body_path.exists() { fs::copy(&body_path, backup.join("draft.md")).map_err(err)?; }
                if folder.join("project.json").exists() { fs::copy(folder.join("project.json"), backup.join("project.json")).map_err(err)?; }
            }
            self.finish_project(folder, &data)?;
        }
        Ok(())
    }
    fn finish_project(&self, folder: &Path, data: &Value) -> Result<()> {
        let body = data["body"].as_str().ok_or("Missing draft text")?;
        atomic(&folder.join("draft.md"), body.as_bytes())?;
        let mut meta = data.clone();
        meta.as_object_mut().ok_or("Invalid project")?.remove("body");
        meta.as_object_mut().unwrap().remove("revision");
        write_json(&folder.join("project.json"), &meta)?;
        fs::rename(folder.join(".recovery.json"), folder.join(".last-save.json")).map_err(err)
    }
    pub fn project(&self, key: &str) -> Result<Value> {
        let folder = self.path("projects", key)?;
        self.recover(&folder)?;
        let mut data = json_file(&folder.join("project.json"))?;
        data["body"] = json!(read(&folder.join("draft.md"))?);
        Ok(revision(data))
    }
    pub fn save_project(&self, mut data: Value, expected: Option<String>) -> Result<Value> {
        let key = data["id"].as_str().ok_or("Missing project id")?.to_string();
        let folder = self.path("projects", &key)?;
        if folder.exists() {
            let current = self.project(&key)?;
            if expected.as_deref() != current["revision"].as_str() { return Err("This draft changed outside Yazı. Your unsaved text is still in the editor. Copy it before reloading.".into()); }
        } else if expected.is_some() { return Err("The draft was moved. Your unsaved text is still in the editor.".into()); }
        if !data["body"].is_string() || !data["title"].is_string() { return Err("Invalid project data".into()); }
        data.as_object_mut().ok_or("Invalid project data")?.remove("revision");
        fs::create_dir_all(&folder).map_err(err)?;
        write_json(&folder.join(".recovery.json"), &data)?;
        self.finish_project(&folder, &data)?;
        Ok(revision(data))
    }
    pub fn save_idea(&self, mut data: Value, expected: Option<String>) -> Result<Value> {
        let key = data["id"].as_str().ok_or("Missing idea id")?;
        let path = self.path("ideas", key)?.with_extension("json");
        if path.exists() {
            let current = revision(json_file(&path)?);
            if expected.as_deref() != current["revision"].as_str() { return Err("This idea changed. Reload before trying again.".into()); }
        } else if expected.is_some() { return Err("This idea was moved.".into()); }
        if !["Idea", "Research", "Draft", "Published"].contains(&data["status"].as_str().unwrap_or("")) { return Err("Invalid idea status".into()); }
        if data["title"].as_str().unwrap_or("").trim().is_empty() { return Err("Give the idea a title".into()); }
        data.as_object_mut().ok_or("Invalid idea")?.remove("revision");
        write_json(&path, &data)?;
        Ok(revision(data))
    }
    pub fn library(&self) -> Result<Value> {
        let mut projects = vec![];
        let mut ideas = vec![];
        let mut images = vec![];
        // Never silently skip an unreadable record: errors remain visible to the writer.
        for item in fs::read_dir(self.root.join("projects")).map_err(err)? {
            let item = item.map_err(err)?;
            if item.file_type().map_err(err)?.is_dir() { projects.push(self.project(&item.file_name().to_string_lossy())?); }
        }
        for item in fs::read_dir(self.root.join("ideas")).map_err(err)? {
            let path = item.map_err(err)?.path();
            if path.extension().and_then(|x| x.to_str()) == Some("json") { ideas.push(revision(json_file(&path)?)); }
        }
        for item in fs::read_dir(self.root.join("images")).map_err(err)? {
            let item = item.map_err(err)?;
            if item.file_type().map_err(err)?.is_dir() { images.push(json_file(&item.path().join("image.json"))?); }
        }
        let settings = if self.root.join("settings.json").exists() { json_file(&self.root.join("settings.json"))? } else {
            json!({"schemaVersion":1,"theme":"light","siteRepo":dirs::document_dir().unwrap_or_default().join("modernist-portfolio").to_string_lossy(),"aiProvider":"claude-code"})
        };
        Ok(json!({"projects":projects,"ideas":ideas,"images":images,"settings":settings,"dataRoot":self.root.to_string_lossy(),"trash":self.trash_list()?}))
    }
    pub fn save_settings(&self, data: Value) -> Result<()> { write_json(&self.root.join("settings.json"), &data) }
    pub fn import_image(&self, source: &Path, key: &str) -> Result<Value> {
        let ext = source.extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
        if !["jpg", "jpeg", "png", "webp", "avif"].contains(&ext.as_str()) { return Err("Choose a JPEG, PNG, WebP or AVIF image.".into()); }
        if fs::metadata(source).map_err(err)?.len() > 100 * 1024 * 1024 { return Err("Choose an image smaller than 100 MB.".into()); }
        let folder = self.path("images", key)?;
        if folder.exists() { return Err("Image identifier already exists".into()); }
        let staging_root = self.root.join(".staging");
        fs::create_dir_all(&staging_root).map_err(err)?;
        let staging = staging_root.join(format!("{}-{key}", stamp()));
        fs::create_dir(&staging).map_err(err)?;
        let file = format!("original.{ext}");
        fs::copy(source, staging.join(&file)).map_err(err)?;
        let data = json!({"id":key,"file":file,"name":source.file_name().unwrap_or_default().to_string_lossy(),"addedAt":stamp()});
        write_json(&staging.join("image.json"), &data)?;
        fs::rename(staging, folder).map_err(err)?;
        Ok(data)
    }
    pub fn image_data(&self, key: &str) -> Result<String> {
        use base64::Engine;
        let folder = self.path("images", key)?;
        let data = json_file(&folder.join("image.json"))?;
        let name = data["file"].as_str().ok_or("Invalid image record")?;
        if !["original.jpg","original.jpeg","original.png","original.webp","original.avif"].contains(&name) { return Err("Invalid image path".into()); }
        let mime = match name.rsplit('.').next().unwrap_or("") { "jpg" | "jpeg" => "jpeg", "png" => "png", "webp" => "webp", _ => "avif" };
        Ok(format!("data:image/{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(fs::read(folder.join(name)).map_err(err)?)))
    }
    pub fn trash(&self, kind: &str, key: &str, title: &str) -> Result<()> {
        let mut source = self.path(kind, key)?;
        if kind == "ideas" { source.set_extension("json"); }
        let trash_key = format!("{}-{}", stamp(), &key[..key.len().min(36)]);
        let destination = self.root.join("_trash").join(&trash_key);
        fs::create_dir(&destination).map_err(err)?;
        let entry = json!({"key":trash_key,"kind":kind,"id":key,"title":title});
        write_json(&destination.join("entry.json"), &entry)?;
        fs::rename(source, destination.join("content")).map_err(err)
    }
    pub fn trash_list(&self) -> Result<Vec<Value>> {
        let mut entries = vec![];
        for item in fs::read_dir(self.root.join("_trash")).map_err(err)? {
            let path = item.map_err(err)?.path();
            if path.join("content").exists() { entries.push(json_file(&path.join("entry.json"))?); }
        }
        Ok(entries)
    }
    pub fn restore(&self, key: &str) -> Result<()> {
        let folder = self.root.join("_trash").join(id(key)?);
        let entry: TrashEntry = serde_json::from_value(json_file(&folder.join("entry.json"))?).map_err(err)?;
        let mut dest = self.path(&entry.kind, &entry.id)?;
        if entry.kind == "ideas" { dest.set_extension("json"); }
        if dest.exists() { return Err("A record already occupies this location. Nothing was replaced.".into()); }
        fs::rename(folder.join("content"), dest).map_err(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn draft() -> Value { json!({"id":"test-1","title":"İstanbul","body":"Merhaba dünya","tags":[],"type":"blog"}) }
    #[test] fn saves_unicode_detects_external_edits_and_recovers_interrupted_transaction() {
        let dir = tempfile::tempdir().unwrap(); let store = Store::new(dir.path().into()).unwrap();
        let saved = store.save_project(draft(), None).unwrap();
        assert_eq!(store.project("test-1").unwrap()["body"], "Merhaba dünya");
        fs::write(dir.path().join("projects/test-1/draft.md"), "external edit").unwrap();
        assert!(store.save_project(draft(), saved["revision"].as_str().map(String::from)).is_err());
        let mut recovery = draft(); recovery["body"] = json!("recovered");
        write_json(&dir.path().join("projects/test-1/.recovery.json"), &recovery).unwrap();
        assert_eq!(store.project("test-1").unwrap()["body"], "recovered");
        let backup = fs::read_dir(dir.path().join("projects/test-1/.recovered")).unwrap().next().unwrap().unwrap().path();
        assert_eq!(fs::read_to_string(backup.join("draft.md")).unwrap(), "external edit");
    }
    #[test] fn trash_keeps_content_and_restore_does_not_overwrite() {
        let dir = tempfile::tempdir().unwrap(); let store = Store::new(dir.path().into()).unwrap();
        store.save_project(draft(), None).unwrap(); store.trash("projects", "test-1", "İstanbul").unwrap();
        let entries = store.trash_list().unwrap(); let key = entries[0]["key"].as_str().unwrap();
        assert!(dir.path().join("_trash").join(key).join("content/draft.md").exists());
        store.restore(key).unwrap(); assert_eq!(store.project("test-1").unwrap()["body"], "Merhaba dünya");
        assert!(store.restore(key).is_err());
    }
    #[test] fn rejects_paths_outside_library() { assert!(id("../outside").is_err()); assert!(id("C:\\outside").is_err()); assert!(id("").is_err()); }
}
