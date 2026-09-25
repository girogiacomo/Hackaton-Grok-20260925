/**
 * Minimal xAI (Grok) chat-completions client. Every call has a hard timeout and
 * returns `undefined` on any failure so callers fall back to canned content;
 * the phone must never wait on the LLM.
 */

export interface GrokOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChatChoice {
  message?: { content?: string | null };
}

export class GrokClient {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GrokOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.XAI_API_KEY;
    this.model = opts.model ?? process.env.GROK_MODEL ?? 'grok-4-fast';
    this.baseUrl = (opts.baseUrl ?? process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /** Returns the assistant text, or undefined on error/timeout/no key. */
  async complete(system: string, user: string, json = false): Promise<string | undefined> {
    if (!this.apiKey) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.8,
          max_tokens: 300,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { choices?: ChatChoice[] };
      const text = data.choices?.[0]?.message?.content ?? undefined;
      return text?.trim() || undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Like `complete` with JSON mode, parsed. Returns undefined if unparsable. */
  async completeJson<T>(system: string, user: string): Promise<T | undefined> {
    const text = await this.complete(system, user, true);
    if (!text) return undefined;
    try {
      // Tolerate models that wrap JSON in a code fence despite JSON mode.
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return undefined;
    }
  }
}
