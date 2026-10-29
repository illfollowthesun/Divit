// One plain request to the chosen model, without web search: used for "Ask without web search" and to
// rank and summarise results from a search service. The writer starts every request.
use crate::ai::{self, AiConfig, ProviderKind, ANTHROPIC_VERSION};
use crate::ai_search::{add_usage, gemini_usage, Spend};
use crate::storage::Result;
use serde_json::{json, Value};

pub struct Reply { pub spend: Spend, pub model: String, pub result: Result<String> }

pub fn request_body(config: &AiConfig, system: &str, prompt: &str, max_tokens: u32) -> Value {
    match config.provider {
        // The Interactions API takes one input; the instructions go first.
        ProviderKind::Gemini => json!({ "model": config.model, "input": format!("{system}\n\n{prompt}") }),
        ProviderKind::Anthropic => json!({ "model": config.model, "max_tokens": max_tokens, "system": system, "messages": [{ "role": "user", "content": prompt }] }),
        // No token limit: OpenAI and compatible services disagree on its name.
        _ => json!({ "model": config.model, "messages": [{ "role": "system", "content": system }, { "role": "user", "content": prompt }] }),
    }
}
// Reads the answer text and adds the tokens to `spend`.
pub fn read_reply(config: &AiConfig, value: &Value, spend: &mut Spend) -> Result<String> {
    let text = match config.provider {
        ProviderKind::Gemini => {
            gemini_usage(spend, value);
            value["steps"].as_array().into_iter().flatten().filter(|s| s["type"] == "model_output")
                .flat_map(|s| s["content"].as_array().into_iter().flatten()).filter(|c| c["type"] == "text").filter_map(|c| c["text"].as_str()).collect::<Vec<_>>().join("\n\n")
        }
        ProviderKind::Anthropic => {
            add_usage(spend, value);
            value["content"].as_array().into_iter().flatten().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect::<Vec<_>>().join("\n\n")
        }
        _ => {
            spend.input_tokens += value["usage"]["prompt_tokens"].as_u64().unwrap_or(0);
            spend.output_tokens += value["usage"]["completion_tokens"].as_u64().unwrap_or(0);
            value["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string()
        }
    };
    if text.trim().is_empty() { return Err("The model answered with no text. Try again.".into()); }
    Ok(text.trim().to_string())
}

pub async fn complete(config: &AiConfig, key: Option<&str>, system: &str, prompt: &str, max_tokens: u32) -> Reply {
    let mut reply = Reply { spend: Spend::default(), model: config.model.clone(), result: Err(String::new()) };
    reply.result = run(config, key, system, prompt, max_tokens, &mut reply.spend, &mut reply.model).await;
    reply
}
async fn run(config: &AiConfig, key: Option<&str>, system: &str, prompt: &str, max_tokens: u32, spend: &mut Spend, served: &mut String) -> Result<String> {
    let http = ai::client(180)?;
    let base = ai::base_url(config);
    let body = request_body(config, system, prompt, max_tokens);
    let call = match config.provider {
        ProviderKind::Gemini => http.post(format!("{base}/interactions")).header("x-goog-api-key", key.ok_or("Add a Gemini API key in Settings → AI first.")?),
        ProviderKind::Anthropic => http.post(format!("{base}/messages")).header("x-api-key", key.ok_or("Add an Anthropic API key in Settings → AI first.")?).header("anthropic-version", ANTHROPIC_VERSION),
        ProviderKind::Openai => http.post(format!("{base}/chat/completions")).bearer_auth(key.ok_or("Add an OpenAI API key in Settings → AI first.")?),
        ProviderKind::Local | ProviderKind::OpenaiCompatible => { let r = http.post(format!("{base}/chat/completions")); match key { Some(k) => r.bearer_auth(k), None => r } }
    };
    let response = call.json(&body).send().await.map_err(|e| if config.provider == ProviderKind::Local { "Nothing answered at the local model's address. Is Ollama or LM Studio running?".to_string() } else { ai::network(e) })?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|_| "The answer was cut off. Nothing was saved.".to_string())?;
    if !(200..300).contains(&status) { return Err(if config.provider == ProviderKind::Gemini { ai::gemini_error(status, &text, false) } else { ai::friendly_error(status, &text) }); }
    let value: Value = serde_json::from_str(&text).map_err(|_| "The AI service answered with something that is not JSON.".to_string())?;
    if let Some(m) = value["model"].as_str() { *served = m.to_string(); }
    read_reply(config, &value, spend)
}

// "Ask without web search": what the model knows about the topic, plainly marked as unchecked.
pub fn unsourced_prompt(topic: &str, angle: &str, language: &str) -> (String, String) {
    let reply_in = if language == "tr" { "Turkish" } else { "English" };
    let system = format!("You help a writer start researching. You cannot browse the web. From what you already know, write a short overview of the topic, then list where to look: kinds of sources, well-known publications, institutions, books and search terms. Never invent web addresses, quotes or figures; if you are unsure, say so. Reply in {reply_in}, in plain paragraphs and a short list.");
    let mut prompt = format!("Topic: {}", topic.trim());
    if !angle.trim().is_empty() { prompt.push_str(&format!("\nAngle: {}", angle.trim())); }
    (system, prompt)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(provider: ProviderKind, model: &str) -> AiConfig { AiConfig { provider, model: model.into(), ..AiConfig::default() } }

    #[test]
    fn each_provider_gets_its_own_request_shape_without_tools() {
        let g = request_body(&config(ProviderKind::Gemini, "gemini-3.8-flash"), "Be brief.", "Topic: ferries", 800);
        assert_eq!(g, json!({ "model": "gemini-3.8-flash", "input": "Be brief.\n\nTopic: ferries" }));
        let a = request_body(&config(ProviderKind::Anthropic, "claude-haiku-5-5"), "Be brief.", "Topic: ferries", 800);
        assert_eq!((a["max_tokens"].as_u64(), a["system"].as_str(), a.get("tools")), (Some(800), Some("Be brief."), None));
        let o = request_body(&config(ProviderKind::Local, "llama3"), "Be brief.", "Topic: ferries", 800);
        assert_eq!(o["messages"][0]["role"], "system"); assert_eq!(o["messages"][1]["content"], "Topic: ferries"); assert!(o.get("max_tokens").is_none());
    }
    #[test]
    fn replies_and_tokens_are_read_for_each_provider() {
        let mut spend = Spend::default();
        let gemini = json!({ "steps": [{ "type": "model_output", "content": [{ "type": "text", "text": " Vapurlar " }] }], "usage": { "total_input_tokens": 10, "total_output_tokens": 5 } });
        assert_eq!(read_reply(&config(ProviderKind::Gemini, "m"), &gemini, &mut spend).unwrap(), "Vapurlar");
        let claude = json!({ "content": [{ "type": "text", "text": "Ferries" }], "usage": { "input_tokens": 7, "output_tokens": 3 } });
        assert_eq!(read_reply(&config(ProviderKind::Anthropic, "m"), &claude, &mut spend).unwrap(), "Ferries");
        let openai = json!({ "choices": [{ "message": { "content": "Boats" } }], "usage": { "prompt_tokens": 2, "completion_tokens": 1 } });
        assert_eq!(read_reply(&config(ProviderKind::Openai, "m"), &openai, &mut spend).unwrap(), "Boats");
        assert_eq!(spend, Spend { input_tokens: 19, output_tokens: 9, web_searches: 0 });
        assert!(read_reply(&config(ProviderKind::Local, "m"), &json!({ "choices": [] }), &mut spend).is_err());
    }
    #[test]
    fn the_unsourced_prompt_forbids_made_up_addresses() {
        let (system, prompt) = unsourced_prompt(" Kış vapurları ", "", "tr");
        assert!(system.contains("Never invent web addresses") && system.contains("Reply in Turkish"));
        assert_eq!(prompt, "Topic: Kış vapurları");
    }
}
