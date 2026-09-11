# AI Analytics Platform

[![CI](https://github.com/zlZayn/AI-analytics-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/zlZayn/AI-analytics-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-22-brightgreen)](.node-version)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

English | [简体中文](README.md)

> The Chinese [README.md](README.md) is authoritative; keep both files in sync in the same change.

Connect PostgreSQL, ask in plain language, get charts and insights — the whole analysis happens in the browser, and your data never leaves the database.

## Capabilities

- **Conversational analysis** — ask a question -> AI builds a structured query -> auto-execute -> chart; multi-turn context, one-click insight cards
- **SQL workbench** — Monaco editor for direct execution; favorites + a unified history timeline (SQL / AI / R interleaved, replayable in one click)
- **Charting** — table, KPI, line, bar, pie/donut, scatter, histogram, boxplot, heatmap, correlation matrix; user-adjustable column mappings
- **R in the browser** — WebR workbench: query results injected as `df`, write dplyr / ggplot2 to plot, no local R needed
- **Data access** — PostgreSQL connection CRUD and testing, AES-256 encrypted passwords; automatic schema discovery, cached snapshots, table preview
- **Take results with you** — one-click CSV (Excel-friendly) / JSON export, copy the R code template
- **Safety boundaries** — read-only transactions, single `SELECT`/`WITH` whitelist validation, parameterized queries, default 5,000-row cap

## What the AI Can See

The AI answers only from the connected database's **table structure**, **data profile**, and the **chart contract** — it never sees raw data rows:

- Can see: table names, column names, database types, per-column distinct counts / null counts / min / max / sample values (up to 6 tables); the 10 chart types with their slot rules; the current conversation history
- Cannot see: data rows of query results (returned only when you view charts), connection passwords, connection strings, platform accounts

The AI assistant panel shows an "AI visible scope" hint at the top; expand it to verify.

## Specify Tables with @

Type `@` to open a table picker; picked tables are injected as explicit context (the AI profiles only those, not limited by the automatic cap). Without `@`, the AI profiles the first 6 tables.

```
compare @orders vs @customers monthly sales
analyze @sales_2026
```

## Quick Start

**Windows**: double-click `Start Dev.cmd` — dependencies, env, and the Prisma client are checked automatically; it starts directly when the build is up-to-date and opens <http://localhost:3000>.

**Any platform**:

```bash
npm ci                      # reproducible install (Node version in .node-version, currently 22)
# copy .env.example to .env, fill DATABASE_URL and ENCRYPTION_KEY
npm run db:init             # idempotent metadata bootstrap (never db push / migrate: they drop business tables)
npm run dev                 # http://localhost:3000
```

Generate `ENCRYPTION_KEY`: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Optional test data: `python scripts/seed.py` (accepts only `SEED_DATABASE_URL`). Launcher and build-script usage: [scripts/README.md](scripts/README.md).
Add a PostgreSQL connection -> open the workbench and ask, e.g. "monthly sales trend by month".

## Tech Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| Editor/Charts | Monaco Editor (self-hosted), Recharts + custom SVG |
| Backend | Next.js Route Handlers, Prisma 7, pg |
| Data/AI | PostgreSQL, OpenAI-compatible SDK + JSON Schema structured output |

## Safety

Only single `SELECT`/`WITH` statements are allowed, run inside a read-only transaction with a statement timeout; default cap 5,000 rows. Connection passwords are AES-256 encrypted with a per-record salt. Configure read-only accounts for external databases in production. See [docs/operations.md](docs/operations.md).

## Docs

- Design philosophy and boundaries: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Interfaces / AI contract / runtime parameters: [docs/api.md](docs/api.md) · [docs/ai-integration.md](docs/ai-integration.md) · [docs/operations.md](docs/operations.md)
- Verification and manual acceptance: [docs/verification.md](docs/verification.md)
- Developer handbook (directory duties, page routes, change routing): [src/README.md](src/README.md)
- Maintainer documentation map (full index): [AGENTS.md](AGENTS.md)

## Contributing

Run `npm test`, `npm run typecheck`, and `npm run lint` after changes; when you touch app routes, sync the browser-script mocks under `scripts/`. Commit and doc-sync conventions: [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
