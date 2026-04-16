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

## Flow Validator Guidance: Backend API

**Isolation:** The backend API is stateless by design. Each HTTP request is independent with no shared state between requests. Tests can run concurrently without interference.

**Testing approach:** Each validator group runs Node.js test scripts (`node --test`) against the running backend server on localhost:3000. Tests make HTTP requests and assert on response codes, headers, and JSON bodies.

**No shared database state:** The backend doesn't use a database for this mission — all state is in the request itself (questionText, screenshotImage, action). Therefore, concurrent tests won't interfere with each other's data.

**Resource boundaries:** Each validator should:
- Use only its assigned test file(s)
- Not modify the backend server or its configuration
- Not create files outside the evidence directory
- Stop cleanly after completion

**Verification:** All tests must exit with code 0. Any non-zero exit indicates failure.
