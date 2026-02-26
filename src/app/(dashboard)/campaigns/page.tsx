"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, PlusCircle, Rocket, Target } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  getCampaigns,
  pauseCampaign,
  resumeCampaign,
} from "@/lib/actions/campaigns";
import { StatusBadge, IntervalDisplay, ConfirmDialog, EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/helpers";

export default function CampaignsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getCampaigns>>>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const result = await getCampaigns(organizationId);
      setRows(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePause(campaignId: string) {
    await pauseCampaign(campaignId);
    toast.success("Campanha pausada.");
    await load();
  }

  async function handleResume(campaignId: string) {
    await resumeCampaign(campaignId);
    toast.success("Campanha retomada.");
    await load();
  }

  return (
    <div className="relative min-h-full overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,.13),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(249,115,22,.12),transparent_36%)]" />
      <div className="relative space-y-4">
        <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Rocket className="text-primary h-4 w-4" />
                <h1 className="font-display text-2xl">Campanhas</h1>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Controle volume, objetivo, IA e performance de resposta.
              </p>
            </div>

            <Button asChild>
              <Link href="/campaigns/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova campanha
              </Link>
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            Carregando campanhas...
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Nenhuma campanha criada"
            description="Crie sua primeira campanha para começar a abordar leads automaticamente."
            action={{ label: "Nova campanha", href: "/campaigns/new" }}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((campaign) => (
              <Card
                key={campaign.id}
                className="border-border/70 bg-card/70 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{campaign.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      {t("campaignObjective", campaign.objective)}
                    </div>
                  </div>
                  <StatusBadge domain="campaignStatus" value={campaign.status} />
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg border border-border/60 p-3 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Leads</p>
                    <p className="mt-1 text-sm font-semibold">{campaign.stats.leadsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enviadas</p>
                    <p className="mt-1 text-sm font-semibold">{campaign.stats.sent}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Respostas</p>
                    <p className="mt-1 text-sm font-semibold">{campaign.stats.replied}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxa de resposta</p>
                    <p className="mt-1 text-sm font-semibold">{campaign.stats.replyRate}%</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Cadência: <IntervalDisplay min={campaign.minInterval} max={campaign.maxInterval} suffix="entre msgs" />
                    · limite {campaign.dailyLimit}/dia
                  </span>
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Criada {formatRelativeTime(campaign.createdAt)}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    IA: {campaign.aiEnabled
                      ? `${campaign.aiModel ?? "ativa"}`
                      : "IA desativada"}
                  </p>

                  {campaign.status === "active" ? (
                    <ConfirmDialog
                      title="Pausar campanha"
                      description={`Deseja pausar a campanha "${campaign.name}"? Novas mensagens não serão enviadas.`}
                      onConfirm={() => handlePause(campaign.id)}
                    >
                      <Button size="sm" variant="outline">
                        <Pause className="mr-2 h-4 w-4" />
                        Pausar
                      </Button>
                    </ConfirmDialog>
                  ) : (
                    <ConfirmDialog
                      title="Retomar campanha"
                      description={`Deseja retomar a campanha "${campaign.name}"? O envio de mensagens será reativado.`}
                      onConfirm={() => handleResume(campaign.id)}
                    >
                      <Button size="sm" variant="default">
                        <Play className="mr-2 h-4 w-4" />
                        Retomar
                      </Button>
                    </ConfirmDialog>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
