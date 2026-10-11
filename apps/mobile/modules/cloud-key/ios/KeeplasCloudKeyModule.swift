// Stores the Cloud Backup Key (CBK) as a synchronizable Keychain item so iCloud
// Keychain (end-to-end encrypted) restores it on a new iPhone signed in to the
// same Apple account. expo-secure-store only writes device-bound items.
// Deleting the item is half of turning cloud backup off.
import ExpoModulesCore
import Foundation
import Security

private let service = "com.keeplas.cloud-backup"

public class KeeplasCloudKeyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KeeplasCloudKey")

    // iCloud Keychain sync is always end-to-end encrypted.
    AsyncFunction("isEndToEndEncrypted") { () -> Bool in
      true
    }

    AsyncFunction("write") { (key: String, value: String) throws in
      try deleteItem(key)
      let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: key,
        kSecAttrSynchronizable: kCFBooleanTrue as Any,
        // Synchronizable items cannot use a *ThisDeviceOnly accessibility.
        kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
        kSecValueData: Data(value.utf8),
      ]
      let status = SecItemAdd(query as CFDictionary, nil)
      guard status == errSecSuccess else {
        throw keychainError("write", status)
      }
    }

    AsyncFunction("read") { (key: String) throws -> String? in
      let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: key,
        kSecAttrSynchronizable: kSecAttrSynchronizableAny,
        kSecReturnData: kCFBooleanTrue as Any,
        kSecMatchLimit: kSecMatchLimitOne,
      ]
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecItemNotFound {
        return nil
      }
      guard status == errSecSuccess, let data = result as? Data else {
        throw keychainError("read", status)
      }
      return String(data: data, encoding: .utf8)
    }

    AsyncFunction("remove") { (key: String) throws in
      try deleteItem(key)
    }
  }
}

/// Deletes the synced (or legacy non-synced) item; a missing item is success.
private func deleteItem(_ key: String) throws {
  let query: [CFString: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: service,
    kSecAttrAccount: key,
    kSecAttrSynchronizable: kSecAttrSynchronizableAny,
  ]
  let status = SecItemDelete(query as CFDictionary)
  guard status == errSecSuccess || status == errSecItemNotFound else {
    throw keychainError("remove", status)
  }
}

private func keychainError(_ operation: String, _ status: OSStatus) -> Exception {
  let message = SecCopyErrorMessageString(status, nil) as String? ?? "unknown error"
  return Exception(
    name: "CloudKeyKeychainException",
    description: "Keychain \(operation) failed (OSStatus \(status)): \(message)",
    code: "ERR_CLOUD_KEY_KEYCHAIN"
  )
}
