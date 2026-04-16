# OpenRouter API Compatibility Research

## Summary

OpenRouter (openrouter.ai) is a unified API gateway that provides access to 300+ AI models through a single OpenAI-compatible endpoint. It is a near drop-in replacement for the OpenAI API.

---

## 1. Drop-in Replacement via baseURL + apiKey?

**Yes.** OpenRouter implements the OpenAI API specification (`/chat/completions`). The official OpenAI SDK for Node.js works by simply changing `baseURL` and `apiKey`.

From the [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart):

```js
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
  defaultHeaders: {
    'HTTP-Referer': '<YOUR_SITE_URL>',    // optional, for leaderboard attribution
    'X-OpenRouter-Title': '<YOUR_SITE_NAME>', // optional, for leaderboard attribution
  },
});

const completion = await openai.chat.completions.create({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## 2. Correct baseURL

```
https://openrouter.ai/api/v1
```

This is the single endpoint. It handles `/chat/completions`, `/completions`, `/models`, etc.

## 3. JSON Mode Support (`response_format: { type: "json_object" }`)

**Yes, supported.** From the [API Parameters docs](https://openrouter.ai/docs/api/reference/parameters):

> `response_format` — Forces the model to produce specific output format. Setting to `{ "type": "json_object" }` enables JSON mode, which guarantees the message the model generates is valid JSON.
>
> **Note**: when using JSON mode, you should also instruct the model to produce JSON yourself via a system or user message.

OpenRouter also supports `json_schema` structured outputs (more strict schema enforcement) for compatible models:

```js
response_format: {
  type: "json_schema",
  json_schema: {
    name: "my_schema",
    strict: true,
    schema: { /* JSON Schema definition */ }
  }
}
```

Models supporting structured outputs include: GPT-4o and later, Google Gemini models, Anthropic Sonnet 4.5+/Opus 4.1+, most open-source models, and all Fireworks-provided models.

## 4. Vision / Image Inputs (Multimodal)

**Yes, supported.** From the [Image Inputs docs](https://openrouter.ai/docs/guides/overview/multimodal/images):

- Images can be sent via the `image_url` content type in the multi-part `messages` array
- Supports both **URLs** and **base64-encoded data** (e.g., `data:image/png;base64,...`)
- Supported formats: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- The format is identical to OpenAI's vision API

Example (identical to current server.js usage):
```js
messages: [{
  role: "user",
  content: [
    { type: "text", text: "Analyze this math problem." },
    { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
  ]
}]
```

**Recommendation**: Send the text prompt first, then images, for best results.

## 5. Available Models (Good at Math)

OpenRouter uses a **provider-prefixed model naming convention** (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4.6`, `deepseek/deepseek-chat-v3`).

### Best Models for Math (as of April 2026)

| Model Slug | Notes |
|---|---|
| `openai/gpt-4o` | Direct equivalent of what's currently used |
| `openai/o3-mini` | Strong reasoning, good for math |
| `openai/o4-mini` | Latest reasoning model |
| `anthropic/claude-sonnet-4.6` | Strong general reasoning |
| `deepseek/deepseek-r1` | Excellent at math reasoning, open-source |
| `deepseek/deepseek-chat-v3` | Strong general model, cost-effective |
| `google/gemini-3-flash-preview` | Fast, good at math, supports vision |
| `google/gemini-2.5-pro` | Strong reasoning model |

### Free Models (for testing)

- `deepseek/deepseek-chat-v3:free` — Free tier of DeepSeek V3
- `meta-llama/llama-3.3-70b-instruct:free` — Free Llama model
- Free models have rate limits: 50 req/day (or 1000 if you've purchased ≥$10 credits)

Full model list: https://openrouter.ai/models

## 6. Gotchas and Differences

### Model Names Must Be Prefixed
Model names use `provider/model` format (e.g., `openai/gpt-4o`, not just `gpt-4o`). However, the prefix is actually optional for well-known models — `gpt-4o` will work too.

### Optional Headers for Attribution
```js
defaultHeaders: {
  'HTTP-Referer': '<YOUR_SITE_URL>',
  'X-OpenRouter-Title': '<YOUR_SITE_NAME>',
}
```
These are optional and only used for app attribution on OpenRouter's leaderboard.

### Pricing
- OpenRouter **passes through provider pricing** — no markup on inference.
- A 5.5% fee (minimum $0.80) is charged when purchasing credits.
- Credits are prepaid; no auto-billing.

### Credit System
- Prepaid credits only. Add funds at https://openrouter.ai/settings/credits
- Credits may expire after 1 year of inactivity.

### Provider Routing & Fallbacks
- OpenRouter automatically falls back to alternative providers if one is unavailable.
- You can control provider selection via `provider` preferences in requests.
- Model variants: `:nitro` (fastest), `:floor` (cheapest), `:thinking` (reasoning enabled).

### Streaming
- Fully supported via SSE (`stream: true`), identical to OpenAI.

### Rate Limits
- Free models: 50 req/day (or 1000 if ≥$10 in credits purchased).
- Paid models: No hard limits; throttling based on credit balance.

### Privacy
- Prompts/completions are **not logged by default**.
- Opt-in logging gives a 1% discount.

---

## Specific Code Changes for server.js

The current `server.js` at `/Users/aftab/Documents/bob-the/codex-proj/backend/server.js` uses the OpenAI SDK with `gpt-4o`. Here are the minimal changes needed:

### Change 1: Update the OpenAI client initialization

**Before** (line ~72):
```js
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
```

**After**:
```js
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});
```

### Change 2: Update the model name

**Before** (line ~97):
```js
model: "gpt-4o",
```

**After**:
```js
model: process.env.LLM_MODEL || "openai/gpt-4o",
```

### Change 3: Update environment variable check

**Before** (line ~23):
```js
if (process.env.OPENAI_API_KEY) {
```

**After**:
```js
if (process.env.OPENROUTER_API_KEY) {
```

### Change 4: Update `.env` file

```env
# Remove or comment out:
# OPENAI_API_KEY=sk-...

# Add:
OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL=openai/gpt-4o
```

### Full Diff Summary

Only 3 lines change in `server.js`:
1. Client constructor: add `baseURL`, switch `apiKey` env var
2. Model name: add env var with fallback
3. Feature flag check: switch env var name

Everything else — `response_format`, `messages` structure, vision/image inputs — works identically with no changes needed.
