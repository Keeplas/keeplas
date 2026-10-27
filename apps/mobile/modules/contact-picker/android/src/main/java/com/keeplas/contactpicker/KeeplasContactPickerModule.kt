// Opens the system contacts app on its phone-number list and reads back the
// number the user picks, with the contact's name. The contacts app grants
// read access to that one data row, so Keeplas needs no READ_CONTACTS
// permission and never sees the rest of the address book.
package com.keeplas.contactpicker

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract.CommonDataKinds.Phone
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.Serializable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PickPhoneInput : Serializable

class PickPhoneContract : AppContextActivityResultContract<PickPhoneInput, Uri?> {
  override fun createIntent(context: Context, input: PickPhoneInput): Intent =
    Intent(Intent.ACTION_PICK).setType(Phone.CONTENT_TYPE)

  override fun parseResult(input: PickPhoneInput, resultCode: Int, intent: Intent?): Uri? =
    if (resultCode == Activity.RESULT_OK) intent?.data else null
}

class KeeplasContactPickerModule : Module() {
  private lateinit var pickPhoneLauncher: AppContextActivityResultLauncher<PickPhoneInput, Uri?>

  override fun definition() = ModuleDefinition {
    Name("KeeplasContactPicker")

    RegisterActivityContracts {
      pickPhoneLauncher = registerForActivityResult(PickPhoneContract())
    }

    AsyncFunction("pickPhone") Coroutine { ->
      pickPhoneLauncher.launch(PickPhoneInput())?.let { uri ->
        withContext(Dispatchers.IO) { readPhone(uri) }
      }
    }
  }

  /** The picked row's name and number; the number in E.164 when the contacts app normalized it. */
  private fun readPhone(uri: Uri): Map<String, String?>? {
    val resolver = (appContext.reactContext ?: throw Exceptions.ReactContextLost()).contentResolver
    val columns = arrayOf(Phone.DISPLAY_NAME, Phone.NUMBER, Phone.NORMALIZED_NUMBER)
    return resolver.query(uri, columns, null, null, null)?.use { cursor ->
      if (!cursor.moveToFirst()) return@use null
      mapOf(
        "name" to cursor.getString(0),
        "number" to (cursor.getString(2) ?: cursor.getString(1)),
      )
    }
  }
}
