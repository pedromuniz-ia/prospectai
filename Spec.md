# Spec — Enrichment Pipeline v2

> Spec tática derivada do PRD. Lista todos os arquivos a modificar/criar e o que fazer em cada um.

---

## Arquivos a Modificar

### 1. `src/db/schema/leads.ts`

**O que fazer:** Adicionar 14 novas colunas na tabela `leads`.

Após a linha 33 (`sourceId`), no bloco "Raw data", adicionar:

```typescript
// Google Maps (novos campos Apify)
googlePlaceId: text("google_place_id"),
googleMapsUrl: text("google_maps_url"),
googleRank: integer("google_rank"),
imageUrl: text("image_url"),
```

Renomear `zipCode` (linha 25) para `postalCode` no campo TypeScript (a coluna SQL `zip_code` pode ficar — ou renomear para `postal_code` na migration). **Decisão:** manter `zipCode` no TS e popular com `postalCode` do Apify no mapping.

Após a linha 42 (`instagramUrl`), adicionar colunas de WhatsApp e Instagram enrichment:

```typescript
// WhatsApp enrichment
hasWhatsapp: integer("has_whatsapp", { mode: "boolean" }),
whatsappIsBusinessAccount: integer("whatsapp_is_business_account", { mode: "boolean" }),
whatsappBusinessDescription: text("whatsapp_business_description"),
whatsappBusinessEmail: text("whatsapp_business_email"),
whatsappBusinessWebsite: text("whatsapp_business_website"),

// Instagram enrichment
instagramUsername: text("instagram_username"),
instagramFollowers: integer("instagram_followers"),
instagramBiography: text("instagram_biography"),
instagramExternalUrl: text("instagram_external_url"),
instagramIsBusinessAccount: integer("instagram_is_business_account", { mode: "boolean" }),
```

**Total de colunas novas:** 14 (4 Google Maps + 5 WhatsApp + 5 Instagram).

---

### 2. `src/lib/apify.ts`

**O que fazer:** Corrigir 3 bugs + mapear 8 campos novos do Apify.

#### 2a. Ampliar `RawApifyItem` (linha 4-18)

Adicionar ao type os campos faltantes:

```typescript
type RawApifyItem = {
  // campos existentes...
  title?: string;
  phone?: string;
  phoneUnformatted?: string;        // NOVO
  website?: string;
  url?: string;
  address?: string;
  neighborhood?: string;            // NOVO
  street?: string;                  // NOVO
  city?: string;
  state?: string;
  postalCode?: string;              // NOVO
  countryCode?: string;             // NOVO
  categoryName?: string;
  categories?: string[];
  totalScore?: number;
  reviewsCount?: number;
  openingHours?: unknown;
  location?: { lat?: number; lng?: number };
  placeId?: string;                 // NOVO
  imageUrl?: string;                // NOVO
  rank?: number;                    // NOVO
  permanentlyClosed?: boolean;      // NOVO
  temporarilyClosed?: boolean;      // NOVO
};
```

#### 2b. Ampliar `ExtractedLead` (linha 20-34)

Adicionar campos novos no type:

```typescript
export type ExtractedLead = {
  // campos existentes...
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  businessHours: unknown;
  latitude: number | null;
  longitude: number | null;
  domain: string | null;
  // novos:
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  googleRank: number | null;
  neighborhood: string | null;
  postalCode: string | null;
  imageUrl: string | null;
  phoneUnformatted: string | null;
};
```

#### 2c. Corrigir `mapItem()` (linha 36-58)

Três correções + mapeamento dos novos campos:

```typescript
function mapItem(item: RawApifyItem): ExtractedLead | null {
  if (!item.title) return null;

  // BUG-02 fix: filtrar negócios fechados
  if (item.permanentlyClosed || item.temporarilyClosed) return null;

  const parsedState = item.state ?? item.address?.split(",").at(-1)?.trim() ?? null;

  // BUG-01 fix: website nunca faz fallback para item.url (que é o link do Maps)
  const website = item.website ?? null;

  return {
    name: item.title,
    phone: item.phone?.trim() ?? null,
    website,
    address: item.address ?? null,
    city: item.city ?? null,
    state: parsedState,
    category: item.categoryName ?? item.categories?.[0] ?? null,
    googleRating: typeof item.totalScore === "number" ? item.totalScore : null,
    googleReviewCount: typeof item.reviewsCount === "number" ? item.reviewsCount : null,
    businessHours: item.openingHours ?? null,
    latitude: typeof item.location?.lat === "number" ? item.location.lat : null,
    longitude: typeof item.location?.lng === "number" ? item.location.lng : null,
    domain: extractDomain(website),
    // Novos campos:
    googleMapsUrl: item.url ?? null,
    googlePlaceId: item.placeId ?? null,
    googleRank: typeof item.rank === "number" ? item.rank : null,
    neighborhood: item.neighborhood ?? null,
    postalCode: item.postalCode ?? null,
    imageUrl: item.imageUrl ?? null,
    phoneUnformatted: item.phoneUnformatted ?? null,
  };
}
```

---

### 3. `src/workers/extraction.ts`

**O que fazer:** Passar os novos campos do `ExtractedLead` para o `db.insert(leads)`.

No bloco `db.insert(leads).values({...})` (linhas 97-115), adicionar os novos campos:

```typescript
const [createdLead] = await db
  .insert(leads)
  .values({
    // campos existentes...
    organizationId: data.organizationId,
    name: result.name,
    phone,
    website: result.website,
    hasWebsite: Boolean(result.website),
    address: result.address,
    city: result.city,
    state: result.state,
    category: result.category,
    sourceType: "apify_gmaps",
    sourceId: data.extractionJobId,
    googleRating: result.googleRating,
    googleReviewCount: result.googleReviewCount,
    businessHours: result.businessHours,
    latitude: result.latitude,
    longitude: result.longitude,
    status: "new",
    // novos:
    neighborhood: result.neighborhood,
    zipCode: result.postalCode,
    googlePlaceId: result.googlePlaceId,
    googleMapsUrl: result.googleMapsUrl,
    googleRank: result.googleRank,
    imageUrl: result.imageUrl,
  })
  .returning();
```

---

### 4. `src/lib/evolution-api.ts`

**O que fazer:** Adicionar 3 interfaces de resposta + 3 novos métodos na classe `EvolutionAPI`.

#### 4a. Novos types (após linha 93, antes dos Webhook Event Types)

```typescript
export interface WhatsappNumberCheck {
  exists: boolean;
  jid: string;
  number: string;
}

export interface WhatsappProfile {
  name?: string;
  status?: string;
  picture?: string;
}

export interface WhatsappBusinessProfile {
  description?: string;
  email?: string;
  website?: string[];
  category?: string;
  address?: string;
}
```

#### 4b. Novos métodos na classe `EvolutionAPI` (após `setPresence`, antes do fechamento da classe na linha 281)

```typescript
// POST /chat/whatsappNumbers/{instance}
async checkWhatsappNumbers(
  instanceName: string,
  numbers: string[]
): Promise<WhatsappNumberCheck[]> {
  return this.request<WhatsappNumberCheck[]>(
    "POST",
    `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
    { numbers }
  );
}

// POST /chat/fetchProfile/{instance}
async fetchProfile(
  instanceName: string,
  number: string
): Promise<WhatsappProfile> {
  return this.request<WhatsappProfile>(
    "POST",
    `/chat/fetchProfile/${encodeURIComponent(instanceName)}`,
    { number }
  );
}

// POST /chat/fetchBusinessProfile/{instance}
async fetchBusinessProfile(
  instanceName: string,
  number: string
): Promise<WhatsappBusinessProfile> {
  return this.request<WhatsappBusinessProfile>(
    "POST",
    `/chat/fetchBusinessProfile/${encodeURIComponent(instanceName)}`,
    { number }
  );
}
```

---

### 5. `src/lib/enrichment/website-check.ts`

**O que fazer:** Adicionar extração de link do Instagram do HTML durante o scraping.

#### 5a. Adicionar `instagramUrl` ao `WebsiteCheckResult` (linhas 5-9)

```typescript
export type WebsiteCheckResult = {
  websiteStatus: WebsiteStatus;
  hasSsl: boolean;
  email: string | null;
  instagramUrl: string | null;   // NOVO
};
```

#### 5b. Adicionar regex e parser de Instagram (após linha 18, `parkedPatterns`)

```typescript
const INSTAGRAM_REGEX = /instagram\.com\/([a-zA-Z0-9_.]+)\/?/;

function parseInstagramUrl(html: string): string | null {
  const match = html.match(INSTAGRAM_REGEX);
  if (!match) return null;
  const username = match[1];
  if (["sharer", "share", "p", "reel", "explore", "stories", "accounts"].includes(username)) return null;
  return `https://instagram.com/${username}`;
}
```

#### 5c. Modificar `checkWebsite()` para extrair Instagram

Nos dois `return` de erro precoce (linhas 44-49 e 67-71), adicionar `instagramUrl: null`.

No loop de paths (linhas 94-112), extrair Instagram do HTML:

```typescript
let instagramUrl: string | null = null;  // declarar junto com email (linha 92)

// dentro do loop, após parseEmail:
if (!instagramUrl) {
  instagramUrl = parseInstagramUrl(html);
}

// no return final (linhas 114-118):
return {
  websiteStatus,
  hasSsl,
  email,
  instagramUrl,
};
```

---

### 6. `src/lib/enrichment/ai-classifier.ts`

**O que fazer:** Ampliar `ClassificationLeadInput` com dados de WA/Instagram + atualizar prompt e heurísticas.

#### 6a. Ampliar `ClassificationLeadInput` (linhas 19-28)

Adicionar novos campos ao type:

```typescript
type ClassificationLeadInput = {
  // existentes:
  name: string | null;
  category: string | null;
  city: string | null;
  hasWebsite: boolean | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  websiteStatus: string | null;
  aiSummary?: string | null;
  // novos:
  googleRank: number | null;
  hasWhatsapp: boolean | null;
  whatsappIsBusinessAccount: boolean | null;
  whatsappBusinessDescription: string | null;
  instagramFollowers: number | null;
  instagramBiography: string | null;
  instagramIsBusinessAccount: boolean | null;
};
```

#### 6b. Atualizar prompt do LLM (linhas 78-88)

Adicionar linhas com dados novos:

```typescript
const prompt = [
  "Classifique este lead para prospeccao B2B via WhatsApp.",
  "Responda estritamente no schema definido.",
  `Nome: ${lead.name ?? "N/A"}`,
  `Categoria: ${lead.category ?? "N/A"}`,
  `Cidade: ${lead.city ?? "N/A"}`,
  `Tem website: ${String(lead.hasWebsite)}`,
  `Status website: ${lead.websiteStatus ?? "N/A"}`,
  `Google rating: ${lead.googleRating ?? "N/A"}`,
  `Google reviews: ${lead.googleReviewCount ?? "N/A"}`,
  `Posicao no Maps: ${lead.googleRank ?? "N/A"}`,
  `Tem WhatsApp: ${lead.hasWhatsapp ?? "N/A"}`,
  `WhatsApp Business: ${lead.whatsappIsBusinessAccount ?? "N/A"}`,
  lead.whatsappBusinessDescription ? `Desc. WA Business: ${lead.whatsappBusinessDescription}` : "",
  `Seguidores Instagram: ${lead.instagramFollowers ?? "N/A"}`,
  lead.instagramBiography ? `Bio Instagram: ${lead.instagramBiography}` : "",
].filter(Boolean).join("\n");
```

#### 6c. Atualizar heurísticas (linhas 30-68)

Refinar regra de `needs_automation` para considerar Instagram:

```typescript
// Regra existente (linha 51): (lead.googleReviewCount ?? 0) >= 80
// Mudar para:
if ((lead.googleReviewCount ?? 0) >= 80 && (lead.instagramFollowers ?? 0) >= 500) {
  return {
    classification: "needs_automation",
    confidence: 0.82,  // sobe de 0.74 → 0.82 com mais sinal
    summary: "Lead com volume relevante e presença digital consolidada.",
    suggestedApproach: "Automação de atendimento com IA para escalar sem aumentar equipe.",
  };
}
```

---

### 7. `src/workers/enrichment.ts`

**O que fazer:** Adicionar tipos `"whatsapp"` e `"instagram"` ao job schema, integrar as 2 novas fases no pipeline, implementar cascade de re-enrichment, e atualizar `pickLeadSnapshot()`.

#### 7a. Ampliar `enrichmentJobSchema` (linha 19)

```typescript
type: z.enum(["rdap", "website", "whatsapp", "instagram", "score", "classify", "full"]).default("full"),
```

#### 7b. Adicionar imports

```typescript
import { checkWhatsapp } from "@/lib/enrichment/whatsapp-check";
import { checkInstagram } from "@/lib/enrichment/instagram-check";
import { whatsappInstances } from "@/db/schema/whatsapp-instances";
```

#### 7c. Adicionar flags de execução condicional (após linha 57)

```typescript
const shouldRunWhatsapp = data.type === "whatsapp" || data.type === "full";
const shouldRunInstagram = data.type === "instagram" || data.type === "full";
```

#### 7d. Adicionar fase WhatsApp (após o bloco `shouldRunWebsite`, após linha 77)

```typescript
if (shouldRunWhatsapp && lead.phone) {
  const connectedInstance = await db.query.whatsappInstances.findFirst({
    where: and(
      eq(whatsappInstances.organizationId, data.organizationId),
      eq(whatsappInstances.status, "connected")
    ),
  });

  if (connectedInstance) {
    const wa = await checkWhatsapp(lead.phone, connectedInstance.instanceName);
    patch.hasWhatsapp = wa.hasWhatsapp;
    patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
    patch.whatsappBusinessDescription = wa.businessDescription;
    patch.whatsappBusinessEmail = wa.businessEmail;
    patch.whatsappBusinessWebsite = wa.businessWebsite;

    // Cascade: WA Business revelou website que não tínhamos
    if (wa.businessWebsite && !lead.website && !patch.website) {
      patch.website = wa.businessWebsite;
      patch.domain = extractDomain(wa.businessWebsite);
      patch.hasWebsite = true;
      const siteCheck = await checkWebsite(wa.businessWebsite);
      patch.websiteStatus = siteCheck.websiteStatus;
      patch.hasSsl = siteCheck.hasSsl;
      patch.email = patch.email ?? siteCheck.email ?? lead.email;
      patch.hasWebsite = siteCheck.websiteStatus !== "error";
      patch.instagramUrl = patch.instagramUrl ?? siteCheck.instagramUrl ?? lead.instagramUrl;
      patch.hasInstagram = Boolean(patch.instagramUrl);
    }
  }
}
```

#### 7e. Adicionar fase Instagram (após fase WhatsApp, antes de scoring)

```typescript
const websiteAfterWa = patch.website ?? lead.website;
const instagramAfterChecks = patch.instagramUrl ?? lead.instagramUrl;

if (shouldRunInstagram && !websiteAfterWa && instagramAfterChecks) {
  const ig = await checkInstagram(instagramAfterChecks);
  patch.instagramUsername = ig.username;
  patch.instagramFollowers = ig.followersCount;
  patch.instagramBiography = ig.biography;
  patch.instagramExternalUrl = ig.externalUrl;
  patch.instagramIsBusinessAccount = ig.isBusinessAccount;
  if (ig.profileUrl) {
    patch.instagramUrl = ig.profileUrl;
    patch.hasInstagram = true;
  }

  // Cascade: Instagram revelou website
  if (ig.externalUrl && !websiteAfterWa) {
    patch.website = ig.externalUrl;
    patch.domain = extractDomain(ig.externalUrl);
    patch.hasWebsite = true;
    const siteCheck = await checkWebsite(ig.externalUrl);
    patch.websiteStatus = siteCheck.websiteStatus;
    patch.hasSsl = siteCheck.hasSsl;
    patch.email = patch.email ?? siteCheck.email ?? lead.email;
    patch.hasWebsite = siteCheck.websiteStatus !== "error";
  }
}
```

#### 7f. Atualizar `pickLeadSnapshot()` (linhas 25-36)

Adicionar campos novos para alimentar o classifier:

```typescript
function pickLeadSnapshot(lead: typeof leads.$inferSelect) {
  return {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    hasWebsite: lead.hasWebsite,
    googleRating: lead.googleRating,
    googleReviewCount: lead.googleReviewCount,
    websiteStatus: lead.websiteStatus,
    aiSummary: lead.aiSummary,
    // novos:
    googleRank: lead.googleRank,
    hasWhatsapp: lead.hasWhatsapp,
    whatsappIsBusinessAccount: lead.whatsappIsBusinessAccount,
    whatsappBusinessDescription: lead.whatsappBusinessDescription,
    instagramFollowers: lead.instagramFollowers,
    instagramBiography: lead.instagramBiography,
    instagramIsBusinessAccount: lead.instagramIsBusinessAccount,
  };
}
```

#### 7g. Adicionar `domain` ao type do patch

Verificar que `leads.$inferInsert` já inclui `domain` como campo. Caso `domain` não exista no schema atual, adicionar a coluna em `leads.ts`:

```typescript
domain: text("domain"),
```

> **Nota:** O campo `domain` é computado via `extractDomain(website)` no mapping do Apify e nunca vem do usuário. Verificar se já existe no schema — se não, adicionar.

---

## Arquivos a Criar

### 8. `src/lib/enrichment/whatsapp-check.ts`

**O que fazer:** Criar módulo de WhatsApp enrichment. Seguir padrão de `rdap.ts`: type exportado, `emptyResult` constante, função assíncrona pura que nunca lança.

```typescript
import { getEvolutionAPI } from "@/lib/evolution-api";

export type WhatsappCheckResult = {
  hasWhatsapp: boolean;
  isBusinessAccount: boolean | null;
  businessDescription: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  businessCategory: string | null;
};

const emptyResult: WhatsappCheckResult = {
  hasWhatsapp: false,
  isBusinessAccount: null,
  businessDescription: null,
  businessEmail: null,
  businessWebsite: null,
  businessCategory: null,
};

export async function checkWhatsapp(
  phone: string,
  instanceName: string
): Promise<WhatsappCheckResult> {
  try {
    const api = getEvolutionAPI();

    const [check] = await api.checkWhatsappNumbers(instanceName, [phone]);
    if (!check?.exists) return emptyResult;

    try {
      const business = await api.fetchBusinessProfile(instanceName, phone);
      return {
        hasWhatsapp: true,
        isBusinessAccount: true,
        businessDescription: business.description ?? null,
        businessEmail: business.email ?? null,
        businessWebsite: business.website?.[0] ?? null,
        businessCategory: business.category ?? null,
      };
    } catch {
      return {
        hasWhatsapp: true,
        isBusinessAccount: false,
        businessDescription: null,
        businessEmail: null,
        businessWebsite: null,
        businessCategory: null,
      };
    }
  } catch {
    return emptyResult;
  }
}
```

---

### 9. `src/lib/enrichment/instagram-check.ts`

**O que fazer:** Criar módulo de Instagram enrichment via Apify `instagram-profile-scraper`. Seguir padrão de `rdap.ts`.

```typescript
import { ApifyClient } from "apify-client";

export type InstagramCheckResult = {
  username: string | null;
  followersCount: number | null;
  biography: string | null;
  externalUrl: string | null;
  isBusinessAccount: boolean | null;
  businessCategory: string | null;
  profileUrl: string | null;
};

const emptyResult: InstagramCheckResult = {
  username: null,
  followersCount: null,
  biography: null,
  externalUrl: null,
  isBusinessAccount: null,
  businessCategory: null,
  profileUrl: null,
};

export async function checkInstagram(
  instagramUrl: string
): Promise<InstagramCheckResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return emptyResult;

  try {
    const client = new ApifyClient({ token });
    const match = instagramUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (!match) return emptyResult;
    const username = match[1];

    const run = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username],
    });

    if (!run.defaultDatasetId) return emptyResult;

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const profile = items[0] as Record<string, unknown> | undefined;
    if (!profile) return emptyResult;

    return {
      username: typeof profile.username === "string" ? profile.username : null,
      followersCount: typeof profile.followersCount === "number" ? profile.followersCount : null,
      biography: typeof profile.biography === "string" ? profile.biography : null,
      externalUrl: typeof profile.externalUrl === "string" ? profile.externalUrl : null,
      isBusinessAccount: typeof profile.isBusinessAccount === "boolean" ? profile.isBusinessAccount : null,
      businessCategory: typeof profile.businessCategoryName === "string" ? profile.businessCategoryName : null,
      profileUrl: `https://instagram.com/${username}`,
    };
  } catch {
    return emptyResult;
  }
}
```

---

### 10. `migrations/0002_enrichment_v2.sql`

**O que fazer:** Gerar via `npx drizzle-kit generate --name=enrichment_v2` após editar o schema. Conteúdo esperado:

```sql
ALTER TABLE `leads` ADD `google_place_id` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `google_maps_url` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `google_rank` integer;
--> statement-breakpoint
ALTER TABLE `leads` ADD `image_url` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `has_whatsapp` integer;
--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsapp_is_business_account` integer;
--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsapp_business_description` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsapp_business_email` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsapp_business_website` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `instagram_username` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `instagram_followers` integer;
--> statement-breakpoint
ALTER TABLE `leads` ADD `instagram_biography` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `instagram_external_url` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `instagram_is_business_account` integer;
```

> **Nota:** Não escrever manualmente. Usar `drizzle-kit generate` para garantir consistência com o schema TS.

---

## Ordem de Execução (Fases)

```
Fase 1 — Schema + Bugs + Campos Apify (sem nova infra)
  └─ leads.ts → apify.ts → extraction.ts → gerar migration

Fase 2 — WhatsApp Enrichment
  └─ evolution-api.ts → whatsapp-check.ts (novo) → enrichment.ts

Fase 3 — Instagram Enrichment
  └─ website-check.ts → instagram-check.ts (novo) → enrichment.ts

Fase 4 — AI Classifier Melhorado
  └─ ai-classifier.ts → enrichment.ts (pickLeadSnapshot)
```

---

## Pipeline Final (Ordem de Execução no Worker)

```
1. RDAP           — dados do registrante (.com.br)
2. Website Check  — status + SSL + email + Instagram link do HTML
3. WhatsApp       — valida número, Business profile
   └── Se achou site → re-run Website Check
4. Instagram      — [CONDICIONAL: só se ainda sem website]
   └── Se achou site → re-run Website Check
5. Score          — recalcula com dados atualizados
6. Classify       — AI com todos os dados enriquecidos
```

---

## Hierarquia de Confiança (Nunca Sobrescrever Fonte Superior)

```
1. Google Maps (Apify)         — base
2. WhatsApp Business profile   — dono preenche
3. Instagram externalUrl       — dono preenche
4. Website HTML (links)        — inferido
5. RDAP/WHOIS                  — técnico
```

---

## Variáveis de Ambiente

Nenhuma variável nova. Reutiliza:
- `APIFY_TOKEN` — já existe (Google Maps + Instagram scraper)
- `EVOLUTION_API_URL` — já existe (WhatsApp)
- `EVOLUTION_API_KEY` — já existe (WhatsApp)

---

## Resumo de Impacto

| Tipo | Arquivos |
|---|---|
| **Modificar** | `src/db/schema/leads.ts`, `src/lib/apify.ts`, `src/workers/extraction.ts`, `src/lib/evolution-api.ts`, `src/lib/enrichment/website-check.ts`, `src/lib/enrichment/ai-classifier.ts`, `src/workers/enrichment.ts` |
| **Criar** | `src/lib/enrichment/whatsapp-check.ts`, `src/lib/enrichment/instagram-check.ts` |
| **Gerar** | `migrations/0002_enrichment_v2.sql` (via drizzle-kit) |
| **Total** | 7 modificados + 2 criados + 1 gerado |
