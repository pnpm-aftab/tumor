# Architecture

How the Math Tutor backend system works — components, relationships, data flows, invariants.

**What belongs here:** High-level system design. Workers reference this for context on how things fit together.

---

## System Overview

```
macOS Client → POST /api/tutor → Express Server → OpenRouter LLM (GPT-4o)
                                       ↓                    ↓
                                  Schema Validation    Symbolic Verification
                                  (zod)                (mathjs + nerdamer)
                                       ↓                    ↓
                                   Fallback defaults    verification object
                                       ↓
                                   JSON Response → Client
```

## Components

### Express Server (`server.js`)
- Single endpoint: `POST /api/tutor`
- Middleware: CORS, JSON body parser (10MB limit), global error handler
- Stateless — no session management

### LLM Integration (`callLLM`)
- Uses OpenAI SDK pointed at OpenRouter (`baseURL: https://openrouter.ai/api/v1`)
- Model configurable via `LLM_MODEL` env var
- Supports multimodal: text + base64 image
- System prompt instructs: structured JSON output, LaTeX extraction from images, confidence self-assessment
- `response_format: { type: "json_object" }` for structured output

### Schema Validation (zod)
- Validates LLM JSON against expected tutoring response schema
- Fills missing fields with defaults (empty strings, empty arrays, "low" confidence)
- Never crashes on malformed LLM output

### Symbolic Verification (`verifyMath`)
- **Algebra**: Uses mathjs for simplification, expression equivalence checking. Uses nerdamer for equation solving.
- **Calculus**: Uses mathjs `derivative()` for derivatives. Uses nerdamer for integration.
- **Scope**: Linear equations, quadratic equations, simplification, derivatives, basic integrals
- **Degradation**: Returns `{ status: "partial", notes: [...] }` for out-of-scope problems. Returns `null` when no verification is possible.
- **Timeout**: Verification has a timeout (5s) to avoid blocking on complex expressions.

### Request Validation
- `questionText`: required, string, non-empty, max 2000 chars
- `screenshotImage`: optional, valid base64 when present
- `action`: optional, one of `"simpler"`, `"detailed"`, or null
- Returns 400 with descriptive JSON error for invalid requests

## Data Flow

1. Client sends POST with questionText, optional screenshotImage, optional action
2. Server validates request fields
3. Server calls LLM via OpenRouter with appropriate system prompt (modified by action)
4. LLM returns JSON
5. Schema validation validates/fills the LLM response
6. Symbolic verification runs against parsedExpressionLatex and finalAnswer
7. Response assembled and returned to client

## Key Invariants

- API is stateless — no session state between requests
- Every response has the same top-level shape (7 keys)
- Verification is best-effort — partial/failed status is acceptable
- Error responses never contain stack traces or API key names
- Mock mode works without OPENROUTER_API_KEY for testing
