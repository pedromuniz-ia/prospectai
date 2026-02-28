import { Badge } from "@/components/ui/badge";
import { StatusBadge as DsStatusBadge } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 60) return "bg-sky-500/20 text-sky-300 border-sky-500/40";
  if (score >= 40) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge className={cn("font-mono tabular-nums text-xs", scoreTone(score))}>
      {score}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <DsStatusBadge domain="leadStatus" value={status} />;
}

export function WhatsappBadge({
  hasWhatsapp,
  isBusiness,
}: {
  hasWhatsapp: boolean | null;
  isBusiness: boolean | null;
}) {
  if (hasWhatsapp == null) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  if (!hasWhatsapp) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
            Sem WA
          </span>
        </TooltipTrigger>
        <TooltipContent>Verificado — sem WhatsApp</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-green-400">
            WA
          </span>
          {isBusiness && (
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-400">
              B
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isBusiness ? "WhatsApp Business" : "WhatsApp pessoal"}
      </TooltipContent>
    </Tooltip>
  );
}

export function InstagramBadge({
  hasInstagram,
  followers,
  username,
}: {
  hasInstagram: boolean | null;
  followers: number | null;
  username: string | null;
}) {
  if (hasInstagram == null) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  if (!hasInstagram) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
            Sem IG
          </span>
        </TooltipTrigger>
        <TooltipContent>Verificado — sem Instagram</TooltipContent>
      </Tooltip>
    );
  }

  if (username) {
    return (
      <a
        href={`https://instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-pink-300 transition-colors"
      >
        <span className="rounded bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-pink-400">
          @{username}
        </span>
      </a>
    );
  }

  const formatted =
    followers != null
      ? followers >= 1000
        ? `${(followers / 1000).toFixed(1)}k`
        : String(followers)
      : null;

  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-pink-400">
        IG
      </span>
      {formatted && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatted}
        </span>
      )}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-mono font-medium text-red-400/80">
          #{rank}
        </span>
      </TooltipTrigger>
      <TooltipContent>Posição #{rank} no Google Maps</TooltipContent>
    </Tooltip>
  );
}

const classificationLabels: Record<string, { label: string; color: string }> = {
  needs_website: { label: "Precisa de site", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  needs_optimization: { label: "Otimização", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  needs_ai_agent: { label: "Agente IA", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  needs_automation: { label: "Automação", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  low_fit: { label: "Baixo fit", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

export function ClassificationBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const meta = classificationLabels[value] ?? { label: value, color: "bg-zinc-500/20 text-zinc-300" };
  return (
    <Badge className={cn("text-[11px] border", meta.color)}>
      {meta.label}
    </Badge>
  );
}
