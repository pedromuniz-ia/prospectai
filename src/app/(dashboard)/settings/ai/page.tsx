"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, FlaskConical, PlusCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  createAIProvider,
  getAIProviders,
  setDefaultAIProvider,
  testAIProvider,
} from "@/lib/actions/ai-providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const providerOptions = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "together",
  "fireworks",
  "openai_compatible",
] as const;

export default function AISettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [rows, setRows] = useState<Awaited<ReturnType<typeof getAIProviders>>>([]);
  const [label, setLabel] = useState("OpenAI");
  const [provider, setProvider] = useState<(typeof providerOptions)[number]>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");

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

  async function handleCreate() {
    if (!organizationId) return;
    if (!apiKey.trim()) {
      toast.error("Informe a API key.");
      return;
    }

    await createAIProvider({
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

    toast.success("Provider adicionado.");
    setApiKey("");
    await load();
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
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Label</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">API key</Label>
            <Input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
            />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Modelo default</Label>
            <Input value={model} onChange={(event) => setModel(event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Base URL (opcional)</Label>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.groq.com/openai/v1"
            />
          </div>
        </div>

        <Button className="mt-3" onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Salvar provider
        </Button>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="text-base font-semibold">Providers configurados</h2>

        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Nenhum provider cadastrado.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{row.label}</p>
                    <Badge variant="outline">{row.provider}</Badge>
                    {row.isDefault && (
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{row.defaultModel}</p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleTest(row.id)}>
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Testar
                  </Button>
                  {!row.isDefault && (
                    <Button size="sm" onClick={() => handleSetDefault(row.id)}>
                      <Star className="mr-2 h-4 w-4" />
                      Padrão
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
