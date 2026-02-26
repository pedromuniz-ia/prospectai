import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const leadStatusTone: Record<string, string> = {
  new: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  enriched: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  scored: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  queued: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  contacted: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  replied: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  interested: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  proposal: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  won: "bg-green-500/20 text-green-300 border-green-500/40",
  lost: "bg-red-500/20 text-red-300 border-red-500/40",
  blocked: "bg-red-500/20 text-red-300 border-red-500/40",
};

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
  return (
    <Badge className={cn("capitalize", leadStatusTone[status] ?? leadStatusTone.new)}>
      {status}
    </Badge>
  );
}
