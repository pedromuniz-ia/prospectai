"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { KanbanCard, type KanbanLeadCard } from "@/components/kanban-card";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  id,
  title,
  cards,
  onOpenCard,
}: {
  id: string;
  title: string;
  cards: KanbanLeadCard[];
  onOpenCard?: (leadId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex w-[300px] min-w-[300px] flex-col rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <Badge variant="outline" className="font-mono">
          {cards.length}
        </Badge>
      </button>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-24 flex-1 space-y-2 overflow-y-auto p-2",
            isOver && "bg-primary/10"
          )}
        >
          <SortableContext
            items={cards.map((card) => card.campaignLeadId)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((card) => (
              <KanbanCard key={card.campaignLeadId} card={card} onOpen={onOpenCard} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
