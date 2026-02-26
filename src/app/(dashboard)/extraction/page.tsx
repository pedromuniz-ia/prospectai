"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Play, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  getExtractionJobs,
  getPresets,
  savePreset,
  startExtraction,
} from "@/lib/actions/extraction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/helpers";

export default function ExtractionPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [query, setQuery] = useState("Restaurante");
  const [city, setCity] = useState("São Paulo");
  const [state, setState] = useState("SP");
  const [maxResults, setMaxResults] = useState(20);
  const [savingPreset, setSavingPreset] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof getExtractionJobs>>>([]);
  const [presets, setPresets] = useState<Awaited<ReturnType<typeof getPresets>>>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;

    const [jobRows, presetRows] = await Promise.all([
      getExtractionJobs(organizationId),
      getPresets(organizationId),
    ]);

    setJobs(jobRows);
    setPresets(presetRows);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!organizationId) return;

    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load, organizationId]);

  async function handleRunExtraction() {
    if (!organizationId) return;
    if (!query.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha query, cidade e estado.");
      return;
    }

    setRunning(true);
    try {
      await startExtraction(organizationId, {
        query: query.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        maxResults,
      });
      toast.success("Extração iniciada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro na extração");
    } finally {
      setRunning(false);
    }
  }

  async function handleSavePreset() {
    if (!organizationId) return;

    setSavingPreset(true);
    try {
      await savePreset(organizationId, {
        name: `${query} · ${city}/${state}`,
        query,
        city,
        state,
        maxResults,
      });
      toast.success("Preset salvo.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar preset");
    } finally {
      setSavingPreset(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,197,94,.14),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.12),transparent_40%)]" />

      <div className="relative grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Search className="text-primary h-4 w-4" />
                <h1 className="font-display text-2xl">Extração de Leads</h1>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Execute buscas no Google Maps via Apify e alimente o pipeline automaticamente.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Sparkles className="mr-1 h-3 w-3" />
              Server-side
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Query de busca
              </Label>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Restaurante"
              />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Cidade
              </Label>
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="São Paulo"
              />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Estado
              </Label>
              <Input
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
              />
            </div>
            <div>
              <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.09em] text-muted-foreground">
                Máximo de resultados
              </Label>
              <Input
                type="number"
                value={maxResults}
                onChange={(event) => setMaxResults(Math.max(1, Number(event.target.value)))}
                min={1}
                max={200}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleRunExtraction} disabled={running}>
              <Play className="mr-2 h-4 w-4" />
              {running ? "Iniciando..." : "Iniciar extração"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSavePreset}
              disabled={savingPreset}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar preset
            </Button>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">Presets salvos</p>
            {presets.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum preset salvo.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setQuery(preset.query);
                      setCity(preset.city);
                      setState(preset.state);
                      setMaxResults(preset.maxResults);
                    }}
                    className="rounded-xl border border-border/70 bg-card/50 p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <p className="text-sm font-medium">{preset.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {preset.query} · {preset.city}/{preset.state} · {preset.maxResults} resultados
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <Database className="text-primary h-4 w-4" />
            <h2 className="text-lg font-semibold">Jobs recentes</h2>
          </div>

          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum job executado ainda.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const progress =
                  job.totalFound > 0
                    ? Math.round(((job.totalNew + job.totalDuplicate) / job.totalFound) * 100)
                    : job.status === "completed"
                      ? 100
                      : job.status === "failed"
                        ? 0
                        : 20;

                return (
                  <div
                    key={job.id}
                    className="rounded-xl border border-border/70 bg-card/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{job.type}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === "completed"
                            ? "default"
                            : job.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>

                    <Progress value={progress} className="mt-3" />

                    <div className="text-muted-foreground mt-2 grid grid-cols-3 gap-1 text-xs">
                      <span>Encontrados: {job.totalFound}</span>
                      <span>Novos: {job.totalNew}</span>
                      <span>Duplicados: {job.totalDuplicate}</span>
                    </div>

                    {job.errorMessage && (
                      <p className="mt-2 text-xs text-destructive">{job.errorMessage}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
