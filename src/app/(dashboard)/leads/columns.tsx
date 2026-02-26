import { Badge } from "@/components/ui/badge";
import { StatusBadge as DsStatusBadge } from "@/components/ds";
import { cn } from "@/lib/utils";

export function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 60) return "bg-sky-500/20 text-sky-300 border-sky-500/40";
  if (score >= 40) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge className={cn("font-mono tabular-nums", scoreTone(score))}>
      {score}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <DsStatusBadge domain="leadStatus" value={status} />;
}
