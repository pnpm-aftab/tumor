# Symbolic Math Libraries for Node.js — Research Findings

**Project:** macOS Math Tutor (codex-proj)  
**Date:** 2026-04-15  
**Goal:** Identify Node.js libraries for symbolic math verification covering **algebra** and **basic calculus** (derivatives, integrals). The backend already has `mathjs` installed.

---

## 1. mathjs (v15.2.0 — already installed)

**Status:** ✅ Actively maintained. Last published 2026-04-07. The gold standard for JS math libraries.

### Symbolic Capabilities

| Feature | Supported? | Details |
|---------|-----------|---------|
| Simplify expressions | ✅ Yes | `math.simplify('2x + 3x')` → `'5 * x'`. Supports custom rules, context-aware simplification. |
| Derivatives | ✅ Yes | `math.derivative('2x^2 + 3x + 4', 'x')` → `'4 * x + 3'`. Supports chain rule, trig, etc. |
| Rationalize | ✅ Yes | `math.rationalize('2x/y - y/(x+1)')` → canonical rational form. |
| Solve equations | ❌ No | No built-in `solve()` function. [Long-standing feature request (#38)](https://github.com/josdejong/mathjs/issues/38) still open. |
| Integrals | ❌ No | No built-in symbolic integration. [Feature request (#442)](https://github.com/josdejong/mathjs/issues/442) open since 2015. |
| LaTeX input | ❌ No | No native LaTeX parser. Requires external converter. |

### Verdict
**Excellent for simplification and derivatives.** Cannot solve equations or compute integrals natively. Already installed and reliable. Should be the foundation of the verification system.

---

## 2. algebra.js (v0.2.6)

**Status:** ❌ Archived. Repository archived by owner (nicolewhite) on May 23, 2019. Last commit June 2017.

### Capabilities

| Feature | Supported? | Details |
|---------|-----------|---------|
| Build expressions | ✅ Yes | Object-oriented API for building expressions and equations. |
| Solve equations | ✅ Yes (linear only) | `eq.solveFor("x")` — works for linear equations only. Can isolate variables through arithmetic. |
| Fractions | ✅ Yes | Built-in fraction support with exact arithmetic. |
| Calculus | ❌ No | No derivatives or integrals. |
| LaTeX output | ✅ Yes | Can convert expressions to LaTeX via `.toTex()`. |

### Verdict
**Not recommended.** Archived, unmaintained for 7+ years. Only handles linear equations. No calculus support. The API is clunky (object-oriented construction rather than string parsing).

---

## 3. mathsteps (v0.2.0 — Google/Socratic)

**Status:** ⚠️ Archived. Repository archived by Google on Aug 29, 2024. Last published on npm 8 years ago (Oct 2017).

### Capabilities

| Feature | Supported? | Details |
|---------|-----------|---------|
| Simplify expressions | ✅ Yes | Step-by-step simplification with change types. |
| Solve equations | ✅ Yes | `mathsteps.solveEquation('2x + 3x = 35')` with step-by-step output. |
| Step-by-step | ✅ Yes | Each step includes `oldNode`, `newNode`, `changeType`, and `substeps`. |
| LaTeX output | ✅ Yes | `print.latex()` converts nodes to LaTeX. |
| Calculus | ❌ No | No derivatives or integrals. |
| Scope | Limited | Pre-algebra and basic algebra only. No polynomials > degree 2. |

### Verdict
**Not recommended as primary library.** Archived and unmaintained. Limited to pre-algebra and basic algebra. No calculus. However, the step-by-step approach is interesting for future pedagogy features. Also depends on an older version of mathjs internally.

---

## 4. nerdamer (v1.1.13)

**Status:** ⚠️ Stale. Last published on npm 4 years ago (2022). GitHub repo exists but activity is minimal. No recent commits.

### Capabilities

| Feature | Supported? | Details |
|---------|-----------|---------|
| Simplify expressions | ✅ Yes | Automatic simplification on parse. |
| Solve equations | ✅ Yes | `nerdamer.solveEquations()` — supports linear systems, polynomials up to degree 3, and some transcendental equations. |
| Derivatives | ✅ Yes | `nerdamer('diff(x^2+2*(cos(x)+x*x), x)')` → `'-2*sin(x)+6*x'`. |
| Integrals | ✅ Yes | `nerdamer('integrate(cos(x)*x^6, x)')` — symbolic integration with configurable depth. Supports indefinite integrals. Has `hasIntegral()` to check completeness. |
| Factor/Expand | ✅ Yes | `nerdamer.expand()`, `nerdamer.factor()`. |
| Partial fractions | ✅ Yes | Via Algebra module. |
| LaTeX output | ✅ Yes | `nerdamer.expressions(true, true)` returns LaTeX. |
| Node.js/CommonJS | ✅ Yes | `var nerdamer = require('nerdamer'); require('nerdamer/Calculus');` |
| Multivariate | ✅ Partial | Polynomials up to degree 3 for multivariate. |
| Definite integrals | ❓ Unclear | Documentation focuses on indefinite integrals. |

### Module Structure
- **Core:** Expression evaluation
- **Algebra:** Factor, expand, polynomial operations
- **Calculus:** Differentiate, integrate
- **Solve:** Equation solving (depends on Algebra + Calculus)
- **Extra:** Additional functions

Load all modules:
```js
var nerdamer = require('nerdamer');
require('nerdamer/Algebra');
require('nerdamer/Calculus');
require('nerdamer/Solve');
require('nerdamer/Extra');
// Or: const nerdamer = require('nerdamer/all.min');
```

### Verdict
**Best available option for comprehensive symbolic math in JS.** Covers all four required operations: simplify, solve, derivatives, AND integrals. Stale but functional — the API is stable and the library works well for the scope we need (algebra + basic calculus). The main risk is long-term maintenance.

---

## 5. mathjs-simple-integral (v0.1.1)

**Status:** ❌ Abandoned. Last published 8 years ago (Jan 2018). Extends mathjs to add integration.

### Verdict
**Not recommended.** Abandoned, limited scope, and nerdamer already provides better integration support.

---

## 6. math-expressions (v2.0.0-alpha83)

**Status:** ✅ Active. Published 3 days ago. By the Doenet project.

### Capabilities
- Equality testing and symbolic computations on mathematical expressions
- Handles transcendental functions
- Very active development (alpha releases every few days)

### Verdict
**Worth watching but not production-ready.** Alpha status, and the library's primary focus appears to be equality testing rather than a full CAS. Not a drop-in replacement for our needs.

---

## 7. Calculess (npm)

**Status:** Basic calculus library. Numerical methods, not symbolic.

### Verdict
**Not relevant.** Numerical calculus only, not symbolic computation.

---

## LaTeX Conversion

### tex-math-parser (v2.0.5) ⭐ Recommended

- **Status:** Active. Published 10 months ago.
- **Purpose:** Parses TeX math into a **MathJS expression tree**.
- **Features:**
  - Converts LaTeX to mathjs-compatible expression tree
  - Supports: `+`, `-`, `*`, `^`, `/`, `\cdot`, `\frac`, `\sqrt`, trig functions, `\pi`, matrices
  - Provides `parseTex(texStr)` → MathJS Node tree
  - Provides `evaluateTex(texStr, scope)` → evaluated result as TeX
  - Works as bridge between MathQuill and MathJS
  - TypeScript support
- **Install:** `npm install tex-math-parser`
- **Usage:**
  ```js
  import { parseTex, evaluateTex } from 'tex-math-parser'
  const tree = parseTex(String.raw`\frac{x^2 + 3x}{2}`);
  // tree is a mathjs Node — can use math.simplify(), math.derivative(), etc.
  ```
- **Limitations:** ES module only (no CommonJS). May need dynamic import or bundler. Does not handle all LaTeX constructs (e.g., `\int`, `\sum`, `\lim`).

### latex-to-js

- Simple converter from LaTeX to JS math syntax
- Very basic, limited scope
- Not actively maintained

### evaluatex

- Evaluates LaTeX and ASCII math expressions
- Browser-focused, not Node.js primary target
- More of an evaluator than a converter

### Manual LaTeX → nerdamer conversion

For nerdamer, there is no direct LaTeX parser. Conversion would need to be manual or via a custom mapping:
- `\frac{a}{b}` → `a/b`
- `\sqrt{x}` → `sqrt(x)`
- `x^2` → `x^2` (already compatible)
- `\sin(x)` → `sin(x)` (already compatible)
- `\int f(x) dx` → `integrate(f(x), x)` (custom mapping needed)

---

## Summary Comparison Matrix

| Feature | mathjs | nerdamer | algebra.js | mathsteps |
|---------|--------|----------|------------|-----------|
| **Simplify** | ✅ | ✅ | ❌ | ✅ |
| **Solve equations** | ❌ | ✅ | ✅ (linear) | ✅ (basic) |
| **Derivatives** | ✅ | ✅ | ❌ | ❌ |
| **Integrals** | ❌ | ✅ | ❌ | ❌ |
| **Factor/Expand** | ✅ (simplify rules) | ✅ | ❌ | ✅ |
| **LaTeX output** | ❌ | ✅ | ✅ | ✅ |
| **Node.js/CJS** | ✅ | ✅ | ✅ | ✅ |
| **Actively maintained** | ✅ | ⚠️ Stale | ❌ Archived | ❌ Archived |
| **Already installed** | ✅ | ❌ | ❌ | ❌ |

---

## Recommendation

### Primary Stack: mathjs + nerdamer

Use **mathjs** as the primary library (already installed) and add **nerdamer** for the capabilities mathjs lacks:

1. **mathjs** handles:
   - Expression simplification (`math.simplify`)
   - Symbolic derivatives (`math.derivative`)
   - Expression parsing and evaluation
   - Rational expressions (`math.rationalize`)

2. **nerdamer** handles:
   - Equation solving (`nerdamer.solveEquations`)
   - Symbolic integration (`nerdamer('integrate(...)')`)
   - Factoring and expanding
   - As a fallback/secondary for derivatives

3. **tex-math-parser** handles:
   - LaTeX → mathjs expression tree conversion
   - Note: ES module only, may need `import()` in CommonJS context
   - Alternative: write a lightweight LaTeX-to-mathml-to-text converter, or use LLM-extracted plain-text expressions directly

### Realistic Verification Capabilities

Given this stack, the following verification checks are realistic for V1:

| Verification Type | Feasibility | Method |
|-------------------|------------|--------|
| Simplify check | ✅ High | mathjs `simplify()` both sides, compare |
| Linear equation solve | ✅ High | nerdamer `solveEquations()` |
| Polynomial equation solve (≤ degree 3) | ✅ High | nerdamer `solveEquations()` |
| Derivative verification | ✅ High | mathjs `derivative()` + compare to LLM answer |
| Basic integral verification | ⚠️ Medium | nerdamer `integrate()` — works for many but not all; use `hasIntegral()` to confirm |
| Factoring/expansion check | ✅ High | nerdamer `expand()` / `factor()` |
| Step-by-step validation | ⚠️ Medium | Check each step's equality via mathjs simplify |
| LaTeX input parsing | ⚠️ Medium | tex-math-parser (ES module caveat) or manual conversion |

### What is NOT realistic for V1

- Complex integrals (integration by parts beyond depth 4, contour integrals)
- Differential equations
- Advanced multivariable calculus
- Proof verification
- Reliable LaTeX → computation pipeline for all expressions (will need LLM assistance for parsing)

### Suggested Implementation Plan

```js
// Load both libraries
const math = require('mathjs');
var nerdamer = require('nerdamer');
require('nerdamer/Algebra');
require('nerdamer/Calculus');
require('nerdamer/Solve');

// Verification service approach
function verify(response) {
  const checks = [];
  
  // 1. Simplification check
  // math.simplify(parsedExpr)
  
  // 2. Derivative check
  // math.derivative(expr, 'x') — compare to LLM answer
  
  // 3. Equation solving check
  // nerdamer.solveEquations(equation, variable)
  
  // 4. Integration check
  // nerdamer('integrate(expr, x)') — check hasIntegral()
  
  return combineVerificationResults(checks);
}
```

### Installation

```bash
cd backend
npm install nerdamer
# tex-math-parser is ES modules only — defer unless needed
```

---

## Risk Assessment

1. **nerdamer staleness** (Medium risk): Last updated 2022. The library is mature and stable for our scope, but won't receive bug fixes. Mitigated by mathjs providing overlapping capabilities for simplification and derivatives.

2. **LaTeX parsing** (Medium risk): No complete LaTeX → computation pipeline exists for Node.js/CommonJS. The LLM already extracts LaTeX and plain-text expressions. Best approach: have the LLM also output plain-text math alongside LaTeX, and use the plain-text for verification.

3. **Integration coverage** (Low-medium risk): nerdamer's integration works for standard cases but may fail on unusual forms. The `hasIntegral()` method provides a clean way to detect failure. For V1, partial verification on integrals is acceptable per the PRD.
