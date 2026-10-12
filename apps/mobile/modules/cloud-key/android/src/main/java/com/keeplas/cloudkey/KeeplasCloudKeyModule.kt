// Stores the Cloud Backup Key (CBK) in Google Play services Block Store with
// cloud backup on, so it is restored on a new Android phone signed in to the
// same Google account (end-to-end encrypted when the device has a screen lock).
// expo-secure-store is device-bound and cannot do this. Deleting the entry is
// half of turning cloud backup off.
package com.keeplas.cloudkey

import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.tasks.await

class KeeplasCloudKeyModule : Module() {
  private val client: BlockstoreClient
    get() = Blockstore.getClient(appContext.reactContext ?: throw Exceptions.ReactContextLost())

  override fun definition() = ModuleDefinition {
    Name("KeeplasCloudKey")

    AsyncFunction("isEndToEndEncrypted") Coroutine { ->
      client.isEndToEndEncryptionAvailable.await()
    }

    AsyncFunction("write") Coroutine { key: String, value: String ->
      val data = StoreBytesData.Builder()
        .setBytes(value.toByteArray(Charsets.UTF_8))
        .setKey(key)
        .setShouldBackupToCloud(true)
        .build()
      client.storeBytes(data).await()
      Unit
    }

    AsyncFunction("read") Coroutine { key: String ->
      val request = RetrieveBytesRequest.Builder().setKeys(listOf(key)).build()
      val response = client.retrieveBytes(request).await()
      response.blockstoreDataMap[key]?.bytes?.toString(Charsets.UTF_8)
    }

    AsyncFunction("remove") Coroutine { key: String ->
      val request = DeleteBytesRequest.Builder().setKeys(listOf(key)).build()
      client.deleteBytes(request).await()
      Unit
    }
  }
}
