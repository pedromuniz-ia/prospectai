"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, PlayCircle, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  createScoringRule,
  getScoreRuleObjectives,
  getScoringRules,
  recalculateAllLeadScores,
  seedDefaultScoringRules,
  updateScoringRule,
} from "@/lib/actions/scoring-rules";
import { entries, formatScoringRule, t } from "@/lib/i18n";
import { EmptyState, FormField, LoadingButton } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const scoringFieldEntries = entries("scoringField");
const scoringOperatorEntries = entries("scoringOperator");
const objectiveEntries = entries("campaignObjective");
const boolFields = new Set(["hasWebsite", "hasInstagram", "hasGoogleBusiness", "hasSsl"]);

export default function ScoringSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [objective, setObjective] = useState("all");
  const [objectives, setObjectives] = useState<string[]>(["all"]);
  const [rules, setRules] = useState<Awaited<ReturnType<typeof getScoringRules>>>([]);

  const [field, setField] = useState("hasWebsite");
  const [operator, setOperator] = useState("eq");
  const [value, setValue] = useState("false");
  const [boolValue, setBoolValue] = useState(false);
  const [numValue, setNumValue] = useState(0);
  const [points, setPoints] = useState(10);
  const [label, setLabel] = useState("");
  const [ruleObjective, setRuleObjective] = useState("global");

  const isBoolField = boolFields.has(field);

  const load = useCallback(async () => {
    if (!organizationId) return;

    const [ruleRows, objectiveRows] = await Promise.all([
      getScoringRules(organizationId, objective),
      getScoreRuleObjectives(organizationId),
    ]);

    setRules(ruleRows);
    setObjectives(objectiveRows as string[]);
  }, [objective, organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleSeedDefaults() {
    if (!organizationId) return;
    const result = await seedDefaultScoringRules(organizationId);
    toast.success(result.seeded ? "Regras padrão criadas." : "Regras já existentes.");
    await load();
  }

  async function handleAddRule() {
    if (!organizationId) return;
    if (!label.trim()) {
      toast.error("Defina um nome para a regra.");
      return;
    }

    const resolvedValue = isBoolField ? String(boolValue) : String(numValue || value);

    await createScoringRule({
      organizationId,
      objective: ruleObjective as "global" | "sell_website" | "sell_ai_agent" | "sell_optimization",
      field,
      operator: operator as "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in",
      value: resolvedValue,
      points,
      label,
      active: true,
    });

    toast.success("Regra criada.");
    setLabel("");
    await load();
  }

  async function handleToggleRule(ruleId: string, active: boolean) {
    await updateScoringRule(ruleId, { active: !active });
    await load();
  }

  async function handleRecalculate() {
    if (!organizationId) return;
    const result = await recalculateAllLeadScores(organizationId);
    toast.success(`Reprocessamento iniciado para ${result.queued} leads.`);
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Lead Scoring</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Regras de pontuação por objetivo para priorização comercial.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LoadingButton variant="outline" onClick={handleSeedDefaults}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar regras padrão
          </LoadingButton>
          <LoadingButton onClick={handleRecalculate}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Recalcular leads
          </LoadingButton>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <h2 className="mb-3 text-sm font-semibold">Nova regra</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Objetivo">
            <Select value={ruleObjective} onValueChange={setRuleObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                {objectiveEntries.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Campo">
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {scoringFieldEntries.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Operador">
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {scoringOperatorEntries.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Valor">
            {isBoolField ? (
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={boolValue}
                  onCheckedChange={setBoolValue}
                />
                <span className="text-sm text-muted-foreground">
                  {boolValue ? "Sim" : "Não"}
                </span>
              </div>
            ) : (
              <Input
                type="number"
                value={numValue}
                onChange={(e) => setNumValue(Number(e.target.value || 0))}
              />
            )}
          </FormField>

          <FormField label="Pontos">
            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value || 0))}
            />
          </FormField>

          <FormField label="Nome da regra">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Sem website"
            />
          </FormField>
        </div>
        <LoadingButton className="mt-3" onClick={handleAddRule}>
          Adicionar regra
        </LoadingButton>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Regras</span>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {objectives.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "Todas" : t("campaignObjective", item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rule.label}</p>
                  <Badge variant="outline">
                    {rule.objective === "global" ? "Global" : t("campaignObjective", rule.objective)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatScoringRule({
                    field: rule.field,
                    operator: rule.operator,
                    value: rule.value === "true" ? true : rule.value === "false" ? false : Number(rule.value) || rule.value,
                    points: rule.points,
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant={rule.active ? "default" : "outline"}
                onClick={() => handleToggleRule(rule.id, rule.active)}
              >
                {rule.active ? "Ativa" : "Inativa"}
              </Button>
            </div>
          ))}

          {rules.length === 0 && (
            <EmptyState
              icon={Calculator}
              title="Sem regras para este filtro"
              description="Crie regras padrão ou adicione uma nova regra acima."
            />
          )}
        </div>
      </Card>
    </div>
  );
}
