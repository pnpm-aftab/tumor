import AppKit
import SwiftUI

class TumorAppDelegate: NSObject, NSApplicationDelegate {
    private var hotkeyManager: HotkeyManager?
    var mathService = MathService()
    private let panelController = SessionPanelController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Set activation policy to accessory so it doesn't show in Dock but has menu bar
        NSApplication.shared.setActivationPolicy(.accessory)
        
        hotkeyManager = HotkeyManager.shared

        // Listen for internal session start triggers
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartText), name: .startTextSession, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartAudio), name: .startAudioSession, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartScreen), name: .startScreenSession, object: nil)
        
        // Listen for hotkeys
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartText), name: .focusInput, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartText), name: .toggleLauncher, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleStartScreen), name: .startScreenSession, object: nil)
        
        // Dismissals
        NotificationCenter.default.addObserver(self, selector: #selector(handleDismiss), name: .dismissPanel, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleDismiss), name: .dismissSessionHotkey, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleDismiss), name: .dismissSession, object: nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotkeyManager?.unregisterAll()
    }
    
    func startSession(mode: SessionMode) {
        panelController.show(contentRect: CGRect(x: 0, y: 0, width: 500, height: 80)) {
            SessionView(mathService: self.mathService)
        }
        
        // Slight delay to ensure SessionView is loaded and listening
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            if mode == .text {
                NotificationCenter.default.post(name: .configureSessionText, object: nil)
            } else {
                NotificationCenter.default.post(name: .configureSessionAudio, object: nil)
            }
        }
    }

    @objc private func handleStartText() {
        startSession(mode: .text)
    }

    @objc private func handleStartAudio() {
        startSession(mode: .audio)
    }
    
    @objc private func handleStartScreen() {
        startSession(mode: .text)
    }

    @objc private func handleDismiss() {
        panelController.hide()
    }
}
