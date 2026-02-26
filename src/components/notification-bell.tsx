"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellDot } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/helpers";

type NotificationsResult = Awaited<ReturnType<typeof getNotifications>>;

const iconByType = {
  lead_replied: "💬",
  campaign_paused: "⏸",
  instance_disconnected: "📴",
  ai_needs_review: "🤖",
  extraction_complete: "✅",
} as const;

export function NotificationBell() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [data, setData] = useState<NotificationsResult>({
    rows: [],
    unreadCount: 0,
  });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const next = await getNotifications(organizationId, 30);
    setData(next);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!organizationId) return;

    const interval = setInterval(() => {
      load();
    }, 10_000);

    return () => clearInterval(interval);
  }, [load, organizationId]);

  async function handleMarkAllRead() {
    if (!organizationId) return;
    await markAllNotificationsRead(organizationId);
    await load();
  }

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || !organizationId) return;

    const unread = data.rows.filter((row) => !row.read).slice(0, 5);
    await Promise.all(
      unread.map((row) => markNotificationRead(organizationId, row.id))
    );
    await load();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          {data.unreadCount > 0 ? (
            <BellDot className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {data.unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {Math.min(data.unreadCount, 99)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Notificações</p>
            <Button variant="ghost" size="xs" onClick={handleMarkAllRead}>
              Marcar tudo
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Eventos operacionais da sua prospecção
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {data.rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem notificações por enquanto.
            </div>
          ) : (
            <div className="divide-y">
              {data.rows.map((notification) => (
                <div key={notification.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        <span className="mr-2">{iconByType[notification.type]}</span>
                        {notification.title}
                      </p>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {notification.body}
                      </p>
                    </div>
                    {!notification.read && <Badge variant="default">Nova</Badge>}
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
