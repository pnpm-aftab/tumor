import SwiftUI
import AppKit

@main
struct TumorApp: App {
    @NSApplicationDelegateAdaptor(TumorAppDelegate.self) var appDelegate
    @State private var mathService = MathService()

    var body: some Scene {
        MenuBarExtra {
            Button("New Text Session") {
                appDelegate.startSession(mode: .text)
            }
            .keyboardShortcut("t", modifiers: [.command, .shift])

            Button("New Audio Session") {
                appDelegate.startSession(mode: .audio)
            }
            .keyboardShortcut("a", modifiers: [.command, .shift])

            Divider()

            Button("Capture Screen") {
                appDelegate.mathService.captureMode = .cursorArea
                appDelegate.startSession(mode: .text)
            }
            .keyboardShortcut("1", modifiers: [.command, .shift])

            Divider()

            Button("Set API Provider & Key...") {
                appDelegate.promptForAPIKey()
            }

            Button("Clear Selected API Key") {
                appDelegate.clearSelectedAPIKey()
            }
            .disabled(!appDelegate.mathService.hasSelectedAPIKey)

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        } label: {
            Text("t.")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
        }
    }
}
