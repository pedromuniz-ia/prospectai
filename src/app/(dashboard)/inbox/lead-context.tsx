"use client";

import Link from "next/link";
import { Globe, MapPin, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ds";
import { t } from "@/lib/i18n";
import { safeJsonParse } from "@/lib/helpers";

type ContextData = {
  lead: {
    scoreBreakdown: unknown;
    name: string;
    category: string | null;
    city: string | null;
    score: number;
    status: string;
    aiClassification: string | null;
    aiSummary: string | null;
    phone: string | null;
    website: string | null;
    googleRating: number | null;
    googleReviewCount: number | null;
  };
  campaignContext: {
    campaignLeadId: string;
    campaignName: string;
    pipelineStage: string;
  } | null;
} | null;

const stages = [
  { value: "interested", label: "Interessado" },
  { value: "proposal", label: "Proposta enviada" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
] as const;

export function LeadContext({
  data,
  onStageChange,
}: {
  data: ContextData;
  onStageChange: (stage: "interested" | "proposal" | "won" | "lost") => Promise<void>;
}) {
  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">Selecione uma conversa.</div>;
  }

  const breakdown = safeJsonParse<Record<string, number>>(
    typeof data.lead.scoreBreakdown === "string" ? data.lead.scoreBreakdown : null,
    {}
  );

  // Calculate max possible score from breakdown entries for proper bar scaling
  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + Math.abs(v), 0);
  const maxScore = Math.max(totalScore, 100);

  return (
    <div className="h-full overflow-y-auto border-l border-border/70 bg-card/50 p-4">
      <div className="space-y-1">
        <p className="text-base font-semibold leading-tight">{data.lead.name}</p>
        <p className="text-muted-foreground text-xs">
          {data.lead.category ?? "Categoria"} · {data.lead.city ?? "Cidade"}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className="font-mono">{data.lead.score} pts</Badge>
          <StatusBadge domain="leadStatus" value={data.lead.status} />
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Detalhamento da pontuação</p>
        {Object.keys(breakdown).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados de score.</p>
        ) : (
          Object.entries(breakdown).map(([label, points]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{label}</span>
                <span className="font-mono">{points >= 0 ? `+${points}` : points}</span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${Math.min((Math.abs(points) / maxScore) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Classificação IA</p>
        {data.lead.aiClassification ? (
          <Badge variant="outline">{data.lead.aiClassification}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">não classificado</span>
        )}
        <p className="text-xs text-muted-foreground">{data.lead.aiSummary ?? "Sem resumo IA."}</p>
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Etapa do funil</p>
        {data.campaignContext ? (
          <>
            <p className="text-sm font-medium">{data.campaignContext.campaignName}</p>
            <p className="text-xs text-muted-foreground">
              {t("pipelineStage", data.campaignContext.pipelineStage)}
            </p>
            <Select
              value={data.campaignContext.pipelineStage}
              onValueChange={(value) =>
                onStageChange(value as "interested" | "proposal" | "won" | "lost")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Lead sem campanha ativa.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns/new">Adicionar a uma campanha</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          {data.lead.phone ? (
            <a href={`tel:${data.lead.phone}`} className="hover:text-foreground transition-colors">
              {data.lead.phone}
            </a>
          ) : (
            "Sem telefone"
          )}
        </p>
        <p className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" />
          {data.lead.website ? (
            <a
              href={data.lead.website.startsWith("http") ? data.lead.website : `https://${data.lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors truncate"
            >
              {data.lead.website}
            </a>
          ) : (
            "Sem website"
          )}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          {data.lead.city ? (
            <Link href={`/leads?city=${encodeURIComponent(data.lead.city)}`} className="hover:text-foreground transition-colors">
              {data.lead.city}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5" />
          {data.lead.googleRating ?? "—"} ({data.lead.googleReviewCount ?? "—"} avaliações)
        </p>
      </div>
    </div>
  );
}
