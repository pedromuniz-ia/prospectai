# UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign every page of ProspectAI with a Design System First approach — build reusable components, then apply them across all 16 routes to eliminate technical jargon, add progressive disclosure, and make the product commercially viable for non-technical users.

**Architecture:** Create a `src/lib/i18n.ts` translation layer and `src/components/ds/` directory with 10 composable components that wrap existing shadcn/ui primitives. Then rewrite each page to use these DS components, keeping all server actions and database schema untouched. One new server action (`listAvailableModels`) is needed for the dynamic ModelSelector.

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui (Radix), Tailwind CSS v4, Drizzle ORM (SQLite/Turso), Vercel AI SDK v6, Vitest, cmdk v1.1.1

---

## Phase 1: Design System Foundation

### Task 1: Translation Layer (`src/lib/i18n.ts`)

**Files:**
- Create: `src/lib/i18n.ts`
- Test: `src/lib/__tests__/i18n.test.ts`

**Step 1: Write tests for enum translation maps and helper functions**

```ts
// src/lib/__tests__/i18n.test.ts
import { describe, it, expect } from "vitest";
import {
  t,
  formatInterval,
  formatScoringRule,
} from "@/lib/i18n";

describe("i18n translation maps", () => {
  it("translates lead status enums to PT-BR", () => {
    expect(t("leadStatus", "new")).toBe("Novo");
    expect(t("leadStatus", "enriched")).toBe("Qualificado");
    expect(t("leadStatus", "contacted")).toBe("Contatado");
    expect(t("leadStatus", "won")).toBe("Ganho");
    expect(t("leadStatus", "blocked")).toBe("Bloqueado");
  });

  it("translates pipeline stage enums", () => {
    expect(t("pipelineStage", "approached")).toBe("Abordado");
    expect(t("pipelineStage", "interested")).toBe("Interessado");
    expect(t("pipelineStage", "won")).toBe("Ganho");
  });

  it("translates campaign status enums", () => {
    expect(t("campaignStatus", "draft")).toBe("Rascunho");
    expect(t("campaignStatus", "active")).toBe("Ativa");
    expect(t("campaignStatus", "paused")).toBe("Pausada");
    expect(t("campaignStatus", "completed")).toBe("Concluída");
  });

  it("translates campaign objective enums", () => {
    expect(t("campaignObjective", "sell_website")).toBe("Vender Website");
    expect(t("campaignObjective", "sell_ai_agent")).toBe("Vender Agente IA");
    expect(t("campaignObjective", "custom")).toBe("Personalizado");
  });

  it("translates AI provider enums", () => {
    expect(t("aiProvider", "openai")).toBe("OpenAI");
    expect(t("aiProvider", "anthropic")).toBe("Anthropic");
    expect(t("aiProvider", "google")).toBe("Google Gemini");
    expect(t("aiProvider", "openai_compatible")).toBe("Custom (OpenAI Compatible)");
  });

  it("translates message source enums", () => {
    expect(t("messageSource", "ai_auto")).toBe("IA (auto)");
    expect(t("messageSource", "webhook")).toBe("WhatsApp");
  });

  it("translates scoring operator enums", () => {
    expect(t("scoringOperator", "eq")).toBe("é igual a");
    expect(t("scoringOperator", "gte")).toBe("é pelo menos");
  });

  it("translates scoring field enums", () => {
    expect(t("scoringField", "hasWebsite")).toBe("Tem website");
    expect(t("scoringField", "googleRating")).toBe("Avaliação Google");
  });

  it("translates job type enums", () => {
    expect(t("jobType", "apify_gmaps")).toBe("Google Maps");
    expect(t("jobType", "rdap_whois")).toBe("Verificação RDAP");
  });

  it("translates job status enums", () => {
    expect(t("jobStatus", "running")).toBe("Em andamento");
    expect(t("jobStatus", "completed")).toBe("Concluído");
  });

  it("translates instance status enums", () => {
    expect(t("instanceStatus", "connected")).toBe("Conectado");
    expect(t("instanceStatus", "banned")).toBe("Banido");
  });

  it("translates notification type enums", () => {
    expect(t("notificationType", "lead_replied")).toBe("Lead respondeu");
    expect(t("notificationType", "campaign_paused")).toBe("Campanha pausada");
  });

  it("returns the raw value for unknown keys", () => {
    expect(t("leadStatus", "unknown_value" as any)).toBe("unknown_value");
  });
});

describe("formatInterval", () => {
  it("converts seconds to human-readable PT-BR", () => {
    expect(formatInterval(60)).toBe("1 minuto");
    expect(formatInterval(120)).toBe("2 minutos");
    expect(formatInterval(180)).toBe("3 minutos");
    expect(formatInterval(90)).toBe("1 min 30s");
    expect(formatInterval(30)).toBe("30 segundos");
    expect(formatInterval(3600)).toBe("1 hora");
    expect(formatInterval(7200)).toBe("2 horas");
  });
});

describe("formatScoringRule", () => {
  it("renders boolean rules in natural language", () => {
    expect(
      formatScoringRule({
        field: "hasWebsite",
        operator: "eq",
        value: false,
        points: 10,
      })
    ).toBe("Sem website → +10 pts");
  });

  it("renders numeric rules in natural language", () => {
    expect(
      formatScoringRule({
        field: "googleRating",
        operator: "gte",
        value: 4,
        points: 15,
      })
    ).toBe("Avaliação Google é pelo menos 4 → +15 pts");
  });

  it("renders negative points", () => {
    expect(
      formatScoringRule({
        field: "hasWebsite",
        operator: "eq",
        value: true,
        points: -5,
      })
    ).toBe("Tem website → -5 pts");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/i18n.test.ts`
Expected: FAIL — module `@/lib/i18n` does not exist

**Step 3: Implement the i18n module**

```ts
// src/lib/i18n.ts

const maps = {
  leadStatus: {
    new: "Novo",
    enriched: "Qualificado",
    scored: "Pontuado",
    queued: "Na fila",
    contacted: "Contatado",
    replied: "Respondeu",
    interested: "Interessado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
    blocked: "Bloqueado",
  },
  pipelineStage: {
    new: "Novo",
    approached: "Abordado",
    replied: "Respondeu",
    interested: "Interessado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
  },
  campaignStatus: {
    draft: "Rascunho",
    active: "Ativa",
    paused: "Pausada",
    completed: "Concluída",
  },
  campaignObjective: {
    sell_website: "Vender Website",
    sell_ai_agent: "Vender Agente IA",
    sell_optimization: "Vender Otimização",
    sell_automation: "Vender Automação",
    custom: "Personalizado",
  },
  aiProvider: {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
    groq: "Groq",
    together: "Together AI",
    fireworks: "Fireworks AI",
    openai_compatible: "Custom (OpenAI Compatible)",
  },
  messageSource: {
    manual: "Manual",
    ai_auto: "IA (auto)",
    ai_approved: "IA (aprovada)",
    cadence: "Cadência",
    webhook: "WhatsApp",
  },
  scoringOperator: {
    eq: "é igual a",
    neq: "é diferente de",
    gt: "é maior que",
    lt: "é menor que",
    gte: "é pelo menos",
    lte: "é no máximo",
    in: "contém",
    not_in: "não contém",
  },
  scoringField: {
    hasWebsite: "Tem website",
    googleRating: "Avaliação Google",
    googleReviewCount: "Nº de avaliações",
    hasInstagram: "Tem Instagram",
    hasGoogleBusiness: "Tem Google Business",
    websiteStatus: "Status do website",
    hasSsl: "Tem SSL",
  },
  jobType: {
    apify_gmaps: "Google Maps",
    rdap_whois: "Verificação RDAP",
    website_check: "Verificação de Website",
  },
  jobStatus: {
    pending: "Pendente",
    running: "Em andamento",
    completed: "Concluído",
    failed: "Falhou",
  },
  instanceStatus: {
    disconnected: "Desconectado",
    connecting: "Conectando",
    connected: "Conectado",
    banned: "Banido",
  },
  notificationType: {
    lead_replied: "Lead respondeu",
    campaign_paused: "Campanha pausada",
    instance_disconnected: "Instância desconectada",
    ai_needs_review: "IA precisa de revisão",
    extraction_complete: "Extração concluída",
  },
  campaignLeadStatus: {
    pending: "Pendente",
    queued: "Na fila",
    sent: "Enviado",
    replied: "Respondeu",
    converted: "Convertido",
    rejected: "Rejeitado",
    skipped: "Ignorado",
  },
  messageStatus: {
    pending: "Pendente",
    sent: "Enviado",
    delivered: "Entregue",
    read: "Lido",
    failed: "Falhou",
  },
} as const;

export type TranslationDomain = keyof typeof maps;

export function t<D extends TranslationDomain>(
  domain: D,
  value: string
): string {
  const map = maps[domain] as Record<string, string>;
  return map[value] ?? value;
}

/** All entries for a given domain — useful for populating <Select> options */
export function entries<D extends TranslationDomain>(
  domain: D
): { value: string; label: string }[] {
  const map = maps[domain] as Record<string, string>;
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

export function formatInterval(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(seconds / 3600);
  const remainingAfterHours = seconds % 3600;
  const minutes = Math.floor(remainingAfterHours / 60);
  const secs = remainingAfterHours % 60;

  if (hours > 0 && minutes === 0 && secs === 0) {
    return `${hours} hora${hours !== 1 ? "s" : ""}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  if (secs === 0) {
    return `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  }

  return `${minutes} min ${secs}s`;
}

// Shorthand field labels for boolean scoring rules
const boolFieldShort: Record<string, { truthy: string; falsy: string }> = {
  hasWebsite: { truthy: "Tem website", falsy: "Sem website" },
  hasInstagram: { truthy: "Tem Instagram", falsy: "Sem Instagram" },
  hasGoogleBusiness: { truthy: "Tem Google Business", falsy: "Sem Google Business" },
  hasSsl: { truthy: "Tem SSL", falsy: "Sem SSL" },
};

export function formatScoringRule(rule: {
  field: string;
  operator: string;
  value: unknown;
  points: number;
}): string {
  const sign = rule.points >= 0 ? `+${rule.points}` : `${rule.points}`;

  // Boolean shorthand: "Sem website → +10 pts"
  if (
    boolFieldShort[rule.field] &&
    (rule.operator === "eq" || rule.operator === "neq")
  ) {
    const isTruthy =
      (rule.operator === "eq" && rule.value === true) ||
      (rule.operator === "neq" && rule.value === false);
    const label = isTruthy
      ? boolFieldShort[rule.field].truthy
      : boolFieldShort[rule.field].falsy;
    return `${label} → ${sign} pts`;
  }

  // Generic: "Avaliação Google é pelo menos 4 → +15 pts"
  const fieldLabel = t("scoringField", rule.field);
  const opLabel = t("scoringOperator", rule.operator);
  return `${fieldLabel} ${opLabel} ${String(rule.value)} → ${sign} pts`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/i18n.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/i18n.ts src/lib/__tests__/i18n.test.ts
git commit -m "feat(ds): add i18n translation layer with enum maps and helpers"
```

---

### Task 2: Install `alert-dialog` shadcn component

This is needed for `ConfirmDialog`. The project does NOT have `alert-dialog` installed yet.

**Step 1: Install the component**

Run: `npx shadcn@latest add alert-dialog`
Expected: Creates `src/components/ui/alert-dialog.tsx`

**Step 2: Verify it was created**

Run: `ls src/components/ui/alert-dialog.tsx`
Expected: file exists

**Step 3: Commit**

```bash
git add src/components/ui/alert-dialog.tsx
git commit -m "feat(ds): add shadcn alert-dialog component"
```

---

### Task 3: `FormField` component

**Files:**
- Create: `src/components/ds/form-field.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/form-field.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  helper,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && helper && (
        <p className="text-xs text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `npx next build --no-lint 2>&1 | head -5` (or just check TS: `npx tsc --noEmit --pretty 2>&1 | grep form-field || echo "OK"`)
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/ds/form-field.tsx
git commit -m "feat(ds): add FormField component"
```

---

### Task 4: `ConfirmDialog` component

**Files:**
- Create: `src/components/ds/confirm-dialog.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/confirm-dialog.tsx
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={loading}
            className={cn(
              destructive && buttonVariants({ variant: "destructive" })
            )}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify types**

Run: `npx tsc --noEmit --pretty 2>&1 | grep confirm-dialog || echo "OK"`
Expected: OK

**Step 3: Commit**

```bash
git add src/components/ds/confirm-dialog.tsx
git commit -m "feat(ds): add ConfirmDialog component"
```

---

### Task 5: `LoadingButton` component

**Files:**
- Create: `src/components/ds/loading-button.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/loading-button.tsx
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type ButtonProps = React.ComponentProps<typeof Button>;

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({
  loading = false,
  disabled,
  children,
  onClick,
  ...props
}: LoadingButtonProps) {
  const [pending, setPending] = React.useState(false);
  const isLoading = loading || pending;

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (isLoading || !onClick) return;
    setPending(true);
    try {
      await (onClick as (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>)(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={isLoading || disabled} onClick={handleClick} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
```

**Step 2: Verify types**

Run: `npx tsc --noEmit --pretty 2>&1 | grep loading-button || echo "OK"`
Expected: OK

**Step 3: Commit**

```bash
git add src/components/ds/loading-button.tsx
git commit -m "feat(ds): add LoadingButton component"
```

---

### Task 6: `EmptyState` component

**Files:**
- Create: `src/components/ds/empty-state.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/empty-state.tsx
import * as React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Button asChild size="sm">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/empty-state.tsx
git commit -m "feat(ds): add EmptyState component"
```

---

### Task 7: `StatusBadge` component

**Files:**
- Create: `src/components/ds/status-badge.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/status-badge.tsx
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { t, type TranslationDomain } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Color maps: domain+value → tailwind classes
const colorMap: Record<string, Record<string, string>> = {
  leadStatus: {
    new: "bg-zinc-500/20 text-zinc-300",
    enriched: "bg-blue-500/20 text-blue-400",
    scored: "bg-indigo-500/20 text-indigo-400",
    queued: "bg-yellow-500/20 text-yellow-300",
    contacted: "bg-sky-500/20 text-sky-400",
    replied: "bg-emerald-500/20 text-emerald-400",
    interested: "bg-green-500/20 text-green-400",
    proposal: "bg-orange-500/20 text-orange-400",
    won: "bg-green-600/20 text-green-300",
    lost: "bg-red-500/20 text-red-400",
    blocked: "bg-red-600/20 text-red-300",
  },
  campaignStatus: {
    draft: "bg-zinc-500/20 text-zinc-300",
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-300",
    completed: "bg-blue-500/20 text-blue-400",
  },
  pipelineStage: {
    new: "bg-zinc-500/20 text-zinc-300",
    approached: "bg-sky-500/20 text-sky-400",
    replied: "bg-emerald-500/20 text-emerald-400",
    interested: "bg-green-500/20 text-green-400",
    proposal: "bg-orange-500/20 text-orange-400",
    won: "bg-green-600/20 text-green-300",
    lost: "bg-red-500/20 text-red-400",
  },
  instanceStatus: {
    disconnected: "bg-zinc-500/20 text-zinc-300",
    connecting: "bg-yellow-500/20 text-yellow-300",
    connected: "bg-green-500/20 text-green-400",
    banned: "bg-red-600/20 text-red-300",
  },
  jobStatus: {
    pending: "bg-zinc-500/20 text-zinc-300",
    running: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
  },
};

interface StatusBadgeProps {
  domain: TranslationDomain;
  value: string;
  className?: string;
}

export function StatusBadge({ domain, value, className }: StatusBadgeProps) {
  const label = t(domain, value);
  const colors = colorMap[domain]?.[value] ?? "bg-zinc-500/20 text-zinc-300";

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", colors, className)}
    >
      {label}
    </Badge>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/status-badge.tsx
git commit -m "feat(ds): add StatusBadge component with i18n"
```

---

### Task 8: `SlidePanel` component

**Files:**
- Create: `src/components/ds/slide-panel.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/slide-panel.tsx
"use client";

import * as React from "react";
import { PanelRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SlidePanelProps {
  title: string;
  /** Desktop: inline fixed column. Mobile: Sheet slide-over. */
  children: React.ReactNode;
  /** Width class for inline mode, e.g. "w-80" */
  inlineWidth?: string;
  className?: string;
}

export function SlidePanel({
  title,
  children,
  inlineWidth = "w-80",
  className,
}: SlidePanelProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Toggle button — visible only below xl */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="xl:hidden"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${title}`}
      >
        <PanelRight className="h-4 w-4" />
      </Button>

      {/* Inline panel — xl and above */}
      <aside
        className={cn(
          "hidden xl:flex xl:flex-col xl:border-l xl:border-border/70",
          inlineWidth,
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>

      {/* Sheet — below xl */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/slide-panel.tsx
git commit -m "feat(ds): add SlidePanel responsive component"
```

---

### Task 9: `TimeRangeInput` component

**Files:**
- Create: `src/components/ds/time-range-input.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/time-range-input.tsx
"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

interface TimeRangeInputProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function TimeRangeInput({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: TimeRangeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={startValue} onValueChange={onStartChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Início" />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-muted-foreground">até</span>
      <Select value={endValue} onValueChange={onEndChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Fim" />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="ml-2 text-xs text-muted-foreground">
        {startValue} — {endValue}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/time-range-input.tsx
git commit -m "feat(ds): add TimeRangeInput component"
```

---

### Task 10: `IntervalDisplay` component

**Files:**
- Create: `src/components/ds/interval-display.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/interval-display.tsx
import { formatInterval } from "@/lib/i18n";

interface IntervalDisplayProps {
  min: number;
  max: number;
  unit?: "seconds" | "minutes";
  suffix?: string;
}

export function IntervalDisplay({
  min,
  max,
  unit = "seconds",
  suffix = "entre envios",
}: IntervalDisplayProps) {
  const minSeconds = unit === "minutes" ? min * 60 : min;
  const maxSeconds = unit === "minutes" ? max * 60 : max;

  return (
    <span className="text-sm text-muted-foreground">
      {formatInterval(minSeconds)}–{formatInterval(maxSeconds)} {suffix}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/interval-display.tsx
git commit -m "feat(ds): add IntervalDisplay component"
```

---

### Task 11: `ModelSelector` component + `listAvailableModels` server action

**Files:**
- Modify: `src/lib/actions/ai-providers.ts` (add `listAvailableModels`)
- Modify: `src/lib/ai/provider-registry.ts` (add `getProviderBaseUrl` helper)
- Create: `src/components/ds/model-selector.tsx`

**Step 1: Add `getProviderBaseUrl` helper to `provider-registry.ts`**

Add this exported function after the existing `resolveBaseUrl` function in `src/lib/ai/provider-registry.ts`:

```ts
/** Returns the base URL for API calls (used for listing models, etc.) */
export function getProviderBaseUrl(provider: AIProviderRow): string {
  switch (provider.provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "together":
      return "https://api.together.xyz/v1";
    case "fireworks":
      return "https://api.fireworks.ai/inference/v1";
    case "openai_compatible":
      return provider.baseUrl ?? "";
    default:
      return "";
  }
}
```

**Step 2: Add `listAvailableModels` server action to `ai-providers.ts`**

Add at the end of `src/lib/actions/ai-providers.ts`:

```ts
import { getProviderBaseUrl } from "@/lib/ai/provider-registry";

export async function listAvailableModels(
  providerId: string
): Promise<{ id: string; name: string }[]> {
  const provider = await db.query.aiProviders.findFirst({
    where: eq(aiProviders.id, providerId),
  });

  if (!provider) throw new Error("Provider não encontrado.");

  const baseUrl = getProviderBaseUrl(provider);
  if (!baseUrl) return [];

  try {
    let models: { id: string; name: string }[] = [];

    if (provider.provider === "anthropic") {
      // Anthropic uses a different header and response format
      const res = await fetch(`${baseUrl}/models`, {
        headers: {
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data: { id: string; display_name: string }[] };
      models = data.data
        .filter((m) => m.id.includes("claude"))
        .map((m) => ({ id: m.id, name: m.display_name || m.id }));
    } else if (provider.provider === "google") {
      // Google Gemini uses API key as query param
      const res = await fetch(`${baseUrl}/models?key=${provider.apiKey}`);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        models: { name: string; displayName: string; supportedGenerationMethods: string[] }[];
      };
      models = data.models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({
          id: m.name.replace("models/", ""),
          name: m.displayName || m.name,
        }));
    } else {
      // OpenAI-compatible (openai, groq, together, fireworks, openai_compatible)
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data: { id: string; owned_by?: string }[] };
      models = data.data
        .filter((m) => {
          const id = m.id.toLowerCase();
          // Filter out embeddings, moderation, tts, whisper, dall-e
          return (
            !id.includes("embedding") &&
            !id.includes("moderation") &&
            !id.includes("tts") &&
            !id.includes("whisper") &&
            !id.includes("dall-e")
          );
        })
        .map((m) => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    // Cache models in DB
    await db
      .update(aiProviders)
      .set({
        availableModels: models.map((m) => m.id),
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, providerId));

    return models;
  } catch {
    // If API call fails, return cached models if any
    if (provider.availableModels) {
      return provider.availableModels.map((id) => ({ id, name: id }));
    }
    return [];
  }
}
```

**Step 3: Create the ModelSelector component**

```tsx
// src/components/ds/model-selector.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listAvailableModels } from "@/lib/actions/ai-providers";

interface ModelSelectorProps {
  providerId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ModelSelector({
  providerId,
  value,
  onChange,
  placeholder = "Selecionar modelo...",
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [models, setModels] = React.useState<{ id: string; name: string }[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [customInput, setCustomInput] = React.useState("");

  const fetchModels = React.useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const result = await listAvailableModels(providerId);
      setModels(result);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  React.useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  if (!providerId) {
    return (
      <p className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
        Salve o provider primeiro
      </p>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Buscar modelo..."
              value={customInput}
              onValueChange={setCustomInput}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  "Carregando modelos..."
                ) : customInput ? (
                  <button
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(customInput);
                      setOpen(false);
                      setCustomInput("");
                    }}
                  >
                    Usar &quot;{customInput}&quot;
                  </button>
                ) : (
                  "Nenhum modelo encontrado."
                )}
              </CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onChange(model.id);
                      setOpen(false);
                      setCustomInput("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {model.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void fetchModels()}
        disabled={loading}
        title="Atualizar modelos"
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      </Button>
    </div>
  );
}
```

**Step 4: Verify types**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "(model-selector|ai-providers|provider-registry)" || echo "OK"`
Expected: OK

**Step 5: Commit**

```bash
git add src/lib/ai/provider-registry.ts src/lib/actions/ai-providers.ts src/components/ds/model-selector.tsx
git commit -m "feat(ds): add ModelSelector with dynamic model fetching from provider APIs"
```

---

### Task 12: `TagInput` component

**Files:**
- Create: `src/components/ds/tag-input.tsx`

**Step 1: Create the component**

```tsx
// src/components/ds/tag-input.tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Adicionar...",
  className,
}: TagInputProps) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ds/tag-input.tsx
git commit -m "feat(ds): add TagInput chip component"
```

---

### Task 13: DS barrel export

**Files:**
- Create: `src/components/ds/index.ts`

**Step 1: Create barrel export**

```ts
// src/components/ds/index.ts
export { FormField } from "./form-field";
export { ConfirmDialog } from "./confirm-dialog";
export { LoadingButton } from "./loading-button";
export { EmptyState } from "./empty-state";
export { StatusBadge } from "./status-badge";
export { SlidePanel } from "./slide-panel";
export { TimeRangeInput } from "./time-range-input";
export { IntervalDisplay } from "./interval-display";
export { ModelSelector } from "./model-selector";
export { TagInput } from "./tag-input";
```

**Step 2: Verify everything compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors (or only pre-existing unrelated warnings)

**Step 3: Commit**

```bash
git add src/components/ds/index.ts
git commit -m "feat(ds): add barrel export for design system components"
```

---

## Phase 2: Settings Redesign

### Task 14: Settings layout — redirect fix + mobile fade

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/settings/layout.tsx`

**Step 1: Fix redirect in settings/page.tsx**

Replace the entire content of `src/app/(dashboard)/settings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/general");
}
```

**Step 2: Add mobile scroll fade to settings/layout.tsx**

In `src/app/(dashboard)/settings/layout.tsx`, wrap the mobile horizontal tab strip with a container that has fade gradients. Find the horizontal scroll container and add:
- `relative` to the wrapper
- A pseudo-element or adjacent div with `pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent` to indicate more scrollable content

Also change the sidebar "Config" items:
- Nav item labels: ensure full "Configurações" label
- Href: `/settings` → `/settings/general` in links that target the settings root

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx src/app/(dashboard)/settings/layout.tsx
git commit -m "fix(settings): redirect /settings to /settings/general, add mobile scroll fade"
```

---

### Task 15: AI & Modelos page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/ai/page.tsx`

**Step 1: Rewrite the page**

Complete rewrite of `src/app/(dashboard)/settings/ai/page.tsx` incorporating:

1. **Provider select** with labels from `entries("aiProvider")` — showing "OpenAI" not "openai"
2. **Label auto-fill** — when provider changes, label auto-fills with provider display name
3. **API key** — password input with eye toggle
4. **Model** — `ModelSelector` component (providers must be saved first to fetch models; for the "add new" form, use a plain Input with helper text "Salve o provider para ver modelos disponíveis", then switch to ModelSelector after creation)
5. **Base URL** — only shown when provider is `openai_compatible`
6. **Button** — `LoadingButton` "Testar e salvar" — tests connection then creates
7. **Provider rows** — `StatusBadge` for provider type, LoadingButton for "Testar", ConfirmDialog for "Remover", edit dialog for modifying existing providers
8. **EmptyState** — when no providers configured

Key changes from current code:
- Import `FormField`, `LoadingButton`, `ConfirmDialog`, `EmptyState`, `ModelSelector` from `@/components/ds`
- Import `t`, `entries` from `@/lib/i18n`
- Replace raw `providerOptions.map((option) => option)` with `entries("aiProvider").map(({ value, label }) => ...)`
- Wrap provider creation in test-then-create flow
- Add `handleEdit` function using `updateAIProvider`
- Add `handleDelete` function using `deleteAIProvider` with ConfirmDialog

**Step 2: Verify page renders**

Run: `npx next dev` → navigate to `/settings/ai`
Expected: Page renders with translated provider labels, proper form fields

**Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/ai/page.tsx
git commit -m "feat(settings): redesign AI & Modelos page with DS components"
```

---

### Task 16: Conta/Geral page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/general/page.tsx`

Key changes:
- Org name: display as `<p>` with lock icon (since read-only), label "Nome da organização"
- "Slug" → "Identificador" with tooltip
- Remove "MVP" badges
- Team invites: show "Em breve" as a polished card instead of "(bloqueado no MVP)"
- "Danger zone" → "Zona de risco", use ConfirmDialog with name confirmation for delete
- Remove English labels

**Commit:** `feat(settings): redesign General page, remove MVP jargon`

---

### Task 17: WhatsApp page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/whatsapp/page.tsx`

Key changes:
- Instance name label: "Dê um nome para este número" with examples
- QR code: add 25s countdown timer (decrement state) + "Gerar novo QR" button when expired
- Instance cards: `StatusBadge` for status, progress bar for daily usage (`dailyMessagesSent / dailyMessageLimit`)
- Action buttons: add tooltips via `title` attribute, wrap delete in `ConfirmDialog`
- `EmptyState` when no instances

**Commit:** `feat(settings): redesign WhatsApp page with QR countdown and confirmations`

---

### Task 18: Lead Scoring page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/scoring/page.tsx`

Key changes:
- Rule display: `formatScoringRule(rule)` from i18n instead of raw `{rule.field} {rule.operator} {rule.value}`
- Rule builder: selects using `entries("scoringField")`, `entries("scoringOperator")`, translated objective select
- Dynamic value input: boolean toggle for hasWebsite/hasInstagram fields, number input for ratings, text for others
- "Seed default" → "Criar regras padrão"
- Objective select: `entries("campaignObjective")` plus "Global"
- Recalculate: `LoadingButton` with toast progress

**Commit:** `feat(settings): redesign Scoring page with natural language rules`

---

### Task 19: Warmup page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/warmup/page.tsx`

Key changes:
- Add explanatory card at top: "O warm-up aumenta gradualmente o volume..."
- Progress bar: `(currentDay / 15) * 100%` visual with colored segments
- Schedule: styled read-only table with phase labels
- Manual override: collapsible section, inputs with 500ms debounce (use `React.useRef` + `setTimeout` pattern)
- Instance select with `StatusBadge`

**Commit:** `feat(settings): redesign Warmup page with progress bar and debounced inputs`

---

### Task 20: Templates page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/templates/page.tsx`

Key changes:
- Empty form (no pre-populated sample data)
- Shortcut: input with "/" prefix visual + inline validation `[a-z0-9-]`
- Edit: click template → open dialog with `updateTemplate` action
- Preview: chat bubble mock showing template content
- `EmptyState` when no templates

**Commit:** `feat(settings): redesign Templates page with edit support and preview`

---

### Task 21: Advanced page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/settings/advanced/page.tsx`
- Create: `src/lib/actions/advanced.ts` (add `checkApifyTokenStatus` server action)

Key changes:
- Webhook URL: add copy-to-clipboard button
- Apify token: new server action `checkApifyTokenStatus()` that reads `process.env.APIFY_TOKEN` server-side and returns `{ configured: boolean }`. Replace client-side `process.env` check.
- Export: `LoadingButton`
- Remove `.env.local` references

**Commit:** `feat(settings): redesign Advanced page, fix APIFY_TOKEN client-side bug`

---

## Phase 3: App Shell

### Task 22: Sidebar fixes

**Files:**
- Modify: `src/components/sidebar.tsx`

Key changes:
- `"Config"` → `"Configurações"`
- `href: "/settings"` → `href: "/settings/general"`
- Add unread count badge on Inbox nav item (read from a shared atom or prop)
- Fix active state: for `/settings/*`, highlight "Configurações" but also show which sub-section via a different mechanism (or just keep parent highlighted)

**Commit:** `fix(shell): sidebar labels, links, and inbox badge`

---

### Task 23: StatusBar fixes

**Files:**
- Modify: `src/components/status-bar.tsx`

Key changes:
- Hide entire bar when `!organizationId`
- Multi-instance: show consolidated usage or first connected instance with "(+N)" indicator
- Replace "entrega monitorada" → "WhatsApp ativo" (or remove entirely)

**Commit:** `fix(shell): hide status bar without org, fix labels`

---

### Task 24: CommandPalette fixes

**Files:**
- Modify: `src/components/command-palette.tsx`

Key changes:
- Reset `query` and `leads` state when dialog closes (`onOpenChange` callback)
- Remove fake shortcuts ("G I", "G L", "G S") from `CommandShortcut` — either implement them or remove
- Move score from `CommandShortcut` slot to a `StatusBadge` or `Badge` within the item content
- "Conectar WhatsApp" icon: `Sparkles` → `Smartphone`

**Commit:** `fix(shell): command palette cleanup — reset state, fix icons`

---

### Task 25: NotificationBell fixes

**Files:**
- Modify: `src/components/notification-bell.tsx`

Key changes:
- "Marcar tudo" → "Marcar todas como lidas"
- Replace emoji icons with Lucide icons: `MessageSquare`, `Pause`, `WifiOff`, `Bot`, `CheckCircle2`
- Make notifications clickable: `lead_replied` → navigate to `/inbox?leadId={entityId}`, `campaign_paused` → `/campaigns`, etc.
- Auto-mark: mark all visible (not just 5)

**Commit:** `fix(shell): notification bell labels, icons, navigation`

---

## Phase 4: Main Pages

### Task 26: Inbox redesign

**Files:**
- Modify: `src/app/(dashboard)/inbox/page.tsx`
- Rewrite: `src/app/(dashboard)/inbox/conversation-list.tsx`
- Rewrite: `src/app/(dashboard)/inbox/chat-view.tsx`
- Rewrite: `src/app/(dashboard)/inbox/lead-context.tsx`

**This is the largest task. Break it into sub-steps:**

**Sub-step A: Conversation List**
- "Aguard. IA" → "IA pendente"
- Replace raw score number with `StatusBadge domain="leadStatus"`
- Add search input at top
- Move "Próximo" button out (it will go to ChatView header)
- Add `aria-label` to conversation buttons

**Sub-step B: ChatView**
- Add `Ctrl+Enter` / `Cmd+Enter` keyboard shortcut for send
- Source labels: move to tooltip on hover, rename "webhook" → "WhatsApp"
- Unify AI suggestion + compose into single area:
  - State: `"compose" | "suggestion"` mode
  - Suggestion mode: show AI text with "Sugestão da IA" banner + "Enviar" / "Editar" / "Descartar"
  - Compose mode: normal textarea + send button
- Character count when > 3000
- Template: insert at cursor, don't replace all
- Skeleton loading state instead of text flash

**Sub-step C: LeadContext**
- Use `SlidePanel` from DS: inline >1280px, Sheet toggle below
- "Score breakdown" → "Detalhamento da pontuação"
- "Pipeline" → "Etapa do funil"
- Fix score bar math: divide by max possible score from rules
- Phone: `<a href="tel:...">`
- Website: `<a href="..." target="_blank">`
- City: `<Link href="/leads?city=...">`
- No campaign: CTA "Adicionar a uma campanha" button
- "não classificado": `<span className="text-muted-foreground">` instead of Badge

**Sub-step D: page.tsx layout**
- Remove fixed 3-col grid, use flex with `SlidePanel` for right column
- Skip-to-content link at top

**Commit:** `feat(inbox): full UX redesign — keyboard send, unified compose, SlidePanel`

---

### Task 27: Leads page redesign

**Files:**
- Modify: `src/app/(dashboard)/leads/page.tsx`
- Modify: `src/app/(dashboard)/leads/data-table.tsx`
- Modify: `src/app/(dashboard)/leads/board-view.tsx`
- Modify: `src/app/(dashboard)/leads/columns.tsx`
- Modify: `src/lib/actions/leads.ts` (add `getFilterOptions` action)

Key changes:

**New server action `getFilterOptions(orgId)`:**
Returns all distinct categories and cities from leads table (not from current page).

**page.tsx:**
- Fetch filter options from server via `getFilterOptions`
- Add `scoreMax` filter to UI
- Add status filter select
- Show "Selecione leads para ações em lote" hint
- Hide pagination when in board view

**data-table.tsx / columns.tsx:**
- `StatusBadge` for lead status and pipeline stage
- "stale" → "Inativo"
- Tooltips on action icon buttons
- `EmptyState` for zero results

**board-view.tsx:**
- Add `TouchSensor` alongside `PointerSensor`
- Card snippet: show category or last message, not raw status
- Optimistic update on drag (move card immediately, revert on error)
- Single campaign selector at top

**Lead detail sheet:**
- Stage labels via `t("pipelineStage", stage)`
- "Ver conversa completa" link to `/inbox?leadId=X`
- Clickable phone/website/city

**Commit:** `feat(leads): redesign with server filters, StatusBadge, touch DnD, optimistic updates`

---

### Task 28: Campaigns page + Wizard redesign

**Files:**
- Rewrite: `src/app/(dashboard)/campaigns/page.tsx`
- Rewrite: `src/components/campaign-wizard.tsx`

**Campaigns page:**
- `StatusBadge` for status
- `IntervalDisplay` for cadence
- Dates: show `formatRelativeTime(campaign.createdAt)` and last activity
- "Reply rate" → "Taxa de resposta"
- AI: show provider label + model, or "IA desativada"
- Pause/Resume: wrap in `ConfirmDialog`
- Grid: `lg:grid-cols-2`

**Campaign Wizard:**

*Step 1:*
- `TagInput` for categories and cities (replace CSV textareas)
- Preview empty: "Nenhum lead encontrado. Ajuste os filtros."

*Step 2:*
- Interval inputs in **minutes** (convert to seconds on save): label "Espera mínima (min)" / "Espera máxima (min)" with live preview via `IntervalDisplay`
- `TimeRangeInput` for schedule
- **5 separate textareas** for message variants (replace single newline-separated textarea):
  ```tsx
  {variants.map((v, i) => (
    <FormField key={i} label={`Variante ${i + 1}`}>
      <Textarea value={v} onChange={...} />
    </FormField>
  ))}
  ```
  With counter "3/5 variantes definidas" + validation warning if < 5
- AI config in collapsible section:
  - Provider select with `entries("aiProvider")`
  - `ModelSelector` for model
  - "Respostas automáticas máximas" label
  - Temperature → toggle: "Conservador" (0.3) / "Balanceado" (0.7) / "Criativo" (1.0)
  - "Instruções para a IA" instead of "System prompt", in advanced collapsible
- Next button icon: `ArrowRight` not `Filter`

*Step 3:*
- Objective via `t("campaignObjective", objective)`
- Cadence via `IntervalDisplay`
- Validate 5 variants before reaching step 3

**Commit:** `feat(campaigns): redesign cards and wizard with DS components`

---

### Task 29: Extraction page redesign

**Files:**
- Rewrite: `src/app/(dashboard)/extraction/page.tsx`

Key changes:
- Remove "Server-side" badge
- "Query de busca" → "Tipo de negócio" with placeholder "ex: Restaurante, Dentista"
- "Máximo de resultados" → "Quantidade de locais" with helper "Locais buscados no Google Maps"
- Preset save: open mini-dialog to name the preset
- `StatusBadge` for job status
- Job type translated via `t("jobType", type)`
- Running with no data: indeterminate spinner
- "Duplicados" with tooltip
- `EmptyState` for no jobs

**Commit:** `feat(extraction): redesign with human-friendly labels and StatusBadge`

---

## Phase 5: Remaining Bug Fixes

### Task 30: Fix remaining bugs

**Files:**
- Modify: `src/app/(dashboard)/inbox/lead-context.tsx` — score bar math
- Modify: `src/components/command-palette.tsx` — checkbox indeterminate (if not already fixed)
- Modify: `src/app/(dashboard)/layout.tsx` — add skip-to-content link

**Bug 1 (score bar):** Already fixed in Task 26 Sub-step C.

**Bug 2 (warmup debounce):** Already fixed in Task 19.

**Bug 3 (filters from page):** Already fixed in Task 27.

**Bug 4 (settings redirect):** Already fixed in Task 14.

**Bug 5 (command palette state):** Already fixed in Task 24.

**Bug 6 (APIFY_TOKEN):** Already fixed in Task 21.

**Bug 7 (board view snippet):** Already fixed in Task 27.

**Bug 8 (pagination in board):** Already fixed in Task 27.

**Remaining bug — skip-to-content link:**

In `src/app/(dashboard)/layout.tsx`, add as the first child inside `<body>` or the main layout wrapper:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
>
  Pular para o conteúdo
</a>
```

And add `id="main-content"` to the `<main>` element.

**Remaining bug — checkbox indeterminate:**

In `src/app/(dashboard)/leads/data-table.tsx`, change the `onCheckedChange` handler to:

```tsx
onCheckedChange={(value) => {
  if (value === "indeterminate") return;
  row.toggleSelected(Boolean(value));
}}
```

**Commit:** `fix: accessibility skip-to-content link, checkbox indeterminate handling`

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| 1 — Foundation | 1–13 | i18n layer + 10 DS components + barrel export |
| 2 — Settings | 14–21 | All 7 settings pages redesigned |
| 3 — App Shell | 22–25 | Sidebar, StatusBar, CommandPalette, NotificationBell fixed |
| 4 — Main Pages | 26–29 | Inbox, Leads, Campaigns, Extraction redesigned |
| 5 — Bug Fixes | 30 | Remaining accessibility and logic bugs |

**Total: 30 tasks, each committable independently.**

Each phase can be verified in isolation — Phase 1 doesn't break any existing pages (new files only), Phase 2 replaces settings pages one at a time, etc.
