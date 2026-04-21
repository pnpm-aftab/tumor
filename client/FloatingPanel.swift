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
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .managed]

        isMovableByWindowBackground = true
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = false
        animationBehavior = .utilityWindow

        backgroundColor = .clear
        isOpaque = false
        hasShadow = true

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.sizingOptions = .minSize
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

    func updateSizeAndPosition(isCollapsed: Bool) {
        let targetScreen = self.screen ?? NSScreen.main ?? NSScreen.screens.first!
        let visibleFrame = targetScreen.visibleFrame

        var newFrame = self.frame

        if isCollapsed {
            newFrame.size.width = min(560, visibleFrame.width - 40)
            newFrame.size.height = 120
        } else {
            newFrame.size.width = min(760, visibleFrame.width - 40)
            newFrame.size.height = min(800, visibleFrame.height - 40)
        }

        newFrame.origin.x = visibleFrame.midX - newFrame.width / 2
        newFrame.origin.y = visibleFrame.minY + 60

        guard newFrame != self.frame else { return }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.4
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            self.animator().setFrame(newFrame, display: true)
        }
    }
}

final class SessionPanelController {
    private var panel: FloatingPanel?

    func show<Content: View>(
        contentRect: CGRect = CGRect(x: 0, y: 0, width: 500, height: 80),
        @ViewBuilder content: () -> Content
    ) {
        if let existing = panel {
            existing.orderFront(nil)
            existing.makeKey()
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
        panel.orderFrontRegardless()
        
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.35
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1.0, 0.3, 1.0)
            panel.animator().alphaValue = 1.0
        }
        
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKey()
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
