// One queue per Node process, shared by extraction and both report generators.
// Multiple processes still share provider quotas: run a single worker on a low tier.
function payload(error) {
  try { return JSON.parse(error?.message); } catch { return {}; }
}
function statusCode(error) {
  const body = payload(error);
  for (const value of [error?.status, error?.statusCode, error?.response?.status, error?.code, body?.error?.code]) {
    const number = Number(value);
    if (number >= 100 && number <= 599) return number;
  }
  if (error?.status === "RESOURCE_EXHAUSTED" || body?.error?.status === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED/.test(error?.message ?? "")) return 429;
  return null;
}
export function classifyGeminiError(error) {
  return statusCode(error) === 429 ? "AI_QUOTA_EXHAUSTED" : null;
}
export function isTransient(error) {
  const status = statusCode(error);
  if (status !== null) return status === 408 || status === 429 || status >= 500;
  const codes = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET"];
  return codes.includes(error?.code) || codes.includes(error?.cause?.code);
}
function duration(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value * 1000 : null;
  if (typeof value === "string" && /^\d+(\.\d+)?s?$/.test(value.trim())) return parseFloat(value) * 1000;
  if (value && typeof value === "object" && value.seconds != null) {
    const milliseconds = Number(value.seconds) * 1000 + Number(value.nanos ?? 0) / 1e6;
    return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : null;
  }
  return null;
}
export function providerRetryDelayMs(error, now = Date.now()) {
  const delays = [];
  for (const headers of [error?.headers, error?.response?.headers]) {
    const value = typeof headers?.get === "function" ? headers.get("retry-after") : headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (value != null) {
      const numeric = duration(value);
      const dateDelay = typeof value === "string" ? Date.parse(value) - now : NaN;
      if (numeric !== null) delays.push(numeric);
      else if (Number.isFinite(dateDelay)) delays.push(Math.max(0, dateDelay));
    }
  }
  const seen = new Set();
  function visit(object, depth = 0) {
    if (!object || typeof object !== "object" || depth > 6 || seen.has(object)) return;
    seen.add(object);
    for (const [key, value] of Object.entries(object)) {
      if (["retryDelay", "retry_delay"].includes(key)) {
        const milliseconds = duration(value);
        if (milliseconds !== null) delays.push(milliseconds);
      } else if (value && typeof value === "object") visit(value, depth + 1);
    }
  }
  visit(error); visit(payload(error));
  return delays.length ? Math.max(...delays) : null;
}
function withHint(error, hint) {
  try { if (error && typeof error === "object" && Object.isExtensible(error)) error.geminiHint = hint; } catch { /* Preserve original provider error. */ }
  return error;
}

export function createGeminiRequester({
  minIntervalMs = Number(process.env.GEMINI_MIN_REQUEST_INTERVAL_MS ?? 15000),
  maxRetries = Number(process.env.GEMINI_MAX_RETRIES ?? 3),
  maxRetryDelayMs = Number(process.env.GEMINI_MAX_RETRY_DELAY_MS ?? 60000),
  baseDelayMs = 2000, maxBackoffMs = 30000, jitterMs = 500, safetyBufferMs = 250,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random,
  onRetry = () => {},
} = {}) {
  for (const [key, value] of Object.entries({ minIntervalMs, maxRetries, maxRetryDelayMs, baseDelayMs, maxBackoffMs, jitterMs, safetyBufferMs })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid Gemini configuration: ${key}.`);
  }
  if (maxRetries > 10) throw new TypeError("GEMINI_MAX_RETRIES cannot exceed 10.");
  let tail = Promise.resolve();
  let nextStart = -Infinity;
  let terminalQuotaError = null;
  let physicalCalls = 0;
  async function execute(call) {
    if (terminalQuotaError) throw terminalQuotaError;
    let retryAt = -Infinity;
    for (let attempt = 0; ; attempt++) {
      if (physicalCalls >= 20) throw new Error("Gemini process budget reached: 20 API attempts including retries. Saved extraction remains available. Check your project daily usage before restarting.");
      let wait = Math.max(nextStart, retryAt) - now();
      while (wait > 0) {
        await sleep(Math.min(wait, 60000));
        wait = Math.max(nextStart, retryAt) - now();
      }
      nextStart = now() + minIntervalMs;
      physicalCalls++;
      try { return await call(); }
      catch (error) {
        if (!isTransient(error)) throw error;
        let details = error?.message ?? "";
        try { details += JSON.stringify(error?.details ?? {}); } catch { /* Circular SDK metadata is not needed for retry classification. */ }
        const quota = statusCode(error) === 429;
        if (quota && /daily|per.?day/i.test(details)) {
          terminalQuotaError = withHint(error, "Daily quota appears exhausted. Wait for the provider reset; this process will not send further requests.");
          throw terminalQuotaError;
        }
        if (attempt >= maxRetries) throw withHint(error, `Gemini retries exhausted after ${attempt + 1} attempts. Check project/model quotas and retry later; no successful report was fabricated.`);
        const providerDelay = providerRetryDelayMs(error, now());
        const fallback = Math.min(maxBackoffMs, baseDelayMs * 2 ** attempt) + Math.floor(Math.max(0, Math.min(1, random())) * jitterMs);
        const delay = providerDelay === null ? fallback : Math.ceil(providerDelay + safetyBufferMs);
        if (delay > maxRetryDelayMs) {
          const failure = withHint(error, "Provider retry delay exceeds the configured wait budget. Retry after the requested delay; requests will not be sent earlier.");
          if (quota) terminalQuotaError = failure;
          throw failure;
        }
        retryAt = now() + delay;
        try { onRetry({ attempt: attempt + 1, delayMs: Math.max(delay, nextStart - now()), providerDelay: providerDelay !== null }); } catch { /* Logging must not change retry behavior. */ }
      }
    }
  }
  return call => {
    const result = tail.then(() => execute(call));
    // One failure must not poison the queue for a later run (except explicit daily quota).
    tail = result.catch(() => {});
    return result;
  };
}

let liveRequester;
export async function requestGemini(ai, request, options = {}) {
  // Disable SDK-level retries so every physical retry passes through this queue.
  const pacedRequest = { ...request, config: { ...request.config,
    httpOptions: { ...request.config?.httpOptions, retryOptions: { attempts: 1 } },
  } };
  const call = () => ai.models.generateContent(pacedRequest);
  if (options.requester) return options.requester(call);
  // Explicitly injected test clients do not consume a live clock or quota budget.
  if (options.client) return call();
  liveRequester ??= createGeminiRequester({ onRetry: ({ attempt, delayMs }) => console.error(`Gemini transient failure; retry ${attempt} waits at least ${Math.ceil(delayMs / 1000)}s.`) });
  return liveRequester(call);
}
