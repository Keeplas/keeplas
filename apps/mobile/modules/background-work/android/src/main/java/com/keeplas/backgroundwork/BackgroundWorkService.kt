// Foreground service that keeps the Keeplas process running while the vault
// export works in the background. It does no work itself: the export runs in
// JS; this only holds the progress notification Android requires.
package com.keeplas.backgroundwork

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class BackgroundWorkService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE).orEmpty()
    val subtitle = intent?.getStringExtra(EXTRA_SUBTITLE).orEmpty()
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification(this, title, subtitle, 0, 0),
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      } else {
        0
      },
    )
    return START_NOT_STICKY
  }

  // Android 15+ caps data-sync services; the service must stop when told.
  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  companion object {
    const val NOTIFICATION_ID = 7301
    const val EXTRA_TITLE = "title"
    const val EXTRA_SUBTITLE = "subtitle"
    private const val CHANNEL_ID = "background-work"

    fun notification(
      context: Context,
      title: String,
      subtitle: String,
      done: Int,
      total: Int,
    ): Notification {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, title, NotificationManager.IMPORTANCE_LOW),
        )
      }
      // expo-notifications ships the monochrome `notification_icon` drawable.
      val icon =
        context.resources
          .getIdentifier("notification_icon", "drawable", context.packageName)
          .takeIf { it != 0 } ?: context.applicationInfo.icon
      val open =
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
          PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
        }
      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(icon)
        .setContentTitle(title)
        .setContentText(subtitle)
        .setContentIntent(open)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(total, done, total == 0)
        .build()
    }
  }
}
