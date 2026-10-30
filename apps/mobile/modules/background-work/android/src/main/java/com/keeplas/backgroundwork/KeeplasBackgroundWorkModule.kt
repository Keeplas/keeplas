// Keeps one user-started job (the vault export) running while Keeplas is in
// the background, through a foreground service with a progress notification.
package com.keeplas.backgroundwork

import android.app.NotificationManager
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KeeplasBackgroundWorkModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var title = ""
  private var subtitle = ""

  // Cleared on the main thread when the system stops the service.
  @Volatile private var running = false

  override fun definition() = ModuleDefinition {
    Name("KeeplasBackgroundWork")

    // The system stopped the job before `end`: JS cancels it.
    Events("onExpire")

    OnCreate { BackgroundWorkService.onExpire = { expire() } }

    OnDestroy { BackgroundWorkService.onExpire = null }

    AsyncFunction("begin") { title: String, subtitle: String ->
      this@KeeplasBackgroundWorkModule.title = title
      this@KeeplasBackgroundWorkModule.subtitle = subtitle
      running = true
      ContextCompat.startForegroundService(
        context,
        Intent(context, BackgroundWorkService::class.java)
          .putExtra(BackgroundWorkService.EXTRA_TITLE, title)
          .putExtra(BackgroundWorkService.EXTRA_SUBTITLE, subtitle),
      )
    }

    AsyncFunction("progress") { done: Int, total: Int ->
      // A late update must not re-post the notification of a stopped service.
      if (!running) return@AsyncFunction
      context
        .getSystemService(NotificationManager::class.java)
        .notify(
          BackgroundWorkService.NOTIFICATION_ID,
          BackgroundWorkService.notification(context, title, subtitle, done, total),
        )
    }

    AsyncFunction("end") { _: Boolean ->
      running = false
      context.stopService(Intent(context, BackgroundWorkService::class.java))
      // A progress update racing an expiry may have re-posted it.
      context
        .getSystemService(NotificationManager::class.java)
        .cancel(BackgroundWorkService.NOTIFICATION_ID)
    }
  }

  private fun expire() {
    running = false
    sendEvent("onExpire")
  }
}
