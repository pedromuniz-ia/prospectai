"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { extractionJobs, extractionLogs } from "@/db/schema/extraction-jobs";
import { aiProviders } from "@/db/schema/ai-providers";
import { extractionQueue } from "@/lib/queue";

export async function getExtractionLogs(jobId: string) {
  return db.query.extractionLogs.findMany({
    where: eq(extractionLogs.jobId, jobId),
    orderBy: [desc(extractionLogs.createdAt)],
    limit: 50,
  });
}

import { generateText } from "ai";
import { getModel } from "../ai/provider-registry";

export type ExtractionConfig = {
  query?: string;
  city?: string;
  state?: string;
  searchStrings?: string[];
  maxResults: number;
  prompt?: string;
};

export async function parseExtractionPrompt(organizationId: string, prompt: string) {
  const provider = await db.query.aiProviders.findFirst({
    where: eq(aiProviders.organizationId, organizationId),
  });

  if (!provider) {
    // If no provider, split by common separators as fallback
    const parts = prompt.split(/ em | no | na | near /i);
    const query = parts[0]?.trim();
    const locations = parts[1]?.split(/, | e | and /i).map(l => l.trim()) ?? [];

    return {
      query,
      locations: locations.length ? locations : ["São Paulo, SP"],
      explanation: "Processado localmente (configurar IA para melhor precisão)."
    };
  }

  const model = getModel(provider);

  try {
    const { text } = await generateText({
      model,
      system: `Você é um especialista em estruturação de dados para busca de leads. 
Sua tarefa é extrair o QUE o usuário quer buscar e ONDE (cidades/regiões).
Retorne APENAS um JSON válido no formato:
{
  "query": "segmento/negócio",
  "locations": ["Cidade, UF", "Região, UF"],
  "explanation": "Breve resumo do que foi identificado"
}`,
      prompt: `Estruture o seguinte pedido de extração: "${prompt}"`,
    });

    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.error("[Extraction AI Error]:", err);

    // AI Error Fallback (Local Engine)
    const parts = prompt.split(/ em | no | na | near /i);
    const query = parts[0]?.trim();
    const rawLocations = parts[1]?.split(/, | e | and /i).map(l => l.trim()) ?? [];
    const locations = rawLocations.length ? rawLocations : ["Goiânia, GO"];

    return {
      query: query || prompt,
      locations,
      explanation: "Processado via engine local (IA indisponível ou limite excedido)."
    };
  }
}

export async function startExtraction(
  organizationId: string,
  config: ExtractionConfig
) {
  const [job] = await db
    .insert(extractionJobs)
    .values({
      organizationId,
      type: "apify_gmaps",
      status: "pending",
      config,
    })
    .returning();

  await extractionQueue.add("apify-gmaps", {
    organizationId,
    query: config.query,
    city: config.city,
    state: config.state,
    searchStrings: config.searchStrings,
    maxResults: config.maxResults,
    extractionJobId: job.id,
  });

  return job;
}

export async function getExtractionJobs(organizationId: string) {
  return db.query.extractionJobs.findMany({
    where: eq(extractionJobs.organizationId, organizationId),
    orderBy: [desc(extractionJobs.createdAt)],
    limit: 30,
  });
}

export async function savePreset(
  organizationId: string,
  preset: { name: string; query: string; city: string; state: string; maxResults: number }
) {
  const presetId = createId();

  await db.insert(auditLogs).values({
    organizationId,
    action: "save_extraction_preset",
    entityType: "extraction_preset",
    entityId: presetId,
    metadata: preset,
  });

  return {
    id: presetId,
    ...preset,
  };
}

export async function getPresets(organizationId: string) {
  const rows = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.entityType, "extraction_preset")
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit: 20,
  });

  return rows
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      if (!metadata.query || !metadata.city || !metadata.state) return null;
      return {
        id: row.entityId,
        name: String(metadata.name ?? "Preset sem nome"),
        query: String(metadata.query),
        city: String(metadata.city),
        state: String(metadata.state),
        maxResults: Number(metadata.maxResults ?? 25),
      };
    })
    .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset));
}
