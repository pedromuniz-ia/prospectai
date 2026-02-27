"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCampaign,
  getMatchingLeadsPreview,
  updateCampaign,
} from "@/lib/actions/campaigns";
import { getInstances } from "@/lib/actions/whatsapp";
import { getAIProviders } from "@/lib/actions/ai-providers";
import {
  FormField,
  IntervalDisplay,
  TagInput,
  TimeRangeInput,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { entries, t } from "@/lib/i18n";

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

const temperaturePresets = [
  { value: 0.3, label: "Conservador" },
  { value: 0.7, label: "Balanceado" },
  { value: 1.0, label: "Criativo" },
] as const;

export function CampaignWizard({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  type ObjectiveType = "sell_website" | "sell_ai_agent" | "sell_optimization" | "sell_automation" | "custom";
  const [objective, setObjective] = useState<ObjectiveType>("sell_website");
  const [categoryTags, setCategoryTags] = useState<string[]>([]);
  const [cityTags, setCityTags] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(50);
  const [hasWebsite, setHasWebsite] = useState("any");

  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [minIntervalMin, setMinIntervalMin] = useState(3);
  const [maxIntervalMin, setMaxIntervalMin] = useState(5);
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
  const [aiConfigOpen, setAiConfigOpen] = useState(false);

  const [instances, setInstances] = useState<Awaited<ReturnType<typeof getInstances>>>([]);
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof getAIProviders>>>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getMatchingLeadsPreview>> | null>(null);
  const [creating, setCreating] = useState(false);

  // Convert minutes to seconds for the API
  const minInterval = minIntervalMin * 60;
  const maxInterval = maxIntervalMin * 60;

  const filters = useMemo(
    () => ({
      categories: categoryTags,
      cities: cityTags,
      minScore,
      hasWebsite: hasWebsite === "any" ? undefined : hasWebsite === "yes",
    }),
    [categoryTags, cityTags, hasWebsite, minScore]
  );

  const filledVariants = messageVariants.filter((v) => v.trim().length > 0);

  useEffect(() => {
    const basePrompt = promptByObjective[objective];
    if (basePrompt) setAiSystemPrompt(basePrompt);
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

  function handleNext() {
    if (step === 2 && filledVariants.length < 5) {
      toast.error("Defina pelo menos 5 variantes de mensagem antes de continuar.");
      return;
    }
    setStep((v) => v + 1);
  }

  async function handleLaunch() {
    if (!name.trim()) {
      toast.error("Defina um nome para a campanha.");
      return;
    }

    if (!whatsappInstanceId) {
      toast.error("Selecione uma instância WhatsApp.");
      return;
    }

    if (filledVariants.length < 5) {
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
        firstMessageVariants: filledVariants,
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
            <FormField label="Nome da campanha">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Restaurantes sem website"
              />
            </FormField>

            <FormField label="Objetivo">
              <Select value={objective} onValueChange={(v) => setObjective(v as ObjectiveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entries("campaignObjective").map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Categorias">
              <TagInput
                value={categoryTags}
                onChange={setCategoryTags}
                placeholder="restaurante, pizzaria..."
              />
            </FormField>

            <FormField label="Cidades">
              <TagInput
                value={cityTags}
                onChange={setCityTags}
                placeholder="São Paulo, Osasco..."
              />
            </FormField>

            <FormField label="Score mínimo">
              <Input
                type="number"
                value={minScore}
                onChange={(event) => setMinScore(Number(event.target.value || 0))}
              />
            </FormField>

            <FormField label="Website">
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
            </FormField>
          </div>

          <Card className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Preview dinâmico</p>
            {preview && preview.count > 0 ? (
              <>
                <p className="mt-2 text-sm font-medium">
                  {preview.count} leads encontrados, {preview.highScoreCount} com score {'>'} 60
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.sample.slice(0, 5).map((lead) => (
                    <Badge key={lead.id} variant="outline">
                      {lead.name}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum lead encontrado. Ajuste os filtros.
              </p>
            )}
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Instância WhatsApp">
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
            </FormField>

            <FormField label="Horário de envio">
              <TimeRangeInput
                startValue={scheduleStart}
                endValue={scheduleEnd}
                onStartChange={setScheduleStart}
                onEndChange={setScheduleEnd}
              />
            </FormField>

            <FormField label="Limite diário">
              <Input
                type="number"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(Number(event.target.value || 40))}
              />
            </FormField>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Espera mínima (min)">
              <Input
                type="number"
                value={minIntervalMin}
                onChange={(event) => setMinIntervalMin(Number(event.target.value || 3))}
              />
            </FormField>
            <FormField label="Espera máxima (min)">
              <Input
                type="number"
                value={maxIntervalMin}
                onChange={(event) => setMaxIntervalMin(Number(event.target.value || 5))}
              />
            </FormField>
          </div>

          <div className="text-xs text-muted-foreground">
            Preview: <IntervalDisplay min={minInterval} max={maxInterval} suffix="entre mensagens" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Variantes da primeira mensagem
              </p>
              <span className="text-xs text-muted-foreground">
                {filledVariants.length}/5 variantes definidas
              </span>
            </div>
            {filledVariants.length < 5 && (
              <p className="text-xs text-amber-400">Defina ao menos 5 variantes para prosseguir.</p>
            )}
            {messageVariants.map((variant, i) => (
              <FormField key={i} label={`Variante ${i + 1}`}>
                <Textarea
                  value={variant}
                  onChange={(event) => {
                    const next = [...messageVariants];
                    next[i] = event.target.value;
                    setMessageVariants(next);
                  }}
                  rows={2}
                />
              </FormField>
            ))}
          </div>

          <Collapsible open={aiConfigOpen} onOpenChange={setAiConfigOpen}>
            <Card className="border-border/60 bg-card/60 p-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <p className="font-medium">Configuração de IA</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={aiEnabled}
                      onCheckedChange={setAiEnabled}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {aiEnabled && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FormField label="Provider">
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
                    </FormField>
                    <FormField label="Modelo">
                      <Input value={aiModel} onChange={(event) => setAiModel(event.target.value)} />
                    </FormField>
                    <FormField label="Respostas automáticas máximas">
                      <Input
                        type="number"
                        value={aiMaxAutoReplies}
                        onChange={(event) =>
                          setAiMaxAutoReplies(Number(event.target.value || 3))
                        }
                      />
                    </FormField>
                    <FormField label="Temperatura">
                      <div className="flex gap-1">
                        {temperaturePresets.map((preset) => (
                          <Button
                            key={preset.value}
                            type="button"
                            variant={aiTemperature === preset.value ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setAiTemperature(preset.value)}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </FormField>
                    <div className="md:col-span-2">
                      <FormField label="Instruções para a IA">
                        <Textarea
                          value={aiSystemPrompt}
                          onChange={(event) => setAiSystemPrompt(event.target.value)}
                          rows={4}
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Resumo</p>
            <div className="mt-3 grid gap-2 text-sm">
              <p><strong>Campanha:</strong> {name || "(sem nome)"}</p>
              <p><strong>Objetivo:</strong> {t("campaignObjective", objective)}</p>
              <p><strong>Leads estimados:</strong> {preview?.count ?? 0}</p>
              <p><strong>Dias úteis estimados:</strong> ~{estimatedBusinessDays}</p>
              <p>
                <strong>Cadência:</strong>{" "}
                <IntervalDisplay min={minInterval} max={maxInterval} suffix="" />
                {" "}· limite {dailyLimit}/dia
              </p>
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
        <Button variant="outline" disabled={step <= 1} onClick={() => setStep((v) => v - 1)}>
          Voltar
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext}>
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
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
