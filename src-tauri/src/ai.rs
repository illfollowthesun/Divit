// In-app AI. Keys live in Windows Credential Manager and never reach the webview, project files,
// backups or exports. Settings (provider, model, usage) live in Documents/Yazi/ai.json without the key.
// Every request is started by the writer; nothing runs in the background.
use crate::search_service::{self, SearchConfig, SearchKind};
use crate::storage::{atomic, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::Path, time::Duration};

pub const ANTHROPIC_VERSION: &str = "2026-10-21";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1";
pub const GEMINI_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_URL: &str = "https://api.openai.com/v1";
const KEYRING_SERVICE: &str = "com.firextream.yazi";

// Listed in the order Settings shows them: the free and private options first.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind { #[default] Gemini, Local, Anthropic, Openai, OpenaiCompatible }
impl ProviderKind {
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "gemini" => Ok(Self::Gemini), "local" => Ok(Self::Local), "anthropic" => Ok(Self::Anthropic),
            "openai" => Ok(Self::Openai), "openai-compatible" => Ok(Self::OpenaiCompatible), _ => Err("Unknown AI provider".into()),
        }
    }
    fn key_name(self) -> &'static str {
        match self { Self::Gemini => "ai-gemini", Self::Local => "ai-local", Self::Anthropic => "ai-anthropic", Self::Openai => "ai-openai", Self::OpenaiCompatible => "ai-openai-compatible" }
    }
    const ALL: [ProviderKind; 5] = [Self::Gemini, Self::Local, Self::Anthropic, Self::Openai, Self::OpenaiCompatible];
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities { pub native_search: bool, pub deep_research: bool, pub streaming: bool, pub local: bool, pub key_required: bool }

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: &'static str, pub label: &'static str, pub input_per_mtok: f64, pub output_per_mtok: f64,
    // Some prices change: (prompt tokens above which, or month from which; input, output).
    pub long_prompt: Option<(u64, f64, f64)>, pub from_month: Option<(&'static str, f64, f64)>,
    pub web_search_tool: &'static str, pub fallbacks: bool,
}
const fn claude(id: &'static str, label: &'static str, input: f64, output: f64, long_prompt: Option<(u64, f64, f64)>, web_search_tool: &'static str, fallbacks: bool) -> ModelInfo {
    ModelInfo { id, label, input_per_mtok: input, output_per_mtok: output, long_prompt, from_month: None, web_search_tool, fallbacks }
}
const fn gemini(id: &'static str, label: &'static str, input: f64, output: f64, from_month: Option<(&'static str, f64, f64)>) -> ModelInfo {
    ModelInfo { id, label, input_per_mtok: input, output_per_mtok: output, long_prompt: None, from_month, web_search_tool: "google_search", fallbacks: false }
}

// Verified 2026-10-29: https://platform.claude.com/docs/en/about-claude/pricing
// Anthropic first-party prices in USD per million tokens.
pub const ANTHROPIC_MODELS: [ModelInfo; 3] = [
    claude("claude-sonnet-5-5", "Claude Sonnet 5.5", 2.0, 10.0, None, "web_search_20260209", true),
    claude("claude-haiku-5-5", "Claude Haiku 5.5 (lowest cost)", 0.10, 0.50, Some((100_000, 0.50, 2.50)), "web_search_20250305", false),
    claude("claude-opus-5-5", "Claude Opus 5.5", 4.0, 20.0, None, "web_search_20260209", true),
];
// Verified 2026-10-29: https://ai.google.dev/gemini-api/docs/pricing
// Gemini paid-tier token prices. Search charges are excluded: the shared account allowance is unknown.
pub const GEMINI_MODELS: [ModelInfo; 2] = [
    gemini("gemini-3.8-flash", "Gemini 3.8 Flash", 0.75, 3.75, Some(("2027-01", 1.50, 7.50))),
    gemini("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite (lowest cost)", 0.30, 2.50, None),
];
pub const WEB_SEARCH_USD: f64 = 0.01; // Claude: $10 per 1,000 searches. Gemini: 5,000 a month free on paid keys, not priced here.

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Usage { pub month: String, pub calls: u64, pub input_tokens: u64, pub output_tokens: u64, pub web_searches: u64, pub cost_usd: f64, pub unpriced_calls: u64 }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiConfig {
    pub enabled: bool, pub provider: ProviderKind, pub model: String, pub base_url: String, pub monthly_limit_usd: Option<f64>,
    // If Claude declines a request, let Anthropic retry it on its recommended fallback model. Off unless the writer turns it on.
    pub fallbacks: bool, pub usage: Usage,
    // A search service for models that cannot search the web themselves.
    pub search: SearchConfig,
    // The old one-word choice from settings.json ("aiProvider"), kept after it was carried over.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_provider: Option<String>,
}
impl Default for AiConfig {
    fn default() -> Self { Self { enabled: false, provider: ProviderKind::Gemini, model: GEMINI_MODELS[0].id.into(), base_url: String::new(), monthly_limit_usd: None, fallbacks: false, usage: Usage::default(), search: SearchConfig::default(), legacy_provider: None } }
}

pub fn catalog(kind: ProviderKind) -> &'static [ModelInfo] {
    match kind { ProviderKind::Gemini => &GEMINI_MODELS, ProviderKind::Anthropic => &ANTHROPIC_MODELS, _ => &[] }
}
pub fn model_info(kind: ProviderKind, model: &str) -> Option<&'static ModelInfo> { catalog(kind).iter().find(|m| m.id == model) }

pub fn capabilities(config: &AiConfig) -> Capabilities {
    let base = Capabilities { native_search: false, deep_research: false, streaming: true, local: false, key_required: true };
    match config.provider {
        ProviderKind::Gemini | ProviderKind::Anthropic => Capabilities { native_search: true, ..base },
        ProviderKind::Local => Capabilities { local: true, key_required: false, ..base },
        // Search through these providers is not wired up; summarize, ask and angles work.
        ProviderKind::Openai | ProviderKind::OpenaiCompatible => base,
    }
}
pub fn is_local(url: &str) -> bool {
    reqwest::Url::parse(url).is_ok_and(|url| url.username().is_empty() && url.password().is_none()
        && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]" | "::1")))
}
pub fn base_url(config: &AiConfig) -> String {
    match config.provider {
        ProviderKind::Gemini => GEMINI_URL.into(), ProviderKind::Anthropic => ANTHROPIC_URL.into(), ProviderKind::Openai => OPENAI_URL.into(),
        ProviderKind::Local | ProviderKind::OpenaiCompatible => config.base_url.trim_end_matches('/').into(),
    }
}

pub fn load(root: &Path) -> Result<AiConfig> {
    match std::fs::read_to_string(root.join("ai.json")) {
        Ok(text) => serde_json::from_str(&text).map_err(|_| "ai.json could not be read. AI settings were not changed.".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => match migrate_legacy(root) {
            Some(config) => { save(root, &config)?; Ok(config) }
            None => Ok(AiConfig::default()),
        },
        Err(e) => Err(e.to_string()),
    }
}
// Before ai.json existed, settings.json held a one-word "aiProvider" ('claude-code' | 'anthropic' | 'ollama').
// It is carried over once, AI stays off, and settings.json itself is left as it is.
pub fn migrate_legacy(root: &Path) -> Option<AiConfig> {
    let settings: Value = serde_json::from_str(&std::fs::read_to_string(root.join("settings.json")).ok()?).ok()?;
    let legacy = settings["aiProvider"].as_str()?.to_string();
    let mut config = AiConfig::default();
    match legacy.as_str() {
        "anthropic" => { config.provider = ProviderKind::Anthropic; config.model = ANTHROPIC_MODELS[0].id.into(); }
        "ollama" => { config.provider = ProviderKind::Local; config.base_url = "http://localhost:11434/v1".into(); config.model = String::new(); }
        _ => {} // Claude Code was never connected; Gemini stays the default.
    }
    config.legacy_provider = Some(legacy);
    Some(config)
}
pub fn save(root: &Path, config: &AiConfig) -> Result<()> { atomic(&root.join("ai.json"), &serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?) }

// Checks a configuration from the Settings form. Usage is kept from disk; the form cannot rewrite it.
pub fn validate(mut next: AiConfig, current: &AiConfig) -> Result<AiConfig> {
    next.model = next.model.trim().to_string();
    next.base_url = next.base_url.trim().to_string();
    if next.model.is_empty() || next.model.len() > 200 || next.model.chars().any(char::is_whitespace) { return Err("Choose a model name without spaces.".into()); }
    if !catalog(next.provider).is_empty() && model_info(next.provider, &next.model).is_none() { return Err("Choose one of the listed models.".into()); }
    match next.provider {
        ProviderKind::Local => if !(next.base_url.starts_with("http://") || next.base_url.starts_with("https://")) || !is_local(&next.base_url) { return Err("A local model's address starts with http://localhost or http://127.0.0.1.".into()); },
        ProviderKind::OpenaiCompatible => if !next.base_url.starts_with("https://") { return Err("The service address must start with https://. For a model on this computer, choose Local model.".into()); },
        _ => next.base_url = String::new(),
    }
    if let Some(limit) = next.monthly_limit_usd { if !(limit.is_finite() && limit > 0.0 && limit <= 100_000.0) { return Err("The monthly limit must be a positive amount in dollars.".into()); } }
    // Only Claude models with a server-side fallback can use one.
    if !model_info(next.provider, &next.model).is_some_and(|m| m.fallbacks) { next.fallbacks = false; }
    next.usage = current.usage.clone();
    next.legacy_provider = current.legacy_provider.clone();
    next.search = search_service::validate(next.search)?;
    Ok(next)
}

fn entry(name: &str) -> Result<keyring::Entry> { keyring::Entry::new(KEYRING_SERVICE, name).map_err(|e| format!("Windows Credential Manager is not available: {e}")) }
pub fn set_named_key(name: &str, key: &str) -> Result<()> {
    let key = key.trim();
    if key.is_empty() || key.len() > 500 || key.chars().any(char::is_whitespace) { return Err("Paste the whole API key, without spaces.".into()); }
    entry(name)?.set_password(key).map_err(|e| format!("The key could not be stored: {e}"))
}
pub fn get_named_key(name: &str) -> Result<Option<String>> {
    match entry(name)?.get_password() { Ok(key) => Ok(Some(key)), Err(keyring::Error::NoEntry) => Ok(None), Err(e) => Err(format!("The key could not be read: {e}")) }
}
pub fn forget_named_key(name: &str) -> Result<()> {
    match entry(name)?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(format!("The key could not be removed: {e}")) }
}
pub fn set_key(kind: ProviderKind, key: &str) -> Result<()> { set_named_key(kind.key_name(), key) }
pub fn get_key(kind: ProviderKind) -> Result<Option<String>> { get_named_key(kind.key_name()) }
pub fn forget_key(kind: ProviderKind) -> Result<()> { forget_named_key(kind.key_name()) }
// The chosen search service and its key, if it can be used now.
pub fn search_service(config: &AiConfig) -> Result<Option<(SearchConfig, Option<String>)>> {
    let search = &config.search;
    Ok(match search.provider {
        SearchKind::None => None,
        SearchKind::Searxng => if search.searxng_url.is_empty() { None } else { Some((search.clone(), None)) },
        kind => get_named_key(kind.key_name().unwrap_or_default())?.map(|key| (search.clone(), Some(key))),
    })
}

// What one request cost at list price, if the served model is known. Claude searches cost the same
// on every model; Gemini searches are left out (5,000 a month are free on paid keys).
pub fn cost(kind: ProviderKind, model: &str, month: &str, input_tokens: u64, output_tokens: u64, web_searches: u64) -> Option<f64> {
    let m = model_info(kind, model)?;
    let (mut input, mut output) = (m.input_per_mtok, m.output_per_mtok);
    if let Some((above, i, o)) = m.long_prompt { if input_tokens > above { (input, output) = (i, o); } }
    if let Some((from, i, o)) = m.from_month { if month >= from { (input, output) = (i, o); } }
    let searches = if kind == ProviderKind::Anthropic { web_searches as f64 * WEB_SEARCH_USD } else { 0.0 };
    Some((input_tokens as f64 * input + output_tokens as f64 * output) / 1_000_000.0 + searches)
}
// Adds one request to this month's usage (a new month starts from zero) and returns its cost, if known.
pub fn record(config: &mut AiConfig, month: &str, model: &str, input_tokens: u64, output_tokens: u64, web_searches: u64) -> Option<f64> {
    if config.usage.month != month { config.usage = Usage { month: month.into(), ..Usage::default() }; }
    let spent = cost(config.provider, model, month, input_tokens, output_tokens, web_searches);
    let usage = &mut config.usage;
    usage.calls += 1; usage.input_tokens += input_tokens; usage.output_tokens += output_tokens; usage.web_searches += web_searches;
    match spent { Some(c) => usage.cost_usd += c, None => usage.unpriced_calls += 1 }
    spent
}
// A soft limit: Yazı warns, the writer decides.
pub fn over_limit(config: &AiConfig, month: &str) -> bool {
    config.usage.month == month && config.monthly_limit_usd.is_some_and(|limit| config.usage.cost_usd >= limit)
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
        429 => "The provider's rate limit or free quota was reached. Wait a minute and try again.",
        500..=599 => "The AI service is busy or having trouble. Try again shortly.",
        _ => "The AI request failed.",
    };
    match detail { Some(d) if !d.is_empty() => format!("{base} ({status}: {d})"), _ => format!("{base} ({status})") }
}

// Errors the Research panel can act on start with "[code] "; the panel strips the code and offers the next step.
pub fn coded(code: &str, message: &str) -> String { format!("[{code}] {message}") }
// Gemini reports a per-minute limit and an empty quota with the same 429 and "exceeded your current quota";
// only the quota details tell them apart.
pub fn gemini_error(status: u16, body: &str, searching: bool) -> String {
    let lower = body.to_ascii_lowercase();
    match status {
        402 => coded("billing", "Billing on this key's Google project is not active yet. Turn it on in Google AI Studio, then try again."),
        429 if lower.contains("perminute") => {
            let wait = serde_json::from_str::<Value>(body).ok().and_then(|v| v["error"]["details"].as_array().and_then(|d| d.iter().find_map(|d| d["retryDelay"].as_str().map(String::from))));
            match wait.and_then(|w| w.trim_end_matches('s').parse::<f64>().ok()) {
                Some(s) => format!("Gemini's per-minute limit was reached. Wait {} seconds and try again.", s.ceil().max(1.0)),
                None => "Gemini's per-minute limit was reached. Wait a minute and try again.".into(),
            }
        }
        429 if lower.contains("exceeded your current quota") => if searching {
            coded("no-search-quota", "This Gemini key has no quota for web search. Its free tier probably includes no Google Search quota. Turn on billing for the key, choose another provider in Settings → AI, or ask without web search.")
        } else { "This Gemini key has used up its quota for now. Wait until it resets, or turn on billing for the key in Google AI Studio.".into() },
        _ => friendly_error(status, body),
    }
}

pub fn client(seconds: u64) -> Result<reqwest::Client> {
    reqwest::Client::builder().timeout(Duration::from_secs(seconds)).connect_timeout(Duration::from_secs(15)).user_agent("Yazi/0.1").build().map_err(|e| e.to_string())
}
pub fn network(error: reqwest::Error) -> String {
    if error.is_timeout() { "The AI service took too long to answer. Nothing was changed.".into() } else { "The AI service could not be reached. Check your connection.".into() }
}

// "Test connection" reads the model's listing, which costs no tokens.
pub async fn test(config: &AiConfig, key: Option<&str>) -> Result<String> {
    let http = client(30)?;
    let base = base_url(config);
    let request = match config.provider {
        ProviderKind::Gemini => http.get(format!("{base}/models/{}", config.model)).header("x-goog-api-key", key.ok_or("Add a Gemini API key first.")?),
        ProviderKind::Anthropic => http.get(format!("{base}/models/{}", config.model)).header("x-api-key", key.ok_or("Add an Anthropic API key first.")?).header("anthropic-version", ANTHROPIC_VERSION),
        ProviderKind::Openai => http.get(format!("{base}/models")).bearer_auth(key.ok_or("Add an OpenAI API key first.")?),
        ProviderKind::Local | ProviderKind::OpenaiCompatible => { let r = http.get(format!("{base}/models")); match key { Some(k) => r.bearer_auth(k), None => r } }
    };
    let response = request.send().await.map_err(|e| if config.provider == ProviderKind::Local { "Nothing answered at that address. Is Ollama or LM Studio running?".to_string() } else { network(e) })?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(network)?;
    if !(200..300).contains(&status) { return Err(if config.provider == ProviderKind::Gemini { gemini_error(status, &body, false).trim_start_matches("[billing] ").to_string() } else { friendly_error(status, &body) }); }
    describe_test(config, &body)
}
pub fn describe_test(config: &AiConfig, body: &str) -> Result<String> {
    let value: Value = serde_json::from_str(body).map_err(|_| "The provider answered with something that is not JSON.".to_string())?;
    Ok(match config.provider {
        ProviderKind::Anthropic => format!("Connected. {} is available.", value["display_name"].as_str().unwrap_or(&config.model)),
        ProviderKind::Gemini => format!("Connected. {} is available.", value["displayName"].as_str().unwrap_or(&config.model)),
        _ => {
            let listed = value["data"].as_array().map(|models| models.iter().any(|m| m["id"].as_str() == Some(&config.model))).unwrap_or(false);
            if listed { format!("Connected. {} is available.", config.model) } else { format!("Connected, but {} was not in the provider's model list. Check the name.", config.model) }
        }
    })
}

// What Settings shows: never a key, only whether one is stored for each provider.
pub fn status(config: &AiConfig) -> Result<Value> {
    let mut stored = serde_json::Map::new();
    for kind in ProviderKind::ALL { stored.insert(serde_json::to_value(kind).unwrap().as_str().unwrap().to_string(), json!(get_key(kind)?.is_some())); }
    let search_keys = json!({ "tavily": get_named_key("search-tavily")?.is_some(), "brave": get_named_key("search-brave")?.is_some() });
    Ok(json!({
        "config": config, "capabilities": capabilities(config), "hasKey": stored,
        "hasSearchKey": search_keys, "searchReady": search_service(config)?.is_some(),
        "models": { "gemini": GEMINI_MODELS, "anthropic": ANTHROPIC_MODELS },
        "price": model_info(config.provider, &config.model),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(provider: ProviderKind, model: &str, base: &str) -> AiConfig { AiConfig { provider, model: model.into(), base_url: base.into(), ..AiConfig::default() } }

    #[test]
    fn defaults_to_gemini_flash_with_ai_off_and_fallbacks_off() {
        let c = AiConfig::default();
        assert!(!c.enabled); assert!(!c.fallbacks); assert_eq!(c.provider, ProviderKind::Gemini); assert_eq!(c.model, "gemini-3.8-flash");
        assert_eq!(ANTHROPIC_MODELS[0].id, "claude-sonnet-5-5"); assert_eq!(ANTHROPIC_MODELS[1].id, "claude-haiku-5-5");
        let parsed: AiConfig = serde_json::from_str(r#"{"provider":"local","model":"llama3","baseUrl":"http://localhost:11434/v1"}"#).unwrap();
        assert_eq!(parsed.provider, ProviderKind::Local); assert!(!parsed.enabled);
    }
    #[test]
    fn validation_keeps_usage_rejects_unsafe_urls_and_unknown_models() {
        let mut current = AiConfig::default(); current.usage.calls = 7;
        let mut form = config(ProviderKind::Anthropic, " claude-sonnet-5-5 ", "https://ignored.example"); form.usage.calls = 0; form.fallbacks = true;
        let ok = validate(form, &current).unwrap();
        assert_eq!((ok.model.as_str(), ok.base_url.as_str(), ok.usage.calls, ok.fallbacks), ("claude-sonnet-5-5", "", 7, true));
        let mut haiku = config(ProviderKind::Anthropic, "claude-haiku-5-5", ""); haiku.fallbacks = true;
        assert!(!validate(haiku, &current).unwrap().fallbacks, "Haiku has no server-side fallback");
        let mut flash = config(ProviderKind::Gemini, "gemini-3.8-flash", ""); flash.fallbacks = true;
        assert!(!validate(flash, &current).unwrap().fallbacks);
        assert!(validate(config(ProviderKind::Gemini, "gemini-1.0-pro", ""), &current).is_err());
        assert!(validate(config(ProviderKind::Anthropic, "gpt-4o", ""), &current).is_err());
        assert!(validate(config(ProviderKind::Local, "llama3", "http://localhost:11434/v1"), &current).is_ok());
        assert!(validate(config(ProviderKind::Local, "llama3", "http://evil.example/v1"), &current).is_err());
        assert!(validate(config(ProviderKind::Local, "llama3", "http://localhost:11434@evil.example/v1"), &current).is_err());
        assert!(validate(config(ProviderKind::Local, "llama3", "http://[::1]:11434/v1"), &current).is_ok());
        assert!(validate(config(ProviderKind::OpenaiCompatible, "llama3", "http://localhost:11434/v1"), &current).is_err());
        assert!(validate(config(ProviderKind::OpenaiCompatible, "deepseek-chat", "https://api.deepseek.com/v1"), &current).is_ok());
        assert!(validate(config(ProviderKind::Openai, "two words", ""), &current).is_err());
        let mut limited = config(ProviderKind::Anthropic, "claude-opus-5-5", ""); limited.monthly_limit_usd = Some(-1.0);
        assert!(validate(limited, &current).is_err());
    }
    #[test]
    fn usage_rolls_over_monthly_and_prices_follow_model_tier_and_date() {
        let mut c = config(ProviderKind::Anthropic, "claude-sonnet-5-5", ""); c.monthly_limit_usd = Some(0.05);
        let spent = record(&mut c, "2026-10", "claude-sonnet-5-5", 20_000, 1_000, 2).unwrap();
        assert!((spent - 0.07).abs() < 1e-9); assert!(over_limit(&c, "2026-10")); assert!(!over_limit(&c, "2026-11"));
        record(&mut c, "2026-11", "claude-sonnet-5-5", 1_000, 0, 0);
        assert_eq!((c.usage.month.as_str(), c.usage.calls, c.usage.input_tokens), ("2026-11", 1, 1_000));
        assert!((cost(ProviderKind::Anthropic, "claude-haiku-5-5", "2026-10", 200_000, 1_000, 0).unwrap() - 0.1025).abs() < 1e-9);
        assert!((cost(ProviderKind::Gemini, "gemini-3.8-flash", "2026-12", 1_000_000, 0, 3).unwrap() - 0.75).abs() < 1e-9, "Gemini searches are not priced");
        assert!((cost(ProviderKind::Gemini, "gemini-3.8-flash", "2027-01", 1_000_000, 0, 0).unwrap() - 1.50).abs() < 1e-9);
        assert_eq!(cost(ProviderKind::Anthropic, "claude-opus-4-8", "2026-10", 1, 1, 1), None);
        let mut local = config(ProviderKind::Local, "llama3", "http://localhost:11434/v1");
        assert_eq!(record(&mut local, "2026-10", "llama3", 500, 50, 0), None); assert_eq!(local.usage.unpriced_calls, 1);
    }
    #[test]
    fn the_old_ai_provider_setting_is_carried_over_once_without_touching_settings_json() {
        for (old, provider, model, base) in [("anthropic", ProviderKind::Anthropic, "claude-sonnet-5-5", ""), ("ollama", ProviderKind::Local, "", "http://localhost:11434/v1"), ("claude-code", ProviderKind::Gemini, "gemini-3.8-flash", "")] {
            let dir = tempfile::tempdir().unwrap();
            let settings = format!(r#"{{"schemaVersion":1,"theme":"dark","aiProvider":"{old}","siteRepo":"C:\\Sites\\blog"}}"#);
            std::fs::write(dir.path().join("settings.json"), &settings).unwrap();
            let loaded = load(dir.path()).unwrap();
            assert_eq!((loaded.provider, loaded.model.as_str(), loaded.base_url.as_str(), loaded.enabled, loaded.legacy_provider.as_deref()), (provider, model, base, false, Some(old)));
            assert_eq!(std::fs::read_to_string(dir.path().join("settings.json")).unwrap(), settings);
            let mut written: AiConfig = serde_json::from_str(&std::fs::read_to_string(dir.path().join("ai.json")).unwrap()).unwrap();
            assert_eq!(written, loaded);
            written.enabled = true; save(dir.path(), &written).unwrap();
            assert!(load(dir.path()).unwrap().enabled, "after the first run ai.json is the only source");
        }
        let empty = tempfile::tempdir().unwrap();
        assert_eq!(load(empty.path()).unwrap(), AiConfig::default());
        assert!(!empty.path().join("ai.json").exists());
    }
    #[test]
    fn capabilities_follow_the_provider() {
        assert!(capabilities(&AiConfig::default()).native_search);
        let local = capabilities(&config(ProviderKind::Local, "m", "http://127.0.0.1:1234/v1"));
        assert!(local.local && !local.key_required && !local.native_search);
        assert!(!capabilities(&config(ProviderKind::OpenaiCompatible, "m", "https://openrouter.ai/api/v1")).native_search);
        assert_eq!(base_url(&config(ProviderKind::Local, "m", "http://localhost:11434/v1/")), "http://localhost:11434/v1");
        assert_eq!(base_url(&AiConfig::default()), "https://generativelanguage.googleapis.com/v1beta");
    }
    #[test]
    fn errors_are_sentences_without_secrets() {
        let body = r#"{"type":"error","error":{"type":"rate_limit_error","message":"Number of requests has exceeded your rate limit"}}"#;
        assert_eq!(friendly_error(429, body), "The provider's rate limit or free quota was reached. Wait a minute and try again. (429: Number of requests has exceeded your rate limit)");
        let gemini = r#"{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}"#;
        assert_eq!(friendly_error(400, gemini), "The AI request failed. (400: API key not valid. Please pass a valid API key.)");
        assert!(friendly_error(529, "not json").starts_with("The AI service is busy"));
    }
    #[test]
    fn gemini_quota_billing_and_rate_limits_are_told_apart() {
        let quota = r#"{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/search_grounding_requests","quotaId":"SearchGroundingRequestsPerDayPerProject-FreeTier","quotaValue":"0"}]}]}}"#;
        let searching = gemini_error(429, quota, true);
        assert!(searching.starts_with("[no-search-quota] ") && searching.contains("ask without web search") && !searching.to_lowercase().contains("grounding"));
        assert!(gemini_error(429, quota, false).starts_with("This Gemini key has used up its quota"));
        let minute = r#"{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"22.4s"}]}}"#;
        assert_eq!(gemini_error(429, minute, true), "Gemini's per-minute limit was reached. Wait 23 seconds and try again.");
        assert!(gemini_error(402, r#"{"error":{"code":402}}"#, true).starts_with("[billing] Billing on this key's Google project is not active yet."));
        assert!(gemini_error(401, "{}", true).starts_with("The API key was not accepted."));
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
        assert_eq!(describe_test(&config(ProviderKind::Anthropic, "claude-sonnet-5-5", ""), r#"{"id":"claude-sonnet-5-5","display_name":"Claude Sonnet 5.5"}"#).unwrap(), "Connected. Claude Sonnet 5.5 is available.");
        assert_eq!(describe_test(&AiConfig::default(), r#"{"name":"models/gemini-3.8-flash","displayName":"Gemini 3.8 Flash"}"#).unwrap(), "Connected. Gemini 3.8 Flash is available.");
        let local = config(ProviderKind::Local, "llama3", "http://localhost:11434/v1");
        assert!(describe_test(&local, r#"{"data":[{"id":"llama3"}]}"#).unwrap().starts_with("Connected. llama3"));
        assert!(describe_test(&local, r#"{"data":[{"id":"qwen"}]}"#).unwrap().contains("was not in the provider's model list"));
    }
}
