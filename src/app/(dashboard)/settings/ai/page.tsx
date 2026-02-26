"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  PlusCircle,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  createAIProvider,
  deleteAIProvider,
  getAIProviders,
  setDefaultAIProvider,
  testAIProvider,
  updateAIProvider,
} from "@/lib/actions/ai-providers";
import { entries, t } from "@/lib/i18n";
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  LoadingButton,
  ModelSelector,
} from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const providerEntries = entries("aiProvider");

export default function AISettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  type ProviderRow = Awaited<ReturnType<typeof getAIProviders>>[number];

  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [label, setLabel] = useState("OpenAI");
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [showKey, setShowKey] = useState(false);

  // Edit dialog state
  const [editRow, setEditRow] = useState<ProviderRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    const data = await getAIProviders(organizationId);
    setRows(data);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function handleProviderChange(value: string) {
    setProvider(value);
    const entry = providerEntries.find((e) => e.value === value);
    if (entry) setLabel(entry.label);
  }

  async function handleCreate() {
    if (!organizationId) return;
    if (!apiKey.trim()) {
      toast.error("Informe a API key.");
      return;
    }

    try {
      // Test connection first
      const created = await createAIProvider({
        organizationId,
        provider,
        label,
        apiKey,
        baseUrl: baseUrl || null,
        defaultModel: model,
        availableModels: null,
        isDefault: false,
        setAsDefault: rows.length === 0,
      });

      const result = await testAIProvider(created.id);
      if (result.ok) {
        toast.success("Provider adicionado e conexão verificada.");
      } else {
        toast.warning(`Provider salvo, mas teste retornou: ${result.response}`);
      }

      setApiKey("");
      setShowKey(false);
      await load();
    } catch (err) {
      toast.error("Erro ao criar provider.");
    }
  }

  async function handleTest(providerId: string) {
    const result = await testAIProvider(providerId);
    if (result.ok) toast.success("Conexão OK.");
    else toast.error(`Resposta inesperada: ${result.response}`);
  }

  async function handleSetDefault(providerId: string) {
    if (!organizationId) return;
    await setDefaultAIProvider(organizationId, providerId);
    toast.success("Provider padrão atualizado.");
    await load();
  }

  async function handleDelete(providerId: string) {
    await deleteAIProvider(providerId);
    toast.success("Provider removido.");
    await load();
  }

  function openEdit(row: ProviderRow) {
    setEditRow(row);
    setEditLabel(row.label);
    setEditModel(row.defaultModel);
    setEditBaseUrl(row.baseUrl ?? "");
  }

  async function handleEditSave() {
    if (!editRow) return;
    await updateAIProvider(editRow.id, {
      label: editLabel,
      defaultModel: editModel,
      baseUrl: editBaseUrl || null,
    });
    toast.success("Provider atualizado.");
    setEditRow(null);
    await load();
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">IA & Modelos</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure providers multi-modelo para resposta automática e sugestões no Inbox.
        </p>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="text-base font-semibold">Adicionar provider</h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FormField label="Provider">
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerEntries.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Nome">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>

          <FormField label="API Key" required>
            <div className="relative">
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                type={showKey ? "text" : "password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField label="Modelo" helper="Salve o provider para ver modelos disponíveis">
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </FormField>

          {provider === "openai_compatible" && (
            <FormField label="Base URL" className="md:col-span-2">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </FormField>
          )}
        </div>

        <LoadingButton className="mt-3" onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Testar e salvar
        </LoadingButton>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="text-base font-semibold">Providers configurados</h2>

        {rows.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Nenhum provider configurado"
            description="Adicione um provider de IA para habilitar respostas automáticas e sugestões."
            className="mt-2"
          />
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => openEdit(row)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{row.label}</p>
                    <Badge variant="outline">{t("aiProvider", row.provider)}</Badge>
                    {row.isDefault && (
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{row.defaultModel}</p>
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <LoadingButton size="sm" variant="outline" onClick={() => handleTest(row.id)}>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Testar
                  </LoadingButton>
                  {!row.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => handleSetDefault(row.id)}>
                      <Star className="mr-2 h-4 w-4" />
                      Padrão
                    </Button>
                  )}
                  <ConfirmDialog
                    title="Remover provider"
                    description={`Tem certeza que deseja remover "${row.label}"? Esta ação não pode ser desfeita.`}
                    confirmText="Remover"
                    destructive
                    onConfirm={() => handleDelete(row.id)}
                  >
                    <Button size="sm" variant="ghost" title="Remover provider">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Nome">
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </FormField>
            <FormField label="Modelo">
              <ModelSelector
                providerId={editRow?.id ?? null}
                value={editModel}
                onChange={setEditModel}
              />
            </FormField>
            {editRow?.provider === "openai_compatible" && (
              <FormField label="Base URL">
                <Input value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} />
              </FormField>
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
