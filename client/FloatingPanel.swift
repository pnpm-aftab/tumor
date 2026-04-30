import SwiftUI
import AppKit

/// A custom NSPanel subclass that provides a truly borderless, floating window.
final class FloatingPanel: NSPanel {
    var onDismiss: (() -> Void)?

    init(contentView rootView: some View,
         contentRect: NSRect) {

        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.managed]

        isMovableByWindowBackground = true
        hidesOnDeactivate = false // Keep visible when switching apps
        becomesKeyOnlyIfNeeded = true // Only become key when needed
        animationBehavior = .utilityWindow

        backgroundColor = .clear
        isOpaque = false
        hasShadow = true

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.sizingOptions = [.intrinsicContentSize]
        contentView = hostingView
    }

    override func close() {
        super.close()
        onDismiss?()
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    // MARK: - Positioning

    func anchorToBottomCenter(screen: NSScreen? = nil, offsetY: CGFloat = 60) {
        let targetScreen = screen ?? self.screen ?? NSScreen.main ?? NSScreen.screens.first!
        let visibleFrame = targetScreen.visibleFrame
        let panelSize = frame.size
        let x = visibleFrame.midX - panelSize.width / 2
        let y = visibleFrame.minY + offsetY
        setFrameOrigin(NSPoint(x: x, y: y))
    }

    func updateSizeAndPosition(isCollapsed: Bool, anchorRect: NSRect? = nil, anchorMode: PanelAnchorMode = .bottomCenter) {
        let targetScreen = self.screen ?? NSScreen.main ?? NSScreen.screens.first!
        let visibleFrame = targetScreen.visibleFrame

        guard let hostingView = self.contentView as? NSHostingView<AnyView> else { return }
        
        // Force a layout pass to get the correct intrinsic content size
        hostingView.layout()
        let contentSize = hostingView.intrinsicContentSize
        
        var newFrame = self.frame

        if isCollapsed {
            newFrame.size.width = max(480, contentSize.width)
            newFrame.size.height = 120
        } else {
            // Respect the intrinsic content size but cap it
            newFrame.size.width = max(700, contentSize.width)
            newFrame.size.height = min(900, contentSize.height + 40) // Small padding
        }

        if let anchorRect {
            newFrame.origin = anchoredOrigin(
                for: newFrame,
                anchorRect: anchorRect,
                visibleFrame: visibleFrame,
                anchorMode: anchorMode
            )
        } else {
            newFrame.origin.x = visibleFrame.midX - newFrame.width / 2
            newFrame.origin.y = visibleFrame.minY + 60
        }

        guard newFrame != self.frame else { return }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.4
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.22, 1, 0.36, 1) // Modern spring-like curve
            self.animator().setFrame(newFrame, display: true)
        }
    }

    private func anchoredOrigin(
        for frame: NSRect,
        anchorRect: NSRect,
        visibleFrame: NSRect,
        anchorMode: PanelAnchorMode
    ) -> NSPoint {
        let horizontalPadding: CGFloat = 24
        let verticalPadding: CGFloat = 24

        let minX = visibleFrame.minX + horizontalPadding
        let maxX = visibleFrame.maxX - frame.width - horizontalPadding
        let minY = visibleFrame.minY + verticalPadding
        let maxY = visibleFrame.maxY - frame.height - verticalPadding

        switch anchorMode {
        case .bottomCenter:
            let originX = min(max(anchorRect.midX - frame.width / 2, minX), maxX)
            let originY = min(max(anchorRect.maxY - 24, minY), maxY)
            return NSPoint(x: originX, y: originY)

        case .rightOfSelection:
            let gap: CGFloat = 36
            // Try right side first
            let rightX = anchorRect.maxX + gap
            // If not enough room on the right, go left
            let leftX = anchorRect.minX - frame.width - gap

            let fitsRight = rightX + frame.width <= visibleFrame.maxX - horizontalPadding
            let fitsLeft = leftX >= visibleFrame.minX + horizontalPadding

            let originX: CGFloat
            if fitsRight {
                originX = rightX
            } else if fitsLeft {
                originX = leftX
            } else {
                // Neither side fits fully; pick whichever has more space
                let rightSpace = visibleFrame.maxX - rightX
                let leftSpace = leftX - visibleFrame.minX
                originX = rightSpace >= leftSpace ? rightX : leftX
            }

            // Bottom-align the panel with the selection
            let originY = min(max(anchorRect.minY, minY), maxY)

            return NSPoint(x: min(max(originX, minX), maxX), y: originY)
        }
    }
}

enum PanelAnchorMode {
    case bottomCenter
    case rightOfSelection
}

final class SessionPanelController {
    private var panel: FloatingPanel?

    func show<Content: View>(
        contentRect: CGRect = CGRect(x: 0, y: 0, width: 500, height: 80),
        @ViewBuilder content: () -> Content
    ) {
        if let existing = panel {
            existing.orderFront(nil)
            // Don't make key - let user control focus
            return
        }

        let panel = FloatingPanel(
            contentView: AnyView(content()),
            contentRect: contentRect
        )

        panel.onDismiss = { [weak self] in
            self?.panel = nil
        }

        self.panel = panel
        panel.anchorToBottomCenter()
        
        panel.alphaValue = 0
        panel.orderFront(nil) // Use orderFront instead of orderFrontRegardless
        
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.35
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1.0, 0.3, 1.0)
            panel.animator().alphaValue = 1.0
        }
        
        // Don't aggressively activate the app or make key - let user control focus
        // panel.makeKey() // Commented out - let user decide when to focus
    }

    func hide() {
        guard let panel = panel else { return }
        
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1.0, 0.3, 1.0)
            panel.animator().alphaValue = 0
        } completionHandler: {
            panel.orderOut(nil)
            self.panel = nil
        }
    }

    func close() {
        panel?.close()
        panel = nil
    }

    func currentPanel() -> FloatingPanel? {
        panel
    }
}
