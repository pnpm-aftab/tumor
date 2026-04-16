---
name: backend-worker
description: Implements backend features for the Math Tutor API — request validation, LLM integration, symbolic verification, schema validation, and error handling.
---

# Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

All backend implementation features: API endpoint changes, LLM integration, symbolic verification, schema validation, OCR/prompt engineering, error handling, and test writing. This worker handles everything in `backend/`.

## Required Skills

None. All work is done with file editing tools and shell commands.

## Work Procedure

### 1. Read Context (REQUIRED FIRST)
Read these files before starting ANY implementation:
- `{missionDir}/validation-contract.md` — understand what assertions this feature must satisfy
- `{missionDir}/AGENTS.md` — boundaries, conventions, testing guidance
- `.factory/library/architecture.md` — how the system works
- `.factory/library/environment.md` — env vars and dependencies
- `backend/server.js` — current implementation state

### 2. Write Tests First (TDD — RED)
- Write failing tests BEFORE implementation
- Tests go in `backend/tests/` organized by category:
  - `backend/tests/contract/` — request/response shape validation
  - `backend/tests/verification/` — symbolic math verification unit tests
  - `backend/tests/integration/` — full API flows (require OPENROUTER_API_KEY)
  - `backend/tests/error-handling/` — error scenarios with mocked LLM
- Use Node.js built-in test runner: `const { describe, it } = require('node:test'); const assert = require('node:assert');`
- Each test file should be self-contained and runnable with `node --test`
- Run tests to confirm they FAIL: `cd backend && node --test tests/{category}/your-test.js`

### 3. Implement (GREEN)
- Implement the minimum code to make tests pass
- All code goes in `backend/server.js` or new modules in `backend/`
- Follow CommonJS conventions (`require`/`module.exports`)
- Run tests to confirm they PASS: `cd backend && npm test`

### 4. Manual Verification
- Start the server: `cd backend && node server.js`
- Test with curl against the specific endpoint/behavior
- Verify error cases return correct status codes
- Check that responses have the expected JSON shape
- Kill the server when done: `lsof -ti :3000 | xargs kill`

### 5. Run Full Test Suite
- Run `cd backend && npm test` to ensure nothing is broken
- If any tests fail, fix them before committing

### 6. Commit
- Stage only relevant files (tests + implementation)
- Write a descriptive commit message referencing the feature

## Key Implementation Guidelines

### LLM Integration (OpenRouter)
```javascript
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});
// Model from env var:
const model = process.env.LLM_MODEL || 'openai/gpt-4o';
```

### Schema Validation (zod)
- Define a zod schema matching the TutoringResult type
- Parse LLM response through schema
- Provide sensible defaults for missing fields
- Set confidence to "low" when defaults are used
- Never crash on malformed LLM output

### Symbolic Verification (mathjs + nerdamer)
- **Algebra**: Use mathjs for simplification/equivalence, nerdamer for solving
- **Calculus**: Use mathjs `derivative()` for derivatives, nerdamer for integrals
- **Timeout**: Wrap verification in a timeout (5s) to avoid blocking
- **Degradation**: Return `{ status: "partial", notes: [...] }` for unsupported problems
- **Null**: Return `null` for verification when no symbolic check is possible

### Request Validation
- `questionText`: required, string, non-empty, max 2000 chars
- `screenshotImage`: optional, valid base64 when present
- `action`: optional, one of `"simpler"`, `"detailed"`, or absent/null
- Return 400 with `{ "error": "..." }` for validation failures

### Error Handling
- Never expose stack traces or API key names in error responses
- Use global error handler middleware
- Handle `process.on('uncaughtException')` and `process.on('unhandledRejection')`
- All error responses must be JSON: `{ "error": "..." }`

### Mock Mode
- When `OPENROUTER_API_KEY` is not set, use mock responses
- Mock mode must produce valid response shapes for testing
- Mock mode must NOT make network calls

## Example Handoff

```json
{
  "salientSummary": "Implemented request validation (questionText required, max 2000 chars, valid action enum), schema validation with zod for LLM responses with fallback defaults, and 15 contract tests covering all validation cases. All tests pass.",
  "whatWasImplemented": "Added zod schema validation to server.js with TutoringResult schema. Added request validation middleware checking questionText (required, string, non-empty, max 2000 chars), screenshotImage (valid base64), and action (enum validation). Added fallback defaults for missing LLM fields. Created 15 tests in backend/tests/contract/.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd backend && npm test", "exitCode": 0, "observation": "All 15 contract tests passed" },
      { "command": "curl -X POST http://localhost:3000/api/tutor -H 'Content-Type: application/json' -d '{}'", "exitCode": 0, "observation": "Returned 400 with error about missing questionText" },
      { "command": "curl -X POST http://localhost:3000/api/tutor -H 'Content-Type: application/json' -d '{\"questionText\": \"1+1\"}'", "exitCode": 0, "observation": "Returned 200 with valid response shape" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "backend/tests/contract/request-validation.test.js",
        "cases": [
          { "name": "rejects missing questionText", "verifies": "VAL-API-001" },
          { "name": "rejects non-string questionText", "verifies": "VAL-API-002" },
          { "name": "accepts without screenshotImage", "verifies": "VAL-API-003" },
          { "name": "rejects invalid base64 screenshotImage", "verifies": "VAL-API-004" },
          { "name": "rejects invalid action values", "verifies": "VAL-API-005" },
          { "name": "rejects questionText over 2000 chars", "verifies": "VAL-API-014" },
          { "name": "handles Unicode in questionText", "verifies": "VAL-API-015" }
        ]
      },
      {
        "file": "backend/tests/contract/response-shape.test.js",
        "cases": [
          { "name": "response has all required keys", "verifies": "VAL-API-006" },
          { "name": "steps array is valid", "verifies": "VAL-API-007" },
          { "name": "confidence is valid enum", "verifies": "VAL-API-008" },
          { "name": "verification has correct shape", "verifies": "VAL-API-009" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires changes to `client/` directory (out of scope)
- npm install fails for a required dependency
- The verification engine needs architectural decisions beyond the feature scope
- Express 5 specific behavior blocks implementation and needs orchestrator guidance
