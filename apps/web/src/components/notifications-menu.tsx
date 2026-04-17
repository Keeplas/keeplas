"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";

const NOTIFICATION_ICONS: Record<string, string> = {
  life_check:
    "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  access_request:
    "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z",
  contact_invited:
    "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z",
  contact_confirmed:
    "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  security_alert:
    "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  system:
    "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

  async function handleMarkRead(id: string) {
    await markAsRead({ notificationId: id as any });
  }

  const bellIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );

  return (
    <div className="relative">
      {variant === "sidebar" ? (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-medium uppercase tracking-widest text-secondary/70 hover:bg-surface-container-highest hover:translate-x-1 transition-transform cursor-pointer"
          aria-label="Notifications"
        >
          {bellIcon}
          <span className="flex-1 text-left">Notifications</span>
          {(unreadCount ?? 0) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
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
              <span className="font-headline font-bold text-sm text-primary">
                Notifications
              </span>
              {(unreadCount ?? 0) > 0 && (
                <button
                  onClick={() => {
                    markAllAsRead();
                    setOpen(false);
                  }}
                  className="text-xs text-secondary font-medium cursor-pointer hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-on-surface-variant">
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
                      <svg
                        className="w-4 h-4 text-secondary mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={NOTIFICATION_ICONS[n.type] ?? NOTIFICATION_ICONS.system}
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">
                          {n.title}
                        </p>
                        <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60 mt-1">
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
