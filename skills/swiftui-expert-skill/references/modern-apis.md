# Modern SwiftUI APIs & Migration

Guidance for moving from deprecated symbols to modern, performant alternatives.

## State Management
- **Deprecated**: `@StateObject`, `@ObservedObject` (Combine-based).
- **Modern**: `@Observable` macro (iOS 17+).
  - Use `@State` for view-owned observable objects.
  - Use direct property access for shared observable objects.

## Data Flow
- **Deprecated**: `onChange(of:perform:)` (single-parameter closure).
- **Modern**: `onChange(of:initial:_:)` or `onChange(of:_:)` (multi-parameter/zero-parameter closures).
```swift
// Modern (iOS 17+)
.onChange(of: value) { oldValue, newValue in
    // logic
}
```

## Lists & Identity
- **Always** use stable identity for `ForEach` (avoid using `\.self` with non-Hashable types).
- Use `Table` for macOS/iPadOS when multiple columns and sorting are required.

## Navigation
- **Deprecated**: `NavigationView`.
- **Modern**: `NavigationStack` or `NavigationSplitView`.
  - Use `navigationDestination(for:destination:)` for type-safe routing.
  - Use `NavigationLink(value:)` to decouple trigger from destination.

## Asynchronous Work
- Use the `.task` modifier instead of `onAppear` for starting async operations. It handles cancellation automatically when the view disappears.
