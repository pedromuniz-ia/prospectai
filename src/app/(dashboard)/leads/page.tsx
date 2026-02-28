"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  getFilterOptions,
  getLead,
  getLeads,
  reenrichLead,
  type LeadFilters,
} from "@/lib/actions/leads";
import { LeadsDataTable } from "@/app/(dashboard)/leads/data-table";
import { LeadDetailModal } from "@/app/(dashboard)/leads/lead-detail-modal";
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
import { entries } from "@/lib/i18n";

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
  const [leadDetails, setLeadDetails] = useState<Awaited<ReturnType<typeof getLead>> | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ categories: string[]; cities: string[] }>({ categories: [], cities: [] });

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const leadId = searchParams.get("leadId");

  const filters = useMemo<LeadFilters>(
    () => ({
      page,
      pageSize,
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
      aiClassification: searchParams
        .get("aiClassification")
        ?.split(",")
        .filter(Boolean),
    }),
    [page, searchParams]
  );

  const setParams = useCallback(
    (params: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      });
      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const loadLeads = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);

    try {
      const [leadResult, filterOpts] = await Promise.all([
        getLeads(organizationId, filters),
        getFilterOptions(organizationId),
      ]);

      setRows(leadResult.rows);
      setCount(leadResult.count);
      setFilterOptions(filterOpts);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar leads"
      );
    } finally {
      setLoading(false);
    }
  }, [filters, organizationId]);

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

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const categoryOptions = filterOptions.categories;
  const cityOptions = filterOptions.cities;

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
                Qualifique, priorize e exporte oportunidades.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Buscar
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-8"
                  value={filters.search ?? ""}
                  onChange={(event) =>
                    setParams({ search: event.target.value || null })
                  }
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
                  setParams({ category: value === "all" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
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
                  setParams({ city: value === "all" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Status
              </Label>
              <Select
                value={filters.status?.[0] ?? "all"}
                onValueChange={(value) =>
                  setParams({ status: value === "all" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {entries("leadStatus").map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
                  setParams({ scoreMin: event.target.value || null })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Score máximo
              </Label>
              <Input
                type="number"
                value={filters.scoreMax ?? ""}
                onChange={(event) =>
                  setParams({ scoreMax: event.target.value || null })
                }
                placeholder="100"
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
        </Card>

        {loading ? (
          <Card className="border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            Carregando leads...
          </Card>
        ) : (
          <LeadsDataTable
            leads={rows}
            selected={selected}
            onToggle={(nextLeadId, checked) => {
              setSelected((current) =>
                checked
                  ? Array.from(new Set([...current, nextLeadId]))
                  : current.filter((id) => id !== nextLeadId)
              );
            }}
            onToggleAll={(checked) => {
              if (checked) setSelected(rows.map((row) => row.id));
              else setSelected([]);
            }}
            onOpenLead={(nextLeadId) => setParams({ leadId: nextLeadId })}
            onReenrich={async (ids) => {
              if (ids.length === 0) return;
              // Assuming all leads on this page belong to the same organization
              // We can get organizationId from any lead in the rows
              const organizationId = rows[0]?.organizationId;
              if (!organizationId) return;

              await Promise.all(ids.map(id => reenrichLead(id, organizationId)));
            }}
            onRefresh={async () => {
              await loadLeads();
            }}
          />
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, count)} de {count}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider opacity-60">Leads por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setParams({ pageSize: val, page: "1" });
                }}
              >
                <SelectTrigger className="h-7 w-[70px] bg-transparent text-xs border-border/40">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParams({ page: String(page + 1) })}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <LeadDetailModal
        lead={leadDetails}
        open={Boolean(leadId)}
        onOpenChange={(open) => {
          if (!open) setParams({ leadId: null });
        }}
        onRefresh={async () => {
          await Promise.all([loadLeads(), loadLeadDetails()]);
        }}
      />
    </div>
  );
}
