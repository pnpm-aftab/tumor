# Liquid Glass (iOS 26+)

Liquid Glass is the primary design language for iOS 26, emphasizing dynamic translucency, light refraction, and fluid morphing.

## Core Properties
- **Dynamic Translucency**: Real-time blurring of background content.
- **Lensing & Refraction**: Light bending based on underlying content.
- **Specular Highlights**: Accelerometer-driven reflections.
- **Fluid Morphing**: Elements "merge" when positioned near each other.

## Key APIs

### .glassEffect(_:in:)
Applies the material to a view.
```swift
Text("Liquid Glass")
    .glassEffect(.regular, in: .capsule)
```
- **Variants**: `.regular`, `.clear` (high transparency), `.identity` (conditional toggle).
- **Modifiers**: `.tint(Color)`, `.interactive(Bool)`.

### GlassEffectContainer
Coordinates multiple glass elements for morphing effects.
```swift
GlassEffectContainer {
    HStack(spacing: -10) {
        Button("Action 1") { }
            .glassEffect()
        Button("Action 2") { }
            .glassEffect()
    }
}
```

### .glassEffectUnion(id:namespace:)
Unifies glass shapes across different parts of the layout.
```swift
@Namespace var glassNamespace
Image(systemName: "heart")
    .glassEffectUnion(id: "actionGroup", in: glassNamespace)
```

## Best Practices
- **Layering**: Use for navigation and control layers (toolbars, floating buttons).
- **Legibility**: Avoid applying to primary content like list rows or text blocks.
- **Edge-to-Edge**: Combine with `.backgroundExtensionEffect()` on media for a "full-bleed" look.
- **Accessibility**: System adjusts automatically for "Reduce Transparency" settings.
