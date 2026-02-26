"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
} from "@/lib/actions/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function TemplatesSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [rows, setRows] = useState<Awaited<ReturnType<typeof getTemplates>>>([]);
  const [shortcut, setShortcut] = useState("preco");
  const [title, setTitle] = useState("Apresentação rápida");
  const [content, setContent] = useState("Oi! Posso te mostrar uma proposta rápida?");

  const load = useCallback(async () => {
    if (!organizationId) return;
    const templates = await getTemplates(organizationId);
    setRows(templates);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCreate() {
    if (!organizationId) return;

    await createTemplate({
      organizationId,
      shortcut,
      title,
      content,
    });

    toast.success("Template criado.");
    setShortcut("");
    setTitle("");
    setContent("");
    await load();
  }

  async function handleDelete(templateId: string) {
    await deleteTemplate(templateId);
    toast.success("Template removido.");
    await load();
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Templates & Snippets</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Use atalhos `/shortcut` para inserir respostas rápidas no Inbox.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Shortcut</Label>
            <Input value={shortcut} onChange={(event) => setShortcut(event.target.value)} placeholder="preco" />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Título</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Apresentação" />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Conteúdo</Label>
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} />
          </div>
        </div>

        <Button className="mt-3" onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Criar template
        </Button>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="text-base font-semibold">Templates cadastrados</h2>

        <div className="mt-3 space-y-2">
          {rows.map((template) => (
            <div key={template.id} className="rounded-xl border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">/{template.shortcut}</Badge>
                    <p className="text-sm font-medium">{template.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{template.content}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem templates cadastrados.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
