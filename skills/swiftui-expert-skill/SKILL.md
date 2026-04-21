---
name: swiftui-expert-skill
description: Expert guidance for SwiftUI development, Liquid Glass (iOS 26+) design, and Swift DocC UI customization. Use when building or refactoring SwiftUI views, adopting modern APIs, optimizing performance, or customizing documentation appearance.
---

# SwiftUI Expert Skill

Expert guidance for building modern, performant, and visually stunning SwiftUI applications and documentation.

## Workflows

### 1. New Feature Development
- Use native SwiftUI APIs by default.
- Consult [modern-apis.md](references/modern-apis.md) for current best practices.
- Apply [performance.md](references/performance.md) patterns early (composition, lazy loading).

### 2. Adopting Liquid Glass (iOS 26+)
- **Only** apply Liquid Glass when explicitly requested or for navigation/control layers.
- Reference [liquid-glass.md](references/liquid-glass.md) for `.glassEffect` and `GlassEffectContainer` usage.
- Ensure accessibility by testing with "Reduce Transparency."

### 3. Documentation Customization (DocC)
- Reference [docc-ui.md](references/docc-ui.md) for web components and `theme-settings.json`.
- Use directives like `@TabNavigator` and `@Stepper` to enhance interactive learning.

### 4. Code Review & Refactoring
- Identify and flag deprecated symbols using [modern-apis.md](references/modern-apis.md).
- Optimize state updates and view identity using [performance.md](references/performance.md).

## Core Principles
- **Conciseness**: Keep views small and focused.
- **Performance**: Minimize state update scope.
- **Modernity**: Prioritize the latest stable APIs (e.g., `@Observable`, `NavigationStack`).
- **Documentation**: Build integrated, interactive documentation using DocC.

## References
- [Liquid Glass (iOS 26+)](references/liquid-glass.md) - Design system and APIs.
- [DocC UI & Customization](references/docc-ui.md) - Directives and theming.
- [Modern APIs & Migration](references/modern-apis.md) - Deprecated vs. Modern mapping.
- [Performance Optimization](references/performance.md) - Updates, composition, and lists.
