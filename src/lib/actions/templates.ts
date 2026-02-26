"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema/message-templates";

const shortcutRegex = /^[a-z0-9-]+$/;

function normalizeShortcut(shortcut: string) {
  return shortcut.trim().toLowerCase().replace(/^\//, "");
}

async function assertUniqueShortcut(
  organizationId: string,
  shortcut: string,
  ignoreTemplateId?: string
) {
  const existing = await db.query.messageTemplates.findFirst({
    where: and(
      eq(messageTemplates.organizationId, organizationId),
      eq(messageTemplates.shortcut, shortcut)
    ),
  });

  if (existing && existing.id !== ignoreTemplateId) {
    throw new Error("Shortcut já existe.");
  }
}

export async function getTemplates(organizationId: string) {
  return db.query.messageTemplates.findMany({
    where: eq(messageTemplates.organizationId, organizationId),
    orderBy: [asc(messageTemplates.shortcut)],
  });
}

export async function createTemplate(input: {
  organizationId: string;
  shortcut: string;
  title: string;
  content: string;
  category?: string | null;
}) {
  const shortcut = normalizeShortcut(input.shortcut);

  if (!shortcutRegex.test(shortcut)) {
    throw new Error("Shortcut deve conter apenas letras, números e hífens.");
  }

  await assertUniqueShortcut(input.organizationId, shortcut);

  const [created] = await db
    .insert(messageTemplates)
    .values({
      organizationId: input.organizationId,
      shortcut,
      title: input.title,
      content: input.content,
      category: input.category ?? null,
    })
    .returning();

  return created;
}

export async function updateTemplate(
  templateId: string,
  input: {
    organizationId: string;
    shortcut: string;
    title: string;
    content: string;
    category?: string | null;
  }
) {
  const shortcut = normalizeShortcut(input.shortcut);

  if (!shortcutRegex.test(shortcut)) {
    throw new Error("Shortcut deve conter apenas letras, números e hífens.");
  }

  await assertUniqueShortcut(input.organizationId, shortcut, templateId);

  const [updated] = await db
    .update(messageTemplates)
    .set({
      shortcut,
      title: input.title,
      content: input.content,
      category: input.category ?? null,
      updatedAt: new Date(),
    })
    .where(eq(messageTemplates.id, templateId))
    .returning();

  return updated;
}

export async function deleteTemplate(templateId: string) {
  await db.delete(messageTemplates).where(eq(messageTemplates.id, templateId));
}
