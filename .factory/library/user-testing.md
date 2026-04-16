# User Testing

Testing surface, required tools, and validation approach for the Math Tutor backend.

**What belongs here:** Testing surface findings, required testing skills/tools, resource cost classification.
**What does NOT belong here:** Implementation details (use `architecture.md`).

---

## Validation Surface

**Surface:** Backend HTTP API (`POST /api/tutor`)
**Tool:** `curl` and Node.js test scripts (`node --test`)
**Setup:** Start backend with `node server.js`, run tests with `npm test`

No browser or GUI testing needed — this is a backend-only mission.

### Test Categories
1. **Contract tests**: Validate request/response shape, error codes. Work without API key.
2. **Verification tests**: Unit tests for mathjs/nerdamer symbolic computation. No API key needed.
3. **Integration tests**: Full API flows with real LLM. Require OPENROUTER_API_KEY.
4. **Error handling tests**: Mock LLM failures, malformed responses. No API key needed.

### Test Runner
- Node.js built-in test runner: `node --test`
- Configured via `npm test` in package.json

## Validation Concurrency

**Max concurrent validators:** 5
**Rationale:** Backend API is lightweight. Each validator runs Node.js test scripts that make HTTP requests to localhost:3000. No heavy resource consumption. The machine has 10 CPUs and 24 GB RAM. 5 concurrent validators would use < 500 MB total.
