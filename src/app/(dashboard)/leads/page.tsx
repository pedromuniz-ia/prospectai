"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  KanbanSquare,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  bulkAddToCampaign,
  getLead,
  getLeadBoard,
  getLeads,
  type LeadFilters,
  updateCampaignLeadStage,
} from "@/lib/actions/leads";
import { getCampaigns } from "@/lib/actions/campaigns";
import { LeadsDataTable } from "@/app/(dashboard)/leads/data-table";
import { BoardView } from "@/app/(dashboard)/leads/board-view";
import { ScoreBadge, StatusBadge } from "@/app/(dashboard)/leads/columns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatRelativeTime, safeJsonParse } from "@/lib/helpers";

const DEFAULT_PAGE_SIZE = 20;

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando leads...</div>}>
      <LeadsPageContent />
    </Suspense>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getLeads>>["rows"]>([]);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof getCampaigns>>>([]);
  const [boardRows, setBoardRows] = useState<Awaited<ReturnType<typeof getLeadBoard>>>([]);
  const [leadDetails, setLeadDetails] = useState<Awaited<ReturnType<typeof getLead>> | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const view = searchParams.get("view") === "board" ? "board" : "table";
  const leadId = searchParams.get("leadId");
  const boardCampaignId = searchParams.get("campaignId") ?? "";
  const bulkCampaignId = searchParams.get("bulkCampaignId") ?? "";

  const filters = useMemo<LeadFilters>(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      search: searchParams.get("search") ?? undefined,
      sortBy: (searchParams.get("sortBy") as LeadFilters["sortBy"]) ?? "score",
      sortOrder:
        (searchParams.get("sortOrder") as LeadFilters["sortOrder"]) ?? "desc",
      category: searchParams.get("category")?.split(",").filter(Boolean),
      city: searchParams.get("city")?.split(",").filter(Boolean),
      status: searchParams.get("status")?.split(",").filter(Boolean),
      scoreMin: searchParams.get("scoreMin")
        ? Number(searchParams.get("scoreMin"))
        : undefined,
      scoreMax: searchParams.get("scoreMax")
        ? Number(searchParams.get("scoreMax"))
        : undefined,
      hasWebsite:
        searchParams.get("hasWebsite") === "true"
          ? true
          : searchParams.get("hasWebsite") === "false"
            ? false
            : undefined,
      campaignId: searchParams.get("filterCampaignId") ?? undefined,
      aiClassification: searchParams
        .get("aiClassification")
        ?.split(",")
        .filter(Boolean),
    }),
    [page, searchParams]
  );

  const setParam = useCallback(
    (key: string, value?: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const loadLeads = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);

    try {
      const [leadResult, campaignResult] = await Promise.all([
        getLeads(organizationId, filters),
        getCampaigns(organizationId),
      ]);

      setRows(leadResult.rows);
      setCount(leadResult.count);
      setCampaigns(campaignResult);

      if (view === "board" && boardCampaignId) {
        const board = await getLeadBoard(organizationId, boardCampaignId);
        setBoardRows(board);
      } else {
        setBoardRows([]);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar leads"
      );
    } finally {
      setLoading(false);
    }
  }, [boardCampaignId, filters, organizationId, view]);

  const loadLeadDetails = useCallback(async () => {
    if (!leadId) {
      setLeadDetails(null);
      return;
    }

    const detail = await getLead(leadId);
    setLeadDetails(detail);
  }, [leadId]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    loadLeadDetails();
  }, [loadLeadDetails]);

  const totalPages = Math.max(1, Math.ceil(count / DEFAULT_PAGE_SIZE));

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort(),
    [rows]
  );

  const cityOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.city).filter(Boolean))).sort(),
    [rows]
  );

  async function handleBulkAdd() {
    if (!organizationId) return;
    if (!bulkCampaignId) {
      toast.error("Selecione uma campanha para o bulk add.");
      return;
    }

    await bulkAddToCampaign(selected, bulkCampaignId, organizationId);
    toast.success("Leads adicionados à campanha.");
    setSelected([]);
    await loadLeads();
  }

  async function handleMoveStage(campaignLeadId: string, stage: string) {
    await updateCampaignLeadStage(
      campaignLeadId,
      stage as "new" | "approached" | "replied" | "interested" | "proposal" | "won" | "lost"
    );
    await loadLeads();
  }

  return (
    <div className="relative min-h-full overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,.14),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,.10),transparent_38%)]" />
      <div className="relative space-y-4">
        <Card className="border-border/70 bg-card/75 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary h-4 w-4" />
                <h1 className="font-display text-2xl">Leads</h1>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Qualifique, priorize e mova oportunidades com ritmo operacional.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={view === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setParam("view", "table")}
              >
                <List className="mr-2 h-4 w-4" />
                Tabela
              </Button>
              <Button
                variant={view === "board" ? "default" : "outline"}
                size="sm"
                onClick={() => setParam("view", "board")}
              >
                <KanbanSquare className="mr-2 h-4 w-4" />
                Board
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Buscar
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-8"
                  value={filters.search ?? ""}
                  onChange={(event) => setParam("search", event.target.value || null)}
                  placeholder="Nome, telefone..."
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Categoria
              </Label>
              <Select
                value={filters.category?.[0] ?? "all"}
                onValueChange={(value) =>
                  setParam("category", value === "all" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category!}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Cidade
              </Label>
              <Select
                value={filters.city?.[0] ?? "all"}
                onValueChange={(value) =>
                  setParam("city", value === "all" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city!}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Score mínimo
              </Label>
              <Input
                type="number"
                value={filters.scoreMin ?? ""}
                onChange={(event) =>
                  setParam("scoreMin", event.target.value || null)
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>{count} leads encontrados</span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Página {page} de {totalPages}
            </Badge>
            <Badge variant="outline" className="border-border/70">
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              Ordenado por score
            </Badge>
          </div>

          {selected.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <Select
                value={bulkCampaignId || "none"}
                onValueChange={(value) =>
                  setParam("bulkCampaignId", value === "none" ? null : value)
                }
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Selecione campanha para bulk add" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleBulkAdd}>
                Adicionar {selected.length} leads
              </Button>
            </div>
          )}
        </Card>

        {loading ? (
          <Card className="border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            Carregando leads...
          </Card>
        ) : view === "table" ? (
          <LeadsDataTable
            leads={rows}
            selected={selected}
            onToggle={(leadId, checked) => {
              setSelected((current) =>
                checked
                  ? Array.from(new Set([...current, leadId]))
                  : current.filter((id) => id !== leadId)
              );
            }}
            onToggleAll={(checked) => {
              if (checked) setSelected(rows.map((row) => row.id));
              else setSelected([]);
            }}
            onOpenLead={(nextLeadId) => setParam("leadId", nextLeadId)}
            onBulkAdd={handleBulkAdd}
          />
        ) : !boardCampaignId ? (
          <Card className="border-border/70 bg-card/70 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Selecione uma campanha para visualizar o board.
            </p>
            <div className="mx-auto mt-3 w-72">
              <Select
                value={boardCampaignId || "none"}
                onValueChange={(value) =>
                  setParam("campaignId", value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Escolha...</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={boardCampaignId || "none"}
                onValueChange={(value) =>
                  setParam("campaignId", value === "none" ? null : value)
                }
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Escolha...</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">{boardRows.length} cards</Badge>
            </div>
            <BoardView
              rows={boardRows}
              onMove={handleMoveStage}
              onOpenLead={(nextLeadId) => setParam("leadId", nextLeadId)}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {(page - 1) * DEFAULT_PAGE_SIZE + 1} - {Math.min(page * DEFAULT_PAGE_SIZE, count)} de {count}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={Boolean(leadId)}
        onOpenChange={(open) => {
          if (!open) setParam("leadId", null);
        }}
      >
        <SheetContent className="w-full max-w-2xl overflow-y-auto">
          {leadDetails ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{leadDetails.name}</SheetTitle>
                <SheetDescription>
                  {leadDetails.category ?? "Categoria não informada"} · {leadDetails.city ?? "Cidade não informada"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 p-4 pt-0">
                <section className="grid gap-3 rounded-xl border border-border/70 bg-card/50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Score</p>
                    <div className="mt-2">
                      <ScoreBadge score={leadDetails.score} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <StatusBadge status={leadDetails.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Telefone</p>
                    <p className="mt-1 text-sm">{leadDetails.phone ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Website</p>
                    <p className="mt-1 text-sm">{leadDetails.website ?? "—"}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-border/70 bg-card/50 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Score breakdown</p>
                  <div className="mt-3 space-y-2">
                    {Object.entries(
                      safeJsonParse<Record<string, number>>(
                        typeof leadDetails.scoreBreakdown === "string"
                          ? leadDetails.scoreBreakdown
                          : null,
                        {}
                      )
                    ).map(([label, points]) => (
                      <div key={label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span>{label}</span>
                          <span className="font-mono">+{points}</span>
                        </div>
                        <div className="bg-muted h-2 rounded-full">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${Math.min(points, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {!leadDetails.scoreBreakdown && (
                      <p className="text-xs text-muted-foreground">Sem breakdown disponível.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border/70 bg-card/50 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Campanhas</p>
                  <div className="mt-3 space-y-2">
                    {leadDetails.campaignRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem campanhas associadas.</p>
                    ) : (
                      leadDetails.campaignRows.map((campaignRow) => (
                        <div
                          key={campaignRow.campaignLeadId}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{campaignRow.campaignName}</p>
                            <p className="text-xs text-muted-foreground">
                              Stage: {campaignRow.pipelineStage}
                            </p>
                          </div>
                          <StatusBadge status={campaignRow.leadStatus} />
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border/70 bg-card/50 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Mensagens recentes</p>
                  <div className="mt-3 space-y-2">
                    {leadDetails.recentMessages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem mensagens recentes.</p>
                    ) : (
                      leadDetails.recentMessages.slice(0, 8).map((message) => (
                        <div key={message.id} className="rounded-lg border border-border/60 p-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{message.direction === "inbound" ? "Entrada" : "Saída"}</span>
                            <span>{formatRelativeTime(message.createdAt)}</span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Carregando detalhes...</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
