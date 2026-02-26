"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getInstances } from "@/lib/actions/whatsapp";
import {
  ensureWarmupConfig,
  getWarmupConfigs,
  setWarmupCurrentDay,
  setWarmupDailyLimit,
} from "@/lib/actions/warmup";
import { Badge } from "@/components/ui/badge";
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

export default function WarmupSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [rows, setRows] = useState<Awaited<ReturnType<typeof getWarmupConfigs>>>([]);
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
        <p className="text-muted-foreground mt-1 text-sm">
          Controle progressão diária para reduzir risco operacional.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  {instance.instanceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateConfig}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar configuração
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {rows.map(({ config, instance }) => (
          <Card key={config.id} className="border-border/70 bg-card/75 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{instance.instanceName}</p>
                <p className="text-xs text-muted-foreground">
                  Dia {config.currentDay} · limite atual {config.currentDailyLimit}/dia
                </p>
              </div>
              <Badge variant={config.warmupCompleted ? "default" : "outline"}>
                {config.warmupCompleted ? "Concluído" : "Em andamento"}
              </Badge>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">Dia atual</p>
                <Input
                  type="number"
                  value={config.currentDay}
                  onChange={(event) =>
                    setWarmupCurrentDay(config.id, Number(event.target.value || 1)).then(load)
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">Limite diário</p>
                <Input
                  type="number"
                  value={config.currentDailyLimit}
                  onChange={(event) =>
                    setWarmupDailyLimit(config.id, Number(event.target.value || 10)).then(load)
                  }
                />
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              {config.schedule.map((entry, index) => (
                <p key={index}>
                  Dias {entry.days[0]}-{entry.days[1]}: {entry.limit}/dia
                </p>
              ))}
            </div>
          </Card>
        ))}

        {rows.length === 0 && (
          <Card className="border-border/70 bg-card/75 p-6 text-center text-sm text-muted-foreground">
            Nenhuma configuração de warm-up criada.
          </Card>
        )}
      </div>
    </div>
  );
}
