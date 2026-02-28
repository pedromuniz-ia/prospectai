"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Info, Play, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  getExtractionJobs,
  getExtractionLogs,
  getPresets,
  parseExtractionPrompt,
  savePreset,
  startExtraction,
} from "@/lib/actions/extraction";
import { StatusBadge, EmptyState, FormField, LoadingButton } from "@/components/ds";
import { Terminal, Activity, Zap, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export default function ExtractionPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [query, setQuery] = useState("Restaurante");
  const [city, setCity] = useState("São Paulo");
  const [state, setState] = useState("SP");
  const [prompt, setPrompt] = useState("");
  const [magicMode, setMagicMode] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{ query: string; locations: string[]; explanation: string } | null>(null);
  const [maxResults, setMaxResults] = useState(50);
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof getExtractionJobs>>>([]);
  const [jobPage, setJobPage] = useState(1);
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getExtractionLogs>>>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [presets, setPresets] = useState<Awaited<ReturnType<typeof getPresets>>>([]);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;

    const [jobRows, presetRows] = await Promise.all([
      getExtractionJobs(organizationId),
      getPresets(organizationId),
    ]);

    setJobs(jobRows);
    setPresets(presetRows);

    // Auto-select latest running or pending job
    const active = jobRows.find(j => j.status === "running" || j.status === "pending");
    if (active) {
      setActiveJobId(active.id);
    } else if (jobRows.length > 0 && !activeJobId) {
      setActiveJobId(jobRows[0].id);
    }
  }, [organizationId, activeJobId]);

  const loadLogs = useCallback(async () => {
    if (!activeJobId) return;
    const jobLogs = await getExtractionLogs(activeJobId);
    setLogs(jobLogs);
  }, [activeJobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!organizationId) return;

    const interval = setInterval(() => {
      load();
      loadLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [load, loadLogs, organizationId]);

  async function handleRunExtraction() {
    if (!organizationId) return;
    if (!query.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha tipo de negócio, cidade e estado.");
      return;
    }

    setRunning(true);
    try {
      const config = magicMode && parsedData
        ? {
            maxResults,
            prompt,
            searchStrings: parsedData.locations.map(l => `${parsedData.query} em ${l}`),
          }
        : {
            maxResults,
            query: query.trim(),
            city: city.trim(),
            state: state.trim().toUpperCase(),
          };

      await startExtraction(organizationId, config);
      toast.success("Extração iniciada com sucesso.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro na extração");
    } finally {
      setRunning(false);
    }
  }

  function handleOpenPresetDialog() {
    setPresetName(`${query} · ${city}/${state}`);
    setPresetDialogOpen(true);
  }

  async function handleSavePreset() {
    if (!organizationId) return;
    if (!presetName.trim()) {
      toast.error("Defina um nome para o preset.");
      return;
    }

    await savePreset(organizationId, {
      name: presetName.trim(),
      query,
      city,
      state,
      maxResults,
    });
    toast.success("Preset salvo.");
    setPresetDialogOpen(false);
    await load();
  }

  // Prompt parsing effect
  useEffect(() => {
    if (!magicMode || !prompt.trim() || prompt.length < 10) {
      setParsedData(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (!organizationId) return;
      setParsing(true);
      try {
        const result = await parseExtractionPrompt(organizationId, prompt);
        setParsedData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setParsing(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [prompt, magicMode, organizationId]);

  return (
    <div className="relative min-h-full overflow-hidden p-5 md:p-6 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,197,94,.14),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.12),transparent_40%)]" />

      <div className="relative mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-xl p-2.5">
            <Sparkles className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Extração Inteligente</h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Alimente seu pipeline de vendas encontrando leads qualificados no Google Maps em segundos.
            </p>
          </div>
        </div>
      </div>

      <div className="relative grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Card className="relative overflow-hidden border-primary/20 bg-card/60 p-6 shadow-xl backdrop-blur-md">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="text-primary h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-70">Extraction Command</span>
              </div>

              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border/50">
                <button
                  onClick={() => setMagicMode(true)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                    magicMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  Modo Inteligente
                </button>
                <button
                  onClick={() => setMagicMode(false)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                    !magicMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  Modo Manual
                </button>
              </div>
            </div>

            {magicMode ? (
              <div className="space-y-6">
                <div className="group relative">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 to-sky-500/20 opacity-0 blur transition duration-500 group-focus-within:opacity-100" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: 'Quero dentistas em Goiânia, Anápolis e Brasília' ou 'Restaurantes de luxo no Itaim Bibi, SP'..."
                    className="relative min-h-[120px] w-full resize-none rounded-xl border border-primary/30 bg-black/40 p-4 font-display text-lg placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-0"
                  />
                  {parsing && (
                    <div className="absolute right-4 bottom-4 flex items-center gap-2 text-xs text-primary animate-pulse">
                      <Activity className="h-3 w-3" />
                      <span>Interpretando pedido...</span>
                    </div>
                  )}
                </div>

                {parsedData ? (
                  <div className="animate-in fade-in slide-in-from-top-2 rounded-xl bg-primary/5 border border-primary/10 p-4 duration-500">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Identificamos o seguinte:</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-border/50 px-3 py-1 text-[11px] font-medium shadow-sm">
                            <Search className="h-3 w-3 text-primary" />
                            <span>{parsedData.query}</span>
                          </div>
                          {parsedData.locations.map((loc, i) => (
                            <div key={i} className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-border/50 px-3 py-1 text-[11px] font-medium shadow-sm">
                              <Activity className="h-3 w-3 text-emerald-400" />
                              <span>{loc}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-zinc-400 text-xs italic">
                          {`Pronto para buscar ${parsedData.query} em ${parsedData.locations.length} localizações diferentes.`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !prompt.trim() ? (
                  <div className="grid gap-3 sm:grid-cols-2 mt-4">
                    {[
                      "Escritórios de advocacia no centro de São Paulo",
                      "Academias de crossfit em Curitiba e Londrina",
                      "Clínicas de estética na Barra da Tijuca, RJ",
                      "Imobiliárias em Balneário Camboriú"
                    ].map((tpl) => (
                      <button
                        key={tpl}
                        onClick={() => setPrompt(tpl)}
                        className="text-left p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-primary/5 hover:border-primary/30 transition-all text-[11px] text-muted-foreground hover:text-primary"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Tipo de negócio" helper="Categoria de busca no Google Maps">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ex: Restaurante, Dentista"
                  />
                </FormField>
                <FormField label="Cidade">
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="São Paulo"
                  />
                </FormField>
                <FormField label="Estado">
                  <Input
                    value={state}
                    onChange={(event) => setState(event.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                  />
                </FormField>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-border/40 pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <Label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Resultados por Local</Label>
                  <Select
                    value={String(maxResults)}
                    onValueChange={(val) => setMaxResults(Number(val))}
                  >
                    <SelectTrigger className="h-8 w-[80px] bg-zinc-900 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleOpenPresetDialog} size="sm">
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Salvar como Preset
                </Button>
                <Button
                  onClick={handleRunExtraction}
                  disabled={running || (magicMode && !parsedData)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-8 h-10 rounded-xl transition-all active:scale-95"
                >
                  {running ? (
                    <Activity className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4 fill-current" />
                  )}
                  Iniciar Extração
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm">
              <p className="mb-4 text-xs uppercase font-bold tracking-widest text-primary/80">Seus Presets</p>
              {presets.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">Nenhum preset salvo.</p>
              ) : (
                <div className="grid gap-3">
                  {presets.slice(0, 4).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setMagicMode(false);
                        setQuery(preset.query);
                        setCity(preset.city);
                        setState(preset.state);
                        setMaxResults(preset.maxResults);
                      }}
                      className="group flex flex-col rounded-xl border border-border/70 bg-card/50 p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                    >
                      <p className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight">{preset.name}</p>
                      <p className="text-muted-foreground mt-1 text-[10px] tabular-nums opacity-60">
                        {preset.query} · {preset.city}/{preset.state} · {preset.maxResults} leads
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-border/70 bg-card/75 p-5 backdrop-blur-sm flex flex-col justify-center text-center items-center">
              <div className="bg-amber-500/10 rounded-2xl p-4 mb-4">
                <Zap className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="font-bold text-sm mb-1">Dica de Especialista</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Extrações em massa com mais de 3 cidades costumam performar melhor no <span className="text-primary font-bold">Modo Inteligente</span>. O sistema otimiza as rotas do Scraper automaticamente.
              </p>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Real-time Monitor */}
          <Card className="flex h-[320px] flex-col border-emerald-500/20 bg-zinc-950/90 p-0 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl shrink-0">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </div>
                <h2 className="font-mono text-[10px] font-bold tracking-widest text-emerald-500 uppercase">Live Worker Monitor</h2>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono text-white/40 uppercase tracking-tight">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3 text-emerald-500/50" />
                  <span>CPU: OK</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-emerald-500/50" />
                  <span>Stream Active</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-black/40 font-mono text-[10px] leading-relaxed custom-scrollbar">
              <div className="flex flex-col-reverse p-4 space-y-reverse space-y-1.5 min-h-full">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600 italic">
                    <Terminal className="h-8 w-8 mb-3 opacity-20" />
                    <p>Aguardando logs do processo...</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-3 group animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className="shrink-0 text-zinc-700 tabular-nums">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={cn(
                        "break-all",
                        log.type === "success" && "text-emerald-400",
                        log.type === "error" && "text-rose-400",
                        log.type === "warning" && "text-amber-400",
                        log.type === "info" && "text-sky-300",
                      )}>
                        <span className="mr-2 opacity-50 font-bold">[{log.type.toUpperCase()}]</span>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Jobs List */}
          <Card className="flex flex-col border-border/70 bg-card/75 p-0 backdrop-blur-sm overflow-hidden min-h-[500px]">
            <div className="p-5 pb-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="text-primary h-4 w-4" />
                <h2 className="text-sm font-bold uppercase tracking-wider opacity-80">Histórico de Extrações</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {jobs.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="Nenhum job executado"
                  description="Inicie uma extração para ver os resultados aqui."
                />
              ) : (
                jobs.slice((jobPage - 1) * 6, jobPage * 6).map((job) => {
                  const isActive = activeJobId === job.id;
                  const isRunning = job.status === "running" || job.status === "pending";
                  const progress =
                    job.totalFound > 0
                      ? Math.round(((job.totalNew + job.totalDuplicate) / job.totalFound) * 100)
                      : job.status === "completed"
                        ? 100
                        : job.status === "failed"
                          ? 0
                          : undefined;

                  return (
                    <button
                      key={job.id}
                      onClick={() => setActiveJobId(job.id)}
                      className={cn(
                        "w-full text-left rounded-xl border p-4 transition-all duration-300 group",
                        isActive
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5"
                          : "border-border/40 bg-zinc-900/30 hover:border-primary/30 hover:bg-zinc-900/50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded">
                              {t("jobType", job.type).split(' ')[0]}
                            </span>
                            {isRunning && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(job.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold line-clamp-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            {/* @ts-expect-error config type is dynamic */}
                            {job.config?.prompt || job.config?.query || "Extração Personalizada"}
                          </p>
                        </div>
                        <div className="scale-75 origin-right">
                          <StatusBadge domain="jobStatus" value={job.status} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className={cn(isRunning ? "text-primary animate-pulse" : "text-emerald-500")}>
                            {progress ?? 0}%
                          </span>
                        </div>
                        <div className="relative h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 transition-all duration-500 rounded-full bg-primary",
                              isRunning && "bg-gradient-to-r from-primary to-sky-400 animate-shimmer bg-[length:200%_100%]"
                            )}
                            style={{ width: `${progress ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="bg-zinc-800/50 rounded-lg p-2 border border-white/5">
                          <span className="block text-[8px] uppercase tracking-widest text-muted-foreground mb-1">Total</span>
                          <span className="text-sm font-bold tabular-nums">{job.totalFound}</span>
                        </div>
                        <div className="bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/10">
                          <span className="block text-[8px] uppercase tracking-widest text-emerald-400/70 mb-1">Novos</span>
                          <span className="text-sm font-bold text-emerald-400 tabular-nums">{job.totalNew}</span>
                        </div>
                        <div className="bg-amber-500/5 rounded-lg p-2 border border-amber-500/10">
                          <span className="block text-[8px] uppercase tracking-widest text-amber-400/70 mb-1">Duplic.</span>
                          <span className="text-sm font-bold text-amber-400 tabular-nums">{job.totalDuplicate}</span>
                        </div>
                      </div>

                      {job.errorMessage && isActive && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-2 text-[10px] text-rose-400 border border-rose-500/20">
                          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>{job.errorMessage}</span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {jobs.length > 6 && (
              <div className="p-4 border-t border-border/40 flex items-center justify-between bg-zinc-950/20">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={jobPage === 1}
                  onClick={() => setJobPage(p => p - 1)}
                  className="h-8 text-[10px] font-bold uppercase"
                >
                  Anterior
                </Button>
                <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-50">
                  Página {jobPage} de {Math.ceil(jobs.length / 6)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={jobPage >= Math.ceil(jobs.length / 6)}
                  onClick={() => setJobPage(p => p + 1)}
                  className="h-8 text-[10px] font-bold uppercase"
                >
                  Próxima
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar preset</DialogTitle>
          </DialogHeader>
          <FormField label="Nome do preset">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Ex: Restaurantes SP"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton onClick={handleSavePreset}>
              Salvar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
