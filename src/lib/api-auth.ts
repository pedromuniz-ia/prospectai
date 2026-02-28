import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";

export async function validateApiKey(
  authHeader: string | null
): Promise<{ organizationId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("pak_")) return null;

  const prefix = rawKey.slice(0, 12);

  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyPrefix, prefix),
  });

  if (!keyRecord) return null;

  const valid = await bcrypt.compare(rawKey, keyRecord.keyHash);
  if (!valid) return null;

  // Update lastUsedAt (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.id))
    .then(() => {})
    .catch(() => {});

  return { organizationId: keyRecord.organizationId };
}
