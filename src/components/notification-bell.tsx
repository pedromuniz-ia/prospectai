"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellDot,
  Bot,
  CheckCircle2,
  MessageSquare,
  Pause,
  WifiOff,
} from "lucide-react";
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
type NotificationType = "lead_replied" | "campaign_paused" | "instance_disconnected" | "ai_needs_review" | "extraction_complete";

const iconByType: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  lead_replied: MessageSquare,
  campaign_paused: Pause,
  instance_disconnected: WifiOff,
  ai_needs_review: Bot,
  extraction_complete: CheckCircle2,
};

const hrefByType: Record<NotificationType, (entityId?: string | null) => string> = {
  lead_replied: (entityId) => entityId ? `/inbox?leadId=${entityId}` : "/inbox",
  campaign_paused: () => "/campaigns",
  instance_disconnected: () => "/settings/whatsapp",
  ai_needs_review: (entityId) => entityId ? `/inbox?leadId=${entityId}` : "/inbox",
  extraction_complete: () => "/extraction",
};

export function NotificationBell() {
  const router = useRouter();
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

    // Mark all visible unread notifications as read
    const unread = data.rows.filter((row) => !row.read);
    await Promise.all(
      unread.map((row) => markNotificationRead(organizationId, row.id))
    );
    await load();
  }

  function handleNotificationClick(notification: NotificationsResult["rows"][number]) {
    const getHref = hrefByType[notification.type as NotificationType];
    if (getHref) {
      setOpen(false);
      router.push(getHref(notification.entityId));
    }
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
              Marcar todas como lidas
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
              {data.rows.map((notification) => {
                const IconComponent = iconByType[notification.type as NotificationType] ?? Bell;
                return (
                  <button
                    key={notification.id}
                    className="w-full space-y-1 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {notification.title}
                        </p>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs pl-6">
                          {notification.body}
                        </p>
                      </div>
                      {!notification.read && <Badge variant="default">Nova</Badge>}
                    </div>
                    <p className="text-muted-foreground text-[11px] pl-6">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
