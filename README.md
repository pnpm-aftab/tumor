# tumor

tumor is a native macOS menu bar app for math tutoring. It accepts typed questions, microphone input, and screen context, then returns step-by-step algebra and calculus explanations with structured verification from a local Node.js backend.

Repository: https://github.com/pnpm-aftab/tumor

## Features

- Native SwiftUI macOS menu bar app
- Floating tutoring panel for quick text, audio, and screen-context sessions
- Full-screen and cursor-area screenshot capture
- Audio recording with optional OpenAI transcription
- Markdown and KaTeX rendering for mathematical explanations
- Refinement actions for simpler or more detailed responses
- Local recent-question history
- Symbolic verification for linear equations, quadratics, simplification, derivatives, and integrals
- Provider support for direct OpenAI Responses API calls or OpenRouter-compatible chat completions
- Mock-mode fallback for local development and automated tests

## Project Structure

```text
client/       SwiftUI macOS app
backend/      Node.js/Express tutoring API and verification engine
docs/         Static landing page
skills/       Development assistant skills used by this repository
Package.swift Swift Package Manager manifest for the macOS app
run-dev.sh    Convenience script for local full-stack development
```

## Requirements

- macOS 14 or newer
- Xcode or Swift toolchain with Swift 5.9 support
- Node.js 20 or newer
- npm
- Screen Recording permission for screenshot-assisted questions
- Microphone permission for audio sessions

An API key is optional for local development. Without an app-provided key, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`, the backend runs in mock mode.

## Quick Start

Clone the repository:

```bash
git clone https://github.com/pnpm-aftab/tumor.git
cd tumor
```

Run the full development stack:

```bash
./run-dev.sh
```

The script installs backend dependencies when needed, loads `backend/.env` if present, starts the backend on `http://localhost:3000`, waits for `/health`, and launches the macOS menu bar app.

## Configuration

You can set an OpenAI or OpenRouter API key directly from the macOS menu bar app:

1. Open the tumor menu bar icon.
2. Select `Set API Provider & Key...`.
3. Choose `OpenAI` or `OpenRouter`.
4. Paste the key and save.

The app stores the selected provider and key in macOS Keychain and sends it only to the local tumor backend as request headers. This is the easiest option when running the bundled macOS client against the local backend.

Alternatively, create `backend/.env` for backend-level provider credentials:

```bash
OPENAI_API_KEY=your_openai_key
# or
OPENROUTER_API_KEY=your_openrouter_key

LLM_MODEL=your_model_name
OPENAI_MODEL=your_openai_model_name
OPENROUTER_MODEL=your_openrouter_model_name
PORT=3000
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | unset | Enables direct OpenAI Responses API calls and audio transcription |
| `OPENROUTER_API_KEY` | unset | Enables the OpenRouter-compatible provider path |
| `LLM_MODEL` | provider-dependent | Model identifier passed to the active provider |
| `OPENAI_MODEL` | `gpt-5.4-nano` | Optional model override for app-supplied OpenAI keys |
| `OPENROUTER_MODEL` | `openrouter/elephant-alpha` | Optional model override for app-supplied OpenRouter keys |
| `PORT` | `3000` | Backend HTTP port |

Provider behavior:

- An API key supplied by the app takes precedence for that request and uses the provider selected in the app.
- `OPENAI_API_KEY` takes precedence when both backend-level provider keys are set.
- OpenAI-backed tutoring calls use the Responses API.
- OpenRouter-backed tutoring calls use chat completions for compatibility.
- Audio transcription uses the OpenAI SDK with `gpt-4o-mini-transcribe` and requires a valid `OPENAI_API_KEY`.
- Mock mode is active in tests, when no provider key is set, or when a configured key is blank or placeholder-like.

## Running Manually

Install and start the backend:

```bash
cd backend
npm install
OPENAI_API_KEY=your_openai_key node server.js
```

Or run with OpenRouter:

```bash
cd backend
OPENROUTER_API_KEY=your_openrouter_key node server.js
```

Run in mock mode:

```bash
cd backend
node server.js
```

Start the macOS client from the repository root:

```bash
swift build
swift run tumor
```

The client currently sends tutor requests to `http://localhost:3000/api/tutor`.

## API

### `POST /api/tutor`

Request:

```json
{
  "questionText": "Solve 2x + 3 = 7",
  "screenshotImage": "base64-encoded-image-or-null",
  "audioFile": "base64-encoded-audio-or-null"
}
```

Response:

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
    "notes": ["Substitution confirms the result."]
  }
}
```

Request notes:

- `questionText` is required, must be a non-empty string, and is limited to 2000 characters.
- `screenshotImage` is optional and must be a base64-encoded string when present.
- `audioFile` is optional and must be a base64-encoded string when present.
- Refinement requests are stateless; the client resends the original question and context with a revised prompt.

### Health Checks

- `GET /health`
- `GET /api/health`

Both return JSON with `status: "ok"` and a timestamp.

## Testing

Run the backend test suite:

```bash
cd backend
npm test
```

Run selected tests:

```bash
cd backend
node --test tests/contract/request-validation.test.js
node --test tests/integration/e2e-flows.test.js
```

Build the macOS app:

```bash
swift build
```

Current verified baseline, checked locally on April 30, 2026:

- `swift build` passed
- `cd backend && npm test` passed
- Backend suite covered 255 tests across 19 test files

## macOS Permissions

tumor requests permissions only for features that need them:

- Screen Recording: required for screenshot-assisted tutoring
- Microphone: required for audio questions

If screenshot or audio capture fails, check macOS System Settings under Privacy & Security and relaunch the app after granting access.

## Key Files

Client:

- `client/TumorApp.swift` - menu bar app entry point
- `client/TumorAppDelegate.swift` - app lifecycle and session startup
- `client/SessionView.swift` - primary session UI and result page
- `client/FloatingPanel.swift` - floating panel window behavior
- `client/MathService.swift` - client networking, local history, and refinements
- `client/CaptureService.swift` - screen context capture modes
- `client/CursorHighlightManager.swift` - cursor-area capture overlay
- `client/AudioService.swift` - microphone recording
- `client/MathView.swift` - KaTeX rendering via `WKWebView`
- `client/Theme.swift` - app styling tokens and shared visual modifiers

Backend:

- `backend/server.js` - Express API, provider calls, validation, fallback logic, and response repair
- `backend/verification.js` - symbolic verification engine
- `backend/tests/` - contract, integration, error-handling, and verification coverage

## Hotkeys

The app uses a menu bar entry as the primary launcher and registers additional global Carbon hotkeys for fast session startup.

If hotkeys change, update both:

- `client/HotkeyManager.swift`
- `client/HotkeyConstants.swift`

## Landing Page

The static landing page lives in `docs/` and can be served by GitHub Pages or any static host.

For local preview:

```bash
cd docs
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment Notes

- The backend is stateless and can run behind a standard HTTP reverse proxy.
- Configure provider keys as environment variables in the target runtime.
- Keep request body limits aligned with expected screenshot and audio payload sizes.
- The macOS client currently assumes the backend is available at `http://localhost:3000/api/tutor`; update `client/MathService.swift` before distributing builds that should call a hosted backend.

## License

The backend package currently declares `ISC` in `backend/package.json`. Confirm the intended repository-level license before publishing release artifacts.
