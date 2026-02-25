# ProspectAI MVP — Design Document

**Data:** 2026-02-25
**Status:** Aprovado
**Autor:** Pedro + Claude

---

## 1. Visão Geral

Sistema de prospecção ativa via WhatsApp com mini CRM integrado. Motor de vendas com custo quase zero em mídia — sem tráfego pago, apenas números de WhatsApp + créditos de IA.

**Objetivo imediato:** Resolver a dor interna de prospecção do Pedro.
**Objetivo estratégico:** Validar como produto para futuro SaaS.

### O que o sistema faz

1. **Extrai leads** do Google Maps via Apify (server-side)
2. **Enriquece** com dados do Registro.br (RDAP), verificação de site, presença digital
3. **Pontua** leads com scoring configurável por objetivo de venda
4. **Classifica** leads com IA (needs_website, needs_ai_agent, etc.)
5. **Aborda** via WhatsApp com cadência segura e anti-ban
6. **Conversa** com apoio de IA semi-automática (responde, operador intervém)
7. **Rastreia** tudo num pipeline visual (kanban) com espelhamento de conversas

---

## 2. Decisões Técnicas

| Aspecto | Decisão |
|---|---|
| Evolution API | Já rodando na VPS |
| Deploy | Mesma VPS da Evolution API |
| Extração de leads | Tudo server-side (Apify + RDAP) |
| IA nas conversas | Semi-automático (IA responde, operador intervém) |
| Cadência | Automático com agenda (janela de horário) |
| Multi-tenant | Sim, desde o MVP |
| Estética | Minimalismo moderno (Linear/Attio/Raycast) |

---

## 3. Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Fullstack, SSR, Server Actions |
| **UI** | React + Tailwind + shadcn/ui | Componentes prontos, design consistente |
| **Estado client** | Jotai | Leve, atômico, sem boilerplate |
| **Auth** | Better Auth | Multi-tenant nativo (orgs), social login, session |
| **ORM** | Drizzle | Type-safe, migrations, leve |
| **Banco** | Turso (SQLite remoto) | Free tier generoso, embedded replicas, edge-ready |
| **Filas** | BullMQ + Redis | Jobs recorrentes, retry, rate limiting nativo |
| **Worker** | Processo Node separado (`worker.ts`) | Consome filas, executa cadência/IA/extração |
| **WhatsApp** | Evolution API (existente) | Webhooks para receber, REST para enviar |
| **Leads** | Apify SDK + RDAP Registro.br | Extração server-side do Google Maps + enriquecimento |
| **IA** | Vercel AI SDK (multi-provider) | OpenAI, Claude, Gemini, Groq, MiniMax, open-source — gratuito e open-source |
| **Drag & Drop** | dnd-kit | Kanban com spring physics |
| **Fonts** | Display: Instrument Serif / Fraunces; UI: Geist / Satoshi; Mono: Geist Mono | Personalidade sem poluição |

---

## 4. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (mesma máquina)                  │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Next.js App        │    │   Worker Process          │  │
│  │   (App Router)       │    │   (BullMQ consumer)       │  │
│  │                      │    │                           │  │
│  │  - UI (React+shadcn) │    │  - Cadência de envio      │  │
│  │  - Server Actions    │    │  - Extração Apify         │  │
│  │  - Route Handlers    │    │  - Enriquecimento RDAP    │  │
│  │  - Webhooks recv     │    │  - Respostas IA           │  │
│  │  - Better Auth       │    │  - Agendamento (cron)     │  │
│  └──────────┬───────────┘    └─────────┬─────────────────┘  │
│             │                          │                    │
│             └──────────┬───────────────┘                    │
│                        │                                    │
│              ┌─────────▼─────────┐                          │
│              │      Redis        │                          │
│              │   (BullMQ queues) │                          │
│              └───────────────────┘                          │
│                        │                                    │
│              ┌─────────▼─────────┐                          │
│              │   Turso (SQLite)  │                          │
│              │   via Drizzle ORM │                          │
│              └───────────────────┘                          │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Evolution API      │    │   APIs externas           │  │
│  │   (já instalada)     │    │   - Apify (Google Maps)   │  │
│  │   - WhatsApp conn    │    │   - Registro.br RDAP      │  │
│  │   - Send/recv msgs   │    │   - OpenAI / Claude /     │  │
│  │   - Webhooks emit    │    │     Gemini / Groq / etc.  │  │
│  └──────────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de dados principal

1. **Extração:** Worker chama Apify → leads brutos → enriquece via RDAP + website check → scoring → classificação IA → salva no banco
2. **Cadência:** Worker (cron) verifica agenda → pega leads na fila → envia primeira mensagem via Evolution API → intervalo randomizado
3. **Recebimento:** Evolution API dispara webhook → Next.js Route Handler recebe → salva mensagem → atualiza status → enfileira job de resposta IA
4. **IA:** Worker consome job → monta contexto (histórico + prompt + dados do lead) → chama LLM via AI SDK → envia resposta ou aguarda aprovação
5. **UI:** Inbox mostra tudo em tempo real via polling/revalidação

---

## 5. Modelo de Dados

### 5.1 — Multi-tenancy

```
organizations
├── id (cuid)
├── name
├── slug (único, usado em URLs)
├── plan ("free" | "pro" | "enterprise")
├── createdAt
└── updatedAt

users
├── id (cuid)
├── email
├── name
├── avatarUrl
├── organizationId → organizations.id
├── role ("owner" | "admin" | "member")
├── createdAt
└── updatedAt
```

### 5.2 — WhatsApp Instances

```
whatsapp_instances
├── id (cuid)
├── organizationId → organizations.id
├── instanceName (nome na Evolution API)
├── instanceId (ID retornado pela Evolution API)
├── phone (número conectado)
├── status ("disconnected" | "connecting" | "connected" | "banned")
├── qrCode (text, temporário para conexão)
├── webhookUrl (URL configurada na Evolution)
├── dailyMessageLimit (default: 80)
├── dailyMessagesSent (reset diário)
├── createdAt
└── updatedAt
```

### 5.3 — Leads (dados brutos + enriquecidos + qualificação + scoring)

```
leads
├── id (cuid)
├── organizationId → organizations.id
│
│  ── DADOS BRUTOS (extração) ──
├── name (nome da empresa)
├── phone (telefone principal)
├── phoneSecondary (telefone secundário, nullable)
├── email (email do RDAP/site, nullable)
├── website (domínio, nullable)
├── address (endereço completo)
├── city
├── state
├── neighborhood (bairro)
├── zipCode
├── latitude (float)
├── longitude (float)
├── category (ex: "Restaurante", "Clínica Odontológica")
├── subcategory (nullable)
├── sourceType ("apify_gmaps" | "manual" | "csv_import" | "extension")
├── sourceId (ID do run/job que gerou)
│
│  ── DADOS ENRIQUECIDOS ──
├── hasWebsite (boolean)
├── websiteStatus ("active" | "inactive" | "parked" | "error" | null)
├── hasSsl (boolean, nullable)
├── hasInstagram (boolean, nullable)
├── instagramUrl (nullable)
├── hasGoogleBusiness (boolean, default true se veio do Maps)
├── googleRating (float, nullable)
├── googleReviewCount (integer, nullable)
├── businessHours (text/JSON, nullable)
├── domainRegistrar (nullable)
├── domainCreatedAt (nullable)
├── whoisEmail (nullable)
├── whoisResponsible (nullable)
├── enrichedAt (timestamp, nullable)
├── enrichmentVersion (integer, default 0)
│
│  ── QUALIFICAÇÃO IA ──
├── aiClassification ("needs_website" | "needs_optimization" | "needs_ai_agent" | "needs_automation" | "low_fit" | null)
├── aiClassificationConfidence (float, nullable, 0-1)
├── aiSummary (text, nullable)
├── aiSuggestedApproach (text, nullable)
├── aiQualifiedAt (timestamp, nullable)
│
│  ── SCORING ──
├── score (integer, default 0)
├── scoreBreakdown (text/JSON)
├── scoreExplanation (text, nullable)
├── scoredAt (timestamp, nullable)
├── scoringVersion (integer, default 0)
│
│  ── STATUS & CONTROLE ──
├── status ("new" | "enriched" | "scored" | "queued" | "contacted" | "replied" | "interested" | "proposal" | "won" | "lost" | "blocked")
├── lostReason (nullable)
├── doNotContact (boolean, default false)
├── contactAttempts (integer, default 0)
├── lastContactedAt (timestamp, nullable)
├── lastRepliedAt (timestamp, nullable)
│
├── createdAt
└── updatedAt
```

### 5.4 — Campanhas

```
campaigns
├── id (cuid)
├── organizationId → organizations.id
├── name
├── objective ("sell_website" | "sell_ai_agent" | "sell_optimization" | "sell_automation" | "custom")
├── status ("draft" | "active" | "paused" | "completed")
│
│  ── FILTROS DE SEGMENTAÇÃO ──
├── filters (text/JSON)
│   Ex: { "hasWebsite": false, "categories": [...], "cities": [...], "minScore": 50 }
│
│  ── CADÊNCIA ──
├── scheduleStart (time, ex: "09:00")
├── scheduleEnd (time, ex: "18:00")
├── scheduleDays (text/JSON, ex: ["mon","tue","wed","thu","fri"])
├── minInterval (integer, segundos, default: 180)
├── maxInterval (integer, segundos, default: 300)
├── dailyLimit (integer, default: 40)
├── dailySent (integer, default: 0)
│
│  ── MENSAGENS ──
├── firstMessageVariants (text/JSON, mín 5 variantes)
│
│  ── IA CONFIG ──
├── aiEnabled (boolean, default true)
├── aiProviderId → ai_providers.id
├── aiModel (text)
├── aiSystemPrompt (text)
├── aiMaxAutoReplies (integer, default: 3)
├── aiTemperature (float, default: 0.7)
│
├── whatsappInstanceId → whatsapp_instances.id
├── createdAt
└── updatedAt
```

### 5.5 — CampaignLeads (vínculo lead ↔ campanha)

```
campaign_leads
├── id (cuid)
├── campaignId → campaigns.id
├── leadId → leads.id
├── organizationId → organizations.id
├── campaignScore (integer)
├── campaignScoreBreakdown (text/JSON)
├── status ("pending" | "queued" | "sent" | "replied" | "converted" | "rejected" | "skipped")
├── pipelineStage ("new" | "approached" | "replied" | "interested" | "proposal" | "won" | "lost")
├── scheduledAt (timestamp, nullable)
├── contactedAt (timestamp, nullable)
├── autoRepliesSent (integer, default 0)
├── needsHumanReview (boolean, default false)
├── createdAt
└── updatedAt

UNIQUE(campaignId, leadId)
```

### 5.6 — Messages (espelhamento de conversas)

```
messages
├── id (cuid)
├── organizationId → organizations.id
├── leadId → leads.id
├── campaignLeadId → campaign_leads.id (nullable)
├── whatsappInstanceId → whatsapp_instances.id
├── direction ("inbound" | "outbound")
├── content (text)
├── mediaType ("text" | "image" | "audio" | "video" | "document" | null)
├── mediaUrl (nullable)
├── source ("manual" | "ai_auto" | "ai_approved" | "cadence" | "webhook")
├── aiGenerated (boolean, default false)
├── aiModel (nullable)
├── evolutionMessageId (nullable)
├── status ("pending" | "sent" | "delivered" | "read" | "failed")
├── sentAt (timestamp, nullable)
├── deliveredAt (timestamp, nullable)
├── readAt (timestamp, nullable)
├── createdAt
└── updatedAt

INDEX(leadId, createdAt)
INDEX(campaignLeadId, createdAt)
```

### 5.7 — Scoring Rules (configurável)

```
scoring_rules
├── id (cuid)
├── organizationId → organizations.id
├── objective ("sell_website" | "sell_ai_agent" | "sell_optimization" | "global")
├── field (text)
├── operator ("eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in")
├── value (text/JSON)
├── points (integer)
├── label (text)
├── active (boolean, default true)
├── createdAt
└── updatedAt
```

### 5.8 — AI Providers (multi-provider)

```
ai_providers
├── id (cuid)
├── organizationId → organizations.id
├── provider ("openai" | "anthropic" | "google" | "groq" | "together" | "fireworks" | "openai_compatible")
├── label (text)
├── apiKey (text, encrypted)
├── baseUrl (nullable, para OpenAI-compatible)
├── defaultModel (text)
├── availableModels (text/JSON, nullable)
├── isDefault (boolean)
├── isActive (boolean, default true)
├── createdAt
└── updatedAt
```

### 5.9 — Extraction Jobs

```
extraction_jobs
├── id (cuid)
├── organizationId → organizations.id
├── type ("apify_gmaps" | "rdap_whois" | "website_check")
├── status ("pending" | "running" | "completed" | "failed")
├── config (text/JSON)
├── apifyRunId (nullable)
├── totalFound (integer, default 0)
├── totalNew (integer, default 0)
├── totalDuplicate (integer, default 0)
├── totalEnriched (integer, default 0)
├── errorMessage (nullable)
├── startedAt (timestamp, nullable)
├── completedAt (timestamp, nullable)
├── createdAt
└── updatedAt
```

### 5.10 — Warm-up Configs

```
warmup_configs
├── id (cuid)
├── whatsappInstanceId → whatsapp_instances.id
├── organizationId → organizations.id
├── currentDay (integer, default 1)
├── currentDailyLimit (integer)
├── warmupCompleted (boolean, default false)
├── startedAt (timestamp)
├── completedAt (timestamp, nullable)
├── schedule (text/JSON)
│   [
│     { "days": [1,3],  "limit": 10 },
│     { "days": [4,7],  "limit": 25 },
│     { "days": [8,14], "limit": 50 },
│     { "days": [15,999], "limit": 80 }
│   ]
├── createdAt
└── updatedAt
```

### 5.11 — Audit Logs

```
audit_logs
├── id (cuid)
├── organizationId → organizations.id
├── userId → users.id (nullable)
├── action (text)
├── entityType (text)
├── entityId (text)
├── metadata (text/JSON)
├── createdAt

INDEX(organizationId, createdAt)
INDEX(entityType, entityId)
```

### 5.12 — Message Templates (snippets)

```
message_templates
├── id (cuid)
├── organizationId → organizations.id
├── shortcut (text, ex: "preco", "portfolio", "agendar")
├── title (text)
├── content (text)
├── category (nullable)
├── createdAt
└── updatedAt

UNIQUE(organizationId, shortcut)
```

### Relações

```
Organization
 ├── Users
 ├── WhatsApp Instances → Warm-up Configs
 ├── AI Providers
 ├── Scoring Rules
 ├── Message Templates
 ├── Extraction Jobs
 ├── Audit Logs
 ├── Leads → Messages
 └── Campaigns → CampaignLeads → Messages
```

---

## 6. Filas, Cadência e Anti-ban

### 6.1 — Arquitetura de Filas (BullMQ)

| Fila | Função | Concurrency |
|---|---|---|
| `extraction` | Runs Apify, Google Maps | 2 |
| `enrichment` | RDAP, website check, scoring, AI classification | 5 |
| `cadence` | Seleciona msg, aplica variação, agenda envio | 1 |
| `ai-reply` | Gera resposta IA para leads que responderam | 3 |
| `message-send` | Envio real via Evolution API (gargalo único) | 1, rate limited |
| `scheduler` | Cron jobs: alimentar cadence, reset counters, health check | repeatable |

### 6.2 — Fluxo de Cadência

1. **Scheduler** (cron, a cada 1 min) verifica: dentro da janela? abaixo do limite? instância conectada?
2. Busca leads elegíveis: `campaign_leads WHERE status = "pending" ORDER BY campaignScore DESC`
3. Enfileira na fila `cadence` com **delay escalonado randômico** (3-5 min entre cada)
4. Consumer da `cadence` seleciona variante de mensagem, aplica micro-variações
5. Enfileira na `message-send` (gargalo único, 1 por vez, 8-15s entre envios)
6. `message-send` chama Evolution API, registra resultado, atualiza contadores

### 6.3 — 7 Camadas Anti-ban

| # | Camada | Implementação |
|---|---|---|
| 1 | **Warm-up progressivo** | Dia 1-3: 10/dia → Dia 4-7: 25 → Dia 8-14: 50 → Dia 15+: 80 |
| 2 | **Intervalos randômicos** | 3-5 min entre leads, 8-15s micro-delay no envio |
| 3 | **Pausas longas** | A cada ~15 msgs, pausa 10-20 min (simula humano) |
| 4 | **Variação de conteúdo** | Pool mín 5 variantes + micro-variações (emoji, abreviação) |
| 5 | **Janela de horário** | Só envia no período configurado, com variação no início (±15min) |
| 6 | **Limites diários rígidos** | Min(instância.limit, campanha.limit), reset à meia-noite |
| 7 | **Detecção de risco** | Monitor taxa de delivery fail >20%/h → auto-pause |

### 6.4 — Comportamento Natural

- Envia status "composing" (digitando) via Evolution API antes de enviar
- Delay proporcional ao tamanho da mensagem (simula leitura + digitação)
- Presença online durante janela de envio

### 6.5 — Fluxo de Resposta IA

1. Webhook recebe mensagem inbound → salva → atualiza status
2. Verifica: `aiEnabled` e `autoRepliesSent < aiMaxAutoReplies`?
3. Se sim: enfileira na `ai-reply`
4. Worker monta contexto (system prompt + dados lead + histórico)
5. Chama LLM via AI SDK (`generateText`)
6. Delay 30s-3min → "composing" → envia via `message-send`
7. Se limite atingido: marca `needsHumanReview = true`

### 6.6 — Worker Process

```
worker.ts (processo separado, rodado com tsx watch)

Consumers:
  extraction    → processExtraction    (concurrency: 2)
  enrichment    → processEnrichment    (concurrency: 5)
  cadence       → processCadence       (concurrency: 1)
  ai-reply      → processAiReply       (concurrency: 3)
  message-send  → processMessageSend   (concurrency: 1, rate limited)

Cron jobs:
  feed-cadence     → */1 * * * *    (a cada 1 min)
  reset-counters   → 0 0 * * *      (meia-noite)
  health-check     → */5 * * * *    (a cada 5 min)
  warmup-advance   → 0 1 * * *      (01:00)
```

---

## 7. Interface (UI)

### 7.1 — Direção Estética

**Conceito:** Minimalismo Moderno — "Precision Tool"
**Referências:** Linear, Attio, Raycast, Vercel Dashboard
**Tema:** Dark mode como padrão, light mode como opção

**Paleta (dark mode):**
- Background: `#0A0A0B`
- Surface: `#141416`
- Border: `#1F1F23`
- Text: `#EDEDEF`
- Text muted: `#71717A`
- Accent/Primary: `#3B82F6` (azul)
- Score hot: `#F97316` (laranja)
- Success: `#22C55E`
- Warning: `#EAB308`
- Danger: `#EF4444`

**Tipografia:**
- Display/Números: Instrument Serif ou Fraunces
- UI/Body: Geist ou Satoshi
- Mono: Geist Mono

### 7.2 — Navegação (5 itens)

```
┌──────────────────────────────────────────────────────────────┐
│  ProspectAI            ⌘K              🔔 3    ⚙️    Pedro  │
│──────────────────────────────────────────────────────────────│
│  5 não lidas · 2 aguardam revisão · 3 campanhas ativas      │
│  📱 +5511... dia 18 warm-up · 34/80 msgs · entrega 97% 🟢   │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│  Inbox   │  [Conteúdo da tela ativa]                         │
│  Leads   │                                                   │
│  Campan. │                                                   │
│  Extração│                                                   │
│          │                                                   │
│  ──────  │                                                   │
│  Config  │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

- **Status bar persistente** (2 linhas) substitui o Dashboard
- **Command Palette** (`⌘K`) para navegação rápida
- **Notificações** (`🔔`) para eventos críticos

### 7.3 — Inbox (tela principal, ~70% do tempo)

Layout 3 colunas:
1. **Fila priorizada** — conversas que precisam de ação, ordenadas por score + urgência
2. **Conversa** — chat com sugestão IA como card editável (Aprovar/Editar/Pular)
3. **Contexto do lead** — dados, score breakdown, campanha, botão "Marcar como"

Funcionalidades:
- Filtros: "Precisa ação", "Todas", "Não lidas", "Aguardando IA"
- Botão "Próximo" para workflow de fila
- `/snippets` para templates rápidos
- "Gerar com IA" para sugestão manual
- Marcar outcome (Interessado/Proposta/Ganho/Perdido) inline
- Tags de origem nas mensagens: cadência, IA auto, IA aprovada, manual
- Mobile responsivo: colapsa para fila → tap abre conversa

### 7.4 — Leads (tabela + board toggle)

**Tabela:**
- Colunas: Nome, Categoria, Cidade, Score (badge colorido), Último contato, Status
- Indicador "stale" para leads sem resposta há >3 dias
- Hover actions inline: [+ Campanha] [Conversa] [→ Stage]
- Score explanation no hover (tooltip), detalhes completos no drawer
- Filtros: categoria, cidade, score range, status, tem site, campanha, classificação IA
- Bulk actions: adicionar à campanha, exportar, excluir

**Board (toggle):**
- 5 colunas: Novo | Contatado | Interessado | Proposta | Fechado (won/lost com badge)
- Cards: nome, score badge, última mensagem (snippet), dias no stage
- Drag & drop com spring physics (dnd-kit)
- Filtros: campanha, score range, dias no stage
- Column collapsing + contadores

### 7.5 — Campanhas

Cards de campanha com: objetivo, instância, leads, enviados, taxa resposta, IA model, cadência.
Botão de pausa/retomada prominente.

**Wizard de criação (3 passos):**
1. **Objetivo + Filtros + Preview:** Dropdown de objetivo → filtros automáticos → "342 leads, 89 com score > 60"
2. **Cadência + Mensagens + IA:** Instância, horários, intervalos, variantes de mensagem (mín 5), provider IA, system prompt, limites
3. **Revisão + Simulação:** Resumo completo + "534 leads, ~11 dias úteis, conclusão 12/03" + verificação de safety

### 7.6 — Extração

- Formulário simples: query + cidade + estado + max resultados
- Saved searches / presets para extrações recorrentes
- Lista de jobs com progresso e resumo (encontrados / novos / duplicados)
- Link direto para ver leads extraídos

### 7.7 — Configurações

Tabs: Conta | WhatsApp | IA & Modelos | Lead Scoring | Templates | Avançado

- **WhatsApp:** Conectar/desconectar instâncias, QR code, warm-up config, limites
- **IA & Modelos:** Providers com apiKey, baseUrl (OpenAI-compatible), modelo default, botão "Testar"
- **Lead Scoring:** Regras por objetivo, campo/operador/valor/pontos, botão "Recalcular todos"
- **Templates:** Snippets com shortcut (`/preco`, `/portfolio`), título, conteúdo
- **Avançado:** Webhooks, export dados, danger zone

### 7.8 — Command Palette (`⌘K`)

- Busca global: leads, campanhas, ações
- Ações rápidas: nova extração, criar campanha, conectar WhatsApp
- Filtros rápidos: "leads score > 80", "sem resposta há 3+ dias"
- Navegação: ir para qualquer tela

### 7.9 — Notificações

Eventos notificados:
- Lead com score alto respondeu
- Campanha auto-pausou (alto block rate)
- Instância desconectou
- IA com confiança baixa pediu revisão
- Extração concluída

Browser push notifications + badge no ícone + painel de notificações no app.

### 7.10 — Componentes shadcn/ui planejados

| Componente | Uso |
|---|---|
| DataTable | Lista de leads |
| Sheet (drawer) | Detalhes do lead |
| Card | Kanban cards, campaign cards |
| Dialog | Wizard de campanha, confirmações |
| Tabs | Settings, filtros |
| Badge | Status, score tier, classificação IA |
| Command | Command palette (`⌘K`) |
| Sonner (toast) | Notificações inline |
| Form + Zod | Formulários validados |
| DnD Kit | Drag & drop no kanban |

---

## 8. Pilares de Dados (requisitos do Pedro)

| Pilar | Onde está |
|---|---|
| **(a) Dados brutos** | `leads` — bloco DADOS BRUTOS |
| **(b) Dados enriquecidos** | `leads` — bloco DADOS ENRIQUECIDOS |
| **(c) Filtros por campanha/serviço** | `campaigns.filters` + `campaigns.objective` |
| **(d) Score + explicação** | `leads.score/scoreBreakdown/scoreExplanation` + `scoring_rules` + `campaign_leads.campaignScore` |
| **(e) Trilha/histórico** | `audit_logs` + `messages` + `extraction_jobs` |

---

## 9. Prioridade de Implementação

| Prioridade | Componente | Razão |
|---|---|---|
| P0 | Auth + Multi-tenant (Better Auth) | Base de tudo |
| P0 | Schema Drizzle + Turso | Sem banco, sem nada |
| P0 | Integração Evolution API (conectar + webhook) | Core do produto |
| P0 | Inbox (conversas + fila) | 70% do uso diário |
| P0 | Leads (tabela) | Gestão de dados |
| P1 | Campanhas (criar + executar) | Motor de receita |
| P1 | Worker + Cadência + Anti-ban | Automação do envio |
| P1 | Extração (Apify + RDAP) | Alimenta o pipeline |
| P1 | IA (AI SDK multi-provider) | Escala a conversa |
| P2 | Leads (board view / kanban) | Visualização pipeline |
| P2 | Scoring + Classificação IA | Priorização inteligente |
| P2 | Status bar + Notificações | Awareness operacional |
| P3 | Command Palette | Power user speed |
| P3 | Templates/Snippets | Produtividade |
| P3 | Warm-up automático | Safety avançado |
