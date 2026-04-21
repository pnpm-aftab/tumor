import AppKit
import SwiftUI

class CursorHighlightWindow: NSWindow {
    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 800),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        self.isOpaque = false
        self.backgroundColor = .clear
        self.level = .screenSaver
        self.ignoresMouseEvents = true
        self.hasShadow = false
        
        let view = NSView(frame: self.frame)
        view.wantsLayer = true
        view.layer?.borderWidth = 2
        // Using a dashed or visible border
        view.layer?.borderColor = NSColor(Theme.accent).withAlphaComponent(0.8).cgColor
        view.layer?.cornerRadius = 16
        view.layer?.backgroundColor = NSColor(Theme.accent).withAlphaComponent(0.05).cgColor
        
        self.contentView = view
    }
}

class CursorHighlightManager {
    static let shared = CursorHighlightManager()
    
    private var window: CursorHighlightWindow?
    private var globalMonitor: Any?
    private var localMonitor: Any?
    
    func start() {
        if window == nil {
            window = CursorHighlightWindow()
        }
        window?.orderFrontRegardless()
        updatePosition()
        
        if globalMonitor == nil {
            globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: .mouseMoved) { [weak self] _ in
                self?.updatePosition()
            }
        }
        if localMonitor == nil {
            localMonitor = NSEvent.addLocalMonitorForEvents(matching: .mouseMoved) { [weak self] event in
                self?.updatePosition()
                return event
            }
        }
    }
    
    func stop() {
        window?.orderOut(nil)
        if let gm = globalMonitor {
            NSEvent.removeMonitor(gm)
            globalMonitor = nil
        }
        if let lm = localMonitor {
            NSEvent.removeMonitor(lm)
            localMonitor = nil
        }
    }
    
    private func updatePosition() {
        let mouseLoc = NSEvent.mouseLocation
        
        // Find which screen contains the mouse
        let targetScreen = NSScreen.screens.first(where: { screen in
            NSMouseInRect(mouseLoc, screen.frame, false)
        }) ?? NSScreen.main ?? NSScreen.screens.first!
        
        // Convert mouse location to be relative to the target screen's origin
        let relativeMouseLoc = NSPoint(
            x: mouseLoc.x - targetScreen.frame.origin.x,
            y: mouseLoc.y - targetScreen.frame.origin.y
        )
        
        // Center the 800x800 window on the mouse
        let windowFrame = NSRect(x: relativeMouseLoc.x - 400, y: relativeMouseLoc.y - 400, width: 800, height: 800)
        window?.setFrame(windowFrame, display: true, animate: false)
    }
}
