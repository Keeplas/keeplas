"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn, Icon } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";

const NOTIFICATION_ICON_PATHS: Record<string, string> = {
  life_check: ICON_PATHS.heartbeat,
  access_request: ICON_PATHS.lock,
  contact_invited: ICON_PATHS.userPlus,
  contact_confirmed: ICON_PATHS.shieldCheck,
  security_alert: ICON_PATHS.warning,
  system: ICON_PATHS.settings,
};

interface NotificationsMenuProps {
  /** Trigger variant. "sidebar" = full-width pill row; "icon" = square icon button. */
  variant?: "sidebar" | "icon";
  /** Alignment of the popover relative to the trigger. */
  align?: "start" | "end";
}

export function NotificationsMenu({
  variant = "sidebar",
  align = "start",
}: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.getNotifications, { limit: 10 });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  async function handleMarkRead(id: Id<"notifications">) {
    await markAsRead({ notificationId: id });
  }

  const bellIcon = <Icon path={ICON_PATHS.bell} />;

  return (
    <div className="relative">
      {variant === "sidebar" ? (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-label-md text-secondary/70 hover:bg-surface-container-highest hover:translate-x-1 transition-transform cursor-pointer"
          aria-label="Notifications"
        >
          {bellIcon}
          <span className="flex-1 text-left">Notifications</span>
          {(unreadCount ?? 0) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-error text-on-error text-label-md flex items-center justify-center">
              {unreadCount! > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="relative p-2 rounded-xl text-on-primary/80 hover:text-on-primary hover:bg-primary-container/50 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          {bellIcon}
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />
          )}
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-50 mt-2 w-80 bg-surface rounded-2xl shadow-2xl overflow-hidden",
              variant === "sidebar" ? "left-0 top-full" : align === "end" ? "right-0 top-full" : "left-0 top-full"
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
              <span className="text-headline-sm text-primary">
                Notifications
              </span>
              {(unreadCount ?? 0) > 0 && (
                <button
                  onClick={() => {
                    markAllAsRead();
                    setOpen(false);
                  }}
                  className="text-body-md text-secondary font-medium cursor-pointer hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="p-6 text-center text-body-md text-on-surface-variant">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => {
                      if (!n.isRead) handleMarkRead(n._id);
                      if (n.actionUrl) {
                        window.location.href = n.actionUrl;
                      }
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer",
                      !n.isRead && "bg-secondary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        path={NOTIFICATION_ICON_PATHS[n.type] ?? NOTIFICATION_ICON_PATHS.system}
                        className="w-4 h-4 text-secondary mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md font-medium text-on-surface truncate">
                          {n.title}
                        </p>
                        <p className="text-body-md text-on-surface-variant line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                        <p className="text-label-md text-on-surface-variant/60 mt-1">
                          {formatTimeAgo(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
