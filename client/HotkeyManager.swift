import Carbon
import AppKit

private func fourCC(_ a: Character, _ b: Character, _ c: Character, _ d: Character) -> FourCharCode {
    UInt32(a.asciiValue!) << 24 | UInt32(b.asciiValue!) << 16 | UInt32(c.asciiValue!) << 8 | UInt32(d.asciiValue!)
}

class HotkeyManager {
    static let shared = HotkeyManager()

    private var refs: [EventHotKeyRef] = []
    private var handlerRef: EventHandlerRef?

    private let configs: [HotkeyConfig] = [
        HotkeyConfig(id: 1, signature: fourCC("m","t","T","g"), keyCode: 0x2E, modifiers: UInt32(cmdKey | shiftKey), notification: .toggleLauncher),
        HotkeyConfig(id: 2, signature: fourCC("m","t","Q","c"), keyCode: 0x01, modifiers: UInt32(cmdKey | shiftKey), notification: .quickCapture),
        HotkeyConfig(id: 3, signature: fourCC("m","t","D","p"), keyCode: 0x0D, modifiers: UInt32(cmdKey | shiftKey), notification: .dismissPanel),
        HotkeyConfig(id: 4, signature: fourCC("m","t","F","i"), keyCode: 0x11, modifiers: UInt32(cmdKey | shiftKey), notification: .focusInput),
        HotkeyConfig(id: 5, signature: fourCC("m","t","D","s"), keyCode: 0x07, modifiers: UInt32(cmdKey | shiftKey), notification: .dismissSessionHotkey)
    ]

    init() {
        registerAll()
    }

    deinit {
        unregisterAll()
    }

    func registerAll() {
        let eventSpec = [EventTypeSpec(eventClass: UInt32(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))]
        let status = InstallEventHandler(
            GetApplicationEventTarget(),
            hotkeyCallback,
            1,
            eventSpec,
            nil,
            &handlerRef
        )
        guard status == noErr else {
            print("HotkeyManager: InstallEventHandler failed (\(status))")
            return
        }

        for config in configs {
            let hotKeyID = EventHotKeyID(signature: config.signature, id: config.id)
            var ref: EventHotKeyRef?
            let regStatus = RegisterEventHotKey(
                config.keyCode,
                config.modifiers,
                hotKeyID,
                GetApplicationEventTarget(),
                0,
                &ref
            )
            if regStatus == noErr, let ref = ref {
                refs.append(ref)
            } else {
                print("HotkeyManager: RegisterEventHotKey failed for id \(config.id) (\(regStatus))")
            }
        }
    }

    func unregisterAll() {
        for ref in refs {
            UnregisterEventHotKey(ref)
        }
        refs.removeAll()
        if let handler = handlerRef {
            RemoveEventHandler(handler)
            handlerRef = nil
        }
    }

    func handleHotkey(id: UInt32) {
        guard let config = configs.first(where: { $0.id == id }) else { return }
        NotificationCenter.default.post(name: config.notification, object: nil)
    }
}

private func hotkeyCallback(
    _ nextHandler: EventHandlerCallRef?,
    _ event: EventRef?,
    _ userData: UnsafeMutableRawPointer?
) -> OSStatus {
    guard let event = event else { return OSStatus(eventNotHandledErr) }

    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
    )
    guard status == noErr else { return OSStatus(eventNotHandledErr) }

    HotkeyManager.shared.handleHotkey(id: hotKeyID.id)
    return noErr
}
