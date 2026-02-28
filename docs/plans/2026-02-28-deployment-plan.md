# ProspectAI Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy ProspectAI to a Contabo VPS using Docker Swarm with CI/CD via GitHub Actions, Cloudflare Tunnel for HTTPS, and Portainer for stack management.

**Architecture:** Two separate Docker Swarm stacks (app + worker) sharing the same Docker image from GHCR. GitHub Actions runs tests, builds the image, pushes to GHCR, then SSH-deploys via `docker service update`. Redis and Cloudflared are pre-existing services on the VPS.

**Tech Stack:** Docker Swarm, GitHub Actions, GHCR, Cloudflare Tunnel, Portainer, Debian 12

---

### Task 1: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

**Step 1: Create the `.dockerignore` file**

```dockerignore
node_modules
.next
.git
.gitignore
.env*
*.md
docs/
coverage/
.vscode/
.claude/
local.db
local.db-*
migrations/meta
.DS_Store
*.pem
```

**Step 2: Verify the file exists**

Run: `cat .dockerignore`
Expected: File contents shown above

**Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for optimized Docker builds"
```

---

### Task 2: Improve Dockerfile

**Files:**
- Modify: `Dockerfile`

The current Dockerfile works but needs: healthcheck with curl, non-root user, and the `src/` copy is needed for the worker (`tsx src/worker.ts`).

**Step 1: Rewrite the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "run", "start"]
```

Key changes from the original:
- Added `curl` for healthcheck
- Added non-root user `nextjs` (security)
- Added `HEALTHCHECK` instruction for Swarm rolling updates
- Everything else stays the same

**Step 2: Verify the Dockerfile is valid syntax**

Run: `docker build --check .` (or just visually inspect)

**Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: improve Dockerfile with healthcheck and non-root user"
```

---

### Task 3: Create Health Check Endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

**Step 1: Create the health endpoint**

```typescript
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
```

This is intentionally simple — just confirms the Next.js server is responding. No DB check needed (Turso is remote, and the health of the Turso connection is not something a Docker healthcheck should gate on).

**Step 2: Test locally**

Run: `npm run dev` then in another terminal: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

**Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add /api/health endpoint for Docker healthcheck"
```

---

### Task 4: Create App Stack File

**Files:**
- Create: `deploy/app-stack.yml`

**Step 1: Create the `deploy/` directory and stack file**

```yaml
version: "3.9"

services:
  app:
    image: ghcr.io/pedromuniz-ia/prospectai:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=${REDIS_URL}
      - TURSO_CONNECTION_URL=${TURSO_CONNECTION_URL}
      - TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=${BETTER_AUTH_URL}
      - APIFY_TOKEN=${APIFY_TOKEN}
      - EVOLUTION_API_URL=${EVOLUTION_API_URL}
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    networks:
      - swarm_public
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      rollback_config:
        parallelism: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  swarm_public:
    external: true
    name: network_swarm_public
```

Note: Env vars are set via Portainer's stack environment variables UI. The `${VAR}` syntax lets Portainer substitute them.

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('deploy/app-stack.yml'))"` or visually inspect.

**Step 3: Commit**

```bash
git add deploy/app-stack.yml
git commit -m "chore: add Swarm stack file for Next.js app"
```

---

### Task 5: Create Worker Stack File

**Files:**
- Create: `deploy/worker-stack.yml`

**Step 1: Create the worker stack file**

```yaml
version: "3.9"

services:
  worker:
    image: ghcr.io/pedromuniz-ia/prospectai:latest
    command: npm run worker:prod
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
      - TURSO_CONNECTION_URL=${TURSO_CONNECTION_URL}
      - TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
      - APIFY_TOKEN=${APIFY_TOKEN}
      - EVOLUTION_API_URL=${EVOLUTION_API_URL}
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY}
    networks:
      - swarm_public
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  swarm_public:
    external: true
    name: network_swarm_public
```

No ports exposed — worker only connects outbound to Redis and external APIs.

**Step 2: Commit**

```bash
git add deploy/worker-stack.yml
git commit -m "chore: add Swarm stack file for BullMQ worker"
```

---

### Task 6: Create GitHub Actions CI/CD Pipeline

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create directory structure**

```bash
mkdir -p .github/workflows
```

**Step 2: Create the workflow file**

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            docker pull ghcr.io/${{ github.repository }}:latest
            docker service update --image ghcr.io/${{ github.repository }}:latest prospectai-app_app --with-registry-auth
            docker service update --image ghcr.io/${{ github.repository }}:latest prospectai-worker_worker --with-registry-auth
```

Key details:
- `test` job runs lint + tests (with `--run` flag for vitest non-watch mode)
- `build-and-push` builds the Docker image and pushes to GHCR with `:latest` and `:sha` tags
- `deploy` SSHs into VPS and does rolling update of both services
- `--with-registry-auth` passes GHCR credentials to the Swarm node for pulling the image
- `GITHUB_TOKEN` is auto-provided for GHCR auth — no extra secret needed for that

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions pipeline for build and deploy"
```

---

### Task 7: Configure Git Remote and First Push

**Files:**
- No file changes — git operations only

**Step 1: Add the GitHub remote**

```bash
git remote add origin https://github.com/pedromuniz-ia/prospectai.git
```

**Step 2: Verify remote**

```bash
git remote -v
```
Expected:
```
origin  https://github.com/pedromuniz-ia/prospectai.git (fetch)
origin  https://github.com/pedromuniz-ia/prospectai.git (push)
```

**Step 3: Push all code to main**

```bash
git push -u origin main
```

Expected: All commits pushed to GitHub. Verify at https://github.com/pedromuniz-ia/prospectai

Note: The first push will trigger the GitHub Actions workflow. It will fail at the `deploy` step because VPS secrets aren't configured yet — that's expected and fine. The `test` and `build-and-push` jobs should succeed.

---

### Task 8: VPS Setup (Manual — Run on VPS via SSH)

This task is a **manual checklist** to be run on the VPS. Not automated by Claude.

**Step 1: Create deploy user on VPS**

```bash
# SSH into VPS as root
ssh root@<VPS_IP>

# Create deploy user and add to docker group
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# Set up SSH key auth for deploy user
mkdir -p /home/deploy/.ssh
# Copy your public key (generated in Step 2) to authorized_keys
echo "<YOUR_PUBLIC_KEY>" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

**Step 2: Generate SSH key pair for CI/CD**

On your local machine:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/prospectai_deploy -N ""
```

- Public key (`~/.ssh/prospectai_deploy.pub`) → goes into VPS `/home/deploy/.ssh/authorized_keys`
- Private key (`~/.ssh/prospectai_deploy`) → goes into GitHub Secret `VPS_SSH_KEY`

**Step 3: Login to GHCR on VPS**

```bash
# SSH as deploy user
ssh deploy@<VPS_IP>

# Create a GitHub Personal Access Token (PAT) with `read:packages` scope
# Then login:
echo "<PAT>" | docker login ghcr.io -u pedromuniz-ia --password-stdin
```

**Step 4: Configure GitHub Secrets**

Go to https://github.com/pedromuniz-ia/prospectai/settings/secrets/actions and add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | IP address of Contabo VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/prospectai_deploy` (private key) |

**Step 5: Deploy stacks via Portainer**

1. Open Portainer UI
2. Create stack `prospectai-app`:
   - Paste contents of `deploy/app-stack.yml`
   - Add environment variables (REDIS_URL, TURSO_CONNECTION_URL, etc.)
3. Create stack `prospectai-worker`:
   - Paste contents of `deploy/worker-stack.yml`
   - Add environment variables

**Step 6: Configure Cloudflare Tunnel**

In Cloudflare Zero Trust Dashboard → Tunnels → your tunnel → Public Hostnames:
- Add route: `yourdomain.com` → `http://prospectai-app_app:3000`

**Step 7: Test the full pipeline**

Make a small commit, push to main, and verify:
1. GitHub Actions runs all 3 jobs (test → build → deploy)
2. New image appears in GHCR
3. `docker service ls` on VPS shows services updated
4. `https://yourdomain.com/api/health` returns `{"status":"ok"}`

---

## Summary of GitHub Secrets Needed

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH user (recommend `deploy`) |
| `VPS_SSH_KEY` | Ed25519 private key for SSH |

`GITHUB_TOKEN` is automatically available — no need to create it.

## Quick Reference: Day-to-Day Operations

```bash
# Rollback app to previous version
docker service rollback prospectai-app_app

# Rollback worker
docker service rollback prospectai-worker_worker

# Deploy specific version (by commit SHA)
docker service update --image ghcr.io/pedromuniz-ia/prospectai:<sha> prospectai-app_app

# View logs
docker service logs prospectai-app_app -f
docker service logs prospectai-worker_worker -f

# Check service status
docker service ls
docker service ps prospectai-app_app
```
