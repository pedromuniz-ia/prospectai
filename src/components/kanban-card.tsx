"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3 } from "lucide-react";
import { ScoreBadge } from "@/app/(dashboard)/leads/columns";
import { cn } from "@/lib/utils";

export type KanbanLeadCard = {
  campaignLeadId: string;
  leadId: string;
  title: string;
  score: number;
  snippet?: string;
  daysInStage: number;
};

export function KanbanCard({
  card,
  onOpen,
}: {
  card: KanbanLeadCard;
  onOpen?: (leadId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.campaignLeadId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const shortSnippet = useMemo(
    () =>
      card.snippet
        ? card.snippet.split(" ").slice(0, 6).join(" ")
        : "Sem mensagem recente",
    [card.snippet]
  );

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      onClick={() => onOpen?.(card.leadId)}
      className={cn(
        "group w-full rounded-xl border border-border/70 bg-card/80 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        isDragging && "border-primary/60 opacity-70"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{card.title}</p>
        <ScoreBadge score={card.score} />
      </div>

      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">{shortSnippet}</p>

      <div className="text-muted-foreground mt-3 flex items-center gap-1 text-[11px]">
        <Clock3 className="h-3.5 w-3.5" />
        {card.daysInStage} dias no estágio
      </div>
    </button>
  );
}
