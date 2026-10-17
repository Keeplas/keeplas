// Keeps small device-only secrets in the Keychain behind the phone's screen
// lock: `.userPresence` releases them after Face ID / Touch ID OR the iPhone
// passcode, so a phone with just a passcode can use it. expo-secure-store's
// requireAuthentication uses `.biometryCurrentSet` (biometrics only). Items
// are deleted by iOS if the passcode is turned off.
import ExpoModulesCore
import Foundation
import LocalAuthentication
import Security

private let service = "com.keeplas.device-lock"

public class KeeplasDeviceLockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KeeplasDeviceLock")

    // Face ID / Touch ID need a passcode, so this covers every screen lock.
    Function("isDeviceSecure") { () -> Bool in
      LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    // Writing does not prompt on iOS; `prompt` is used by Android only.
    AsyncFunction("setItem") { (key: String, value: String, _: String) throws in
      var error: Unmanaged<CFError>?
      guard let access = SecAccessControlCreateWithFlags(
        nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .userPresence, &error
      ) else {
        throw Exception(
          name: "DeviceLockAccessControlException",
          description: "Access control failed: \(String(describing: error?.takeRetainedValue()))",
          code: "ERR_DEVICE_LOCK_ACCESS_CONTROL"
        )
      }
      try deleteItem(key)
      let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: key,
        kSecAttrAccessControl: access,
        kSecValueData: Data(value.utf8),
      ]
      let status = SecItemAdd(query as CFDictionary, nil)
      guard status == errSecSuccess else {
        throw keychainError("write", status)
      }
    }

    AsyncFunction("getItem") { (key: String, prompt: String) throws -> String? in
      let context = LAContext()
      context.localizedReason = prompt
      let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: key,
        kSecUseAuthenticationContext: context,
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

    AsyncFunction("deleteItem") { (key: String) throws in
      try deleteItem(key)
    }
  }
}

/// Deletes the item; a missing item is success. Deleting never prompts.
private func deleteItem(_ key: String) throws {
  let query: [CFString: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: service,
    kSecAttrAccount: key,
  ]
  let status = SecItemDelete(query as CFDictionary)
  guard status == errSecSuccess || status == errSecItemNotFound else {
    throw keychainError("remove", status)
  }
}

private func keychainError(_ operation: String, _ status: OSStatus) -> Exception {
  let message = SecCopyErrorMessageString(status, nil) as String? ?? "unknown error"
  return Exception(
    name: "DeviceLockKeychainException",
    description: "Keychain \(operation) failed (OSStatus \(status)): \(message)",
    code: "ERR_DEVICE_LOCK_KEYCHAIN"
  )
}
