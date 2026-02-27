"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";
import {
  createNotificationRecord,
  type NotificationType,
} from "@/lib/notifications";

export async function createNotification(input: {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return createNotificationRecord(input);
}

export async function getNotifications(organizationId: string, limit = 20) {
  const rows = await db.query.notifications.findMany({
    where: eq(notifications.organizationId, organizationId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  const [{ unreadCount }] = await db
    .select({ unreadCount: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.read, false)
      )
    );

  return {
    rows,
    unreadCount,
  };
}

export async function markAllNotificationsRead(organizationId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.organizationId, organizationId));
}

export async function markNotificationRead(
  organizationId: string,
  notificationId: string
) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.id, notificationId)
      )
    );
}
