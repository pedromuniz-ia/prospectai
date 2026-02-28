"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MoveRight,
  Database,
  Download,
  SlidersHorizontal,
  ExternalLink,
  RefreshCcw,
} from "lucide-react";
import {
  ScoreBadge,
  StatusBadge,
  WhatsappBadge,
  InstagramBadge,
  RankBadge,
  ClassificationBadge,
} from "@/app/(dashboard)/leads/columns";
import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { isActualWebsite } from "@/lib/helpers";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LeadRow = {
  id: string;
  organizationId: string;
  name: string;
  category: string | null;
  city: string | null;
  score: number;
  status: string;
  createdAt: Date;
  imageUrl?: string | null;
  googleMapsUrl?: string | null;
  googleRank?: number | null;
  hasWhatsapp?: boolean | null;
  whatsappIsBusinessAccount?: boolean | null;
  hasInstagram?: boolean | null;
  instagramFollowers?: number | null;
  instagramUsername?: string | null;
  aiClassification?: string | null;
  website?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Column visibility                                                  */
/* ------------------------------------------------------------------ */

const COLUMN_IDS = [
  "score",
  "status",
  "classification",
  "whatsapp",
  "instagram",
  "website",
  "rank",
  "city",
  "category",
  "createdAt",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const COLUMN_LABELS: Record<ColumnId, string> = {
  score: "Score",
  status: "Status",
  classification: "Classificação IA",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  website: "Website",
  rank: "Rank Maps",
  city: "Cidade",
  category: "Categoria",
  createdAt: "Criado em",
};

const DEFAULT_COLUMNS: Record<ColumnId, boolean> = {
  score: true,
  status: true,
  classification: true,
  whatsapp: true,
  instagram: true,
  website: true,
  rank: true,
  city: true,
  category: false,
  createdAt: false,
};

const STORAGE_KEY = "leads-columns-v1";

function loadColumnVisibility(): Record<ColumnId, boolean> {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_COLUMNS, ...JSON.parse(stored) };
  } catch {
    /* ignore */
  }
  return DEFAULT_COLUMNS;
}

function saveColumnVisibility(state: Record<ColumnId, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Export helpers                                                      */
/* ------------------------------------------------------------------ */

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCsv(rows: LeadRow[]) {
  const headers = [
    "id",
    "name",
    "city",
    "category",
    "score",
    "status",
    "hasWhatsapp",
    "hasInstagram",
    "instagramFollowers",
    "googleRank",
    "aiClassification",
    "website",
    "createdAt",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escCsv(r.id),
        escCsv(r.name),
        escCsv(r.city),
        escCsv(r.category),
        escCsv(r.score),
        escCsv(r.status),
        escCsv(r.hasWhatsapp),
        escCsv(r.hasInstagram),
        escCsv(r.instagramFollowers),
        escCsv(r.googleRank),
        escCsv(r.aiClassification),
        escCsv(r.website),
        escCsv(r.createdAt?.toISOString?.() ?? ""),
      ].join(",")
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(lines.join("\n"), `leads-${date}.csv`, "text/csv");
}

function exportJson(rows: LeadRow[]) {
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(
    JSON.stringify(rows, null, 2),
    `leads-${date}.json`,
    "application/json"
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeadsDataTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onOpenLead,
  onReenrich,
  onRefresh,
}: {
  leads: LeadRow[];
  selected: string[];
  onToggle: (leadId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenLead: (leadId: string) => void;
  onReenrich?: (leadIds: string[]) => Promise<void>;
  onRefresh?: () => Promise<void>;
}) {
  const [columns, setColumns] = useState<Record<ColumnId, boolean>>(DEFAULT_COLUMNS);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setColumns(loadColumnVisibility());
  }, []);

  const toggleColumn = useCallback(
    (id: ColumnId) => {
      setColumns((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        saveColumnVisibility(next);
        return next;
      });
    },
    []
  );

  const resetColumns = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setColumns(DEFAULT_COLUMNS);
  }, []);

  const allSelected = leads.length > 0 && selected.length === leads.length;
  const someSelected = selected.length > 0 && selected.length < leads.length;

  const handleReenrich = async () => {
    if (!onReenrich || selected.length === 0) return;
    setLoadingAction(true);
    try {
      await onReenrich(selected);
      toast.success(`${selected.length} leads enviados para re-enriquecimento`);
    } catch (error) {
      toast.error("Erro ao re-enriquecer leads");
    } finally {
      setLoadingAction(false);
    }
  };

  const col = (id: ColumnId) => columns[id];

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
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground text-xs shrink-0">
            {selected.length > 0
              ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`
              : `${leads.length} leads`}
          </div>

          {selected.length > 0 && onReenrich && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[11px] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all"
              onClick={handleReenrich}
              disabled={loadingAction}
            >
              <RefreshCcw className={`h-3 w-3 ${loadingAction ? "animate-spin" : ""}`} />
              Re-enriquecer
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={async () => {
              if (onRefresh) {
                setIsRefreshing(true);
                await onRefresh();
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Sincronizando..." : "Sincronizar"}
          </Button>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv(leads)}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportJson(leads)}>
                Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {COLUMN_IDS.map((id) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={columns[id]}
                  onCheckedChange={() => toggleColumn(id)}
                >
                  {COLUMN_LABELS[id]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetColumns}>
                Restaurar padrão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(value) => {
                  if (value === "indeterminate") return;
                  onToggleAll(Boolean(value));
                }}
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            {col("score") && <TableHead className="w-16">Score</TableHead>}
            {col("status") && <TableHead>Status</TableHead>}
            {col("classification") && <TableHead>Classificação</TableHead>}
            {col("whatsapp") && <TableHead className="w-20">WhatsApp</TableHead>}
            {col("instagram") && <TableHead className="w-24">Instagram</TableHead>}
            {col("website") && <TableHead>Website</TableHead>}
            {col("rank") && <TableHead className="w-16">Rank</TableHead>}
            {col("city") && <TableHead>Cidade</TableHead>}
            {col("category") && <TableHead>Categoria</TableHead>}
            {col("createdAt") && <TableHead>Criado em</TableHead>}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {leads.map((lead) => {
            const checked = selected.includes(lead.id);

            return (
              <TableRow
                key={lead.id}
                data-state={checked ? "selected" : undefined}
                className="group"
              >
                <TableCell className="pl-4">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onToggle(lead.id, Boolean(value))}
                  />
                </TableCell>

                {/* Name + Google Maps link */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenLead(lead.id)}
                    className="hover:text-primary text-left text-sm font-medium transition-colors"
                  >
                    {lead.name}
                  </button>
                  {lead.googleMapsUrl && (
                    <a
                      href={lead.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Ver no Maps
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </TableCell>

                {col("score") && (
                  <TableCell>
                    <ScoreBadge score={lead.score} />
                  </TableCell>
                )}

                {col("status") && (
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                )}

                {col("classification") && (
                  <TableCell>
                    <ClassificationBadge value={lead.aiClassification ?? null} />
                  </TableCell>
                )}

                {col("whatsapp") && (
                  <TableCell>
                    <WhatsappBadge
                      hasWhatsapp={lead.hasWhatsapp ?? null}
                      isBusiness={lead.whatsappIsBusinessAccount ?? null}
                    />
                  </TableCell>
                )}

                {col("instagram") && (
                  <TableCell>
                    <InstagramBadge
                      hasInstagram={lead.hasInstagram ?? null}
                      followers={lead.instagramFollowers ?? null}
                      username={lead.instagramUsername ?? null}
                    />
                  </TableCell>
                )}

                {col("website") && (
                  <TableCell className="text-muted-foreground text-xs max-w-32 truncate">
                    {lead.website && isActualWebsite(lead.website) ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                )}

                {col("rank") && (
                  <TableCell>
                    <RankBadge rank={lead.googleRank ?? null} />
                  </TableCell>
                )}

                {col("city") && (
                  <TableCell className="text-muted-foreground text-sm">
                    {lead.city ?? "—"}
                  </TableCell>
                )}

                {col("category") && (
                  <TableCell className="text-muted-foreground text-sm max-w-32 truncate">
                    {lead.category ?? "—"}
                  </TableCell>
                )}

                {col("createdAt") && (
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {lead.createdAt
                      ? new Date(lead.createdAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                )}

                <TableCell className="pr-4">
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
