"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { getModel } from "@/lib/ai/provider-registry";

export async function getAIProviders(organizationId: string) {
  return db.query.aiProviders.findMany({
    where: eq(aiProviders.organizationId, organizationId),
    orderBy: [desc(aiProviders.isDefault), asc(aiProviders.label)],
  });
}

export async function createAIProvider(
  input: Omit<typeof aiProviders.$inferInsert, "id" | "createdAt" | "updatedAt" | "isActive"> & {
    setAsDefault?: boolean;
  }
) {
  if (input.setAsDefault) {
    await db
      .update(aiProviders)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(aiProviders.organizationId, input.organizationId));
  }

  const [created] = await db
    .insert(aiProviders)
    .values({
      organizationId: input.organizationId,
      provider: input.provider,
      label: input.label,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl ?? null,
      defaultModel: input.defaultModel,
      availableModels: input.availableModels ?? null,
      isDefault: input.setAsDefault ?? false,
      isActive: true,
    })
    .returning();

  return created;
}

export async function updateAIProvider(
  providerId: string,
  input: Partial<Omit<typeof aiProviders.$inferInsert, "id" | "organizationId">>
) {
  const [updated] = await db
    .update(aiProviders)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(aiProviders.id, providerId))
    .returning();

  return updated;
}

export async function deleteAIProvider(providerId: string) {
  await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
}

export async function setDefaultAIProvider(
  organizationId: string,
  providerId: string
) {
  await db
    .update(aiProviders)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(aiProviders.organizationId, organizationId));

  const [updated] = await db
    .update(aiProviders)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiProviders.organizationId, organizationId),
        eq(aiProviders.id, providerId)
      )
    )
    .returning();

  return updated;
}

export async function testAIProvider(providerId: string) {
  const provider = await db.query.aiProviders.findFirst({
    where: eq(aiProviders.id, providerId),
  });

  if (!provider) {
    throw new Error("Provider não encontrado.");
  }

  const model = getModel(provider);

  const { text } = await generateText({
    model,
    prompt: "Responda apenas com OK",
    maxOutputTokens: 20,
    temperature: 0,
  });

  return {
    ok: /ok/i.test(text),
    response: text,
  };
}
