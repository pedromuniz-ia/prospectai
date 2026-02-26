"use client";

import { Clock3, MessageSquare, MoveRight, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ScoreBadge, StatusBadge } from "@/app/(dashboard)/leads/columns";
import { Badge } from "@/components/ui/badge";
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
import { formatRelativeTime } from "@/lib/helpers";

type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  score: number;
  status: string;
  lastContactedAt: Date | null;
  createdAt: Date;
};

export function LeadsDataTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onOpenLead,
  onBulkAdd,
}: {
  leads: LeadRow[];
  selected: string[];
  onToggle: (leadId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenLead: (leadId: string) => void;
  onBulkAdd: () => void;
}) {
  const allSelected = leads.length > 0 && selected.length === leads.length;
  const [referenceNow] = useState(() => Date.now());

  const staleIds = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    return new Set(
      leads
        .filter((lead) => {
          if (lead.status !== "contacted" || !lead.lastContactedAt) return false;
          return (
            referenceNow - new Date(lead.lastContactedAt).getTime() > threeDaysMs
          );
        })
        .map((lead) => lead.id)
    );
  }, [leads, referenceNow]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <div className="text-muted-foreground text-xs">
          {selected.length > 0 ? `${selected.length} selecionados` : `${leads.length} leads nesta página`}
        </div>

        {selected.length > 0 && (
          <Button size="sm" onClick={onBulkAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar em campanha
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={(value) => onToggleAll(Boolean(value))} />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Último contato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {leads.map((lead) => {
            const checked = selected.includes(lead.id);
            const isStale = staleIds.has(lead.id);

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
                    className="hover:text-primary text-left text-sm font-medium"
                  >
                    {lead.name}
                  </button>
                </TableCell>

                <TableCell className="text-muted-foreground">{lead.category ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{lead.city ?? "—"}</TableCell>
                <TableCell>
                  <ScoreBadge score={lead.score} />
                </TableCell>

                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{formatRelativeTime(lead.lastContactedAt ?? lead.createdAt)}</span>
                    {isStale && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        <Clock3 className="mr-1 h-3 w-3" />
                        stale
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge status={lead.status} />
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={`/inbox?leadId=${lead.id}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onOpenLead(lead.id)}>
                      <MoveRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
