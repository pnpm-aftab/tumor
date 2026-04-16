# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Required Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | Yes (for LLM) | — | OpenRouter API key for LLM calls |
| `LLM_MODEL` | No | `openai/gpt-4o` | Model name for completions |
| `PORT` | No | `3000` | Server port |

## External Dependencies

- **OpenRouter API**: `https://openrouter.ai/api/v1` — OpenAI SDK compatible, drop-in replacement
- No database, no Redis, no other services needed

## Dependency Quirks

- `nerdamer`: CommonJS compatible, no special setup needed
- `zod`: CommonJS compatible via `require('zod')`
- `mathjs`: Already installed, CommonJS compatible
- `openai` SDK: Used with OpenRouter baseURL, no special config needed
- `express` v5: Different error handling middleware than Express 4

## Notes

- Server starts without OPENROUTER_API_KEY (falls back to mock mode for testing)
- Mock mode generates hardcoded responses — no real LLM calls
- The `.env` file should be in `backend/` directory and is gitignored
