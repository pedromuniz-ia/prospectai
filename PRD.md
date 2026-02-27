# PRD — Enrichment Pipeline v2

> Documento de referência para implementação. Consolida diagnóstico de bugs, arquivos afetados, padrões de código da base existente, documentação externa e snippets de implementação.

---

## 1. Contexto e Motivação

O pipeline atual de extração + enrichment tem bugs críticos que corrompem dados em cascata, e está deixando sinais valiosos na mesa. O objetivo desta iteração é:

1. **Corrigir bugs críticos** que comprometem a qualidade de todos os leads
2. **Mapear campos não capturados** da Apify que já existem no schema do banco
3. **Adicionar WhatsApp enrichment** via Evolution API (já integrada)
4. **Adicionar Instagram enrichment** via Apify scraper
5. **Melhorar AI classification** com inputs mais ricos

---

## 2. Bugs Críticos (Afetam Dados Hoje)

### BUG-01 — `website` recebe link do Google Maps

**Arquivo:** `src/lib/apify.ts:40`

```typescript
// ERRADO — item.url é o link do Google Maps, não o site do negócio
const website = item.website ?? item.url ?? null;

// CORRETO
const website = item.website ?? null;
// item.url vai para um campo separado: googleMapsUrl
```

**Impacto em cascata:**
- `hasWebsite: true` para negócios sem site
- Website check → "active" (está checando google.com/maps/...)
- `hasSsl: true` incorreto
- Score: nunca ganha +30 "Sem website"
- AI: nunca classifica como `needs_website`
- RDAP: tenta consultar `google.com` em vez de domínio real

### BUG-02 — Leads fechados sendo processados

**Arquivo:** `src/lib/apify.ts` — `mapItem()` não filtra `permanentlyClosed`

```typescript
// ADICIONAR no início de mapItem():
if (item.permanentlyClosed || item.temporarilyClosed) return null;
```

### BUG-03 — `neighborhood` e `postalCode` não mapeados

Colunas já existem em `src/db/schema/leads.ts` (linhas 24–25), Apify retorna os campos, mas `RawApifyItem` não os declara e `mapItem()` não os mapeia.

---

## 3. Arquivos Afetados

### Modificações em arquivos existentes

| Arquivo | Tipo de mudança |
|---|---|
| `src/lib/apify.ts` | Fix bugs + mapear novos campos da Apify |
| `src/lib/evolution-api.ts` | Adicionar 3 novos métodos na classe `EvolutionAPI` |
| `src/lib/enrichment/website-check.ts` | Extrair links do Instagram do HTML |
| `src/lib/enrichment/ai-classifier.ts` | Ampliar `ClassificationLeadInput` com dados de WA e Instagram |
| `src/workers/enrichment.ts` | Adicionar fases WhatsApp e Instagram, cascade de re-enrichment |
| `src/db/schema/leads.ts` | Adicionar ~10 novas colunas |

### Novos arquivos a criar

| Arquivo | Propósito |
|---|---|
| `src/lib/enrichment/whatsapp-check.ts` | Módulo de enrichment via Evolution API |
| `src/lib/enrichment/instagram-check.ts` | Módulo de enrichment via Apify Instagram scraper |
| `migrations/0002_*.sql` | Migration com novas colunas |

---

## 4. Schema — Novas Colunas em `leads`

### Colunas a adicionar em `src/db/schema/leads.ts`

```typescript
// --- Apify Google Maps (novos campos) ---
googlePlaceId: text("google_place_id"),           // placeId — identificador único do Google
googleMapsUrl: text("google_maps_url"),            // item.url — link real do Maps
googleRank: integer("google_rank"),                // posição no resultado de busca
imageUrl: text("image_url"),                       // foto principal do negócio

// --- WhatsApp enrichment ---
hasWhatsapp: integer("has_whatsapp", { mode: "boolean" }),
whatsappIsBusinessAccount: integer("whatsapp_is_business_account", { mode: "boolean" }),
whatsappBusinessDescription: text("whatsapp_business_description"),
whatsappBusinessEmail: text("whatsapp_business_email"),
whatsappBusinessWebsite: text("whatsapp_business_website"),   // externalUrl do perfil WA Business

// --- Instagram enrichment ---
// hasInstagram e instagramUrl já existem no schema
instagramUsername: text("instagram_username"),
instagramFollowers: integer("instagram_followers"),
instagramBiography: text("instagram_biography"),
instagramExternalUrl: text("instagram_external_url"),         // link da bio — possível site
instagramIsBusinessAccount: integer("instagram_is_business_account", { mode: "boolean" }),
```

### Padrão de migration (baseado em `0001_rapid_abomination.sql`)

```sql
-- 0002_enrichment_v2.sql
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

> **Workflow de migration:** Editar o schema → `npx drizzle-kit generate --name=enrichment_v2` → aplicar.

---

## 5. Apify — Novos campos mapeados

### Output completo do `compass/crawler-google-places` (campos relevantes)

```json
{
  "title": "Dra. Ana Silva - Psicóloga",
  "rank": 3,
  "phone": "(11) 99999-9999",
  "phoneUnformatted": "+5511999999999",
  "website": "https://draana.com.br",
  "url": "https://www.google.com/maps/search/?api=1&query=...&query_place_id=...",
  "address": "Rua das Flores, 123, São Paulo, SP",
  "neighborhood": "Jardins",
  "street": "Rua das Flores, 123",
  "city": "São Paulo",
  "state": "São Paulo",
  "postalCode": "01401-001",
  "countryCode": "BR",
  "location": { "lat": -23.5, "lng": -46.6 },
  "categoryName": "Psicólogo",
  "categories": ["Psicólogo", "Terapeuta"],
  "totalScore": 4.8,
  "reviewsCount": 47,
  "imageUrl": "https://lh3.googleusercontent.com/...",
  "placeId": "ChIJ...",
  "permanentlyClosed": false,
  "temporarilyClosed": false,
  "openingHours": [{"day": "Segunda-feira", "hours": "9 AM to 6 PM"}],
  "additionalInfo": {
    "Service options": [{"Online appointments": true}],
    "Payments": [{"Credit cards": true}]
  }
}
```

### Mapeamento atualizado (`RawApifyItem` e `ExtractedLead`)

```typescript
// Novos campos em RawApifyItem
type RawApifyItem = {
  // ... campos existentes ...
  rank?: number;
  phoneUnformatted?: string;
  neighborhood?: string;
  street?: string;
  postalCode?: string;
  countryCode?: string;
  placeId?: string;
  imageUrl?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  additionalInfo?: Record<string, unknown>;
};

// Novos campos em ExtractedLead
export type ExtractedLead = {
  // ... campos existentes ...
  googleMapsUrl: string | null;    // item.url (era erroneamente usado como website)
  googlePlaceId: string | null;
  googleRank: number | null;
  neighborhood: string | null;
  postalCode: string | null;
  imageUrl: string | null;
  phoneUnformatted: string | null;
};

// mapItem() corrigido
function mapItem(item: RawApifyItem): ExtractedLead | null {
  if (!item.title) return null;
  if (item.permanentlyClosed || item.temporarilyClosed) return null; // BUG-02 fix

  const website = item.website ?? null; // BUG-01 fix — sem fallback para item.url

  return {
    // ... campos existentes ...
    website,
    googleMapsUrl: item.url ?? null,     // preserva o link do Maps separadamente
    googlePlaceId: item.placeId ?? null,
    googleRank: typeof item.rank === "number" ? item.rank : null,
    neighborhood: item.neighborhood ?? null,
    postalCode: item.postalCode ?? null,
    imageUrl: item.imageUrl ?? null,
    phoneUnformatted: item.phoneUnformatted ?? null,
    domain: extractDomain(website),      // agora sempre um domínio real ou null
  };
}
```

---

## 6. Evolution API — Novos métodos

### Documentação dos endpoints

#### `POST /chat/whatsappNumbers/{instance}`
```
Verifica se números estão registrados no WhatsApp.
```
```json
// Request
{ "numbers": ["5511999999999"] }

// Response 200
[{
  "exists": true,
  "jid": "5511999999999@s.whatsapp.net",
  "number": "5511999999999"
}]
```

#### `POST /chat/fetchProfile/{instance}`
```
Busca perfil básico de um contato WhatsApp.
```
```json
// Request
{ "number": "5511999999999" }

// Response 200
{
  "name": "Dra. Ana Silva",
  "status": "Psicóloga | Atendimento online",
  "picture": "https://pps.whatsapp.net/..."
}
```

#### `POST /chat/fetchBusinessProfile/{instance}`
```
Busca perfil Business de um número (quando isBusinessAccount=true).
```
```json
// Request
{ "number": "5511999999999" }

// Response 200
{
  "description": "Psicóloga CRP 06/12345. Atendimento online e presencial.",
  "email": "contato@draana.com.br",
  "website": ["https://draana.com.br"],
  "category": "Health/Medical",
  "address": "Rua das Flores, 123, São Paulo"
}
```

### Implementação em `src/lib/evolution-api.ts`

```typescript
// Novos tipos
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

// Novos métodos na classe EvolutionAPI
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

## 7. WhatsApp Enrichment Module

### `src/lib/enrichment/whatsapp-check.ts` (novo arquivo)

**Padrão:** seguir exatamente o mesmo contrato de `rdap.ts` e `website-check.ts`:
- Exporta um tipo de resultado
- Exporta uma função assíncrona pura
- Retorna resultado vazio em caso de falha (sem throw)
- Sem side effects

```typescript
export type WhatsappCheckResult = {
  hasWhatsapp: boolean;
  isBusinessAccount: boolean | null;
  businessDescription: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;   // ← dado mais valioso
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

    // 1. Verifica se o número existe no WhatsApp
    const [check] = await api.checkWhatsappNumbers(instanceName, [phone]);
    if (!check?.exists) return emptyResult;

    // 2. Busca perfil Business (não lança erro se não for business)
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
      // Não é conta Business — retorna apenas existência
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

### Como obter o `instanceName` no worker

O enrichment worker precisa de uma instância conectada da organização. Padrão a seguir:

```typescript
// No enrichment worker, antes de chamar checkWhatsapp:
const connectedInstance = await db.query.whatsappInstances.findFirst({
  where: and(
    eq(whatsappInstances.organizationId, data.organizationId),
    eq(whatsappInstances.status, "connected")
  ),
});

if (connectedInstance && lead.phone) {
  const wa = await checkWhatsapp(lead.phone, connectedInstance.instanceName);
  patch.hasWhatsapp = wa.hasWhatsapp;
  patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
  patch.whatsappBusinessDescription = wa.businessDescription;
  patch.whatsappBusinessEmail = wa.businessEmail;
  patch.whatsappBusinessWebsite = wa.businessWebsite;
}
```

---

## 8. Website Check — Extração de Link do Instagram

### Modificação em `src/lib/enrichment/website-check.ts`

Adicionar extração de link do Instagram durante o scraping do HTML. É a forma mais barata e confiável de encontrar o Instagram de um negócio.

```typescript
// Regex para extrair handle do Instagram a partir de links no HTML
const INSTAGRAM_REGEX = /instagram\.com\/([a-zA-Z0-9_.]+)\/?/;

// No retorno de checkWebsite(), adicionar:
export type WebsiteCheckResult = {
  websiteStatus: WebsiteStatus;
  hasSsl: boolean;
  email: string | null;
  instagramUrl: string | null;   // novo
};

// Na função que faz parse do HTML:
function parseInstagramUrl(html: string): string | null {
  const match = html.match(INSTAGRAM_REGEX);
  if (!match) return null;
  const username = match[1];
  // Ignorar handles genéricos
  if (["sharer", "share", "p", "reel", "explore"].includes(username)) return null;
  return `https://instagram.com/${username}`;
}
```

---

## 9. Instagram Enrichment Module

### Actor Apify: `apify/instagram-profile-scraper`

**Input:**
```json
{
  "usernames": ["draanasilva.psi"],
  "resultsLimit": 3
}
```

**Output (campos relevantes):**
```json
{
  "username": "draanasilva.psi",
  "fullName": "Dra. Ana Silva - Psicóloga",
  "biography": "Psicóloga CRP 06/12345 🧠 Atendimento online e presencial 📅",
  "externalUrl": "https://draana.com.br",
  "followersCount": 2840,
  "followsCount": 312,
  "postsCount": 187,
  "isBusinessAccount": true,
  "businessCategoryName": "Health/Beauty",
  "verified": false,
  "private": false,
  "profilePicUrl": "https://..."
}
```

### `src/lib/enrichment/instagram-check.ts` (novo arquivo)

**Padrão:** seguir `src/lib/apify.ts` para chamadas ao Apify client.

```typescript
import { ApifyClient } from "apify-client";

export type InstagramCheckResult = {
  username: string | null;
  followersCount: number | null;
  biography: string | null;
  externalUrl: string | null;     // ← website encontrado na bio
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
    // Extrair username da URL
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

## 10. Enrichment Worker — Novo Pipeline Completo

### Novos tipos de job em `enrichmentJobSchema`

```typescript
type: z.enum([
  "rdap",
  "website",
  "whatsapp",    // novo
  "instagram",   // novo
  "score",
  "classify",
  "full"
]).default("full"),
```

### Lógica condicional para WhatsApp e Instagram

```typescript
const shouldRunWhatsapp = data.type === "whatsapp" || data.type === "full";
const shouldRunInstagram = data.type === "instagram" || data.type === "full";
```

### Gatilhos condicionais (custo e relevância)

```typescript
// WhatsApp: rodar se tem telefone e instância conectada
if (shouldRunWhatsapp && lead.phone) {
  const instance = await db.query.whatsappInstances.findFirst({
    where: and(
      eq(whatsappInstances.organizationId, data.organizationId),
      eq(whatsappInstances.status, "connected")
    ),
  });
  if (instance) {
    const wa = await checkWhatsapp(lead.phone, instance.instanceName);
    patch.hasWhatsapp = wa.hasWhatsapp;
    patch.whatsappIsBusinessAccount = wa.isBusinessAccount;
    patch.whatsappBusinessDescription = wa.businessDescription;
    patch.whatsappBusinessEmail = wa.businessEmail;
    patch.whatsappBusinessWebsite = wa.businessWebsite;

    // Se WA Business revelou um website que não tínhamos
    if (wa.businessWebsite && !lead.website) {
      patch.website = wa.businessWebsite;
      patch.domain = extractDomain(wa.businessWebsite);
      // Acionar website check no novo domínio encontrado
      const siteCheck = await checkWebsite(wa.businessWebsite);
      patch.websiteStatus = siteCheck.websiteStatus;
      patch.hasSsl = siteCheck.hasSsl;
      patch.email = patch.email ?? siteCheck.email ?? lead.email;
      patch.hasWebsite = siteCheck.websiteStatus !== "error";
      patch.instagramUrl = patch.instagramUrl ?? siteCheck.instagramUrl ?? null;
    }
  }
}

// Instagram: rodar SOMENTE se ainda sem website após WA check
const websiteAfterWa = patch.website ?? lead.website;
const instagramAfterWebsiteCheck = patch.instagramUrl ?? lead.instagramUrl;

if (shouldRunInstagram && !websiteAfterWa && instagramAfterWebsiteCheck) {
  const ig = await checkInstagram(instagramAfterWebsiteCheck);
  patch.instagramUsername = ig.username;
  patch.instagramFollowers = ig.followersCount;
  patch.instagramBiography = ig.biography;
  patch.instagramExternalUrl = ig.externalUrl;
  patch.instagramIsBusinessAccount = ig.isBusinessAccount;
  if (ig.profileUrl) {
    patch.instagramUrl = ig.profileUrl;
    patch.hasInstagram = true;
  }

  // Se Instagram revelou um website
  if (ig.externalUrl && !websiteAfterWa) {
    patch.website = ig.externalUrl;
    patch.domain = extractDomain(ig.externalUrl);
    const siteCheck = await checkWebsite(ig.externalUrl);
    patch.websiteStatus = siteCheck.websiteStatus;
    patch.hasSsl = siteCheck.hasSsl;
    patch.email = patch.email ?? siteCheck.email ?? lead.email;
    patch.hasWebsite = siteCheck.websiteStatus !== "error";
  }
}
```

### Pipeline completo (ordem de execução)

```
1. RDAP         — busca dados do registrante do domínio (.com.br)
2. Website Check — verifica site, extrai email + link do Instagram do HTML
3. WhatsApp     — valida número, busca Business profile (possível site)
   └── Se achou site: re-run Website Check no novo domínio
4. Instagram    — [condicional: só se ainda sem website]
   └── Se achou site: re-run Website Check no novo domínio
5. Score        — recalcula pontuação com dados atualizados
6. Classify     — AI classification com todos os dados enriquecidos
```

---

## 11. AI Classifier — Inputs Expandidos

### `ClassificationLeadInput` atualizado em `src/lib/enrichment/ai-classifier.ts`

```typescript
type ClassificationLeadInput = {
  // Campos existentes
  name: string | null;
  category: string | null;
  city: string | null;
  hasWebsite: boolean | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  websiteStatus: string | null;
  aiSummary?: string | null;

  // Novos campos
  googleRank: number | null;
  hasWhatsapp: boolean | null;
  whatsappIsBusinessAccount: boolean | null;
  whatsappBusinessDescription: string | null;
  instagramFollowers: number | null;
  instagramBiography: string | null;
  instagramIsBusinessAccount: boolean | null;
};
```

### Prompt atualizado para LLM

```typescript
const prompt = [
  "Classifique este lead para prospecção B2B via WhatsApp.",
  "Responda estritamente no schema definido.",
  `Nome: ${lead.name ?? "N/A"}`,
  `Categoria: ${lead.category ?? "N/A"}`,
  `Cidade: ${lead.city ?? "N/A"}`,
  `Tem website: ${String(lead.hasWebsite)}`,
  `Status website: ${lead.websiteStatus ?? "N/A"}`,
  `Google rating: ${lead.googleRating ?? "N/A"}`,
  `Google reviews: ${lead.googleReviewCount ?? "N/A"}`,
  `Posição no Maps: ${lead.googleRank ?? "N/A"}`,
  `Tem WhatsApp: ${lead.hasWhatsapp ?? "N/A"}`,
  `WhatsApp Business: ${lead.whatsappIsBusinessAccount ?? "N/A"}`,
  lead.whatsappBusinessDescription ? `Desc. WA Business: ${lead.whatsappBusinessDescription}` : "",
  `Seguidores Instagram: ${lead.instagramFollowers ?? "N/A"}`,
  lead.instagramBiography ? `Bio Instagram: ${lead.instagramBiography}` : "",
].filter(Boolean).join("\n");
```

### Heurísticas atualizadas

```typescript
function heuristicClassification(lead: ClassificationLeadInput): LeadClassification {
  // Regra mais precisa: sem website E sem indício de site em WA/Instagram
  if (!lead.hasWebsite) {
    return {
      classification: "needs_website",
      confidence: 0.88,
      summary: "Lead sem website funcional.",
      suggestedApproach: "Proposta objetiva de criação de site com entrega rápida.",
    };
  }

  // Baixo engajamento
  if ((lead.googleRating ?? 0) < 4 || (lead.googleReviewCount ?? 0) < 40) {
    return {
      classification: "needs_optimization",
      confidence: 0.78,
      summary: "Presença digital com sinais de baixa performance.",
      suggestedApproach: "Otimização do funil digital e ajustes de conversão.",
    };
  }

  // Alta demanda (muitos reviews + Instagram ativo)
  if ((lead.googleReviewCount ?? 0) >= 80 && (lead.instagramFollowers ?? 0) >= 500) {
    return {
      classification: "needs_automation",
      confidence: 0.82,  // confiança maior com mais sinal
      summary: "Lead com volume relevante e presença digital consolidada.",
      suggestedApproach: "Automação de atendimento com IA para escalar sem aumentar equipe.",
    };
  }

  // ... resto das regras
}
```

---

## 12. Hierarquia de Confiança das Fontes

Quando múltiplas fontes fornecem o mesmo campo (ex: `website`), esta é a ordem de prioridade:

```
1. Google Maps (Apify)         — base, mas pode estar desatualizado
2. WhatsApp Business profile   — dono preenche, alta confiabilidade
3. Instagram externalUrl       — dono preenche, alta confiabilidade
4. Website HTML (links)        — inferido, confiável
5. RDAP/WHOIS                  — dado registral, técnico
```

**Regra:** fonte de maior prioridade nunca é sobrescrita por fonte de menor prioridade.

---

## 13. Padrões de Implementação da Base de Código

### Padrão de módulo de enrichment (rdap.ts como referência)

```typescript
// 1. Tipo de resultado exportado
export type XyzEnrichment = { field: string | null; ... };

// 2. Resultado vazio (constante)
const emptyResult: XyzEnrichment = { field: null, ... };

// 3. Função assíncrona pura exportada
export async function enrichWithXyz(input: string): Promise<XyzEnrichment> {
  try {
    // ... lógica ...
    return { field: value };
  } catch {
    return emptyResult;  // nunca lança, sempre retorna
  }
}
```

### Padrão de timeout em fetch

```typescript
// RDAP: 10 segundos
signal: AbortSignal.timeout(10_000)

// Website check: 7 segundos
signal: AbortSignal.timeout(7_000)

// WhatsApp (Evolution): sem timeout explícito (Evolution tem o seu próprio)
// Instagram (Apify): sem timeout explícito (Apify gerencia internamente)
```

### Padrão de patch no worker (enrichment.ts)

```typescript
// Acumular todas as mudanças em um objeto patch
const patch: Partial<typeof leads.$inferInsert> = { updatedAt: new Date() };

// Aplicar todos os dados enriquecidos
patch.hasWhatsapp = wa.hasWhatsapp;

// Um único update no banco ao final
await db.update(leads).set(patch).where(eq(leads.id, lead.id));
```

### Padrão de tipagem do Apify client

```typescript
// Cast do resultado para tipo conhecido, validar campos individualmente
const profile = items[0] as Record<string, unknown> | undefined;
const followersCount = typeof profile?.followersCount === "number"
  ? profile.followersCount
  : null;
```

---

## 14. Checklist de Implementação

### Fase 1 — Correções e campos faltando (sem nova infra)
- [ ] Fix `website ?? url` bug em `src/lib/apify.ts`
- [ ] Adicionar filtro `permanentlyClosed` em `mapItem()`
- [ ] Ampliar `RawApifyItem` com campos novos (rank, neighborhood, postalCode, placeId, imageUrl, phoneUnformatted, permanentlyClosed, temporarilyClosed)
- [ ] Ampliar `ExtractedLead` e `mapItem()` para mapear campos novos
- [ ] Adicionar novos campos no `db.insert(leads)` do worker de extração
- [ ] Adicionar colunas novas em `src/db/schema/leads.ts`
- [ ] Gerar e aplicar migration SQL

### Fase 2 — WhatsApp enrichment
- [ ] Adicionar `checkWhatsappNumbers`, `fetchProfile`, `fetchBusinessProfile` em `EvolutionAPI`
- [ ] Criar `src/lib/enrichment/whatsapp-check.ts`
- [ ] Integrar no `src/workers/enrichment.ts` (incluindo cascade de website)
- [ ] Adicionar tipo `"whatsapp"` no `enrichmentJobSchema`

### Fase 3 — Instagram enrichment
- [ ] Adicionar extração de links do Instagram em `website-check.ts`
- [ ] Criar `src/lib/enrichment/instagram-check.ts`
- [ ] Integrar no `src/workers/enrichment.ts` (condicional: só se sem website)
- [ ] Adicionar tipo `"instagram"` no `enrichmentJobSchema`

### Fase 4 — AI Classifier melhorado
- [ ] Ampliar `ClassificationLeadInput` com novos campos
- [ ] Atualizar prompt do LLM
- [ ] Atualizar heurísticas de fallback
- [ ] Atualizar `pickLeadSnapshot()` no worker

---

## 15. Variáveis de Ambiente Necessárias

Nenhuma variável nova necessária. Reutiliza o que já existe:

```env
APIFY_TOKEN=...          # já existe — usado para Instagram scraper
EVOLUTION_API_URL=...    # já existe — para WhatsApp check
EVOLUTION_API_KEY=...    # já existe — para WhatsApp check
```
