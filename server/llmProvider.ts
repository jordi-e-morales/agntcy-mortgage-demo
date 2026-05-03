/**
 * AGNTCY Mortgage Demo — LLM Provider Abstraction Layer
 * ======================================================
 * Supports: Manus Built-in (Gemini 2.5 Flash), OpenAI, Anthropic, Ollama (local).
 * Settings are persisted in the llm_settings DB table and loaded at runtime.
 * Falls back to the built-in Manus API if no settings are configured.
 */

import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { llmSettings } from "../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMProvider = "gemini" | "openai" | "anthropic" | "ollama";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  messages: LLMMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model?: string;
  provider?: string;
}

export interface ActiveLLMConfig {
  provider: LLMProvider;
  modelName: string;
  useBuiltIn: boolean;
  ollamaBaseUrl?: string;
  temperature: number;
  maxTokens: number;
}

// ─── Settings Cache ───────────────────────────────────────────────────────────

let _cachedSettings: ActiveLLMConfig | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds

export async function getActiveLLMConfig(): Promise<ActiveLLMConfig> {
  const now = Date.now();
  if (_cachedSettings && now < _cacheExpiry) return _cachedSettings;

  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(llmSettings).limit(1);
    if (rows.length > 0) {
      const row = rows[0]!;
      _cachedSettings = {
        provider: row.provider,
        modelName: row.modelName,
        useBuiltIn: row.useBuiltIn,
        ollamaBaseUrl: row.ollamaBaseUrl ?? "http://localhost:11434",
        temperature: row.temperature,
        maxTokens: row.maxTokens,
      };
      _cacheExpiry = now + CACHE_TTL_MS;
      return _cachedSettings;
    }
  } catch {
    // Fall through to default
  }

  // Default: use built-in Manus API
  return {
    provider: "gemini",
    modelName: "gemini-2.5-flash",
    useBuiltIn: true,
    temperature: 0.1,
    maxTokens: 4096,
  };
}

export function invalidateLLMCache() {
  _cachedSettings = null;
  _cacheExpiry = 0;
}

// ─── Provider Implementations ─────────────────────────────────────────────────

async function callBuiltIn(opts: LLMCallOptions): Promise<LLMResponse> {
  const result = await invokeLLM({
    messages: opts.messages,
    response_format: opts.response_format as Parameters<typeof invokeLLM>[0]["response_format"],
  });
  // Cast to our simpler LLMResponse type (content is always string for JSON responses)
  return {
    choices: result.choices.map((c) => ({
      message: { content: typeof c.message.content === "string" ? c.message.content : JSON.stringify(c.message.content) },
    })),
    model: result.model,
    provider: "manus-builtin",
  };
}

async function callOpenAI(opts: LLMCallOptions, config: ActiveLLMConfig, apiKey: string): Promise<LLMResponse> {
  const body = {
    model: config.modelName,
    messages: opts.messages,
    temperature: opts.temperature ?? config.temperature,
    max_tokens: opts.max_tokens ?? config.maxTokens,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json() as LLMResponse;
  return { ...data, provider: "openai" };
}

async function callAnthropic(opts: LLMCallOptions, config: ActiveLLMConfig, apiKey: string): Promise<LLMResponse> {
  // Extract system message
  const systemMsg = opts.messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = opts.messages.filter((m) => m.role !== "system");

  // If JSON schema requested, append instruction to system prompt
  let systemPrompt = systemMsg;
  if (opts.response_format?.type === "json_schema") {
    systemPrompt += `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(opts.response_format.json_schema.schema, null, 2)}\n\nRespond ONLY with the JSON object, no other text.`;
  }

  const body = {
    model: config.modelName,
    max_tokens: opts.max_tokens ?? config.maxTokens,
    system: systemPrompt,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { content: Array<{ text: string }> };
  return {
    choices: [{ message: { content: data.content[0]?.text ?? "" } }],
    provider: "anthropic",
  };
}

async function callOllama(opts: LLMCallOptions, config: ActiveLLMConfig): Promise<LLMResponse> {
  const baseUrl = config.ollamaBaseUrl ?? "http://localhost:11434";

  // If JSON schema requested, append instruction
  const messages = [...opts.messages];
  if (opts.response_format?.type === "json_schema") {
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    if (lastUser >= 0) {
      messages[lastUser] = {
        ...messages[lastUser]!,
        content: messages[lastUser]!.content +
          `\n\nIMPORTANT: Respond ONLY with valid JSON matching this schema:\n${JSON.stringify(opts.response_format.json_schema.schema, null, 2)}`,
      };
    }
  }

  const body = {
    model: config.modelName,
    messages,
    stream: false,
    options: {
      temperature: opts.temperature ?? config.temperature,
      num_predict: opts.max_tokens ?? config.maxTokens,
    },
    ...(opts.response_format ? { format: "json" } : {}),
  };

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000), // local models can be slow
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { message: { content: string } };
  return {
    choices: [{ message: { content: data.message.content } }],
    provider: "ollama",
    model: config.modelName,
  };
}

async function callGeminiDirect(opts: LLMCallOptions, config: ActiveLLMConfig, apiKey: string): Promise<LLMResponse> {
  // Use OpenAI-compatible endpoint for Gemini
  const body = {
    model: config.modelName,
    messages: opts.messages,
    temperature: opts.temperature ?? config.temperature,
    max_tokens: opts.max_tokens ?? config.maxTokens,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
  };

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json() as LLMResponse;
  return { ...data, provider: "gemini" };
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function callLLM(opts: LLMCallOptions): Promise<LLMResponse> {
  const config = await getActiveLLMConfig();

  // Always use built-in if configured
  if (config.useBuiltIn) {
    return callBuiltIn(opts);
  }

  // Load API key from DB
  let apiKey = "";
  try {
    const db = await getDb();
    if (db) {
      const rows = await db.select().from(llmSettings).limit(1);
      apiKey = rows[0]?.apiKey ?? "";
    }
  } catch {
    // ignore
  }

  switch (config.provider) {
    case "openai":
      if (!apiKey) throw new Error("OpenAI API key not configured");
      return callOpenAI(opts, config, apiKey);

    case "anthropic":
      if (!apiKey) throw new Error("Anthropic API key not configured");
      return callAnthropic(opts, config, apiKey);

    case "ollama":
      return callOllama(opts, config);

    case "gemini":
      if (!apiKey) throw new Error("Gemini API key not configured");
      return callGeminiDirect(opts, config, apiKey);

    default:
      return callBuiltIn(opts);
  }
}

// ─── Available Models per Provider ───────────────────────────────────────────

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  ollama: [
    "llama3.2",
    "llama3.1",
    "llama3",
    "mistral",
    "mixtral",
    "phi3",
    "qwen2.5",
    "deepseek-r1",
    "gemma2",
    "codellama",
  ],
};
