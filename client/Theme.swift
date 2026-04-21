import SwiftUI
import AppKit

struct Theme {
    // Notion / shadcn inspired monochrome palette
    static let base = Color(nsColor: .windowBackgroundColor)
    static let surface = Color(nsColor: .controlBackgroundColor)
    static let border = Color.primary.opacity(0.12)
    
    // Typography
    static let textPrimary = Color.primary
    static let textSecondary = Color.secondary
    
    // Minimalist accent
    static let accent = Color.primary
    static let accentSoft = Color.primary.opacity(0.06)
    
    // Replace gradient with solid primary for a flatter look
    static let accentGradient = Color.primary
    
    // Sharper UI Constants for a web-like / Notion feel
    static let cornerRadius: CGFloat = 10
    static let panelRadius: CGFloat = 16
    
    static var morphSpring: Animation {
        .timingCurve(0.16, 1.0, 0.3, 1.0, duration: 0.35)
    }
}

extension View {
    func modernPillStyle() -> some View {
        self
            .background(Theme.base)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 2))
            .shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 6)
    }
    
    func modernPanelStyle() -> some View {
        self
            .background(Theme.base)
            .clipShape(RoundedRectangle(cornerRadius: Theme.panelRadius))
            .overlay(RoundedRectangle(cornerRadius: Theme.panelRadius).stroke(Theme.border, lineWidth: 2))
            .shadow(color: Color.black.opacity(0.1), radius: 30, x: 0, y: 12)
    }
}
