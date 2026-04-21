import SwiftUI
import AppKit

@main
struct TumorApp: App {
    @NSApplicationDelegateAdaptor(TumorAppDelegate.self) var appDelegate
    @State private var mathService = MathService()

    var body: some Scene {
        MenuBarExtra("tumor", systemImage: "brain.head.profile") {
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
                appDelegate.startSession(mode: .text) // Starts text mode but we can auto-trigger screen capture
            }
            .keyboardShortcut("1", modifiers: [.command, .shift])

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
