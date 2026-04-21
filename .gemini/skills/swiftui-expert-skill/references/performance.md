# SwiftUI Performance Optimization

Patterns for building fluid interfaces and reducing unnecessary view updates.

## View Composition
- **Extract Small Views**: Smaller view bodies are easier for the compiler to optimize and help localize refreshes.
- **Identity Stability**: Avoid changing the identity of a view unnecessarily (e.g., avoid `if` statements that wrap the entire view if only a small part changes; use modifiers or internal state).

## State Granularity
- **@Observable Optimization**: The `@Observable` macro tracks property access. Ensure views only access the properties they actually need to render to avoid over-triggering refreshes.
- **Avoid Heavy Initialization**: Never perform complex logic or networking inside a view's `init`. Use `.task` or `.onAppear`.

## Lists & Scrolling
- **Lazy Loading**: Use `LazyVStack`, `LazyHStack`, or `List` for large datasets.
- **Image Optimization**:
  - Use `AsyncImage` for remote images.
  - Implement downsampling for high-resolution local images to save memory.
  - Cache results when possible.

## Hot-Path Optimization
- **Animatable Data**: Use the `@Animatable` macro or `animatableData` property for complex, high-frequency value updates.
- **Equatability**: Conforming custom views to `Equatable` and using `.equatable()` can prevent updates when the input data hasn't changed.
