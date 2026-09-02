# AI Analytics Platform

[English](README_en.md) | [简体中文](README.md)

A general-purpose AI data analytics platform. Connect any PostgreSQL database and analyze/visualize data through natural language.

## Features

- **Connection management** - PostgreSQL connection CRUD with automatic test
- **Schema discovery** - Automatic schema scanning with cached snapshots
- **SQL editor** - Monaco Editor with syntax highlighting
- **AI analysis** - natural language -> structured query with multi-turn conversation
- **AI insights** - automatic business insight suggestions; one-click execution and visualization
- **Data explorer** - table structure, column details, relations, data preview
- **Charting** - table, KPI, line, bar, pie/donut, scatter, histogram, boxplot, heatmap, correlation matrix with user-chosen column mappings
- **Query management** - query history and saved queries

## Tech Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| Editor | Monaco Editor |
| Visualization | Recharts + custom SVG (boxplot / heatmap / correlation matrix) |
| Backend | Next.js Route Handlers, Prisma 7, pg |
| Database | PostgreSQL |
| AI | OpenAI-compatible SDK + JSON Schema structured output |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_analytics"
ENCRYPTION_KEY=""
AI_API_BASE="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o"
```

`ENCRYPTION_KEY` must be an application-specific random value of at least 32 characters. Generate it, put it in `.env`, do not use the placeholder, and do not change it after connections have been saved:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

### 3. Initialize the database

```bash
npx prisma db push
```

### 4. Seed test data (optional)

The seed script reads no hardcoded credentials. Point it at the target database explicitly:

```powershell
$env:SEED_DATABASE_URL = "postgresql://seed_user:replace-me@localhost:5432/ai_analytics"
python scripts/seed.py
```

The script accepts only `SEED_DATABASE_URL` and never falls back to the app's `DATABASE_URL`, so it cannot write into the app or production databases by accident.

### 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>

### Windows shortcuts (recommended)

- `Start Dev.cmd`: one-click launch (dependency/.env/Prisma checks -> build freshness check: skips rebuild and starts production when up-to-date, allows rebuild or dev mode when stale -> opens the browser; opens browser directly when port is in use)
- `Build.cmd`: build freshness check (skips when up-to-date, force-rebuild option) -> type-check -> production build

## Query Safety & Limits

Only a single `SELECT`/`WITH` statement is allowed, run inside a PostgreSQL read-only transaction with a statement timeout. The default result cap is 5,000 rows; truncation and chart sampling are always surfaced in the UI. Configure read-only accounts for every external database in production.

## Testing & Docs

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma generate   # if src/generated/prisma is missing
```

CI (GitHub Actions, see `.github/workflows/ci.yml`) runs the same sequence on every push and PR: install -> prisma generate -> typecheck -> lint -> test -> build -> docs link check (`scripts/check-links.py`) -> diff check.

All AI contract tests use an injected fake provider and never call a real model API. Browser verification is described in `docs/testing.md`.
The repository contains no real AI-calling scripts or credentials; real providers are used only for manual acceptance with rotatable, scoped keys.

Design principles, architecture decisions, API conventions, chart specs, and operations notes live in `docs/`.

## Project Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── fonts/                    # Self-hosted Geist fonts (woff2)
│   ├── page.tsx                  # Connection selection & management
│   ├── workspace/page.tsx        # Data workbench (SQL + AI)
│   ├── explorer/page.tsx         # Data explorer
│   ├── queries/page.tsx          # Query management (favorites + history)
│   └── api/                      # Route handlers
│       ├── connections/          # Connection CRUD
│       ├── schema/               # Schema scanning
│       ├── query/                # SQL execution + history + saved
│       └── ai/                   # AI analysis + insights
├── components/
│   ├── layout/                   # Layout components
│   │   ├── app-shell.tsx         # Top-level shell
│   │   ├── sidebar.tsx           # Sidebar + connection selector
│   │   └── connection-context.tsx # Connection context
│   ├── dashboard/                # Shared components
│   │   └── result-panel.tsx      # Result panel
│   ├── workspace/                # Session-state workbench (refactor v4)
│   │   └── session-workspace.tsx # Session-driven workspace
│   ├── charts/                   # Charting system
│   │   ├── views/                # 10 base chart views
│   │   ├── hooks/                # Custom hooks
│   │   ├── chart-icons.tsx       # SVG icon mapping
│   │   ├── types.ts              # Chart type definitions
│   │   ├── constants.ts          # Color/axis config
│   │   ├── algorithms.ts         # Fixed statistical algorithms
│   │   ├── transform.ts          # Deterministic display transforms
│   │   ├── empty-state.tsx       # Empty state component
│   │   └── error-boundary.tsx    # Chart error boundary
│   ├── SessionView.tsx           # Session rendering (loading/error/chart + warnings)
│   ├── chart-config-panel.tsx    # Chart config panel
│   ├── chart.tsx                 # Chart re-export
│   ├── insight-card.tsx          # AI insight card
│   ├── toast.tsx                 # Toast notifications
│   └── ui/                       # Base UI components (Base UI + TailwindCSS)
├── hooks/                        # Session state (refactor v4)
│   ├── useSession.ts             # Session management + side effects
│   └── sessionReducer.ts         # Pure transitions for 19 actions
├── lib/                          # Core libraries
│   ├── ai-service.ts             # AI service (generateAnalysis + insights)
│   ├── ai-contract.ts            # Prompts, JSON Schema, runtime validation
│   ├── query-compiler.ts         # QuerySpec -> parameterized SQL (refactor v4)
│   ├── validators.ts             # Dual-mode validation (refactor v4)
│   ├── render-binder.ts          # Dataset -> chart binding (refactor v4)
│   ├── query-engine.ts           # Query engine
│   ├── schema-service.ts         # Schema scanning + data profiling
│   ├── sql-validator.ts          # SQL safety validation
│   ├── encryption.ts             # Password encryption
│   ├── prisma.ts                 # Prisma client
│   └── utils.ts                  # Utilities
├── types/                        # Shared + session types (session.ts/actions.ts)
└── generated/prisma/             # Prisma client (regenerable)

prisma/
└── schema.prisma                 # Database schema definition

scripts/
├── seed.py                       # Test data generator
├── check-links.py                # Markdown link checker
├── final_ui_smoke.py             # Four-viewport UI smoke test
└── offline_workspace_e2e.py      # Offline workbench E2E

.github/
└── workflows/ci.yml              # GitHub Actions CI
```

## Page Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Connection selection & management (sidebar dropdown) |
| `/workspace?connection=xxx` | Data workbench (SQL editor + AI assistant); append `&session=1` for the session-state build |
| `/explorer?connection=xxx` | Data explorer (schema browsing) |
| `/queries?connection=xxx` | Query management (favorites + history) |

## API Routes

| Method | Route | Purpose |
| :--- | :--- | :--- |
| GET/POST | `/api/connections` | List/create connections |
| GET/PUT/DELETE | `/api/connections/[id]` | Connection detail/update/delete |
| GET | `/api/schema/[connectionId]` | Schema scan/cache |
| POST | `/api/query` | Execute SQL |
| POST | `/api/query/preview` | Safe table preview (schema/table identifiers) |
| GET | `/api/query/history` | Query history |
| GET/POST | `/api/query/saved` | Saved queries |
| POST | `/api/ai` | AI analysis (structured JSON output) |
| POST | `/api/ai/insights` | AI insight suggestions |

## Chart Types

| Type | Description |
| :--- | :--- |
| Line | Trend analysis |
| Bar | Category comparison |
| Pie | Share analysis |
| Scatter | Correlation analysis |
| Boxplot | Statistical distribution |
| Heatmap | Matrix analysis |
| Correlation matrix | Variable correlations |
| Data table | Raw data |
| KPI card | Single value with optional comparison |
| Histogram | Continuous variable distribution |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [AI integration](docs/04_ai_integration.md)
- [API conventions](docs/api.md)
- [Chart specs](docs/charts.md)
- [Testing](docs/testing.md)
- [Operations](docs/operations.md)
- [Design philosophy](docs/design-philosophy.md)
- [Manual acceptance](docs/manual-acceptance.md)
- Maintainer index & rules: [AGENTS.md](AGENTS.md)