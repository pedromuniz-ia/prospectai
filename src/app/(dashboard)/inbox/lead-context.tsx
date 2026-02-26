"use client";

import { Globe, MapPin, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBadge, StatusBadge } from "@/app/(dashboard)/leads/columns";
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

  return (
    <div className="h-full overflow-y-auto border-l border-border/70 bg-card/50 p-4">
      <div className="space-y-1">
        <p className="text-base font-semibold leading-tight">{data.lead.name}</p>
        <p className="text-muted-foreground text-xs">
          {data.lead.category ?? "Categoria"} · {data.lead.city ?? "Cidade"}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <ScoreBadge score={data.lead.score} />
          <StatusBadge status={data.lead.status} />
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Score breakdown</p>
        {Object.keys(breakdown).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados de score.</p>
        ) : (
          Object.entries(breakdown).map(([label, points]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{label}</span>
                <span className="font-mono">+{points}</span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${Math.min(points, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Classificação IA</p>
        <Badge variant="outline">{data.lead.aiClassification ?? "não classificado"}</Badge>
        <p className="text-xs text-muted-foreground">{data.lead.aiSummary ?? "Sem resumo IA."}</p>
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pipeline</p>
        {data.campaignContext ? (
          <>
            <p className="text-sm font-medium">{data.campaignContext.campaignName}</p>
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
          <p className="text-xs text-muted-foreground">Lead sem campanha ativa.</p>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-border/70 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" /> {data.lead.phone ?? "Sem telefone"}
        </p>
        <p className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5" /> {data.lead.website ?? "Sem website"}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" /> {data.lead.city ?? "—"}
        </p>
        <p className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5" />
          {data.lead.googleRating ?? "—"} ({data.lead.googleReviewCount ?? "—"} avaliações)
        </p>
      </div>
    </div>
  );
}
