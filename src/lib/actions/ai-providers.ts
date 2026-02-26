"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import { aiProviders } from "@/db/schema/ai-providers";
import { getModel, getProviderBaseUrl } from "@/lib/ai/provider-registry";

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

export async function listAvailableModels(
  providerId: string
): Promise<{ id: string; name: string }[]> {
  const provider = await db.query.aiProviders.findFirst({
    where: eq(aiProviders.id, providerId),
  });

  if (!provider) throw new Error("Provider não encontrado.");

  const baseUrl = getProviderBaseUrl(provider);
  if (!baseUrl) return [];

  try {
    let models: { id: string; name: string }[] = [];

    if (provider.provider === "anthropic") {
      // Anthropic uses a different header and response format
      const res = await fetch(`${baseUrl}/models`, {
        headers: {
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data: { id: string; display_name: string }[] };
      models = data.data
        .filter((m) => m.id.includes("claude"))
        .map((m) => ({ id: m.id, name: m.display_name || m.id }));
    } else if (provider.provider === "google") {
      // Google Gemini uses API key as query param
      const res = await fetch(`${baseUrl}/models?key=${provider.apiKey}`);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        models: { name: string; displayName: string; supportedGenerationMethods: string[] }[];
      };
      models = data.models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName || m.name,
        }));
    } else {
      // OpenAI-compatible (openai, groq, together, fireworks, openai_compatible)
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data: { id: string; owned_by?: string }[] };
      models = data.data
        .filter((m) => {
          const id = m.id.toLowerCase();
          // Filter out embeddings, moderation, tts, whisper, dall-e
          return (
            !id.includes("embedding") &&
            !id.includes("moderation") &&
            !id.includes("tts") &&
            !id.includes("whisper") &&
            !id.includes("dall-e")
          );
        })
        .map((m) => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    // Cache models in DB
    await db
      .update(aiProviders)
      .set({
        availableModels: models.map((m) => m.id),
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, providerId));

    return models;
  } catch {
    // If API call fails, return cached models if any
    if (provider.availableModels) {
      return provider.availableModels.map((id) => ({ id, name: id }));
    }
    return [];
  }
}
