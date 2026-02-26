"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
import {
  getEvolutionAPI,
  type ConnectionState,
} from "@/lib/evolution-api";

export async function getInstances(organizationId: string) {
  return db.query.whatsappInstances.findMany({
    where: eq(whatsappInstances.organizationId, organizationId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

export async function connectInstance(
  organizationId: string,
  instanceName: string
) {
  const api = getEvolutionAPI();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/webhooks/evolution`;

  // Create instance on Evolution API
  const result = await api.createInstance({
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: {
      url: webhookUrl,
      byEvents: true,
      base64: true,
      events: [
        "MESSAGES_UPSERT",
        "QRCODE_UPDATED",
        "CONNECTION_UPDATE",
        "MESSAGES_UPDATE",
      ],
    },
  });

  // Save to DB
  const [instance] = await db
    .insert(whatsappInstances)
    .values({
      organizationId,
      instanceName,
      instanceId: result.instance.instanceId,
      status: "connecting",
      webhookUrl,
      qrCode: result.qrcode?.base64 ?? null,
    })
    .returning();

  return instance;
}

export async function fetchConnectionState(
  instanceName: string
): Promise<ConnectionState> {
  const api = getEvolutionAPI();
  return api.getConnectionState(instanceName);
}

export async function disconnectInstance(instanceId: string) {
  const instance = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.id, instanceId),
  });
  if (!instance) throw new Error("Instance not found");

  const api = getEvolutionAPI();

  try {
    await api.logoutInstance(instance.instanceName);
  } catch {
    // Instance may already be disconnected on Evolution API side
  }

  await db
    .update(whatsappInstances)
    .set({
      status: "disconnected",
      qrCode: null,
      updatedAt: new Date(),
    })
    .where(eq(whatsappInstances.id, instanceId));
}

export async function deleteInstance(instanceId: string) {
  const instance = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.id, instanceId),
  });
  if (!instance) throw new Error("Instance not found");

  const api = getEvolutionAPI();

  try {
    await api.deleteInstance(instance.instanceName);
  } catch {
    // Instance may not exist on Evolution API side
  }

  await db
    .delete(whatsappInstances)
    .where(eq(whatsappInstances.id, instanceId));
}

export async function refreshInstanceStatus(instanceId: string) {
  const instance = await db.query.whatsappInstances.findFirst({
    where: eq(whatsappInstances.id, instanceId),
  });
  if (!instance) throw new Error("Instance not found");

  const api = getEvolutionAPI();

  try {
    const state = await api.getConnectionState(instance.instanceName);
    const statusMap = {
      open: "connected",
      close: "disconnected",
      connecting: "connecting",
    } as const;

    const newStatus = statusMap[state.instance.state] ?? "disconnected";

    await db
      .update(whatsappInstances)
      .set({
        status: newStatus,
        qrCode: newStatus === "connected" ? null : instance.qrCode,
        updatedAt: new Date(),
      })
      .where(eq(whatsappInstances.id, instanceId));

    return newStatus;
  } catch {
    return instance.status;
  }
}
