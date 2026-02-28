# ProspectAI — Deployment Design

**Data:** 2026-02-28
**Stack:** Docker Swarm + Cloudflare Tunnel + GitHub Actions + Portainer

## Contexto

- VPS Contabo, Debian 12, 8+ GB RAM
- Docker Swarm (single-node) já configurado
- Portainer para gerenciar stacks
- Redis já ativo na rede `network_swarm_public`
- Cloudflared já ativo na mesma rede (tunnel → Cloudflare)
- Domínio próprio com DNS no Cloudflare
- Repo: https://github.com/pedromuniz-ia/prospectai.git (primeiro push pendente)

## Arquitetura

```
VPS (Docker Swarm)
  rede: network_swarm_public (externa, já existe)

  Stack: redis        ← JÁ EXISTE
  Stack: cloudflared  ← JÁ EXISTE (tunnel aponta tráfego para app:3000)
  Stack: portainer    ← JÁ EXISTE

  Stack: prospectai-app     ← NOVO (Next.js :3000)
  Stack: prospectai-worker  ← NOVO (BullMQ workers)
```

### Stacks

**prospectai-app** — Next.js server
- 1 replica, conecta à `network_swarm_public`
- Porta 3000 acessível pelo Cloudflared na rede interna
- Healthcheck: `curl -f http://localhost:3000/api/health`
- Rolling update: `parallelism 1, delay 10s, failure_action rollback`
- Env vars via `.env.production` no Portainer ou Docker secrets

**prospectai-worker** — BullMQ workers
- 1 replica, conecta à `network_swarm_public` (acessa Redis)
- Sem porta exposta
- Command override: `npm run worker:prod`
- Restart: on-failure

Ambos usam a **mesma imagem Docker** (`ghcr.io/pedromuniz-ia/prospectai`), diferenciando pelo command.

## CI/CD Pipeline

```
Trigger: push to main

Jobs:
  1. test:
     - npm ci
     - npm run lint
     - npm test

  2. build-and-push (needs: test):
     - Docker build multi-stage
     - Push para GHCR com tags :latest e :sha-xxxxxxx

  3. deploy (needs: build-and-push):
     - SSH na VPS
     - docker pull ghcr.io/pedromuniz-ia/prospectai:latest
     - docker service update --image ... prospectai-app_app
     - docker service update --image ... prospectai-worker_worker
```

### GitHub Secrets necessários
- `VPS_HOST` — IP da VPS Contabo
- `VPS_USER` — usuário SSH (recomendado: `deploy`, não root)
- `VPS_SSH_KEY` — chave privada SSH
- `ENV_PRODUCTION` — conteúdo do `.env.production` (ou secrets individuais)

## Rollback

- Swarm mantém imagem anterior: `docker service rollback prospectai-app_app`
- Imagens tagueadas com SHA no GHCR para deploy de versão específica
- Rollback automático se healthcheck falhar (configurado no update_config)

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `deploy/app-stack.yml` | Novo | Stack file Swarm para Next.js app |
| `deploy/worker-stack.yml` | Novo | Stack file Swarm para BullMQ worker |
| `.github/workflows/deploy.yml` | Novo | CI/CD pipeline completa |
| `Dockerfile` | Melhorar | Healthcheck, .dockerignore, otimizar layers |
| `.dockerignore` | Novo | Excluir .git, node_modules, docs, etc. |
| `src/app/api/health/route.ts` | Novo | Health check endpoint |

## Setup inicial (manual, uma vez)

1. Configurar remote Git e fazer primeiro push
2. Na VPS: criar usuário `deploy`, configurar SSH key
3. Na VPS: fazer login no GHCR (`docker login ghcr.io`)
4. No GitHub: configurar Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)
5. No Portainer: criar stacks `prospectai-app` e `prospectai-worker` com os YAML
6. No Cloudflare: configurar tunnel para apontar `dominio.com → http://prospectai-app_app:3000`

## Segurança

- SSH key dedicada para deploy (não reutilizar chave pessoal)
- Usuário `deploy` sem sudo (só precisa de acesso ao Docker socket)
- Secrets no GitHub (criptografados)
- Firewall: apenas portas 22 (SSH) e nenhuma outra aberta (Cloudflare Tunnel não precisa de porta aberta)
- GHCR packages como private
