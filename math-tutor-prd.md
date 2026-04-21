# PRD: macOS Math Tutor With Floating White-Paper Panel

## Overview
This product is a lightweight macOS desktop tutor for mathematics, inspired by the interaction model of `clicky` but intentionally much simpler. A learner opens the app from the menu bar, asks a math question in text, optionally captures a screen region containing the problem, and receives a structured step-by-step explanation in a floating white-paper panel.

The product is designed for education first. Its purpose is not just to produce answers, but to teach the reasoning behind them in a format that feels like a worked solution on paper.

## Product Goal
Help students understand algebra and basic calculus problems through fast, visual, step-by-step AI tutoring on macOS.

## Success Criteria
- A user can submit a typed or screenshot-based math question in under 15 seconds
- The app returns a readable structured explanation with rendered equations
- The explanation is useful as a teaching artifact, not just a final answer
- The floating white-paper panel feels persistent and usable alongside other study materials
- The system is reliable enough on scoped math problems that users trust it for guided practice

## Target User
Primary user:
- College STEM students working on algebra and introductory calculus

Secondary user:
- Advanced high school students taking precalculus or calculus

## Key Use Cases
1. A student types an equation and asks for an explanation
2. A student screenshots a worksheet, PDF, or homework platform question and asks the app to solve it
3. A student reviews the full derivation in a side panel while continuing to work in another app
4. A student asks for a simpler explanation or a more detailed explanation of the same result

## Product Principles
- Tutor, not answer bot
- Math should be visually clear and easy to follow
- The interaction should be quick and lightweight
- Scope should stay deliberately narrow in v1
- Trust matters more than breadth

## Scope For V1
### In scope
- macOS-only app
- Menu bar popover entry point
- Text input for math questions
- Native area-selection screenshot capture
- OCR/math extraction from screenshot
- Hosted multimodal model for solution generation
- Floating white-paper explanation panel
- Full derivation shown immediately
- Rendered LaTeX equations
- Selective symbolic verification for some algebra and calculus tasks
- Actions to re-explain simply, expand detail, copy answer, and copy full explanation

### Out of scope
- Voice input
- Voice output
- Cursor animation or pointer guidance
- Automatic full-screen capture
- Broad support for all college math domains
- Full computer algebra system
- Multi-user accounts
- Collaboration features
- Mobile or web clients
- Offline/local-model support in v1

## User Experience
### Entry flow
- User clicks the menu bar icon
- Popover opens with:
  - Question input box
  - Capture area button
  - Submit button
  - Recent questions list
- User types a question and optionally captures a screen area
- User submits

### Result flow
- The app opens or updates the floating white-paper panel
- The panel displays:
  - Problem restatement
  - Parsed equation if available
  - Ordered solution steps
  - Final answer
  - Short concept summary
  - Verification status if relevant

### Follow-up flow
- User can request:
  - Re-explain simpler
  - Show more detail
  - New question
  - Copy answer
  - Copy full explanation

## Functional Requirements
### 1. Question input
- The system must accept free-form typed math questions
- The system must allow optional screenshot-based input through area selection
- The system must support text-only queries without requiring image input

### 2. Screenshot capture
- The system must let the user select a screen region on macOS
- The system must attach the captured image to the tutoring request
- The system must not perform passive background capture

### 3. OCR and math extraction
- The system must extract readable text from screenshots
- The system should attempt to normalize detected equations into LaTeX
- The system must preserve the original screenshot as model input when OCR confidence is weak

### 4. Tutoring response generation
- The system must send text and optional image context to a hosted model
- The system must request a structured tutoring response rather than unconstrained prose
- The system must return:
  - Problem summary
  - Parsed expression LaTeX when available
  - Ordered explanation steps
  - Final answer
  - Concept summary
  - Confidence level
  - Verification status

### 5. Step rendering
- The system must render equations clearly using LaTeX
- The system must show the complete derivation immediately in v1
- The system must display step titles and explanations in a readable vertical layout

### 6. Verification
- The system must run symbolic verification on a limited subset of problems where feasible
- The system must surface verification state as passed, partial, or failed
- The system must avoid presenting unverified reasoning as definitely correct when checks fail

### 7. White-paper panel
- The system must present the explanation in a floating movable panel
- The panel must remain visible while the user works in other windows
- The panel must feel like a clean notebook/paper surface optimized for reading equations

### 8. Refinement actions
- The system must support "re-explain simpler"
- The system must support "show more detail"
- The system must support copying the final answer
- The system must support copying the full explanation

## Non-Functional Requirements
- The product should feel responsive for normal student workflows
- The panel UI should remain readable on common laptop screen sizes
- Math rendering should be visually stable and not degrade plain text explanations
- The system should degrade gracefully on low-confidence OCR or low-confidence solution cases
- Privacy expectations should be clear when screenshot capture is used

## Suggested System Design
### Client
Native macOS app in Swift/SwiftUI with the following responsibilities:
- Menu bar UX
- Area screenshot capture
- Floating panel window management
- Local state/history
- Request orchestration
- Rendering structured tutoring output

Suggested internal modules:
- `CaptureService`
- `OCRMathParseService`
- `TutorRequestService`
- `MathVerificationService`
- `PanelStateStore`

### Backend
A small API service with these responsibilities:
- Accept text plus optional image
- Call a hosted multimodal model
- Enforce response schema
- Run selective symbolic verification
- Return normalized tutoring JSON

## API / Interface Requirements
### Request shape
- `questionText: string`
- `screenshotImage?: binary | url`
- `ocrText?: string`
- `parsedLatex?: string`
- `problemTypeHint?: string`

### Response shape
- `problemSummary: string`
- `parsedExpressionLatex?: string`
- `steps: Step[]`
- `finalAnswer: string`
- `conceptSummary: string`
- `verification: { status: "passed" | "partial" | "failed", notes?: string[] }`
- `confidence: "low" | "medium" | "high"`

### Step type
- `title: string`
- `explanationMarkdown: string`
- `latex?: string`
- `stepType: string`

## Math Scope For V1
The system should explicitly optimize for:
- Algebraic simplification
- Solving single-variable equations
- Factoring and expansion
- Introductory derivatives
- Basic integrals
- Substitution and simplification steps common to early calculus

The system should not claim broad support for:
- Proof-heavy mathematics
- Abstract algebra
- Advanced linear algebra
- Differential equations
- Real analysis
- Symbolic manipulation beyond the verification subset

## Failure Modes And Expected Behavior
- If OCR is poor, the app should restate the detected problem and proceed cautiously
- If the model is uncertain, the response should communicate uncertainty
- If symbolic verification fails, the app should still show the explanation but include a warning state
- If parsing fails completely, the user should still receive a plain-language explanation attempt rather than a hard failure
- If screenshot permissions are unavailable, the app should still support text-only tutoring

## Acceptance Criteria
- A student can solve a text-based algebra problem end to end from the menu bar
- A student can capture a worksheet region and receive a structured explanation
- The white-paper panel consistently opens and remains usable beside other apps
- Rendered equations are readable and correctly placed in the derivation
- Verification status appears when checks are run
- Re-explain and more-detail actions produce meaningful alternate explanations

## Test Plan
### Core scenarios
- Text-only algebra equation
- Text-only derivative problem
- Screenshot of printed worksheet equation
- Screenshot of dense PDF math prompt
- Ambiguous OCR input
- Verification pass
- Verification partial/fail
- Re-explain simpler
- Show more detail
- Copy answer and copy explanation

### UI scenarios
- Popover opens from menu bar reliably
- Floating panel is movable and remains visible
- Panel content scrolls correctly for long derivations
- Layout remains readable on laptop-size displays

## Assumptions And Defaults
- macOS is the only target platform for v1
- The menu bar is the primary entry point
- The product is education-first and tutoring-first
- Full derivation is shown immediately rather than progressively revealed
- Hosted API is preferred over local inference in v1
- Selective symbolic verification is included, but only for a limited subset
- V1 is intentionally constrained to algebra and basic calculus for quality

## Open Product Risks
- OCR quality on handwritten or low-resolution math may be inconsistent
- LLM explanations may still skip steps unless strongly structured
- Verification coverage will be narrower than the explanation surface
- College-STEM expectations may exceed v1 scope if messaging is not explicit
