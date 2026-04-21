import Foundation

extension Notification.Name {
    // Hotkey triggered notifications
    static let toggleLauncher = Notification.Name("com.tumor.hotkey.toggleLauncher")
    static let quickCapture = Notification.Name("com.tumor.hotkey.quickCapture")
    static let dismissPanel = Notification.Name("com.tumor.hotkey.dismissPanel")
    static let focusInput = Notification.Name("com.tumor.hotkey.focusInput")
    static let dismissSessionHotkey = Notification.Name("com.tumor.hotkey.dismissSession")
    
    // Session Start Notifications (UI -> App Logic)
    static let startTextSession = Notification.Name("com.tumor.session.start.text")
    static let startScreenSession = Notification.Name("com.tumor.session.start.screen")
    static let startAudioSession = Notification.Name("com.tumor.session.start.audio")
    
    // Session Configuration Notifications (App Logic -> SessionView)
    static let configureSessionText = Notification.Name("com.tumor.session.config.text")
    static let configureSessionScreen = Notification.Name("com.tumor.session.config.screen")
    static let configureSessionAudio = Notification.Name("com.tumor.session.config.audio")
    
    // Result Handling
    static let showResult = Notification.Name("com.tumor.result.show")
    static let clearResult = Notification.Name("com.tumor.result.clear")
    
    // Dismissal
    static let dismissSession = Notification.Name("com.tumor.session.dismiss")
}

struct HotkeyConfig {
    let id: UInt32
    let signature: FourCharCode
    let keyCode: UInt32
    let modifiers: UInt32
    let notification: Notification.Name
}
