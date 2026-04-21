# tumor Implementation TODO

## Phase 1: Research & Setup

- [x] Research SwiftUI Menu Bar Extra (macOS 13+) vs standard Popover.

- [x] Research macOS Screen Capture APIs (ScreenCaptureKit or shell-based `screencapture`).

- [x] Research LaTeX rendering in SwiftUI (MathJax/KaTeX via WebView or native libs).

- [x] Set up project structure (Client and Backend).

## Phase 2: Backend API (Node.js/Express)

- [x] Initialize backend project.

- [x] Implement endpoint to receive text + image.

- [x] Integrate with LLM (OpenAI gpt-5.4-nano) for math tutoring.

- [x] Implement real symbolic verification for scoped algebra/calculus problems.

- [x] Define and enforce a strict response schema with validation and fallback handling.

- [x] Support stateless refinement requests that reuse the original question, screenshot context, and follow-up intent when the client re-sends them.

- [x] Add screenshot/image extraction handling with heuristic fallback for image input.

- [x] Add low-confidence handling for ambiguous screenshot parsing.

## Phase 3: macOS Client - Core UI

- [x] Create runnable Xcode macOS app project (via Swift Package Manager).

- [x] Replace the menu bar icon/popover entry point with a persistent floating bar launcher.

- [x] Refine the launcher into a true floating menu that stays visible above other apps.

- [x] Simplify the launcher input flow around text entry plus automatic screen context capture, without an explicit screenshot button.

- [x] Add launcher states that transition from a single-icon idle state to a multi-icon mode picker for screen, text, and audio.

- [x] Define the text state as the current input bar experience.

- [x] Add an audio state with a voice-memo-style animated recording view.

- [ ] Surface Recent Questions in the visible client UI (questions are persisted, but no list is currently shown).

## Phase 4: macOS Client - Features

- [x] Replace explicit area screenshot capture with automatic full-screen context capture.
- [x] Implement cursor area screen capture mode with an 800x800 highlight overlay.
- [x] Add toggle to switch between no capture, cursor area capture, and full-screen capture.

- [x] Capture the entire visible screen automatically when submitting a question.

- [x] Decide whether refinements should reuse the original screen capture or refresh screen context before each request.

- [x] Update image preview/handling to reflect automatic screen context instead of manual screenshots.

- [x] Connect client to Backend API.

- [x] Redesign the frontend as a modern, smooth, minimal notebook-page simulation that makes the app intuitive to use.

- [x] Upgrade the typography to a more distinctive, premium font system that fits the notebook experience.

- [x] Refine the visual design into a stronger monochrome theme with better tonal contrast and restraint.

- [x] Overhaul the design system with a modern, "fluid" aesthetic featuring Glassmorphism, linear gradients, and a sophisticated Indigo/Violet accent palette.

- [x] Implement a central `Theme.swift` for design tokens and reusable modifiers (glassStyle, prominentShadow).
- [x] Update theme to modern Indigo/Violet palette with glass effects.

- [x] Implement a true floating "White-Paper" panel using panel-style window behavior.
- [x] Replace SwiftUI `Window` with custom `FloatingPanel` (NSPanel) for true borderless UI.
- [x] Implement `SessionPanelController` for lifecycle management of the floating UI.

- [x] Implement LaTeX rendering in the panel.
- [x] Bundle math rendering assets locally instead of relying on CDN-hosted KaTeX.
- [x] Render step explanations as rich Markdown instead of plain text.
- [x] Keep stable step identities for SwiftUI list rendering.
- [x] Add user-visible loading and error states for request/decode failures.

- [x] Add an audio preview button so the user can play back the final recorded prompt from the same app component before submission.

## Phase 5: Refinement & Actions

- [x] Implement "Re-explain simpler" and "Show more detail" actions.
- [x] Implement Copy Full Explanation.
- [x] Polish "White-Paper" aesthetic.
- [x] Add verification status indicators.
- [x] Add Copy Final Answer action.
- [x] Ensure refinement actions reuse the original question and captured image.
- [x] Show verification warnings only when checks are real and scoped.

## Phase 6: Testing & Validation

- [x] Verify the frontend builds successfully with Swift Package Manager.
- [x] Test with text-only algebra (Verified with test-backend.js).
- [x] Test full-screen automatic context capture with the tutoring flow.
- [x] Test screenshot-based calculus with a true OCR/extraction pipeline.
- [x] Test "Re-explain" functionality (Verified).

## UX Direction Change

- [x] Remove the persistent floating desktop launcher/buttons and restore the menu bar icon as the primary entry point.
- [ ] Make the menu bar screen entry start a distinct screen-oriented session flow instead of reusing plain text mode.
- [x] Show a temporary bottom-floating session component only after a session begins.
- [x] Add global hotkeys for starting sessions and dismissing the panel.
- [x] Ensure smooth morphing transitions between "Pill" and "Result Page" modes.
