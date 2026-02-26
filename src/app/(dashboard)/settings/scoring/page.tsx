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

const operators = ["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in"] as const;

export default function ScoringSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [objective, setObjective] = useState("all");
  const [objectives, setObjectives] = useState<string[]>(["all"]);
  const [rules, setRules] = useState<Awaited<ReturnType<typeof getScoringRules>>>([]);

  const [field, setField] = useState("hasWebsite");
  const [operator, setOperator] = useState<(typeof operators)[number]>("eq");
  const [value, setValue] = useState("false");
  const [points, setPoints] = useState(10);
  const [label, setLabel] = useState("");
  const [ruleObjective, setRuleObjective] = useState("global");

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
      toast.error("Defina um label para a regra.");
      return;
    }

    await createScoringRule({
      organizationId,
      objective: ruleObjective as "global" | "sell_website" | "sell_ai_agent" | "sell_optimization",
      field,
      operator,
      value,
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
          <Button variant="outline" onClick={handleSeedDefaults}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Seed default
          </Button>
          <Button onClick={handleRecalculate}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Recalcular leads
          </Button>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Objetivo da regra</Label>
            <Select value={ruleObjective} onValueChange={setRuleObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">global</SelectItem>
                <SelectItem value="sell_website">sell_website</SelectItem>
                <SelectItem value="sell_ai_agent">sell_ai_agent</SelectItem>
                <SelectItem value="sell_optimization">sell_optimization</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Field</Label>
            <Input value={field} onChange={(event) => setField(event.target.value)} />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Operator</Label>
            <Select value={operator} onValueChange={(value) => setOperator(value as typeof operator)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {operators.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Value</Label>
            <Input value={value} onChange={(event) => setValue(event.target.value)} />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Points</Label>
            <Input type="number" value={points} onChange={(event) => setPoints(Number(event.target.value || 0))} />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Label</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={handleAddRule}>Adicionar regra</Button>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Regras</span>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {objectives.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
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
                  <Badge variant="outline">{rule.objective}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {rule.field} {rule.operator} {String(rule.value)} → +{rule.points}
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
            <p className="text-sm text-muted-foreground">Sem regras para este filtro.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
