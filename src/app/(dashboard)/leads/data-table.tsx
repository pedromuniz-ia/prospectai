"use client";

import { MoveRight, Database } from "lucide-react";
import { ScoreBadge, StatusBadge } from "@/app/(dashboard)/leads/columns";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  score: number;
  status: string;
  createdAt: Date;
};

export function LeadsDataTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onOpenLead,
}: {
  leads: LeadRow[];
  selected: string[];
  onToggle: (leadId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const allSelected = leads.length > 0 && selected.length === leads.length;
  const someSelected = selected.length > 0 && selected.length < leads.length;

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Nenhum lead encontrado"
        description="Ajuste os filtros ou inicie uma nova extração para popular a base."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <div className="text-muted-foreground text-xs">
          {selected.length > 0
            ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`
            : `${leads.length} leads`}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(value) => {
                  if (value === "indeterminate") return;
                  onToggleAll(Boolean(value));
                }}
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {leads.map((lead) => {
            const checked = selected.includes(lead.id);

            return (
              <TableRow key={lead.id} data-state={checked ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onToggle(lead.id, Boolean(value))}
                  />
                </TableCell>

                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenLead(lead.id)}
                    className="hover:text-primary text-left text-sm font-medium transition-colors"
                  >
                    {lead.name}
                  </button>
                </TableCell>

                <TableCell className="text-muted-foreground">{lead.category ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{lead.city ?? "—"}</TableCell>
                <TableCell>
                  <ScoreBadge score={lead.score} />
                </TableCell>

                <TableCell>
                  <StatusBadge status={lead.status} />
                </TableCell>

                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onOpenLead(lead.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalhes</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
