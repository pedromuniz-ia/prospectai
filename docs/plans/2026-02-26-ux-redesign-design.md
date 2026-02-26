# ProspectAI — UX Redesign: Design System + Full Page Redesign

**Data:** 2026-02-26
**Abordagem:** Design System First — criar componentes e padrões antes de aplicar às páginas
**Escopo:** Produto inteiro (todas as 16 rotas + app shell)
**Princípio:** Progressive disclosure — simples por padrão, poder escondido para quem precisa
**Público-alvo:** Mix de perfis (dono de agência, vendedor/SDR, dev) — produto precisa funcionar para todos

---

## 1. Camada de Tradução (`src/lib/i18n.ts`)

Arquivo centralizado que mapeia todos os enums do banco para labels humanos em PT-BR.

### 1.1 — Mapas de Enum

| Domínio | Chave → Label |
|---|---|
| **Lead status** | `new` → "Novo", `enriched` → "Qualificado", `scored` → "Pontuado", `queued` → "Na fila", `contacted` → "Contatado", `replied` → "Respondeu", `interested` → "Interessado", `proposal` → "Proposta", `won` → "Ganho", `lost` → "Perdido", `blocked` → "Bloqueado" |
| **Pipeline stage** | `new` → "Novo", `approached` → "Abordado", `replied` → "Respondeu", `interested` → "Interessado", `proposal` → "Proposta", `won` → "Ganho", `lost` → "Perdido" |
| **Campaign status** | `draft` → "Rascunho", `active` → "Ativa", `paused` → "Pausada", `completed` → "Concluída" |
| **Campaign objective** | `sell_website` → "Vender Website", `sell_ai_agent` → "Vender Agente IA", `sell_optimization` → "Vender Otimização", `sell_automation` → "Vender Automação", `custom` → "Personalizado" |
| **AI provider** | `openai` → "OpenAI", `anthropic` → "Anthropic", `google` → "Google Gemini", `groq` → "Groq", `together` → "Together AI", `fireworks` → "Fireworks AI", `openai_compatible` → "Custom (OpenAI Compatible)" |
| **Message source** | `manual` → "Manual", `ai_auto` → "IA (auto)", `ai_approved` → "IA (aprovada)", `cadence` → "Cadência", `webhook` → "WhatsApp" |
| **Scoring operator** | `eq` → "é igual a", `neq` → "é diferente de", `gt` → "é maior que", `lt` → "é menor que", `gte` → "é pelo menos", `lte` → "é no máximo", `in` → "contém", `not_in` → "não contém" |
| **Scoring field** | `hasWebsite` → "Tem website", `googleRating` → "Avaliação Google", `googleReviewCount` → "Nº de avaliações", `hasInstagram` → "Tem Instagram", `hasGoogleBusiness` → "Tem Google Business", `websiteStatus` → "Status do website", `hasSsl` → "Tem SSL" |
| **Job type** | `apify_gmaps` → "Google Maps", `rdap_whois` → "Verificação RDAP", `website_check` → "Verificação de Website" |
| **Job status** | `pending` → "Pendente", `running` → "Em andamento", `completed` → "Concluído", `failed` → "Falhou" |
| **Instance status** | `disconnected` → "Desconectado", `connecting` → "Conectando", `connected` → "Conectado", `banned` → "Banido" |
| **Notification type** | `lead_replied` → "Lead respondeu", `campaign_paused` → "Campanha pausada", `instance_disconnected` → "Instância desconectada", `ai_needs_review` → "IA precisa de revisão", `extraction_complete` → "Extração concluída" |

### 1.2 — Helpers

- **`formatInterval(seconds: number): string`** — `180` → "3 minutos", `90` → "1 min 30s"
- **`formatScoringRule(rule): string`** — `{ field: "hasWebsite", operator: "eq", value: false, points: 10 }` → "Negócio sem website → +10 pts"
- **`formatRelativeDate(date): string`** — Reutilizar o `formatRelativeTime` existente em `helpers.ts`

---

## 2. Componentes do Design System (`src/components/ds/`)

### 2.1 — `FormField`
Campo de formulário padronizado com label uppercase tracking, helper text opcional, error state, required indicator. Substitui o padrão `<div><Label>...<Input>` repetido em todas as páginas.

### 2.2 — `ConfirmDialog`
Wrapper de `AlertDialog` shadcn para ações destrutivas. Props: `title`, `description`, `onConfirm`, `destructive?`, `confirmText?`. Loading state no botão de confirmação.

**Onde usar:** pausar campanha, deletar instância WhatsApp, deletar template, excluir organização.

### 2.3 — `LoadingButton`
Wrapper de `Button` shadcn com `loading: boolean`. Mostra spinner, desabilita durante loading, previne double-click.

**Onde usar:** todo botão que dispara server action (Testar, Salvar, Exportar, etc.)

### 2.4 — `EmptyState`
Componente para estados vazios. Props: `icon?`, `title`, `description`, `action?: { label, onClick | href }`.

**Onde usar:** lista vazia de providers, leads, campaigns, templates, conversations, etc.

### 2.5 — `StatusBadge`
Badge que traduz e coloriza enums automaticamente. Props: `domain` ("lead" | "campaign" | "pipeline" | "instance" | "job"), `value` (o enum cru). Usa mapa i18n internamente.

### 2.6 — `SlidePanel`
Painel lateral responsivo. Em desktop (>1280px): coluna inline fixa. Em telas menores: Sheet deslizante com botão toggle. Baseado no `Sheet` shadcn.

**Onde usar:** lead context no Inbox, lead detail nos Leads.

### 2.7 — `TimeRangeInput`
Seletor de intervalo de horário com dois selects (hora + minuto) ou combobox de meia em meia hora. Validação nativa. Preview visual.

**Onde usar:** campaign wizard step 2 (scheduleStart/scheduleEnd).

### 2.8 — `IntervalDisplay`
Componente de exibição que humaniza intervalos. Props: `{ min: number, max: number, unit: "seconds" | "minutes" }`. Renderiza "3–5 min entre envios".

**Onde usar:** campaign cards, campaign wizard step 3 summary.

### 2.9 — `ModelSelector`
Combobox dinâmico que busca modelos do provider via API.

**Server action `listAvailableModels(providerId): Promise<Model[]>`:**

| Provider | Endpoint |
|---|---|
| OpenAI | `GET /v1/models` |
| Anthropic | `GET /v1/models` |
| Google Gemini | `GET /v1beta/models` |
| Groq | `GET /v1/models` (OpenAI-compatible) |
| Together | `GET /v1/models` (OpenAI-compatible) |
| Fireworks | `GET /v1/models` (OpenAI-compatible) |
| OpenAI Compatible | `GET {baseUrl}/models` |

**Comportamento:**
- Busca modelos quando provider é selecionado (com API key salva)
- Filtra modelos relevantes (chat/completion, ignora embeddings/fine-tunes)
- Cache no campo `availableModels` do banco (já existe, hoje sempre null)
- Combobox aceita texto livre como fallback
- Botão "Atualizar modelos" para re-fetch

### 2.10 — `TagInput`
Input de chips/tags para substituir campos CSV. Enter ou vírgula adiciona item. X ou backspace remove. Muito mais intuitivo que "Categorias (csv)".

**Onde usar:** campaign wizard step 1 (categorias, cidades).

---

## 3. Redesign de Páginas

### Princípios Universais

1. **Progressive disclosure** — campos avançados em seções colapsáveis
2. **Smart defaults** — auto-detectar valores quando possível
3. **Tradução universal** — nenhum enum cru via `StatusBadge` e mapa i18n
4. **Confirmação em ações destrutivas** — `ConfirmDialog`
5. **Loading states** — `LoadingButton` em todo botão async
6. **Mobile-first** — `SlidePanel` para painéis, touch sensors no DnD, fade indicators
7. **Empty states com CTA** — `EmptyState` com ação clara

---

### 3.1 — Settings: IA & Modelos

**Card "Adicionar provider":**
- **Provider** → Select com labels bonitos (via i18n): "OpenAI", "Anthropic", "Google Gemini"...
- **Label** → Auto-preenchido com nome do provider; editável
- **API Key** → Password input com toggle visibility (ícone olho)
- **Modelo padrão** → `ModelSelector` dinâmico
- **Base URL** → Só aparece quando provider = "Custom (OpenAI Compatible)"
- **Botão** → "Testar conexão e salvar" — `LoadingButton`, testa antes de salvar

**Card "Providers configurados":**
- Cada row: ícone do provider, label, modelo, badge "Padrão"
- Ações: "Testar" (LoadingButton), "Definir como padrão", "Editar" (dialog), "Remover" (ConfirmDialog)
- Funcionalidade nova: edição de providers existentes

---

### 3.2 — Settings: Conta/Geral

- Nome da organização: editável com "Salvar" ou `<p>` com lock se read-only
- "Slug" → "Identificador" com tooltip
- Remover "MVP" badges
- Equipe: lista de membros + convite. Features limitadas → "Em breve" elegante
- "Danger zone" → "Zona de risco" — ConfirmDialog pesado (digitar nome para confirmar)

---

### 3.3 — Settings: WhatsApp

- "Nome da instância" → "Dê um nome para este número (ex: Comercial, Suporte)"
- QR Code: countdown 20s + "Gerar novo QR" ao expirar
- Cards de instância: nome, telefone, StatusBadge traduzido, uso diário com progress bar
- Ações: tooltips + ConfirmDialog para desconectar/remover
- EmptyState: "Conecte seu primeiro número WhatsApp" + CTA

---

### 3.4 — Settings: Lead Scoring

- Regras em linguagem natural: "Negócio sem website → +10 pontos"
- Builder visual: selects traduzidos para campo, condição, valor (tipo dinâmico por campo)
- Objetivo: select traduzido
- "Criar regras padrão" em vez de "Seed default"
- "Recalcular pontuações" com progress indicator

---

### 3.5 — Settings: Warmup

- Card explicativo: "O warm-up protege seu número de ser banido..."
- Progresso visual: barra dia atual / dia 15
- Schedule: visualização bonita das fases (read-only)
- Override manual: seção colapsável com debounce 500ms nos inputs
- Select de instância no topo

---

### 3.6 — Settings: Templates

- Form limpo (campos vazios, sem dados sample)
- Atalho: input com prefixo "/" visual + validação inline `[a-z0-9-]`
- Edição: clicar abre dialog (usar `updateTemplate` existente)
- Preview: bolha de chat simulada
- Categorias: agrupar por category

---

### 3.7 — Settings: Avançado

- Webhook URL: input read-only + botão "Copiar"
- Integração Google Maps: server action para verificar token, não env var client-side
- Export: LoadingButton com feedback
- Remover referências a `.env.local`

---

### 3.8 — Settings: Layout

- `/settings` redireciona para `/settings/general`
- Mobile: scroll horizontal com fade gradient nas bordas
- Desktop: sidebar com ícones + labels completos

---

### 3.9 — Inbox

**Coluna Esquerda (Lista):**
- "Aguard. IA" → "IA pendente"
- Score: `StatusBadge` com cores
- Busca: campo no topo da lista
- "Próximo" → mover para header do ChatView, atalho "N"
- aria-labels nos botões de conversa

**Coluna Central (Chat):**
- **Ctrl+Enter / Cmd+Enter para enviar** (crítico!)
- Source labels: tooltip no hover, "webhook" → "WhatsApp"
- **AI suggestion + compose unificados**: área única que muda de modo
  - Com sugestão: texto + banner "Sugestão da IA" + "Enviar" / "Editar" / "Descartar"
  - Sem sugestão: compose normal
- Character count: `1234/4096` quando > 3000
- Template autocomplete: inserir no cursor, não substituir tudo
- Skeleton/shimmer durante loading
- Delivery status nas mensagens outbound (se Evolution API suportar)

**Coluna Direita (Contexto):**
- `SlidePanel`: inline >1280px, Sheet em telas menores com toggle
- Labels em PT-BR: "Detalhamento da pontuação", "Etapa do funil"
- Score bar: corrigir math (relativo ao máximo possível)
- Contato: telefone tel:, website href, cidade link para /leads?city=X
- Sem campanha: CTA "Adicionar a uma campanha"
- "não classificado" como texto muted, não badge

---

### 3.10 — Leads

**Filtros:**
- Categoria/cidade: buscar opções do servidor completo (não da página atual)
- Score: range min + max
- Status: adicionar select (já existe no schema)
- Bulk actions: hint visível antes de selecionar

**Table:**
- `StatusBadge` traduzido
- "stale" → "Inativo"
- Tooltips nos action buttons
- EmptyState com CTA
- Mobile: responsive cards

**Board:**
- TouchSensor + PointerSensor
- Card snippet: última mensagem ou categoria
- Optimistic update no drag
- Esconder paginação no board view
- Campaign selector único no topo
- Mobile: horizontal scroll com min-width

**Lead Detail Sheet:**
- Stage labels traduzidos
- "Ver conversa completa" link para inbox
- Contato clicável

---

### 3.11 — Campaigns

**Cards:**
- StatusBadge traduzido
- IntervalDisplay para cadence
- Datas: criação + última atividade
- "Taxa de resposta" em vez de "Reply rate"
- AI: nome provider + modelo ou "IA desativada"
- Pause/Resume: ConfirmDialog
- Grid: lg:grid-cols-2

**Wizard Step 1:**
- TagInput para categorias e cidades
- Preview 0 leads: CTA para ajustar filtros

**Wizard Step 2:**
- Intervalo em minutos (não segundos) + preview humanizado
- TimeRangeInput para horário
- 5 textareas separados (não newlines) + contador "3/5 variantes"
- AI config colapsável:
  - Provider: select traduzido
  - Modelo: ModelSelector dinâmico
  - Limite de respostas: label clara
  - Temperature: toggle nomeado ("Conservador"/"Balanceado"/"Criativo")
  - System prompt: "Instruções para a IA", seção avançada
- "Próximo": ArrowRight icon

**Wizard Step 3:**
- Objetivo traduzido
- Cadência em minutos
- Validar 5 variantes antes de chegar aqui

---

### 3.12 — Extraction

- Remover "Server-side" badge
- "Query de busca" → "Tipo de negócio"
- "Máximo de resultados" → "Quantidade de locais" + helper
- Preset: pedir nome ao salvar
- StatusBadge traduzido para jobs
- Job type traduzido
- Running sem dados: spinner indeterminado
- "Duplicados" com tooltip explicativo
- Botão cancelar jobs (se Apify suportar)

---

### 3.13 — App Shell

**Sidebar:**
- "Config" → "Configurações"
- Link para `/settings/general`
- Badge de notificação no "Inbox"
- Active state correto para sub-páginas

**StatusBar:**
- Esconder sem organização
- Multi-instância: uso consolidado
- Remover "entrega monitorada" → "WhatsApp ativo"

**CommandPalette:**
- Limpar busca ao fechar
- Remover/implementar shortcuts G I, G L, G S
- Score no slot correto
- Ícones semânticos

**NotificationBell:**
- "Marcar todas como lidas"
- Notifications clicáveis com navegação
- Lucide icons (não emojis)
- Auto-mark: todas visíveis

---

## 4. Bugs a Corrigir

| # | Bug | Arquivo | Fix |
|---|---|---|---|
| 1 | `process.env.APIFY_TOKEN` lido client-side — sempre undefined | settings/advanced | Mover para server action |
| 2 | Score bar math `min(points, 100)%` sem sentido | inbox/lead-context | Calcular relativo ao max possível |
| 3 | Warmup inputs fire API on every keystroke | settings/warmup | Debounce 500ms |
| 4 | Category/city filters from current page only | leads/page | Buscar do servidor completo |
| 5 | `/settings` renders blank children | settings/layout | Redirect para `/settings/general` |
| 6 | CommandPalette keeps previous search on reopen | command-palette | Reset state on close |
| 7 | Checkbox `"indeterminate"` coerced to true | leads/data-table | Handle properly |
| 8 | Board view snippet shows raw status enum | leads/board-view | Show last message or category |
| 9 | Pagination visible in board view | leads/page | Conditionally hide |
| 10 | No `<a>` skip-to-content for keyboard nav | dashboard/layout | Add accessibility link |

---

## 5. Ordem de Implementação Sugerida

### Fase 1: Foundation (Design System)
1. `src/lib/i18n.ts` — mapa de traduções
2. `src/components/ds/form-field.tsx`
3. `src/components/ds/confirm-dialog.tsx`
4. `src/components/ds/loading-button.tsx`
5. `src/components/ds/empty-state.tsx`
6. `src/components/ds/status-badge.tsx`
7. `src/components/ds/slide-panel.tsx`
8. `src/components/ds/time-range-input.tsx`
9. `src/components/ds/interval-display.tsx`
10. `src/components/ds/model-selector.tsx` + server action `listAvailableModels`
11. `src/components/ds/tag-input.tsx`

### Fase 2: Settings Redesign
12. Settings layout fix (redirect, mobile fade)
13. AI & Modelos
14. Conta/Geral
15. WhatsApp
16. Lead Scoring
17. Warmup
18. Templates
19. Avançado

### Fase 3: App Shell
20. Sidebar (labels, active states, badge)
21. StatusBar (hide when no org, multi-instance)
22. CommandPalette (cleanup, icons)
23. NotificationBell (labels, navigation, icons)

### Fase 4: Main Pages
24. Inbox (keyboard send, AI/compose unification, SlidePanel)
25. Leads (filters from server, StatusBadge, board fixes)
26. Campaigns (StatusBadge, IntervalDisplay, ConfirmDialog)
27. Campaign Wizard (TagInput, TimeRange, separate textareas, ModelSelector)
28. Extraction (labels, progress, cancel)

### Fase 5: Bug Fixes
29. Fix all 10 bugs listed in section 4
