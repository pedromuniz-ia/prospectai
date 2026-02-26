"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Filter, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  createCampaign,
  getMatchingLeadsPreview,
  updateCampaign,
} from "@/lib/actions/campaigns";
import { getInstances } from "@/lib/actions/whatsapp";
import { getAIProviders } from "@/lib/actions/ai-providers";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const objectives = [
  { value: "sell_website", label: "Vender Website" },
  { value: "sell_ai_agent", label: "Vender Agente IA" },
  { value: "sell_optimization", label: "Vender Otimização" },
  { value: "sell_automation", label: "Vender Automação" },
  { value: "custom", label: "Custom" },
] as const;

const promptByObjective: Record<string, string> = {
  sell_website:
    "Voce e SDR de websites. Seja direto, amigavel e convide para uma conversa curta com proposta clara.",
  sell_ai_agent:
    "Voce e SDR de agentes IA para WhatsApp. Foco em produtividade e resposta rapida.",
  sell_optimization:
    "Voce e SDR de consultoria de otimização digital. Mostre ganhos objetivos e próximos passos.",
  sell_automation:
    "Voce e SDR de automação comercial. Conecte dor operacional com ganho de escala.",
  custom: "Voce e SDR objetivo e cordial. Responda em portugues, curto e com CTA claro.",
};

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function CampaignWizard({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState<(typeof objectives)[number]["value"]>(
    "sell_website"
  );
  const [categories, setCategories] = useState("");
  const [cities, setCities] = useState("");
  const [minScore, setMinScore] = useState(50);
  const [hasWebsite, setHasWebsite] = useState("any");

  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [minInterval, setMinInterval] = useState(180);
  const [maxInterval, setMaxInterval] = useState(300);
  const [dailyLimit, setDailyLimit] = useState(40);
  const [messageVariants, setMessageVariants] = useState([
    "Oi {name}, tudo bem?",
    "Oi! Vi seu perfil e queria te mostrar uma ideia rápida.",
    "Olá, posso te enviar uma sugestão prática para melhorar suas conversas no WhatsApp?",
    "Fala! Tenho uma estratégia curta para aumentar suas oportunidades.",
    "Oi, posso te explicar em 2 minutos uma abordagem que está funcionando para negócios locais?",
  ]);
  const [whatsappInstanceId, setWhatsappInstanceId] = useState("");

  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiProviderId, setAiProviderId] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiSystemPrompt, setAiSystemPrompt] = useState(promptByObjective.sell_website);
  const [aiMaxAutoReplies, setAiMaxAutoReplies] = useState(3);
  const [aiTemperature, setAiTemperature] = useState(0.7);

  const [instances, setInstances] = useState<Awaited<ReturnType<typeof getInstances>>>([]);
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof getAIProviders>>>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getMatchingLeadsPreview>> | null>(null);
  const [creating, setCreating] = useState(false);

  const filters = useMemo(
    () => ({
      categories: parseCommaList(categories),
      cities: parseCommaList(cities),
      minScore,
      hasWebsite: hasWebsite === "any" ? undefined : hasWebsite === "yes",
    }),
    [categories, cities, hasWebsite, minScore]
  );

  useEffect(() => {
    const basePrompt = promptByObjective[objective];
    setAiSystemPrompt(basePrompt);
  }, [objective]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const result = await getMatchingLeadsPreview(organizationId, filters);
      setPreview(result);
    }, 220);

    return () => clearTimeout(timeout);
  }, [filters, organizationId]);

  useEffect(() => {
    (async () => {
      const [instanceRows, providerRows] = await Promise.all([
        getInstances(organizationId),
        getAIProviders(organizationId),
      ]);
      setInstances(instanceRows.filter((instance) => instance.status === "connected"));
      setProviders(providerRows);

      const defaultProvider = providerRows.find((provider) => provider.isDefault);
      if (defaultProvider) {
        setAiProviderId(defaultProvider.id);
        setAiModel(defaultProvider.defaultModel);
      }
    })();
  }, [organizationId]);

  const estimatedBusinessDays = Math.ceil(
    Math.max((preview?.count ?? 0) / Math.max(dailyLimit, 1), 1)
  );

  const safetyRisk = dailyLimit > 80;

  async function handleLaunch() {
    if (!name.trim()) {
      toast.error("Defina um nome para a campanha.");
      return;
    }

    if (!whatsappInstanceId) {
      toast.error("Selecione uma instância WhatsApp.");
      return;
    }

    if (messageVariants.filter((variant) => variant.trim().length > 0).length < 5) {
      toast.error("Defina pelo menos 5 variantes de mensagem.");
      return;
    }

    setCreating(true);

    try {
      const { campaign, matchedLeadsCount } = await createCampaign({
        organizationId,
        name,
        objective,
        filters,
        scheduleStart,
        scheduleEnd,
        minInterval,
        maxInterval,
        dailyLimit,
        firstMessageVariants: messageVariants.filter((variant) => variant.trim().length > 0),
        aiEnabled,
        aiProviderId: aiEnabled ? aiProviderId : null,
        aiModel: aiEnabled ? aiModel : null,
        aiSystemPrompt,
        aiMaxAutoReplies,
        aiTemperature,
        whatsappInstanceId,
      });

      await updateCampaign(campaign.id, { status: "active" });

      toast.success(`Campanha criada com ${matchedLeadsCount} leads.`);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar campanha");
    } finally {
      setCreating(false);
    }
  }

  const progress = (step / 3) * 100;

  return (
    <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assistente de Campanha</h2>
          <p className="text-muted-foreground text-sm">3 etapas para lançar com segurança.</p>
        </div>
        <Badge variant="outline">Etapa {step}/3</Badge>
      </div>

      <Progress value={progress} className="mb-5" />

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Nome da campanha
              </Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Restaurantes sem website"
              />
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Objetivo
              </Label>
              <Select value={objective} onValueChange={(value) => setObjective(value as typeof objective)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {objectives.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Categorias (csv)
              </Label>
              <Input
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
                placeholder="restaurante, pizzaria"
              />
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Cidades (csv)
              </Label>
              <Input
                value={cities}
                onChange={(event) => setCities(event.target.value)}
                placeholder="São Paulo, Osasco"
              />
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Score mínimo
              </Label>
              <Input
                type="number"
                value={minScore}
                onChange={(event) => setMinScore(Number(event.target.value || 0))}
              />
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Website
              </Label>
              <Select value={hasWebsite} onValueChange={setHasWebsite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Indiferente</SelectItem>
                  <SelectItem value="no">Sem website</SelectItem>
                  <SelectItem value="yes">Com website</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Preview dinâmico</p>
            <p className="mt-2 text-sm font-medium">
              {preview?.count ?? 0} leads encontrados, {preview?.highScoreCount ?? 0} com score {'>'} 60
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {preview?.sample.slice(0, 5).map((lead) => (
                <Badge key={lead.id} variant="outline">
                  {lead.name}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Instância WhatsApp
              </Label>
              <Select value={whatsappInstanceId} onValueChange={setWhatsappInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Janela inicial
              </Label>
              <Input value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Janela final
              </Label>
              <Input value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Intervalo mínimo (s)
              </Label>
              <Input
                type="number"
                value={minInterval}
                onChange={(event) => setMinInterval(Number(event.target.value || 180))}
              />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Intervalo máximo (s)
              </Label>
              <Input
                type="number"
                value={maxInterval}
                onChange={(event) => setMaxInterval(Number(event.target.value || 300))}
              />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Limite diário
              </Label>
              <Input
                type="number"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(Number(event.target.value || 40))}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
              Variantes da primeira mensagem (uma por linha)
            </Label>
            <Textarea
              value={messageVariants.join("\n")}
              onChange={(event) => setMessageVariants(event.target.value.split("\n"))}
              rows={8}
            />
          </div>

          <Card className="border-border/60 bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <p className="font-medium">Configuração de IA</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>

            {aiEnabled && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                    Provider
                  </Label>
                  <Select value={aiProviderId} onValueChange={setAiProviderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                    Modelo
                  </Label>
                  <Input value={aiModel} onChange={(event) => setAiModel(event.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                    Max auto-replies
                  </Label>
                  <Input
                    type="number"
                    value={aiMaxAutoReplies}
                    onChange={(event) =>
                      setAiMaxAutoReplies(Number(event.target.value || 3))
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                    Temperatura
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={1}
                    value={aiTemperature}
                    onChange={(event) =>
                      setAiTemperature(Number(event.target.value || 0.7))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                    System prompt
                  </Label>
                  <Textarea
                    value={aiSystemPrompt}
                    onChange={(event) => setAiSystemPrompt(event.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Resumo</p>
            <div className="mt-3 grid gap-2 text-sm">
              <p><strong>Campanha:</strong> {name || "(sem nome)"}</p>
              <p><strong>Objetivo:</strong> {objective}</p>
              <p><strong>Leads estimados:</strong> {preview?.count ?? 0}</p>
              <p><strong>Dias úteis estimados:</strong> ~{estimatedBusinessDays}</p>
              <p><strong>Cadência:</strong> {minInterval}s - {maxInterval}s · limite {dailyLimit}/dia</p>
              <p><strong>IA:</strong> {aiEnabled ? `ativa (${aiModel || "modelo padrão"})` : "desativada"}</p>
            </div>
          </Card>

          {safetyRisk && (
            <Card className="border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                <p className="text-sm text-amber-200">
                  Limite diário acima de 80 pode aumentar risco operacional para contas em warm-up.
                </p>
              </div>
            </Card>
          )}

          {!safetyRisk && (
            <Card className="border-emerald-500/50 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <p className="text-sm text-emerald-200">
                  Configuração dentro de faixa segura para operação contínua.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="outline" disabled={step <= 1} onClick={() => setStep((value) => value - 1)}>
          Voltar
        </Button>

        {step < 3 ? (
          <Button onClick={() => setStep((value) => value + 1)}>
            Próximo
            <Filter className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleLaunch} disabled={creating}>
            <Rocket className="mr-2 h-4 w-4" />
            {creating ? "Lançando..." : "Lançar campanha"}
          </Button>
        )}
      </div>
    </Card>
  );
}
