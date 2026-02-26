"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Flame, Info, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getInstances } from "@/lib/actions/whatsapp";
import {
  ensureWarmupConfig,
  getWarmupConfigs,
  setWarmupCurrentDay,
  setWarmupDailyLimit,
} from "@/lib/actions/warmup";
import { EmptyState, FormField, LoadingButton, StatusBadge } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WarmupRow = Awaited<ReturnType<typeof getWarmupConfigs>>[number];

export default function WarmupSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [rows, setRows] = useState<WarmupRow[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof getInstances>>>([]);
  const [instanceId, setInstanceId] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;

    const [configRows, instanceRows] = await Promise.all([
      getWarmupConfigs(organizationId),
      getInstances(organizationId),
    ]);

    setRows(configRows);
    setInstances(instanceRows);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCreateConfig() {
    if (!organizationId || !instanceId) return;

    await ensureWarmupConfig(organizationId, instanceId);
    toast.success("Configuração de warm-up criada.");
    await load();
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Warm-up por instância</h1>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-sm text-muted-foreground">
            O warm-up aumenta gradualmente o volume de mensagens diárias ao longo de 15 dias,
            reduzindo o risco de bloqueio do número. Cada instância tem seu próprio progresso.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  <span className="flex items-center gap-2">
                    {instance.instanceName}
                    <StatusBadge domain="instanceStatus" value={instance.status} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LoadingButton onClick={handleCreateConfig} disabled={!instanceId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar configuração
          </LoadingButton>
        </div>
      </Card>

      <div className="space-y-3">
        {rows.map(({ config, instance }) => (
          <WarmupCard
            key={config.id}
            config={config}
            instance={instance}
            onReload={load}
          />
        ))}

        {rows.length === 0 && (
          <EmptyState
            icon={Flame}
            title="Nenhuma configuração de warm-up"
            description="Selecione uma instância acima para criar uma configuração de warm-up."
          />
        )}
      </div>
    </div>
  );
}

function WarmupCard({
  config,
  instance,
  onReload,
}: {
  config: WarmupRow["config"];
  instance: WarmupRow["instance"];
  onReload: () => Promise<void>;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const dayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressPercent = Math.min(Math.round((config.currentDay / 15) * 100), 100);

  function debouncedSetDay(value: number) {
    if (dayTimerRef.current) clearTimeout(dayTimerRef.current);
    dayTimerRef.current = setTimeout(() => {
      setWarmupCurrentDay(config.id, value).then(onReload);
    }, 500);
  }

  function debouncedSetLimit(value: number) {
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    limitTimerRef.current = setTimeout(() => {
      setWarmupDailyLimit(config.id, value).then(onReload);
    }, 500);
  }

  return (
    <Card className="border-border/70 bg-card/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{instance.instanceName}</p>
          <p className="text-xs text-muted-foreground">
            Dia {config.currentDay} de 15 · limite atual {config.currentDailyLimit}/dia
          </p>
        </div>
        <Badge variant={config.warmupCompleted ? "default" : "outline"}>
          {config.warmupCompleted ? "Concluído" : "Em andamento"}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span>{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Schedule table */}
      <div className="mt-3 rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Fase</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Dias</th>
              <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Limite/dia</th>
            </tr>
          </thead>
          <tbody>
            {config.schedule.map((entry, index) => {
              const isCurrentPhase =
                config.currentDay >= entry.days[0] && config.currentDay <= entry.days[1];
              return (
                <tr
                  key={index}
                  className={isCurrentPhase ? "bg-primary/5" : ""}
                >
                  <td className="px-3 py-1.5">
                    {isCurrentPhase && <span className="mr-1">●</span>}
                    Fase {index + 1}
                  </td>
                  <td className="px-3 py-1.5">{entry.days[0]}–{entry.days[1]}</td>
                  <td className="px-3 py-1.5 text-right">{entry.limit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manual override - collapsible */}
      <Collapsible open={overrideOpen} onOpenChange={setOverrideOpen} className="mt-3">
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={`h-3 w-3 transition-transform ${overrideOpen ? "rotate-180" : ""}`} />
          Ajuste manual
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Dia atual">
              <Input
                type="number"
                defaultValue={config.currentDay}
                min={1}
                max={15}
                onChange={(e) => debouncedSetDay(Number(e.target.value || 1))}
              />
            </FormField>
            <FormField label="Limite diário">
              <Input
                type="number"
                defaultValue={config.currentDailyLimit}
                min={1}
                onChange={(e) => debouncedSetLimit(Number(e.target.value || 10))}
              />
            </FormField>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
