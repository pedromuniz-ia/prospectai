import { db } from "@/db";
import { notifications } from "@/db/schema/notifications";

export type NotificationType =
  | "lead_replied"
  | "campaign_paused"
  | "instance_disconnected"
  | "ai_needs_review"
  | "extraction_complete";

export async function createNotificationRecord(input: {
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning();

  return notification;
}
