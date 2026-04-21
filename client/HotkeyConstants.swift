import Foundation

extension Notification.Name {
    // Hotkey triggered notifications
    static let toggleLauncher = Notification.Name("com.mathtutor.hotkey.toggleLauncher")
    static let quickCapture = Notification.Name("com.mathtutor.hotkey.quickCapture")
    static let dismissPanel = Notification.Name("com.mathtutor.hotkey.dismissPanel")
    static let focusInput = Notification.Name("com.mathtutor.hotkey.focusInput")
    static let dismissSessionHotkey = Notification.Name("com.mathtutor.hotkey.dismissSession")
    
    // Session Start Notifications (UI -> App Logic)
    static let startTextSession = Notification.Name("com.mathtutor.session.start.text")
    static let startScreenSession = Notification.Name("com.mathtutor.session.start.screen")
    static let startAudioSession = Notification.Name("com.mathtutor.session.start.audio")
    
    // Session Configuration Notifications (App Logic -> SessionView)
    static let configureSessionText = Notification.Name("com.mathtutor.session.config.text")
    static let configureSessionScreen = Notification.Name("com.mathtutor.session.config.screen")
    static let configureSessionAudio = Notification.Name("com.mathtutor.session.config.audio")
    
    // Result Handling
    static let showResult = Notification.Name("com.mathtutor.result.show")
    static let clearResult = Notification.Name("com.mathtutor.result.clear")
    
    // Dismissal
    static let dismissSession = Notification.Name("com.mathtutor.session.dismiss")
}

struct HotkeyConfig {
    let id: UInt32
    let signature: FourCharCode
    let keyCode: UInt32
    let modifiers: UInt32
    let notification: Notification.Name
}
