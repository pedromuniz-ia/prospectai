"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from "@/lib/actions/templates";
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  LoadingButton,
} from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TemplateRow = Awaited<ReturnType<typeof getTemplates>>[number];

export default function TemplatesSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shortcutError, setShortcutError] = useState("");

  // Edit dialog
  const [editRow, setEditRow] = useState<TemplateRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

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

  function validateShortcut(value: string) {
    if (value && !/^[a-z0-9-]+$/.test(value)) {
      setShortcutError("Use apenas letras minúsculas, números e hifens");
      return false;
    }
    setShortcutError("");
    return true;
  }

  async function handleCreate() {
    if (!organizationId) return;
    if (!shortcut.trim() || !content.trim()) {
      toast.error("Preencha o atalho e o conteúdo.");
      return;
    }
    if (!validateShortcut(shortcut)) return;

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

  function openEdit(row: TemplateRow) {
    setEditRow(row);
    setEditTitle(row.title);
    setEditContent(row.content);
  }

  async function handleEditSave() {
    if (!editRow || !organizationId) return;
    await updateTemplate(editRow.id, {
      organizationId,
      shortcut: editRow.shortcut,
      title: editTitle,
      content: editContent,
    });
    toast.success("Template atualizado.");
    setEditRow(null);
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
          Use atalhos <code className="rounded bg-muted px-1 text-xs">/atalho</code> para inserir respostas rápidas no Inbox.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FormField
            label="Atalho"
            required
            error={shortcutError}
            helper="Letras minúsculas, números e hifens"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/</span>
              <Input
                value={shortcut}
                onChange={(e) => {
                  setShortcut(e.target.value);
                  validateShortcut(e.target.value);
                }}
                placeholder="preco"
                className="pl-7"
              />
            </div>
          </FormField>
          <FormField label="Título">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Apresentação de preço"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Conteúdo" required>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Escreva o conteúdo da mensagem..."
              />
            </FormField>

            {/* Chat bubble preview */}
            {content.trim() && (
              <div className="mt-2 rounded-lg bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">Pré-visualização</p>
                <div className="inline-block max-w-sm rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-2 text-sm">
                  {content}
                </div>
              </div>
            )}
          </div>
        </div>

        <LoadingButton className="mt-3" onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Criar template
        </LoadingButton>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="text-base font-semibold">Templates cadastrados</h2>

        <div className="mt-3 space-y-2">
          {rows.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border border-border/70 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => openEdit(template)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">/{template.shortcut}</Badge>
                    <p className="text-sm font-medium">{template.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openEdit(template)}
                    title="Editar template"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <ConfirmDialog
                    title="Remover template"
                    description={`Deseja remover o template "/${template.shortcut}"?`}
                    confirmText="Remover"
                    destructive
                    onConfirm={() => handleDelete(template.id)}
                  >
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      title="Remover template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <EmptyState
              icon={MessageSquareText}
              title="Sem templates cadastrados"
              description="Crie templates para agilizar respostas no Inbox."
            />
          )}
        </div>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar template <Badge variant="outline" className="ml-2">/{editRow?.shortcut}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Título">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </FormField>
            <FormField label="Conteúdo">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
              />
            </FormField>
            {editContent.trim() && (
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">Pré-visualização</p>
                <div className="inline-block max-w-sm rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-2 text-sm">
                  {editContent}
                </div>
              </div>
            )}
            <LoadingButton onClick={handleEditSave} className="w-full">
              Salvar alterações
            </LoadingButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
