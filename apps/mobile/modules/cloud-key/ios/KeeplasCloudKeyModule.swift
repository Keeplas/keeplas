// Stores the Cloud Backup Key (CBK) as a synchronizable Keychain item so iCloud
// Keychain (end-to-end encrypted) restores it on a new iPhone signed in to the
// same Apple account. expo-secure-store only writes device-bound items.
// Deleting the item is half of turning cloud backup off.
//
// Synchronizable items cannot be *ThisDeviceOnly; WhenUnlocked is the
// strictest class that still syncs. The CBK is only used in the foreground
// (turning the backup on, restoring), so a locked phone never needs it.
import ExpoModulesCore
import Foundation
import Security

private let service = "com.keeplas.cloud-backup"

public class KeeplasCloudKeyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KeeplasCloudKey")

    // CBKs written before were AfterFirstUnlock (readable on a locked phone
    // once unlocked after boot). Best effort: a phone that is locked right
    // now upgrades at a later launch.
    OnCreate {
      let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrSynchronizable: kSecAttrSynchronizableAny,
        kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
      ]
      let update: [CFString: Any] = [kSecAttrAccessible: kSecAttrAccessibleWhenUnlocked]
      SecItemUpdate(query as CFDictionary, update as CFDictionary)
    }

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
        kSecAttrAccessible: kSecAttrAccessibleWhenUnlocked,
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
