# tumor

A menu bar macOS math app with a floating session panel and a Node.js backend for solving, explaining, and verifying algebra/calculus work.

## Current Status

The project is in a complete and verified state.

- The macOS client builds successfully with Swift Package Manager.
- The backend test suite is passing end to end (255 tests across 19 files).
- Text, screenshot-assisted, refinement, and audio-transcription flows are fully implemented.
- Symbolic verification is active for algebra (linear, quadratic, simplification) and calculus (derivatives, integrals).
- UI/UX features a modern Glassmorphism theme with a persistent notebook-page aesthetic.

Verified locally on April 30, 2026:

- `swift build` succeeded
- `cd backend && npm test` succeeded (255 tests passed across 19 test files)
- `backend/tests/integration/screenshot-calculus-ocr.test.js` verified OCR logic

## Architecture

```text
client/   SwiftUI macOS app
backend/  Node.js/Express tutoring API
```

### Client

The macOS app includes:

- `MenuBarExtra` entry point for starting text, audio, and screen-context sessions
- A borderless floating `NSPanel` session UI that morphs between "Pill" and "Result Page" modes
- Text input and automatic full-screen context capture on submit
- Audio recording with backend transcription and local preview playback
- Rich result rendering using `MathText` (Markdown + KaTeX)
- Refinement actions for simpler and more detailed explanations
- Symbolic verification status display and copy actions (Final Answer & Full Explanation)
- Global hotkeys (Cmd+Shift+T/A/1) and recent-question menu
- Visual cursor-area capture mode with a persistent 800x800 highlight overlay

Key files:

- `client/TumorApp.swift` - menu bar app entry point
- `client/TumorAppDelegate.swift` - app lifecycle and session startup
- `client/SessionView.swift` - primary session UI and result page
- `client/FloatingPanel.swift` - floating panel window behavior
- `client/MathService.swift` - client networking, history, and refinements
- `client/CaptureService.swift` - screen context capture modes
- `client/CursorHighlightManager.swift` - visual overlay for cursor area capture
- `client/AudioService.swift` - microphone recording
- `client/MathView.swift` - KaTeX rendering via `WKWebView`
- `client/Theme.swift` - app styling tokens and shared visual modifiers

### Backend

The backend accepts tutoring requests, optionally transcribes audio, validates and repairs model output, and runs symbolic verification.

Key features:

- Direct OpenAI Responses API support via the OpenAI SDK
- OpenRouter-compatible chat completions support for the fallback provider path
- Optional direct OpenAI transcription for audio uploads
- Zod request validation and response repair
- Heuristic fallback responses in mock mode or on some upstream failures
- Symbolic verification for linear equations, quadratics, simplification, derivatives, and integrals
- Screenshot/image handling with confidence-aware extraction behavior
- Stateless refinement requests
- Health endpoints and structured error handling

Key files:

- `backend/server.js` - Express API, model calls, validation, fallback logic
- `backend/verification.js` - symbolic verification engine
- `backend/tests/` - contract, integration, error-handling, and verification tests

## API

### `POST /api/tutor`

Request body:

```json
{
  "questionText": "Solve 2x + 3 = 7",
  "screenshotImage": "base64-encoded-image-or-null",
  "audioFile": "base64-encoded-audio-or-null"
}
```

Notes:

- `questionText` is required, must be a non-empty string, and is limited to 2000 characters.
- `screenshotImage` is optional and must be a string if present; the client sends base64-encoded image data.
- `audioFile` is optional and must be a string if present; the client sends base64-encoded audio data.
- Refinements are stateless client requests that resend the original question/context with a revised prompt.

Response shape:

```json
{
  "problemSummary": "Solving the equation 2x + 3 = 7",
  "parsedExpressionLatex": "2x + 3 = 7",
  "summary": "We isolated the variable by undoing addition first, then division. The equation simplifies to x = 2.",
  "steps": [
    {
      "title": "Isolate the variable",
      "explanationMarkdown": "Subtract 3 from both sides to keep the equation balanced.",
      "latex": "2x = 4",
      "stepType": "computation"
    }
  ],
  "finalAnswer": "x = 2",
  "conceptSummary": "Linear equations are solved by isolating the variable with inverse operations.",
  "confidence": "high",
  "verification": {
    "status": "passed",
    "notes": [
      "Substitution confirms the result."
    ]
  }
}
```

### Health Endpoints

- `GET /api/health`
- `GET /health`

Both return JSON with `status: "ok"` and a timestamp.

## Environment

Backend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | unset | Enables OpenRouter-backed tutoring calls |
| `OPENAI_API_KEY` | unset | Enables direct OpenAI Responses API calls when preferred |
| `LLM_MODEL` | provider-dependent | Model identifier passed to the selected provider |
| `PORT` | `3000` | Backend port |

Behavior notes:

- Mock mode is active when `NODE_ENV=test`, no provider key is set, or the selected key is blank/placeholder.
- `OPENAI_API_KEY` takes precedence over `OPENROUTER_API_KEY` when both are set.
- Direct OpenAI requests use the Responses API when `OPENAI_API_KEY` is set; the OpenRouter provider path uses chat completions for compatibility.
- Audio transcription currently calls the OpenAI transcription endpoint through the OpenAI SDK with `gpt-4o-mini-transcribe` and only runs when a valid API key is configured.
- The backend LLM timeout is 50 seconds, and the client request timeout is intentionally longer to avoid discarding late but valid responses.

## Running The Project

### Backend

```bash
cd backend
npm install
OPENROUTER_API_KEY=your_key_here node server.js
```

If you prefer:

```bash
cd backend
OPENAI_API_KEY=your_key_here node server.js
```

Or:

```bash
cd backend
node server.js
```

The backend listens on `http://localhost:3000` by default.

### Full Development Script

From the repo root:

```bash
./run-dev.sh
```

This loads `backend/.env` if present, installs backend dependencies when missing, starts the backend, waits for `/health`, and then runs the macOS app.

### macOS Client

From the repo root:

```bash
swift build
swift run tumor
```

Requirements:

- macOS 14+
- Xcode / Swift toolchain with Swift 5.9 support
- Screen Recording permission for screenshot-assisted use
- Microphone permission for audio sessions

The client currently targets `http://localhost:3000/api/tutor`.

## Testing

Backend tests use Node's built-in test runner and run sequentially through the `npm test` script.

```bash
cd backend
npm test
```

Examples:

```bash
cd backend
node --test tests/contract/request-validation.test.js
node --test tests/integration/e2e-flows.test.js
```

Coverage areas include:

- request validation
- response shape and schema repair
- concurrency and statelessness
- screenshot handling
- end-to-end tutoring flows
- symbolic verification
- error handling and recovery

Focused diagnostic coverage now lives under `backend/tests/verification/`.

## Hotkeys And UX

The app uses a menu bar entry as the primary launcher and opens a temporary floating session component after a session begins.

Configured global hotkeys:

- menu bar shortcuts for starting text, audio, and screen-context sessions
- additional global Carbon hotkeys registered in `client/HotkeyManager.swift`

If you change hotkeys, update both:

- `client/HotkeyManager.swift`
- `client/HotkeyConstants.swift`

## Repository Notes

- `todo.md` tracks implementation milestones.
- `math-tutor-prd.md` contains the original product requirements.
- `skills/` contains specialized agent skills for development (e.g., `swiftui-expert-skill`).
