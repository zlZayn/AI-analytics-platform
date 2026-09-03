# AI Analytics Platform

English | [简体中文](README.md)

A natural-language data analytics platform for business users: connect PostgreSQL, ask questions in plain language, get charts and insights.

## What Problems It Solves

- Analyze data without writing SQL — ask questions in natural language; the AI generates and runs the structured query
- Connect databases without code — connection management, schema discovery, and data preview out of the box
- Visualize results directly — 10 chart types with user-adjustable column mappings
- Keep data safe — read-only transactions, parameterized queries, whitelist validation

Design philosophy and boundaries: [design-philosophy.md](docs/design-philosophy.md).

## Features

- **Natural-language analysis** - ask a question -> AI builds the query -> auto-execute -> chart; multi-turn conversations keep context
- **AI insights** - automatic insight suggestions, one-click execution and visualization
- **Connection management** - PostgreSQL CRUD, connection test, AES-encrypted passwords
- **Schema discovery** - automatic table scanning with cached snapshots and data preview
- **Data explorer** - table structure, column details, relations, data preview
- **SQL editor** - Monaco Editor with highlighting; run queries directly
- **Charting** - table, KPI, line, bar, pie/donut, scatter, histogram, boxplot, heatmap, correlation matrix; user-chosen mappings
- **Query management** - history and favorites with replay

## What the AI Can See

The AI answers only from the connected database's **table structure** and **data profile** — it never sees raw data rows or any sensitive information:

- Can see: table names, column names, database types, per-column distinct counts / null counts / min / max / sample values (up to 6 tables), and the current conversation history
- Cannot see: data rows of query results (returned only when you view charts), connection passwords, connection strings, platform accounts

The AI assistant panel in the workbench shows a "AI visible scope" hint at the top; click to expand details.

## Quick Start (Windows)

1. Double-click **`Start Dev.cmd`** — dependencies, env, and Prisma client are checked automatically; starts directly when the build is up-to-date and opens the browser
2. Open <http://localhost:3000> and add a PostgreSQL connection
3. Go to the workbench and ask, e.g. "monthly sales trend by month"

CLI instructions below; use **`Build.cmd`** for a type-check + production build (with freshness check).

### Manual Setup

```bash
npm install
# copy .env.example to .env (Windows: copy .env.example .env), fill DATABASE_URL, ENCRYPTION_KEY
npx prisma db push      # initialize the metadata database
npm run dev             # http://localhost:3000
```

Generate `ENCRYPTION_KEY`: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Optional test data: `scripts/seed.py` (accepts only `SEED_DATABASE_URL`, see [scripts/README.md](scripts/README.md)).

## Tech Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| Editor/Charts | Monaco Editor, Recharts + custom SVG |
| Backend | Next.js Route Handlers, Prisma 7, pg |
| Data/AI | PostgreSQL, OpenAI-compatible SDK + JSON Schema structured output |

## Safety

Only single `SELECT`/`WITH` statements are allowed, run inside a read-only transaction with a statement timeout; default cap 5,000 rows. Connection passwords are AES-256 encrypted with per-record salt. Configure read-only accounts for external databases in production. See [api.md](docs/api.md) and [operations.md](docs/operations.md).

## Docs

- Usage/interaction: this file + [scripts/README.md](scripts/README.md) (launcher/build entry points)
- Developer handbook: [src/README.md](src/README.md) (directory duties, page routes, change routing) · [prisma/README.md](prisma/README.md)
- Architecture & decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/design-philosophy.md](docs/design-philosophy.md) · [.agents/notes/](.agents/notes/) (decision records)
- Interfaces & specs: [docs/api.md](docs/api.md) (API contract) · [docs/charts.md](docs/charts.md) (chart specs) · [docs/04_ai_integration.md](docs/04_ai_integration.md) (AI contract) · [docs/operations.md](docs/operations.md) (ops)
- Testing & acceptance: [docs/testing.md](docs/testing.md) (incl. CI) · [docs/manual-acceptance.md](docs/manual-acceptance.md) (manual acceptance)
- Maintainer index & rules: [AGENTS.md](AGENTS.md) · implementation status: [docs/implementation-status.md](docs/implementation-status.md)