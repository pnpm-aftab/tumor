import AppKit
import SwiftUI

class CursorHighlightWindow: NSWindow {
    init(size: CGFloat) {
        let contentRect = NSRect(x: 0, y: 0, width: size, height: size)
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        self.isOpaque = false
        self.backgroundColor = .clear
        self.level = .floating
        self.ignoresMouseEvents = false
        self.hasShadow = false

        let view = CursorHighlightView(frame: contentRect)
        self.contentView = view
    }
}

class CursorHighlightView: NSView {
    var isLocked = false
    var onMouseDown: (() -> Void)?

    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) {
        onMouseDown?()
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        let accentColor = NSColor(Theme.accent)

        // Subtle background tint
        accentColor.withAlphaComponent(0.03).setFill()
        dirtyRect.fill()

        let w = dirtyRect.width
        let h = dirtyRect.height

        if isLocked {
            // Locked: solid, slightly thicker border
            let borderPath = NSBezierPath(rect: dirtyRect.insetBy(dx: 2, dy: 2))
            borderPath.lineWidth = 2.5
            accentColor.withAlphaComponent(0.85).setStroke()
            borderPath.stroke()
        } else {
            // Unlocked: dashed marquee border
            let borderPath = NSBezierPath(rect: dirtyRect.insetBy(dx: 1.5, dy: 1.5))
            borderPath.lineWidth = 2.0
            let dashPattern: [CGFloat] = [14, 7]
            borderPath.setLineDash(dashPattern, count: dashPattern.count, phase: 0)
            accentColor.withAlphaComponent(0.7).setStroke()
            borderPath.stroke()
        }

        // Solid corner brackets
        let cornerLength: CGFloat = isLocked ? 40 : 32
        let bracketWidth: CGFloat = 3.0
        let bracketPath = NSBezierPath()
        bracketPath.lineWidth = bracketWidth
        bracketPath.lineCapStyle = .round
        accentColor.withAlphaComponent(isLocked ? 1.0 : 0.9).setStroke()

        // Top-left
        bracketPath.move(to: NSPoint(x: 0, y: cornerLength))
        bracketPath.line(to: NSPoint(x: 0, y: 0))
        bracketPath.line(to: NSPoint(x: cornerLength, y: 0))

        // Top-right
        bracketPath.move(to: NSPoint(x: w - cornerLength, y: 0))
        bracketPath.line(to: NSPoint(x: w, y: 0))
        bracketPath.line(to: NSPoint(x: w, y: cornerLength))

        // Bottom-right
        bracketPath.move(to: NSPoint(x: w, y: h - cornerLength))
        bracketPath.line(to: NSPoint(x: w, y: h))
        bracketPath.line(to: NSPoint(x: w - cornerLength, y: h))

        // Bottom-left
        bracketPath.move(to: NSPoint(x: cornerLength, y: h))
        bracketPath.line(to: NSPoint(x: 0, y: h))
        bracketPath.line(to: NSPoint(x: 0, y: h - cornerLength))

        bracketPath.stroke()

        let cx = w / 2
        let cy = h / 2

        if isLocked {
            // Locked: solid center dot
            let dotPath = NSBezierPath(ovalIn: NSRect(x: cx - 4, y: cy - 4, width: 8, height: 8))
            accentColor.withAlphaComponent(0.9).setFill()
            dotPath.fill()
        } else {
            // Unlocked: crosshair
            let crossSize: CGFloat = 18
            let crossPath = NSBezierPath()
            crossPath.lineWidth = 1.5
            accentColor.withAlphaComponent(0.55).setStroke()

            crossPath.move(to: NSPoint(x: cx - crossSize, y: cy))
            crossPath.line(to: NSPoint(x: cx + crossSize, y: cy))
            crossPath.move(to: NSPoint(x: cx, y: cy - crossSize))
            crossPath.line(to: NSPoint(x: cx, y: cy + crossSize))
            crossPath.stroke()
        }
    }
}

class CursorHighlightManager {
    static let shared = CursorHighlightManager()

    let captureAreaSize: CGFloat = 800

    private var window: CursorHighlightWindow?
    private var moveGlobalMonitor: Any?
    private var moveLocalMonitor: Any?
    private var clickMonitor: Any?
    private(set) var isActive = false
    private(set) var isLocked = false
    private(set) var selectedFrame: NSRect?

    var onFrameChanged: ((NSRect) -> Void)?
    var onSelectionLocked: ((NSRect) -> Void)?

    /// The frame to capture. If locked, returns the locked window frame.
    /// If unlocked, returns a frame centered on the current mouse position.
    var currentCaptureFrame: NSRect {
        if let frame = selectedFrame {
            return frame
        }
        if isLocked, let frame = window?.frame {
            return frame
        }
        let mouseLoc = NSEvent.mouseLocation
        let halfSize = captureAreaSize / 2
        return NSRect(
            x: mouseLoc.x - halfSize,
            y: mouseLoc.y - halfSize,
            width: captureAreaSize,
            height: captureAreaSize
        )
    }

    func start() {
        guard !isActive else { return }
        isActive = true

        if window == nil {
            window = CursorHighlightWindow(size: captureAreaSize)
            (window?.contentView as? CursorHighlightView)?.onMouseDown = { [weak self] in
                self?.handleClick()
            }
        }

        if let selectedFrame {
            isLocked = true
            window?.setFrame(selectedFrame, display: true, animate: false)
        } else {
            isLocked = false
            updatePosition()
        }

        (window?.contentView as? CursorHighlightView)?.isLocked = isLocked
        window?.contentView?.needsDisplay = true
        window?.orderFront(nil) // Use orderFront instead of orderFrontRegardless

        if isLocked {
            removeMovementMonitors()
            if let selectedFrame {
                onFrameChanged?(selectedFrame)
            }
        } else {
            registerMovementMonitors()
        }
        registerClickMonitor()
    }

    func stop() {
        guard isActive else { return }
        isActive = false
        isLocked = false
        selectedFrame = nil

        window?.orderOut(nil)
        if let mm = moveGlobalMonitor {
            NSEvent.removeMonitor(mm)
            moveGlobalMonitor = nil
        }
        if let lm = moveLocalMonitor {
            NSEvent.removeMonitor(lm)
            moveLocalMonitor = nil
        }
        if let cm = clickMonitor {
            NSEvent.removeMonitor(cm)
            clickMonitor = nil
        }
    }

    func persistSelection(frame: NSRect) {
        let clampedFrame = clampFrameToScreen(frame)
        selectedFrame = clampedFrame

        guard let window else { return }
        isLocked = true
        removeMovementMonitors()
        window.setFrame(clampedFrame, display: true, animate: false)
        (window.contentView as? CursorHighlightView)?.isLocked = true
        window.contentView?.needsDisplay = true
        onSelectionLocked?(clampedFrame)
        onFrameChanged?(clampedFrame)
    }

    func hideDuringCapture(_ capture: @escaping (@escaping () -> Void) -> Void) {
        let wasVisible = window?.isVisible == true
        if wasVisible {
            window?.orderOut(nil)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { [weak self] in
            capture {
                DispatchQueue.main.async {
                    guard wasVisible, self?.isActive == true else { return }
                    self?.window?.orderFront(nil)
                }
            }
        }
    }

    func clearSelection() {
        selectedFrame = nil
        isLocked = false

        if isActive {
            registerMovementMonitors()
            (window?.contentView as? CursorHighlightView)?.isLocked = false
            window?.contentView?.needsDisplay = true
            updatePosition()
        }
    }

    private func registerMovementMonitors() {
        if moveGlobalMonitor == nil {
            moveGlobalMonitor = NSEvent.addGlobalMonitorForEvents(matching: .mouseMoved) { [weak self] _ in
                self?.handleMouseMoved()
            }
        }
        if moveLocalMonitor == nil {
            moveLocalMonitor = NSEvent.addLocalMonitorForEvents(matching: .mouseMoved) { [weak self] event in
                self?.handleMouseMoved()
                return event
            }
        }
    }

    private func removeMovementMonitors() {
        if let mm = moveGlobalMonitor {
            NSEvent.removeMonitor(mm)
            moveGlobalMonitor = nil
        }
        if let lm = moveLocalMonitor {
            NSEvent.removeMonitor(lm)
            moveLocalMonitor = nil
        }
    }

    private func registerClickMonitor() {
        guard clickMonitor == nil else { return }
        clickMonitor = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDown) { [weak self] _ in
            self?.handleClick()
        }
    }

    private func handleMouseMoved() {
        guard isActive, !isLocked else { return }
        updatePosition()
    }

    private func handleClick() {
        guard isActive else { return }
        if isLocked {
            unlock()
        } else {
            lock()
        }
    }

    private func lock() {
        guard isActive, !isLocked else { return }
        isLocked = true
        removeMovementMonitors()
        (window?.contentView as? CursorHighlightView)?.isLocked = true
        window?.contentView?.needsDisplay = true
        if let frame = window?.frame {
            selectedFrame = frame
            onSelectionLocked?(frame)
        }
    }

    private func unlock() {
        guard isActive, isLocked else { return }
        isLocked = false
        selectedFrame = nil
        registerMovementMonitors()
        (window?.contentView as? CursorHighlightView)?.isLocked = false
        window?.contentView?.needsDisplay = true
        updatePosition()
    }

    private func updatePosition() {
        let mouseLoc = NSEvent.mouseLocation
        let halfSize = captureAreaSize / 2

        let proposedFrame = NSRect(
            x: mouseLoc.x - halfSize,
            y: mouseLoc.y - halfSize,
            width: captureAreaSize,
            height: captureAreaSize
        )
        let windowFrame = clampFrameToScreen(proposedFrame, point: mouseLoc)
        window?.setFrame(windowFrame, display: true, animate: false)
        onFrameChanged?(windowFrame)
    }

    private func clampFrameToScreen(_ frame: NSRect, point: NSPoint? = nil) -> NSRect {
        let targetPoint = point ?? NSPoint(x: frame.midX, y: frame.midY)
        let targetScreen = NSScreen.screens.first(where: { screen in
            NSMouseInRect(targetPoint, screen.frame, false)
        }) ?? NSScreen.main ?? NSScreen.screens.first

        guard let screenFrame = targetScreen?.frame else { return frame }

        let width = min(frame.width, screenFrame.width)
        let height = min(frame.height, screenFrame.height)
        let x = max(screenFrame.minX, min(frame.origin.x, screenFrame.maxX - width))
        let y = max(screenFrame.minY, min(frame.origin.y, screenFrame.maxY - height))

        return NSRect(x: x, y: y, width: width, height: height)
    }
}
