# macOS Math Tutor

A menu bar macOS math tutor with a floating session panel and a Node.js backend for solving, explaining, and verifying algebra/calculus work.

## Current Status

The project is in a strong MVP state, but not fully finished.

- The macOS client builds successfully with Swift Package Manager.
- The backend test suite is passing end to end.
- Text, screenshot-assisted, refinement, and audio-transcription flows are implemented.
- Some client-facing UX/docs are still catching up with the implementation.

Verified locally on April 21, 2026:

- `swift build` succeeded
- `cd backend && npm test` succeeded

Known gaps:

- Recent questions are persisted locally, but are not currently surfaced in the visible client UI.
- The menu bar "Capture Screen" entry currently opens the text session flow rather than a distinct screen-configured session.
- The repo still contains uncommitted in-progress work.

## Architecture

```text
client/   SwiftUI macOS app
backend/  Node.js/Express tutoring API
```

### Client

The macOS app includes:

- `MenuBarExtra` entry point for starting text, audio, and screen-context sessions
- A borderless floating `NSPanel` session UI
- Text input and automatic full-screen context capture on submit
- Audio recording with backend transcription
- Rich result rendering with Markdown explanations and KaTeX math
- Refinement actions for simpler and more detailed explanations
- Verification status display and copy actions
- Global hotkeys and recent-question persistence

Current UX caveats:

- Recent questions are stored in `UserDefaults`, but there is no visible list in the current session UI.
- Screen capture is primarily controlled from the in-session capture-mode toggle.

Key files:

- `client/MathTutorApp.swift` - menu bar app entry point
- `client/MathTutorAppDelegate.swift` - app lifecycle and session startup
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

- OpenAI-compatible chat completion support via the OpenAI SDK
- Optional direct OpenAI Whisper transcription for audio uploads
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
  "audioFile": "base64-encoded-audio-or-null",
  "action": "simpler"
}
```

Notes:

- `questionText` is required, must be a non-empty string, and is limited to 2000 characters.
- `screenshotImage` is optional and must be valid base64 if present.
- `audioFile` is optional and must be valid base64 if present.
- `action` is optional and may be `simpler` or `detailed`.

Response shape:

```json
{
  "problemSummary": "Solving the equation 2x + 3 = 7",
  "parsedExpressionLatex": "2x + 3 = 7",
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
| `OPENROUTER_API_KEY` | unset | Enables OpenRouter-backed tutoring calls and current mock-mode check |
| `OPENAI_API_KEY` | unset | Enables direct OpenAI chat completions when preferred |
| `LLM_MODEL` | provider-dependent | Model identifier passed to the selected provider |
| `PORT` | `3000` | Backend port |

Behavior notes:

- In practice, mock mode is currently keyed off `OPENROUTER_API_KEY` in `shouldUseMockMode()`.
- Chat completions use `OPENAI_API_KEY` when set, otherwise fall back to `OPENROUTER_API_KEY`.
- Audio transcription currently calls the OpenAI transcription endpoint through the OpenAI SDK and only runs when a valid API key is configured.

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

### macOS Client

From the repo root:

```bash
swift build
swift run MathTutor
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

There are also standalone diagnostic scripts in `backend/` for focused manual checks.

## Hotkeys And UX

The app uses a menu bar entry as the primary launcher and opens a temporary floating session component after a session begins.

Configured global hotkeys:

- menu bar shortcuts for starting text, audio, and screen-context sessions
- additional global Carbon hotkeys registered in `client/HotkeyManager.swift`

If you change hotkeys, update both:

- `client/HotkeyManager.swift`
- `client/HotkeyConstants.swift`

## Repository Notes

- `todo.md` tracks implementation milestones, but a few items are only partially complete and are called out there.
- `math-tutor-prd.md` contains the original product requirements.
- The repo currently contains uncommitted in-progress work, especially in `backend/server.js` and the client app tree.
