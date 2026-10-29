// In-app AI. Keys live in Windows Credential Manager and never reach the webview, project files,
// backups or exports. Settings (provider, model, usage) live in Documents/Yazi/ai.json without the key.
// Every request is started by the writer; nothing runs in the background.
use crate::storage::{atomic, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::Path, time::Duration};

pub const ANTHROPIC_VERSION: &str = "2026-10-21";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1";
const OPENAI_URL: &str = "https://api.openai.com/v1";
const KEYRING_SERVICE: &str = "com.firextream.yazi";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind { #[default] Anthropic, Openai, OpenaiCompatible }
impl ProviderKind {
    pub fn parse(value: &str) -> Result<Self> {
        match value { "anthropic" => Ok(Self::Anthropic), "openai" => Ok(Self::Openai), "openai-compatible" => Ok(Self::OpenaiCompatible), _ => Err("Unknown AI provider".into()) }
    }
    fn key_name(self) -> &'static str { match self { Self::Anthropic => "ai-anthropic", Self::Openai => "ai-openai", Self::OpenaiCompatible => "ai-openai-compatible" } }
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities { pub native_search: bool, pub deep_research: bool, pub streaming: bool, pub local: bool }

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo { pub id: &'static str, pub label: &'static str, pub input_per_mtok: f64, pub output_per_mtok: f64 }

// Anthropic first-party prices in USD per million tokens. Other providers are billed at their own
// rates, which Yazı does not know, so their cost is shown as unknown.
pub const ANTHROPIC_MODELS: [ModelInfo; 4] = [
    ModelInfo { id: "claude-opus-5-5", label: "Claude Opus 5.5", input_per_mtok: 4.0, output_per_mtok: 20.0 },
    ModelInfo { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", input_per_mtok: 2.0, output_per_mtok: 10.0 },
    ModelInfo { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", input_per_mtok: 0.10, output_per_mtok: 0.50 },
    ModelInfo { id: "claude-fable-5-1", label: "Claude Fable 5.1", input_per_mtok: 10.0, output_per_mtok: 50.0 },
];

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Usage { pub month: String, pub calls: u64, pub input_tokens: u64, pub output_tokens: u64, pub cost_usd: f64, pub unpriced_calls: u64 }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiConfig { pub enabled: bool, pub provider: ProviderKind, pub model: String, pub base_url: String, pub monthly_limit_usd: Option<f64>, pub usage: Usage }
impl Default for AiConfig {
    fn default() -> Self { Self { enabled: false, provider: ProviderKind::Anthropic, model: ANTHROPIC_MODELS[0].id.into(), base_url: String::new(), monthly_limit_usd: None, usage: Usage::default() } }
}

pub fn capabilities(config: &AiConfig) -> Capabilities {
    match config.provider {
        ProviderKind::Anthropic => Capabilities { native_search: true, deep_research: false, streaming: true, local: false },
        // Search through these providers is not wired up yet; summarize, ask and angles work.
        ProviderKind::Openai => Capabilities { native_search: false, deep_research: false, streaming: true, local: false },
        ProviderKind::OpenaiCompatible => Capabilities { native_search: false, deep_research: false, streaming: true, local: is_local(&config.base_url) },
    }
}
fn is_local(url: &str) -> bool {
    let host = url.split("://").nth(1).unwrap_or("").split(['/', ':']).next().unwrap_or("");
    matches!(host, "localhost" | "127.0.0.1" | "[::1]")
}
pub fn base_url(config: &AiConfig) -> String {
    match config.provider { ProviderKind::Anthropic => ANTHROPIC_URL.into(), ProviderKind::Openai => OPENAI_URL.into(), ProviderKind::OpenaiCompatible => config.base_url.trim_end_matches('/').into() }
}
pub fn price(config: &AiConfig) -> Option<&'static ModelInfo> {
    if config.provider == ProviderKind::Anthropic { ANTHROPIC_MODELS.iter().find(|m| m.id == config.model) } else { None }
}

pub fn load(root: &Path) -> Result<AiConfig> {
    match std::fs::read_to_string(root.join("ai.json")) {
        Ok(text) => serde_json::from_str(&text).map_err(|_| "ai.json could not be read. AI settings were not changed.".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(AiConfig::default()),
        Err(e) => Err(e.to_string()),
    }
}
pub fn save(root: &Path, config: &AiConfig) -> Result<()> { atomic(&root.join("ai.json"), &serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?) }

// Checks a configuration from the Settings form. Usage is kept from disk; the form cannot rewrite it.
pub fn validate(mut next: AiConfig, current: &AiConfig) -> Result<AiConfig> {
    next.model = next.model.trim().to_string();
    next.base_url = next.base_url.trim().to_string();
    if next.model.is_empty() || next.model.len() > 200 || next.model.chars().any(char::is_whitespace) { return Err("Choose a model name without spaces.".into()); }
    if next.provider == ProviderKind::Anthropic && !ANTHROPIC_MODELS.iter().any(|m| m.id == next.model) { return Err("Choose one of the listed Claude models.".into()); }
    if next.provider == ProviderKind::OpenaiCompatible {
        let ok = next.base_url.starts_with("https://") || next.base_url.starts_with("http://") && is_local(&next.base_url);
        if !ok { return Err("The base URL must start with https:// (http:// only for localhost).".into()); }
    } else { next.base_url = String::new(); }
    if let Some(limit) = next.monthly_limit_usd { if !(limit.is_finite() && limit > 0.0 && limit <= 100_000.0) { return Err("The monthly limit must be a positive amount in dollars.".into()); } }
    next.usage = current.usage.clone();
    Ok(next)
}


fn entry(kind: ProviderKind) -> Result<keyring::Entry> { keyring::Entry::new(KEYRING_SERVICE, kind.key_name()).map_err(|e| format!("Windows Credential Manager is not available: {e}")) }
pub fn set_key(kind: ProviderKind, key: &str) -> Result<()> {
    let key = key.trim();
    if key.is_empty() || key.len() > 500 || key.chars().any(char::is_whitespace) { return Err("Paste the whole API key, without spaces.".into()); }
    entry(kind)?.set_password(key).map_err(|e| format!("The key could not be stored: {e}"))
}
pub fn get_key(kind: ProviderKind) -> Result<Option<String>> {
    match entry(kind)?.get_password() { Ok(key) => Ok(Some(key)), Err(keyring::Error::NoEntry) => Ok(None), Err(e) => Err(format!("The key could not be read: {e}")) }
}
pub fn forget_key(kind: ProviderKind) -> Result<()> {
    match entry(kind)?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(format!("The key could not be removed: {e}")) }
}

// Turns an HTTP failure into a sentence for the writer. The key is never part of the message.
pub fn friendly_error(status: u16, body: &str) -> String {
    let detail = serde_json::from_str::<Value>(body).ok().and_then(|v| v["error"]["message"].as_str().or(v["message"].as_str()).map(|s| s.chars().take(240).collect::<String>()));
    let base = match status {
        401 => "The API key was not accepted. Check it in Settings → AI.",
        402 => "The provider reports a billing problem with this key.",
        403 => "This key is not allowed to use that model or feature.",
        404 => "The model was not found, or this key cannot use it.",
        413 => "The request was too large for the provider.",
        429 => "The provider's rate limit was reached. Wait a minute and try again.",
        500..=599 => "The AI service is busy or having trouble. Try again shortly.",
        _ => "The AI request failed.",
    };
    match detail { Some(d) if !d.is_empty() => format!("{base} ({status}: {d})"), _ => format!("{base} ({status})") }
}

pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder().timeout(Duration::from_secs(120)).connect_timeout(Duration::from_secs(15)).user_agent("Yazi/0.1").build().map_err(|e| e.to_string())
}
fn network(error: reqwest::Error) -> String {
    if error.is_timeout() { "The AI service took too long to answer. Nothing was changed.".into() } else { "The AI service could not be reached. Check your connection.".into() }
}

// "Test connection" reads the model's listing, which costs no tokens.
pub async fn test(config: &AiConfig, key: Option<&str>) -> Result<String> {
    let http = client()?;
    let base = base_url(config);
    let request = match config.provider {
        ProviderKind::Anthropic => http.get(format!("{base}/models/{}", config.model)).header("x-api-key", key.ok_or("Add an Anthropic API key first.")?).header("anthropic-version", ANTHROPIC_VERSION),
        ProviderKind::Openai => http.get(format!("{base}/models")).bearer_auth(key.ok_or("Add an OpenAI API key first.")?),
        ProviderKind::OpenaiCompatible => { let r = http.get(format!("{base}/models")); match key { Some(k) => r.bearer_auth(k), None => r } }
    };
    let response = request.send().await.map_err(network)?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(network)?;
    if !(200..300).contains(&status) { return Err(friendly_error(status, &body)); }
    describe_test(config, &body)
}
pub fn describe_test(config: &AiConfig, body: &str) -> Result<String> {
    let value: Value = serde_json::from_str(body).map_err(|_| "The provider answered with something that is not JSON.".to_string())?;
    Ok(match config.provider {
        ProviderKind::Anthropic => format!("Connected. {} is available.", value["display_name"].as_str().unwrap_or(&config.model)),
        _ => {
            let listed = value["data"].as_array().map(|models| models.iter().any(|m| m["id"].as_str() == Some(&config.model))).unwrap_or(false);
            if listed { format!("Connected. {} is available.", config.model) } else { format!("Connected, but {} was not in the provider's model list. Check the name.", config.model) }
        }
    })
}

// What Settings shows: never a key, only whether one is stored for each provider.
pub fn status(config: &AiConfig) -> Result<Value> {
    let stored = |kind| get_key(kind).map(|key| key.is_some());
    Ok(json!({
        "config": config, "capabilities": capabilities(config),
        "hasKey": { "anthropic": stored(ProviderKind::Anthropic)?, "openai": stored(ProviderKind::Openai)?, "openai-compatible": stored(ProviderKind::OpenaiCompatible)? },
        "models": ANTHROPIC_MODELS, "price": price(config),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(provider: ProviderKind, model: &str, base: &str) -> AiConfig { AiConfig { provider, model: model.into(), base_url: base.into(), ..AiConfig::default() } }

    #[test]
    fn defaults_to_anthropic_opus_and_is_off() {
        let c = AiConfig::default();
        assert!(!c.enabled); assert_eq!(c.provider, ProviderKind::Anthropic); assert_eq!(c.model, "claude-opus-5-5");
        let parsed: AiConfig = serde_json::from_str(r#"{"provider":"openai-compatible","model":"llama3"}"#).unwrap();
        assert_eq!(parsed.provider, ProviderKind::OpenaiCompatible); assert!(!parsed.enabled);
    }
    #[test]
    fn validation_keeps_usage_and_rejects_unsafe_urls() {
        let mut current = AiConfig::default(); current.usage.calls = 7;
        let mut form = config(ProviderKind::Anthropic, " claude-sonnet-5-5 ", "https://ignored.example"); form.usage.calls = 0;
        let ok = validate(form, &current).unwrap();
        assert_eq!((ok.model.as_str(), ok.base_url.as_str(), ok.usage.calls), ("claude-sonnet-5-5", "", 7));
        assert!(validate(config(ProviderKind::Anthropic, "gpt-4o", ""), &current).is_err());
        assert!(validate(config(ProviderKind::OpenaiCompatible, "llama3", "http://evil.example/v1"), &current).is_err());
        assert!(validate(config(ProviderKind::OpenaiCompatible, "llama3", "http://localhost:11434/v1"), &current).is_ok());
        assert!(validate(config(ProviderKind::OpenaiCompatible, "deepseek-chat", "https://api.deepseek.com/v1"), &current).is_ok());
        assert!(validate(config(ProviderKind::Openai, "two words", ""), &current).is_err());
        let mut limited = config(ProviderKind::Anthropic, "claude-opus-5-5", ""); limited.monthly_limit_usd = Some(-1.0);
        assert!(validate(limited, &current).is_err());
    }
    #[test]
    fn capabilities_follow_the_provider_and_local_urls() {
        assert!(capabilities(&AiConfig::default()).native_search);
        assert!(capabilities(&config(ProviderKind::OpenaiCompatible, "m", "http://127.0.0.1:1234/v1")).local);
        assert!(!capabilities(&config(ProviderKind::OpenaiCompatible, "m", "https://openrouter.ai/api/v1")).local);
        assert_eq!(base_url(&config(ProviderKind::OpenaiCompatible, "m", "http://localhost:11434/v1/")), "http://localhost:11434/v1");
    }
    #[test]
    fn errors_are_sentences_without_secrets() {
        let body = r#"{"type":"error","error":{"type":"rate_limit_error","message":"Number of requests has exceeded your rate limit"}}"#;
        assert_eq!(friendly_error(429, body), "The provider's rate limit was reached. Wait a minute and try again. (429: Number of requests has exceeded your rate limit)");
        assert!(friendly_error(529, "not json").starts_with("The AI service is busy"));
        assert_eq!(friendly_error(401, ""), "The API key was not accepted. Check it in Settings → AI. (401)");
    }
    // Touches the real Windows Credential Manager under a separate test name; run with --ignored.
    #[test]
    #[ignore]
    fn windows_credential_manager_round_trip() {
        let entry = keyring::Entry::new("com.firextream.yazi.test", "round-trip").unwrap();
        entry.set_password("sk-test-not-a-real-key").unwrap();
        assert_eq!(entry.get_password().unwrap(), "sk-test-not-a-real-key");
        entry.delete_credential().unwrap();
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    }
    #[test]
    fn test_results_name_the_model() {
        assert_eq!(describe_test(&AiConfig::default(), r#"{"id":"claude-opus-5-5","display_name":"Claude Opus 5.5"}"#).unwrap(), "Connected. Claude Opus 5.5 is available.");
        let local = config(ProviderKind::OpenaiCompatible, "llama3", "http://localhost:11434/v1");
        assert!(describe_test(&local, r#"{"data":[{"id":"llama3"}]}"#).unwrap().starts_with("Connected. llama3"));
        assert!(describe_test(&local, r#"{"data":[{"id":"qwen"}]}"#).unwrap().contains("was not in the provider's model list"));
    }
}
