# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Start all services in parallel (API on :3001, web on :5173, worker)
pnpm dev

# Start individual services
pnpm dev:api
pnpm dev:worker
pnpm dev:web

# Build all packages (in dependency order: shared → api/worker → web)
pnpm build

# Type-check all packages
pnpm typecheck

# Database
pnpm db:migrate      # Run migrations interactively
pnpm db:deploy       # Apply migrations (non-interactive, for CI/prod)
pnpm db:generate     # Regenerate Prisma client after schema changes
pnpm db:studio       # Open Prisma Studio at localhost:5555
```

## Architecture

ThreadGraph2 is a pnpm monorepo (`packages/*`) with four packages that convert conversation transcripts into interactive knowledge graphs.

### Packages

- **`packages/shared`** — Zod schemas and TypeScript types (`Span`, `GraphNode`, `GraphEdge`, `GraphCluster`, `RawTurn`, `Graph`). All other packages depend on this; build it first.
- **`packages/api`** — Hono REST API server. Handles auth (better-auth, email/password + sessions), graph CRUD, job submission, and user API key management. Encrypted Anthropic keys are stored per-user in PostgreSQL.
- **`packages/worker`** — BullMQ worker (concurrency: 2) that pulls jobs from the Redis `parse-thread` queue and runs the 3-pass Claude pipeline. Graceful SIGTERM shutdown included.
- **`packages/web`** — React + Vite frontend (Tailwind CSS, Zustand auth store, `@xyflow/react` for graph canvas). Dev server proxies `/api` to `$VITE_API_URL`.

### Core Data Flow

1. User submits transcript via web UI → API creates `Graph` + `Job` records in PostgreSQL and enqueues to Redis.
2. Worker processes the job through three Claude (`claude-sonnet-4-6`) passes:
   - **Pass 1** (4096 tokens max): Extract semantic spans from raw turns.
   - **Pass 2** (16000 tokens max): Derive nodes (insights, decisions, questions, etc.) from spans.
   - **Pass 3** (4096 tokens max): Build edges (relationships) and clusters.
3. Complete `graph_json` + token usage stats are saved to the `Graph` record; job marked complete.
4. Web polls job status, then fetches and renders the graph on `/canvas/:id`.

### Key External Dependencies

- **PostgreSQL** — all persistent data (users, sessions, graphs, jobs) via Prisma ORM.
- **Redis** — BullMQ queue for async job processing.
- **Anthropic API** — per-user encrypted key stored in DB; fallback to `ANTHROPIC_API_KEY` env var when `DISABLE_AUTH=true`.

### Environment Variables

Key variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ENCRYPTION_SECRET` | 64-char hex key for encrypting stored Anthropic API keys |
| `SESSION_SECRET` | Session signing secret |
| `DISABLE_AUTH` | Set `true` to skip auth (uses `ANTHROPIC_API_KEY` env var instead of per-user key) |
| `ANTHROPIC_API_KEY` | Fallback key used when `DISABLE_AUTH=true` |
| `VITE_API_URL` | Frontend proxy target for `/api` requests |

### TypeScript Configuration

- Target: ES2022, module: NodeNext (ESM throughout).
- Strict mode enabled across all packages.
- After editing `packages/shared`, rebuild it (`pnpm --filter shared build`) before dependent packages will pick up type changes.
