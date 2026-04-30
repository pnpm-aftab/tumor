import Foundation
import Security

enum APIKeyStore {
    private static let service = "tumor.api-key"
    private static let openAIAccount = "openai"
    private static let openRouterAccount = "openrouter"

    enum Provider: String, CaseIterable {
        case openAI = "openai"
        case openRouter = "openrouter"

        var displayName: String {
            switch self {
            case .openAI:
                return "OpenAI"
            case .openRouter:
                return "OpenRouter"
            }
        }

        var account: String {
            switch self {
            case .openAI:
                return openAIAccount
            case .openRouter:
                return openRouterAccount
            }
        }
    }

    private static let selectedProviderKey = "selectedAPIProvider"

    static var selectedProvider: Provider {
        get {
            guard
                let rawValue = UserDefaults.standard.string(forKey: selectedProviderKey),
                let provider = Provider(rawValue: rawValue)
            else {
                return .openAI
            }
            return provider
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: selectedProviderKey)
        }
    }

    static func loadKey(for provider: Provider = selectedProvider) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider.account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard
            status == errSecSuccess,
            let data = item as? Data,
            let key = String(data: data, encoding: .utf8),
            !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return nil
        }

        return key
    }

    static func saveKey(_ key: String, for provider: Provider) throws {
        selectedProvider = provider
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedKey.isEmpty, let data = trimmedKey.data(using: .utf8) else {
            clearKey(for: provider)
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider.account
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var newItem = query
            newItem[kSecValueData as String] = data
            newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(newItem as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw APIKeyStoreError.keychainFailure(addStatus)
            }
            return
        }

        guard status == errSecSuccess else {
            throw APIKeyStoreError.keychainFailure(status)
        }
    }

    static func clearKey(for provider: Provider = selectedProvider) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider.account
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func loadOpenAIKey() -> String? {
        loadKey(for: .openAI)
    }

    static func saveOpenAIKey(_ key: String) throws {
        try saveKey(key, for: .openAI)
    }

    static func clearOpenAIKey() {
        clearKey(for: .openAI)
    }
}

enum APIKeyStoreError: LocalizedError {
    case keychainFailure(OSStatus)

    var errorDescription: String? {
        switch self {
        case .keychainFailure(let status):
            return "Keychain operation failed with status \(status)."
        }
    }
}
