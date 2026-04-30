import SwiftUI
import AppKit

struct Theme {
    // Warm paper palette shared with the landing page.
    static let base = Color(hex: 0xfffdf9)
    static let surface = Color(hex: 0xf5f2eb)
    static let surfaceHover = Color(hex: 0xeeebe2)
    static let border = Color(hex: 0xe8e4da)
    static let borderHover = Color(hex: 0xd3cec1)
    
    // Typography
    static let textPrimary = Color(hex: 0x1c1b1a)
    static let textSecondary = Color(hex: 0x7a756d)
    
    // Terracotta accent
    static let accent = Color(hex: 0xe35e3d)
    static let accentHover = Color(hex: 0xcc5437)
    static let accentSoft = Color(hex: 0xfbece8)
    
    static let accentGradient = Color(hex: 0xe35e3d)
    
    // Sharper UI Constants for a web-like / Notion feel
    static let cornerRadius: CGFloat = 12
    static let controlRadius: CGFloat = 14
    static let panelRadius: CGFloat = 16
    static let pillRadius: CGFloat = 30
    
    static var morphSpring: Animation {
        .timingCurve(0.16, 1.0, 0.3, 1.0, duration: 0.35)
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}

extension View {
    func modernPillStyle() -> some View {
        self
            .background(Theme.base)
            .clipShape(RoundedRectangle(cornerRadius: Theme.pillRadius))
            .overlay(RoundedRectangle(cornerRadius: Theme.pillRadius).stroke(Theme.border, lineWidth: 2))
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
