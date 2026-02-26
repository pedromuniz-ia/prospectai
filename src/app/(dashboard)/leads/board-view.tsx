"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/kanban-column";

type BoardRow = {
  campaignLeadId: string;
  pipelineStage: string;
  status: string;
  campaignScore: number;
  leadId: string;
  leadName: string;
  leadCategory: string | null;
  leadCity: string | null;
  leadScore: number;
  contactedAt: Date | null;
};

const stages = [
  { id: "new", label: "Novo" },
  { id: "approached", label: "Contatado" },
  { id: "interested", label: "Interessado" },
  { id: "proposal", label: "Proposta" },
  { id: "won", label: "Fechado (Ganho)" },
  { id: "lost", label: "Fechado (Perdido)" },
];

export function BoardView({
  rows,
  onMove,
  onOpenLead,
}: {
  rows: BoardRow[];
  onMove: (campaignLeadId: string, stage: string) => Promise<void>;
  onOpenLead?: (leadId: string) => void;
}) {
  const [optimisticRows, setOptimisticRows] = useState<BoardRow[] | null>(null);
  const displayRows = optimisticRows ?? rows;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    })
  );

  const cardsByStage = useMemo(() => {
    const map = new Map<string, BoardRow[]>();
    for (const stage of stages) map.set(stage.id, []);

    for (const row of displayRows) {
      if (!map.has(row.pipelineStage)) map.set(row.pipelineStage, []);
      map.get(row.pipelineStage)?.push(row);
    }

    return map;
  }, [displayRows]);

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    let targetStage = String(over.id);

    if (!stages.find((stage) => stage.id === targetStage)) {
      const dropCard = displayRows.find((row) => row.campaignLeadId === targetStage);
      targetStage = dropCard?.pipelineStage ?? targetStage;
    }

    if (!stages.find((stage) => stage.id === targetStage)) return;

    // Optimistic update
    const prev = rows;
    setOptimisticRows(
      rows.map((row) =>
        row.campaignLeadId === activeId ? { ...row, pipelineStage: targetStage } : row
      )
    );

    try {
      await onMove(activeId, targetStage);
    } catch {
      setOptimisticRows(prev);
      toast.error("Erro ao mover card. Revertido.");
    } finally {
      setOptimisticRows(null);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-3">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            id={stage.id}
            title={stage.label}
            cards={(cardsByStage.get(stage.id) ?? []).map((row) => ({
              campaignLeadId: row.campaignLeadId,
              leadId: row.leadId,
              title: row.leadName,
              score: row.leadScore,
              snippet: row.leadCategory ?? row.leadCity ?? undefined,
              daysInStage: row.contactedAt
                ? Math.floor(
                    (Date.now() - new Date(row.contactedAt).getTime()) / 86_400_000
                  )
                : 0,
            }))}
            onOpenCard={onOpenLead}
          />
        ))}
      </div>
    </DndContext>
  );
}
