"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  cn,
  Icon,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";
import { useTranslations } from "@/lib/i18n";

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
}

export function NotificationsMenu({
  variant = "sidebar",
}: NotificationsMenuProps) {
  const t = useTranslations("chrome");
  const [open, setOpen] = useState(false);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.getNotifications, {
    limit: 20,
  });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  async function handleMarkRead(id: Id<"notifications">) {
    await markAsRead({ notificationId: id });
  }

  const bellIcon = <Icon path={ICON_PATHS.bell} />;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-label-md text-secondary/70 hover:bg-surface-container-highest hover:translate-x-1 transition-transform cursor-pointer"
          aria-label={t("notifications.title")}
        >
          {bellIcon}
          <span className="flex-1 text-left">{t("notifications.title")}</span>
          {(unreadCount ?? 0) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-error text-on-error text-label-md flex items-center justify-center">
              {unreadCount! > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative p-2 rounded-xl text-on-primary/80 hover:text-on-primary hover:bg-primary-container/50 transition-colors cursor-pointer"
          aria-label={t("notifications.title")}
        >
          {bellIcon}
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />
          )}
        </button>
      )}

      <SheetContent
        side="right"
        className="flex flex-col w-full max-w-md bg-surface-container-low"
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Icon path={ICON_PATHS.bell} className="w-5 h-5 text-primary" />
            <SheetTitle>{t("notifications.title")}</SheetTitle>
          </div>
          <div className="flex items-center gap-2">
            {(unreadCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="px-3 py-1.5 rounded-full border border-outline-variant/30 text-body-md text-secondary hover:bg-surface-container transition-colors cursor-pointer"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
            <SheetClose
              aria-label={t("notifications.close")}
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              <Icon path={ICON_PATHS.close} className="w-5 h-5" />
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!notifications || notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
              <Icon
                path={ICON_PATHS.bell}
                className="w-10 h-10 text-on-surface-variant/40"
              />
              <p className="text-body-md text-on-surface-variant">
                {t("notifications.empty")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {notifications.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.isRead) handleMarkRead(n._id);
                      if (n.actionUrl) {
                        window.location.href = n.actionUrl;
                      }
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl bg-surface border border-outline-variant/15 hover:bg-surface-container transition-colors cursor-pointer",
                      !n.isRead && "border-secondary/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        path={
                          NOTIFICATION_ICON_PATHS[n.type] ??
                          NOTIFICATION_ICON_PATHS.system
                        }
                        className="w-4 h-4 text-secondary mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md font-medium text-on-surface">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-body-md text-on-surface-variant line-clamp-2 mt-1">
                            {n.body}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-label-md text-on-surface-variant/70">
                          <Icon path={ICON_PATHS.history} className="w-3 h-3" />
                          <span>{formatTimeAgo(n.createdAt)}</span>
                          {!n.isRead && (
                            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-secondary" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
