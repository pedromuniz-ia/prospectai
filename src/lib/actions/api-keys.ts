"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";

export async function generateApiKey(organizationId: string, name: string = "Default") {
  // Generate a secure random key: "pak_" + 40 random hex chars
  const rawKey = `pak_${randomBytes(20).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12); // "pak_" + 8 chars
  const keyHash = await bcrypt.hash(rawKey, 10);

  // Delete existing key for this org (one key per org)
  await db.delete(apiKeys).where(eq(apiKeys.organizationId, organizationId));

  await db.insert(apiKeys).values({
    organizationId,
    name,
    keyHash,
    keyPrefix,
  });

  revalidatePath("/settings/integrations");

  // Return the raw key ONCE — never stored in plain text
  return { key: rawKey, prefix: keyPrefix };
}

export async function revokeApiKey(organizationId: string) {
  await db.delete(apiKeys).where(eq(apiKeys.organizationId, organizationId));
  revalidatePath("/settings/integrations");
}

export async function getApiKeyInfo(organizationId: string) {
  return db.query.apiKeys.findFirst({
    where: eq(apiKeys.organizationId, organizationId),
    columns: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });
}
