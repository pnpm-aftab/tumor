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

    func promptForAPIKey() {
        NSApplication.shared.activate(ignoringOtherApps: true)

        let alert = NSAlert()
        alert.messageText = "Set API Provider & Key"
        alert.informativeText = "Choose OpenAI or OpenRouter. The key is stored in your macOS Keychain and sent only to the local tumor backend for tutor requests."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Cancel")

        let providerPicker = NSPopUpButton(frame: NSRect(x: 0, y: 34, width: 360, height: 26), pullsDown: false)
        for provider in APIKeyStore.Provider.allCases {
            providerPicker.addItem(withTitle: provider.displayName)
            providerPicker.lastItem?.representedObject = provider.rawValue
        }
        providerPicker.selectItem(withTitle: APIKeyStore.selectedProvider.displayName)

        let secureField = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 360, height: 24))
        secureField.placeholderString = APIKeyStore.loadKey() == nil ? "Paste API key..." : "Existing key saved. Enter a new key to replace it."

        let stack = NSView(frame: NSRect(x: 0, y: 0, width: 360, height: 64))
        stack.addSubview(providerPicker)
        stack.addSubview(secureField)
        alert.accessoryView = stack

        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let selectedRawValue = providerPicker.selectedItem?.representedObject as? String
        let provider = selectedRawValue.flatMap(APIKeyStore.Provider.init(rawValue:)) ?? .openAI

        do {
            try APIKeyStore.saveKey(secureField.stringValue, for: provider)
        } catch {
            showAPIKeyError(error.localizedDescription)
        }
    }

    func clearSelectedAPIKey() {
        APIKeyStore.clearKey()
    }

    private func showAPIKeyError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Could Not Save API Key"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    @objc private func handleStartText() {
        startSession(mode: .text)
    }

    @objc private func handleStartAudio() {
        startSession(mode: .audio)
    }
    
    @objc private func handleStartScreen() {
        mathService.captureMode = .cursorArea
        startSession(mode: .text)
    }

    @objc private func handleDismiss() {
        CursorHighlightManager.shared.clearSelection()
        panelController.hide()
    }
}
