"use client";

import type { getLead } from "@/lib/actions/leads";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ScoreBadge,
  WhatsappBadge,
  InstagramBadge,
  RankBadge,
  ClassificationBadge,
} from "./columns";
import { StatusBadge } from "@/components/ds";
import {
  ExternalLink,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Brain,
  BarChart3,
  Search,
  Clock,
  RefreshCcw,
  Plus,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { reenrichLead } from "@/lib/actions/leads";
import { toast } from "sonner";
import { useState } from "react";

type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLead>>>;

interface LeadDetailModalProps {
  lead: LeadDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Shared UI pieces
// ---------------------------------------------------------------------------

function FieldRow({
  icon: Icon,
  label,
  children,
  muted,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70">
          {label}
        </p>
        <div className={muted ? "mt-0.5 text-sm text-muted-foreground/50" : "mt-0.5 text-sm"}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border/20 px-4">{children}</div>
    </div>
  );
}

function EmptyField({ text = "Não verificado" }: { text?: string }) {
  return <span className="text-muted-foreground/40 italic">{text}</span>;
}

// ---------------------------------------------------------------------------
// Tab: Visão Geral
// ---------------------------------------------------------------------------

function TabOverview({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Contato" icon={Phone}>
        <FieldRow icon={Phone} label="Telefone">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="font-mono text-sm tabular-nums transition-colors hover:text-primary"
            >
              {lead.phone}
            </a>
          ) : (
            <EmptyField text="Sem telefone" />
          )}
        </FieldRow>

        <FieldRow icon={MessageCircle} label="WhatsApp">
          <div className="flex items-center gap-2">
            <WhatsappBadge
              hasWhatsapp={lead.hasWhatsapp}
              isBusiness={lead.whatsappIsBusinessAccount}
            />
            {lead.hasWhatsapp === true && (
              <span className="text-xs text-muted-foreground">
                {lead.whatsappIsBusinessAccount ? "Business" : "Pessoal"}
              </span>
            )}
            {lead.hasWhatsapp == null && (
              <span className="text-xs text-muted-foreground/40 italic">
                Não verificado
              </span>
            )}
          </div>
        </FieldRow>

        <FieldRow icon={Mail} label="Email">
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="transition-colors hover:text-primary"
            >
              {lead.email}
            </a>
          ) : (
            <EmptyField text="Sem email" />
          )}
        </FieldRow>

        <FieldRow icon={Globe} label="Website">
          {lead.website ? (
            <a
              href={
                lead.website.startsWith("http")
                  ? lead.website
                  : `https://${lead.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <span className="truncate">
                {lead.website.replace(/^https?:\/\/(www\.)?/, "")}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </a>
          ) : (
            <EmptyField text="Sem website" />
          )}
          {lead.websiteStatus && (
            <div className="mt-1 flex items-center gap-2">
              <Badge
                className={
                  lead.websiteStatus === "active"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                    : lead.websiteStatus === "parked"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                      : "border-red-500/30 bg-red-500/10 text-red-400 text-[10px]"
                }
              >
                {lead.websiteStatus === "active"
                  ? "Ativo"
                  : lead.websiteStatus === "parked"
                    ? "Estacionado"
                    : lead.websiteStatus === "inactive"
                      ? "Inativo"
                      : "Erro"}
              </Badge>
              {lead.hasSsl != null && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  {lead.hasSsl ? "SSL" : "Sem SSL"}
                </span>
              )}
            </div>
          )}
        </FieldRow>

        <FieldRow icon={MapPin} label="Endereço">
          {lead.address || lead.city ? (
            <span>
              {lead.address && <span>{lead.address}</span>}
              {lead.address && lead.city && <span> — </span>}
              {lead.city && (
                <span>
                  {lead.city}
                  {lead.state ? `, ${lead.state}` : ""}
                </span>
              )}
            </span>
          ) : (
            <EmptyField text="Sem endereço" />
          )}
        </FieldRow>
      </SectionCard>

      <SectionCard title="Google Maps" icon={MapPin}>
        <FieldRow icon={Star} label="Avaliação">
          {lead.googleRating != null ? (
            <span className="flex items-center gap-1.5">
              <span className="font-mono font-semibold tabular-nums text-amber-400">
                {lead.googleRating.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({lead.googleReviewCount ?? 0} avaliações)
              </span>
            </span>
          ) : (
            <EmptyField text="Sem avaliação" />
          )}
        </FieldRow>

        <FieldRow icon={Search} label="Posição (Rank)">
          <RankBadge rank={lead.googleRank} />
        </FieldRow>

        <FieldRow icon={MapPin} label="Categoria">
          {lead.category ?? <EmptyField text="Sem categoria" />}
        </FieldRow>

        {lead.googleMapsUrl && (
          <FieldRow icon={ExternalLink} label="Link">
            <a
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-primary"
            >
              Ver no Google Maps
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          </FieldRow>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Enrichment
// ---------------------------------------------------------------------------

function TabEnrichment({ lead }: { lead: LeadDetail }) {
  const notChecked = (
    <span className="text-xs italic text-muted-foreground/40">
      Não verificado — enrichment pendente
    </span>
  );

  return (
    <div className="space-y-4">
      <SectionCard title="WhatsApp" icon={MessageCircle}>
        {lead.hasWhatsapp == null ? (
          <div className="py-3">{notChecked}</div>
        ) : (
          <>
            <FieldRow label="Status" icon={MessageCircle}>
              <WhatsappBadge
                hasWhatsapp={lead.hasWhatsapp}
                isBusiness={lead.whatsappIsBusinessAccount}
              />
            </FieldRow>
            {lead.whatsappIsBusinessAccount && (
              <>
                {lead.whatsappBusinessDescription && (
                  <FieldRow label="Descrição Business" icon={MessageCircle}>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {lead.whatsappBusinessDescription}
                    </p>
                  </FieldRow>
                )}
                {lead.whatsappBusinessEmail && (
                  <FieldRow label="Email Business" icon={Mail}>
                    <a
                      href={`mailto:${lead.whatsappBusinessEmail}`}
                      className="transition-colors hover:text-primary"
                    >
                      {lead.whatsappBusinessEmail}
                    </a>
                  </FieldRow>
                )}
                {lead.whatsappBusinessWebsite && (
                  <FieldRow label="Website Business" icon={Globe}>
                    <a
                      href={
                        lead.whatsappBusinessWebsite.startsWith("http")
                          ? lead.whatsappBusinessWebsite
                          : `https://${lead.whatsappBusinessWebsite}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                    >
                      {lead.whatsappBusinessWebsite.replace(
                        /^https?:\/\/(www\.)?/,
                        ""
                      )}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  </FieldRow>
                )}
              </>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Instagram" icon={Instagram}>
        {lead.hasInstagram == null ? (
          <div className="py-3">{notChecked}</div>
        ) : !lead.hasInstagram ? (
          <div className="py-3">
            <span className="text-xs text-muted-foreground/50">
              Sem perfil Instagram encontrado
            </span>
          </div>
        ) : (
          <>
            <FieldRow label="Perfil" icon={Instagram}>
              <InstagramBadge
                hasInstagram={lead.hasInstagram}
                followers={lead.instagramFollowers}
                username={lead.instagramUsername}
              />
            </FieldRow>
            {lead.instagramFollowers != null && (
              <FieldRow label="Seguidores" icon={Instagram}>
                <span className="font-mono tabular-nums">
                  {lead.instagramFollowers.toLocaleString("pt-BR")}
                </span>
              </FieldRow>
            )}
            {lead.instagramBiography && (
              <FieldRow label="Bio" icon={Instagram}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {lead.instagramBiography}
                </p>
              </FieldRow>
            )}
            {lead.instagramExternalUrl && (
              <FieldRow label="Link externo" icon={ExternalLink}>
                <a
                  href={lead.instagramExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                >
                  {lead.instagramExternalUrl.replace(
                    /^https?:\/\/(www\.)?/,
                    ""
                  )}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              </FieldRow>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Website" icon={Globe}>
        <FieldRow label="Status" icon={Globe}>
          {lead.websiteStatus ? (
            <Badge
              className={
                lead.websiteStatus === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                  : lead.websiteStatus === "parked"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                    : "border-red-500/30 bg-red-500/10 text-red-400 text-[10px]"
              }
            >
              {lead.websiteStatus === "active"
                ? "Ativo"
                : lead.websiteStatus === "parked"
                  ? "Estacionado"
                  : lead.websiteStatus === "inactive"
                    ? "Inativo"
                    : "Erro"}
            </Badge>
          ) : (
            notChecked
          )}
        </FieldRow>
        <FieldRow label="SSL" icon={ShieldCheck}>
          {lead.hasSsl != null ? (
            <span className={lead.hasSsl ? "text-emerald-400" : "text-red-400"}>
              {lead.hasSsl ? "Certificado válido" : "Sem SSL"}
            </span>
          ) : (
            notChecked
          )}
        </FieldRow>
      </SectionCard>

      <SectionCard title="Domínio (RDAP)" icon={Globe}>
        {lead.domainRegistrar || lead.whoisEmail ? (
          <>
            {lead.domainRegistrar && (
              <FieldRow label="Registrar" icon={Globe}>
                {lead.domainRegistrar}
              </FieldRow>
            )}
            {lead.domainCreatedAt && (
              <FieldRow label="Criado em" icon={Clock}>
                {lead.domainCreatedAt}
              </FieldRow>
            )}
            {lead.whoisEmail && (
              <FieldRow label="Email WHOIS" icon={Mail}>
                {lead.whoisEmail}
              </FieldRow>
            )}
            {lead.whoisResponsible && (
              <FieldRow label="Responsável" icon={MapPin}>
                {lead.whoisResponsible}
              </FieldRow>
            )}
          </>
        ) : (
          <div className="py-3">{notChecked}</div>
        )}
      </SectionCard>

      {lead.enrichedAt && (
        <p className="text-center text-[10px] text-muted-foreground/40">
          Enriquecido {formatRelativeTime(lead.enrichedAt)} atrás · versão{" "}
          {lead.enrichmentVersion}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Inteligência IA
// ---------------------------------------------------------------------------

function TabIntelligence({ lead }: { lead: LeadDetail }) {
  const breakdown = lead.parsedScoreBreakdown;
  const breakdownEntries = Object.entries(breakdown);
  const maxPoints = breakdownEntries.length
    ? Math.max(...breakdownEntries.map(([, v]) => Math.abs(v)), 1)
    : 1;

  return (
    <div className="space-y-4">
      <SectionCard title="Classificação IA" icon={Brain}>
        <FieldRow label="Classe" icon={Brain}>
          {lead.aiClassification ? (
            <div className="flex items-center gap-2">
              <ClassificationBadge value={lead.aiClassification} />
              {lead.aiClassificationConfidence != null && (
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {(lead.aiClassificationConfidence * 100).toFixed(0)}%
                  confiança
                </span>
              )}
            </div>
          ) : (
            <EmptyField text="Não classificado" />
          )}
        </FieldRow>

        {lead.aiSummary && (
          <FieldRow label="Resumo" icon={Brain}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {lead.aiSummary}
            </p>
          </FieldRow>
        )}

        {lead.aiSuggestedApproach && (
          <FieldRow label="Abordagem sugerida" icon={Brain}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {lead.aiSuggestedApproach}
            </p>
          </FieldRow>
        )}

        {lead.aiQualifiedAt && (
          <FieldRow label="Classificado em" icon={Clock}>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(lead.aiQualifiedAt)} atrás
            </span>
          </FieldRow>
        )}
      </SectionCard>

      <SectionCard title="Pontuação" icon={BarChart3}>
        <div className="py-3">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <ScoreBadge score={lead.score} />
          </div>

          {breakdownEntries.length > 0 ? (
            <div className="space-y-3">
              {breakdownEntries.map(([label, points]) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className={`font-mono tabular-nums ${points >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {points >= 0 ? `+${points}` : points}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50">
                    <div
                      className={`h-1.5 rounded-full transition-all ${points >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                      style={{
                        width: `${Math.min((Math.abs(points) / maxPoints) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground/40">
              Sem breakdown disponível
            </p>
          )}

          {lead.scoreExplanation && (
            <p className="mt-3 border-t border-border/20 pt-3 text-xs leading-relaxed text-muted-foreground/60">
              {lead.scoreExplanation}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LeadDetailModal({
  lead,
  open,
  onOpenChange,
  onRefresh,
}: LeadDetailModalProps) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!onRefresh) return;
    setIsSyncing(true);
    await onRefresh();
    setIsSyncing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 max-h-[85vh] border-border/50 bg-background/95 backdrop-blur-xl">
        {lead ? (
          <>
            {/* ---- Header ---- */}
            <div className="border-b border-border/40 px-6 pb-4 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="font-display text-xl font-semibold leading-tight truncate">
                    {lead.name}
                  </DialogTitle>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{lead.category ?? "Sem categoria"}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{lead.city ?? "Sem cidade"}</span>
                    {lead.googleMapsUrl && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <a
                          href={lead.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs transition-colors hover:text-primary"
                        >
                          Ver no Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-border/60"
                    disabled={loadingAction}
                    onClick={async () => {
                      setLoadingAction(true);
                      try {
                        await reenrichLead(lead.id, lead.organizationId);
                        toast.success("Enriquecimento reiniciado");
                        // Refresh after 5 seconds automatically as a courtesy
                        setTimeout(() => handleManualSync(), 5000);
                      } catch (error) {
                        toast.error("Erro ao reiniciar enriquecimento");
                      } finally {
                        setLoadingAction(false);
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Enriquecer</span>
                  </Button>

                  {lead.hasWhatsapp && lead.phone && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                      onClick={() => {
                        window.open(`https://wa.me/${lead.phone}`, "_blank");
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Key badges */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ScoreBadge score={lead.score} />
                <StatusBadge domain="leadStatus" value={lead.status} />
                <ClassificationBadge value={lead.aiClassification} />
                <RankBadge rank={lead.googleRank} />
                <WhatsappBadge
                  hasWhatsapp={lead.hasWhatsapp}
                  isBusiness={lead.whatsappIsBusinessAccount}
                />
                <InstagramBadge
                  hasInstagram={lead.hasInstagram}
                  followers={lead.instagramFollowers}
                  username={lead.instagramUsername}
                />
              </div>
            </div>

            {/* ---- Tabs ---- */}
            <Tabs defaultValue="overview" className="flex-1">
              <div className="border-b border-border/30 px-6">
                <TabsList variant="line" className="gap-0">
                  <TabsTrigger value="overview" className="px-4">
                    Visão Geral
                  </TabsTrigger>
                  <TabsTrigger value="enrichment" className="px-4">
                    Enrichment
                  </TabsTrigger>
                  <TabsTrigger value="intelligence" className="px-4">
                    Inteligência IA
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(85vh - 180px)" }}>
                <TabsContent value="overview">
                  <TabOverview lead={lead} />
                </TabsContent>
                <TabsContent value="enrichment">
                  <TabEnrichment lead={lead} />
                </TabsContent>
                <TabsContent value="intelligence">
                  <TabIntelligence lead={lead} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <DialogTitle className="sr-only">Carregando detalhes do lead</DialogTitle>
            Carregando detalhes...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
