// Keeps small device-only secrets behind the phone's screen lock. Each value is
// AES-GCM-encrypted by its own Android Keystore key that only works after the
// user passes a strong biometric OR the device PIN / pattern / password, so a
// phone with just a PIN can use it. expo-secure-store's requireAuthentication
// accepts strong biometrics only. The ciphertext and its key alias sit in
// private SharedPreferences; the key never leaves the Keystore.
package com.keeplas.devicelock

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

private const val KEYSTORE = "AndroidKeyStore"
private const val PREFS = "keeplas.device-lock"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val IV_LENGTH = 12
private const val TAG_BITS = 128

// Before Android 11 a Keystore key cannot be bound per use to "biometric or
// device credential", so it stays usable this many seconds after the prompt.
private const val LEGACY_AUTH_WINDOW_SECONDS = 10

class DeviceLockException(message: String) : CodedException(message)

class KeeplasDeviceLockModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val prefs
    get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("KeeplasDeviceLock")

    Function("isDeviceSecure") {
      context.getSystemService(KeyguardManager::class.java).isDeviceSecure
    }

    // A new key under a new alias, swapped in only once the value is sealed:
    // cancelling the prompt leaves the previous value readable.
    AsyncFunction("setItem") Coroutine { key: String, value: String, prompt: String ->
      val alias = "keeplas.device-lock.$key.${UUID.randomUUID()}"
      val sealed = try {
        val secretKey = createKey(alias)
        val cipher = unlockedCipher(prompt) { it.init(Cipher.ENCRYPT_MODE, secretKey) }
        cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      } catch (e: Throwable) {
        keyStore().deleteEntry(alias)
        throw e
      }
      val previousAlias = prefs.getString(aliasPref(key), null)
      prefs.edit()
        .putString(key, Base64.encodeToString(sealed, Base64.NO_WRAP))
        .putString(aliasPref(key), alias)
        .commit()
      previousAlias?.let { keyStore().deleteEntry(it) }
      Unit
    }

    AsyncFunction("getItem") Coroutine { key: String, prompt: String ->
      val stored = prefs.getString(key, null)
      val secretKey = prefs.getString(aliasPref(key), null)
        ?.let { keyStore().getKey(it, null) as SecretKey? }
      if (stored == null || secretKey == null) {
        null
      } else {
        val sealed = Base64.decode(stored, Base64.NO_WRAP)
        val cipher = unlockedCipher(prompt) {
          it.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(TAG_BITS, sealed, 0, IV_LENGTH))
        }
        String(cipher.doFinal(sealed, IV_LENGTH, sealed.size - IV_LENGTH), Charsets.UTF_8)
      }
    }

    AsyncFunction("deleteItem") { key: String ->
      prefs.getString(aliasPref(key), null)?.let { keyStore().deleteEntry(it) }
      prefs.edit().remove(key).remove(aliasPref(key)).commit()
      Unit
    }
  }

  private fun aliasPref(key: String) = "$key.alias"

  private fun keyStore() = KeyStore.getInstance(KEYSTORE).apply { load(null) }

  /** A new screen-lock-bound AES-256 Keystore key under `alias`. */
  private fun createKey(alias: String): SecretKey {
    val spec = KeyGenParameterSpec.Builder(
      alias,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      // The PIN opens it anyway, so a newly enrolled fingerprint grants
      // nothing the PIN did not; keep the key (iOS .userPresence agrees).
      .setInvalidatedByBiometricEnrollment(false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      spec.setUserAuthenticationParameters(
        0,
        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL,
      )
    } else {
      @Suppress("DEPRECATION")
      spec.setUserAuthenticationValidityDurationSeconds(LEGACY_AUTH_WINDOW_SECONDS)
    }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
      .apply { init(spec.build()) }
      .generateKey()
  }

  /**
   * Shows the screen-lock prompt and returns `init`'s cipher ready to use.
   * Android 11+ binds the prompt to this one operation (CryptoObject); older
   * versions open the key's short validity window, then init the cipher.
   */
  private suspend fun unlockedCipher(prompt: String, init: (Cipher) -> Unit): Cipher {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      init(cipher)
      val result = authenticate(
        prompt,
        BIOMETRIC_STRONG or DEVICE_CREDENTIAL,
        BiometricPrompt.CryptoObject(cipher),
      )
      return result.cryptoObject?.cipher
        ?: throw DeviceLockException("The screen lock prompt returned no cipher")
    }
    // androidx.biometric does not allow BIOMETRIC_STRONG with DEVICE_CREDENTIAL below Android 11.
    authenticate(prompt, BIOMETRIC_WEAK or DEVICE_CREDENTIAL, null)
    init(cipher)
    return cipher
  }

  private suspend fun authenticate(
    title: String,
    authenticators: Int,
    crypto: BiometricPrompt.CryptoObject?,
  ): BiometricPrompt.AuthenticationResult {
    val activity = appContext.currentActivity as? FragmentActivity
      ?: throw DeviceLockException("The app must be in the foreground to show the screen lock")
    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setAllowedAuthenticators(authenticators)
      .build()
    return withContext(Dispatchers.Main) {
      suspendCancellableCoroutine { continuation ->
        val biometricPrompt = BiometricPrompt(
          activity,
          ContextCompat.getMainExecutor(activity),
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              continuation.resume(result)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              continuation.resumeWithException(DeviceLockException("$errString ($errorCode)"))
            }
          },
        )
        continuation.invokeOnCancellation { biometricPrompt.cancelAuthentication() }
        if (crypto != null) biometricPrompt.authenticate(info, crypto) else biometricPrompt.authenticate(info)
      }
    }
  }
}
