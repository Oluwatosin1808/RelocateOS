import "server-only";
import { getServerEnv } from "@/lib/configuration/env";

/**
 * Minimal OpenAI-compatible chat-completions client.
 *
 * Works with any provider that speaks the OpenAI `/v1/chat/completions`
 * protocol: OpenAI, Together, Groq, Ollama, LM Studio, OpenRouter, etc.
 * Set `AI_BASE_URL` to the provider's root (e.g. `https://api.openai.com/v1`)
 * and `AI_API_KEY` to the key. When no key is configured the provider is
 * `"none"` and every call fails fast — nothing is silently faked.
 */

export class AiUnavailableError extends Error {
  constructor(message = "AI provider is not configured.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export class AiCallError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionChoice = {
  message: { content: string };
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type AiCallResult = {
  content: string;
  model: string;
  totalTokens: number | null;
};

/**
 * Call an OpenAI-compatible chat-completions endpoint.
 * Throws `AiUnavailableError` when no provider is configured,
 * `AiCallError` on HTTP or network failure. Never returns fabricated text.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AiCallResult> {
  const env = getServerEnv();
  if (env.ai.provider !== "openai-compatible" || !env.ai.apiKey) {
    throw new AiUnavailableError();
  }

  const baseUrl = (env.ai.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = env.ai.model || "gpt-4o-mini";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new AiCallError(
      err instanceof Error ? err.message : "Network error calling AI provider.",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiCallError(
      `AI provider returned ${res.status}: ${body.slice(0, 300)}`,
      res.status,
    );
  }

  const data = (await res.json().catch(() => null)) as ChatCompletionResponse | null;
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AiCallError("AI provider returned an empty response.");
  }

  return {
    content,
    model,
    totalTokens: data?.usage?.total_tokens ?? null,
  };
}

export function isAiConfigured(): boolean {
  return getServerEnv().ai.provider === "openai-compatible";
}
