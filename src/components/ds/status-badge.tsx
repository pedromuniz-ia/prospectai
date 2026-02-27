import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { t, type TranslationDomain } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Color maps: domain+value → tailwind classes
const colorMap: Record<string, Record<string, string>> = {
  leadStatus: {
    new: "bg-zinc-500/20 text-zinc-300",
    enriched: "bg-blue-500/20 text-blue-400",
    scored: "bg-indigo-500/20 text-indigo-400",
    queued: "bg-yellow-500/20 text-yellow-300",
    contacted: "bg-sky-500/20 text-sky-400",
    replied: "bg-emerald-500/20 text-emerald-400",
    interested: "bg-green-500/20 text-green-400",
    proposal: "bg-orange-500/20 text-orange-400",
    won: "bg-green-600/20 text-green-300",
    lost: "bg-red-500/20 text-red-400",
    blocked: "bg-red-600/20 text-red-300",
  },
  campaignStatus: {
    draft: "bg-zinc-500/20 text-zinc-300",
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-300",
    completed: "bg-blue-500/20 text-blue-400",
  },
  pipelineStage: {
    new: "bg-zinc-500/20 text-zinc-300",
    approached: "bg-sky-500/20 text-sky-400",
    replied: "bg-emerald-500/20 text-emerald-400",
    interested: "bg-green-500/20 text-green-400",
    proposal: "bg-orange-500/20 text-orange-400",
    won: "bg-green-600/20 text-green-300",
    lost: "bg-red-500/20 text-red-400",
  },
  instanceStatus: {
    disconnected: "bg-zinc-500/20 text-zinc-300",
    connecting: "bg-yellow-500/20 text-yellow-300",
    connected: "bg-green-500/20 text-green-400",
    banned: "bg-red-600/20 text-red-300",
  },
  jobStatus: {
    pending: "bg-zinc-500/20 text-zinc-300",
    running: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
  },
};

interface StatusBadgeProps {
  domain: TranslationDomain;
  value: string;
  className?: string;
}

export function StatusBadge({ domain, value, className }: StatusBadgeProps) {
  const label = t(domain, value);
  const colors = colorMap[domain]?.[value] ?? "bg-zinc-500/20 text-zinc-300";

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", colors, className)}
    >
      {label}
    </Badge>
  );
}
