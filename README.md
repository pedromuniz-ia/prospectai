# ProspectAI

Plataforma B2B de prospecção inteligente. Extrai leads do Google Maps, enriquece com dados multi-fonte (website, WhatsApp, Instagram, RDAP), classifica com IA e gerencia outreach automatizado via WhatsApp.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui
- **Backend**: Server Actions, Drizzle ORM, Turso (LibSQL/SQLite)
- **Workers**: BullMQ + Redis para processamento em background
- **Integrações**: Apify (Google Maps), Evolution API (WhatsApp), Claude/GPT/Gemini (classificação IA)
- **Deploy**: Docker Swarm, GitHub Actions CI/CD, Cloudflare Tunnel

## Setup Local

### Pré-requisitos

- Node.js 20+
- Redis (via Docker ou local)
- Chaves de API (ver `.env.example`)

### Instalação

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas chaves

# Subir Redis
docker compose up redis -d

# Aplicar migrations do banco
npx drizzle-kit migrate

# Rodar em dois terminais
npm run dev          # Next.js (porta 3000)
npm run worker       # BullMQ workers
```

## Scripts

| Comando | Descrição |
| ------- | --------- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run worker` | Workers BullMQ (watch mode) |
| `npm run worker:prod` | Workers BullMQ (produção) |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npx drizzle-kit generate` | Gerar migration a partir do schema |
| `npx drizzle-kit migrate` | Aplicar migrations pendentes |

## Arquitetura

```text
Browser → Next.js Server Components / Server Actions
  → Drizzle ORM → Turso (SQLite)
  → Redis BullMQ → Workers
  → APIs externas: Apify, Evolution API, LLMs
```

### Workers

| Worker | Função |
| ------ | ------ |
| `extraction` | Extrai resultados do Google Maps via Apify |
| `enrichment` | Pipeline: website → WhatsApp → Instagram → RDAP → IA → score |
| `cadence` | Processa sequências de mensagens agendadas |
| `ai-reply` | Gera respostas automáticas para mensagens WhatsApp |
| `message-send` | Envia mensagens WhatsApp via Evolution API |
| `scheduler` | Cron: alimenta fila de cadência, reset de contadores, warmup |

## Deploy

Deploy via Docker Swarm com CI/CD automatizado:

1. Push na `main` → GitHub Actions roda testes + build
2. Imagem Docker publicada no GHCR
3. Deploy automático na VPS via SSH + `docker service update`

Stack files em `deploy/` para uso com Portainer.

## Licença

Proprietário. Todos os direitos reservados.
