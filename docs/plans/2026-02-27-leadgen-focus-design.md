# Design — ProspectAI: Lead Gen Focus

**Data:** 2026-02-27
**Status:** Aprovado

---

## Contexto

ProspectAI foi redefinido como uma **fábrica de leads qualificados** — focado exclusivamente em extração, enriquecimento e export de dados. Outreach ativo (WhatsApp automático, campanhas, inbox) sai do escopo e passa para n8n/ferramentas externas.

---

## Abordagem

**Clean first, build second** — remover tudo que não pertence antes de adicionar features novas. Garante que o código novo nasce sem dívida técnica.

---

## Fase 1 — Clean (Remover outreach)

### Páginas removidas
- `src/app/(dashboard)/inbox/` — conversas WhatsApp
- `src/app/(dashboard)/campaigns/` — wizard de campanha

### Workers removidos
- `src/workers/cadence.ts`
- `src/workers/ai-reply.ts`
- `src/workers/message-send.ts`
- `src/workers/scheduler.ts`

### Schema — tabelas removidas
- `campaigns`
- `campaign_contacts`
- `messages`
- `conversations`
- Migrations de DROP correspondentes geradas

### Limpeza de código
- `src/lib/queue.ts` — remover `cadenceQueue`, `aiReplyQueue`, `messageSendQueue`
- `src/worker.ts` — remover registro dos workers removidos
- `src/lib/actions/` — remover actions de campanha/mensagem/inbox
- `src/lib/evolution-api.ts` — manter apenas métodos usados pelo enrichment, remover `sendMessage` e afins
- Nav lateral — remover links Inbox e Campaigns

### O que permanece
Extraction, Enrichment, Leads, Settings, Auth.

---

## Fase 2 — Build (Novas features)

### Deduplicação melhorada

Hierarquia de dedup na extração:
1. `googlePlaceId` (mais confiável — identificador único do Google)
2. `phone` (normalizado)
3. `name + website`

### Export API

**Endpoint:** `GET /api/v1/leads`
**Auth:** `Authorization: Bearer <api-key>`

Query params:
```
min_score=70
has_whatsapp=true
has_website=true
classification=needs_website,needs_optimization
status=scored,enriched
limit=100
offset=0
since=2026-02-01T00:00:00Z
```

Resposta JSON paginada com todos os campos enriquecidos. Compatível com n8n HTTP Request node out-of-the-box.

### API Key

- Gerada em Settings → aba "Integrações"
- Uma chave ativa por organização; pode ser revogada e regenerada
- Armazenada como hash bcrypt (nunca em plain text)
- Exibida uma única vez na geração (padrão de segurança)

### Export manual

- Botão "Exportar" na UI de leads
- Respeita filtros ativos da tabela
- Formatos: CSV (planilha) e JSON (integração manual)
- Download direto no browser

---

## Fase 3 — Polish (UI de leads)

### Colunas configuráveis

Toggle de visibilidade por coluna, persistido em `localStorage` por organização.

| Coluna | Default |
|---|---|
| Score | ✅ |
| Status | ✅ |
| Classificação IA | ✅ |
| WhatsApp | ✅ |
| Website | ✅ |
| Instagram | ✅ |
| Rank no Maps | ✅ |
| Cidade | ✅ |
| Categoria | off |
| Email | off |
| Foto | off |
| Criado em | off |

### Novos dados na tabela

- **WhatsApp:** badge verde ✓ / cinza ✗ + ícone "B" dourado se Business account
- **Instagram:** badge com número de seguidores formatado (2.8k)
- **Rank:** pill `#3` com tooltip "3º no Maps para essa busca"
- **Foto:** thumbnail 32×32 rounded do negócio (quando disponível)
- **Score:** barra de progresso colorida (0-100) com valor numérico
- **Classificação IA:** chip colorido por tipo (`needs_website`, `needs_optimization`, etc.)

### Painel de colunas

- Abre via botão "Colunas" no header da tabela (ícone de sliders)
- Dropdown com lista de toggles, agrupados por categoria
- "Restaurar padrão" limpa o localStorage

### Export na tabela

- Botão "Exportar" ao lado dos filtros
- Dropdown: "Exportar CSV" / "Exportar JSON"
- Exporta a view atual (filtros + ordenação aplicados)
- Sem modal — ação direta

---

## Princípios de UI

- Design system existente: shadcn/ui + `src/components/ds/` (StatusBadge, SlidePanel)
- Nenhum componente novo de terceiros — usar o que já existe
- Feedback visual imediato (loading states, toasts)
- Tabela densa mas legível — dados enriquecidos não devem poluir, devem informar
- Ações destrutivas com confirmação; ações de leitura sem fricção

---

## Fora do escopo

- Envio automático de WhatsApp
- Gestão de conversas (inbox)
- Campanhas e cadências
- Score configurável via UI (já existe, não muda)
- Multi-idioma
