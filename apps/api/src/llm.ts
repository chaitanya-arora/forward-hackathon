import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * The single model-call abstraction (spec §1). This is the only file in the
 * codebase that knows which provider is in use — swapping to another provider
 * means rewriting `callModel` and nothing else.
 *
 * Retry/backoff for rate limits (spec §3.6) is handled by the SDK's own
 * `maxRetries`, which retries 429/5xx with exponential backoff. Do not
 * hand-roll a retry loop on top of it.
 */

export const MODELS = {
  /** High-volume extraction: one call per ~4000-char chunk. */
  extraction: process.env.EXTRACTION_MODEL ?? "claude-opus-5",
  /** Report prose: the narratives are the actual deliverable. */
  narrative: process.env.NARRATIVE_MODEL ?? "claude-opus-5",
} as const;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ maxRetries: 3 });
  }
  return client;
}

export class ModelError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ModelError";
  }
}

export interface CallModelOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  model?: string;
  /** Lower effort for bulk extraction; leave default where prose quality matters. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

export async function callModel<T>(opts: CallModelOptions<T>): Promise<T> {
  const { system, user, schema, model = MODELS.extraction, effort, maxTokens = 16000 } = opts;

  try {
    const message = await getClient().messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(schema),
        ...(effort ? { effort } : {}),
      },
      messages: [{ role: "user", content: user }],
    });

    if (message.stop_reason === "refusal") {
      throw new ModelError(
        `Model declined the request (${message.stop_details?.category ?? "unspecified"}).`,
      );
    }

    if (message.parsed_output == null) {
      throw new ModelError(
        `Model returned no parseable output (stop_reason: ${message.stop_reason}).`,
      );
    }

    return message.parsed_output;
  } catch (err) {
    if (err instanceof ModelError) throw err;
    if (err instanceof Anthropic.RateLimitError) {
      throw new ModelError("Rate limited by the Claude API after retries.", err);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ModelError("ANTHROPIC_API_KEY is missing or invalid.", err);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new ModelError("Could not reach the Claude API.", err);
    }
    throw new ModelError(err instanceof Error ? err.message : String(err), err);
  }
}

/**
 * Run `tasks` with bounded concurrency. Agent 1 issues one call per chunk;
 * the spec's 30s-2min estimate assumes these run sequentially. A cap of 5
 * brings a 63-page document down to roughly 20-30s while staying well inside
 * rate limits.
 */
export async function mapWithConcurrency<In, Out>(
  items: In[],
  limit: number,
  fn: (item: In, index: number) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}
