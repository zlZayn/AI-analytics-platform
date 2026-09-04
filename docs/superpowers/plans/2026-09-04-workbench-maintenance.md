# Workbench Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the workbench execution path reliable, make the Windows launcher restart stale services, and improve the three core pages without changing data or security contracts.

**Architecture:** Keep the existing session-driven workspace and App Router. Add a pure navigation URL helper, make initial SQL execution idempotent, and use focused layout changes that preserve existing semantic CSS tokens. Keep launcher lifecycle logic in the existing GBK/CRLF batch entry.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright Python smoke tests, Windows batch launcher.

**Spec:** `docs/superpowers/specs/2026-09-04-workbench-maintenance-design.md`

## Global Constraints

- Keep SQL validation, API response contracts, session state ownership, and R data boundaries unchanged.
- Use `configureMonaco()` before rendering new Monaco editors.
- Use only `src/app/globals.css` semantic color tokens.
- Keep root `*.cmd` files CRLF + GBK/ANSI + no BOM.
- Run tests, typecheck, lint, build, offline E2E, link validation, line-ending validation, and `git diff --check`.

### Task 1: Navigation Contract

**Files:**
- Create: `src/lib/workspace-navigation.ts`
- Create: `src/lib/__tests__/workspace-navigation.test.ts`
- Modify: `src/app/explorer/page.tsx`
- Modify: `src/app/queries/page.tsx`

**Interfaces:**
- Produces `buildWorkspaceUrl(connectionId: string | null, sql?: string): string | null`.
- Returns `null` for missing connection or blank SQL; otherwise returns `/workspace?connection=...&sql=...` with `encodeURIComponent`.

- [x] Write tests for missing inputs, whitespace trimming, Chinese text, ampersands, and quote characters.
- [x] Run the focused test and confirm the new import/function fails before implementation.
- [x] Implement the pure helper and replace both page-local `router.push` URL constructions.
- [x] Run the focused test and existing page/component tests; confirm all pass.
- [x] Commit the navigation and execution changes with the maintenance batch.

### Task 2: Initial Execution State

**Files:**
- Modify: `src/components/workspace/session-workspace.tsx`
- Modify: `src/hooks/sessionReducer.ts`
- Create: `src/hooks/__tests__/initial-workspace-execution.test.ts`
- Modify: `scripts/offline_workspace_e2e.py`

**Interfaces:**
- Keep `SessionWorkspace({ connectionId, initialSql })` unchanged.
- Add a reducer action or pure guard only if needed to ensure one initial SQL dispatch per mount.

- [x] Write a focused failing test proving identical compiled SQL cannot create a second execution dispatch when the effect is re-run.
- [x] Run the focused test and confirm the duplicate-execution failure.
- [x] Implement the smallest idempotence guard; preserve manual execution and AI execution behavior.
- [x] Add E2E assertions for exactly one query request, decoded SQL in the URL/editor, and mobile overflow.
- [x] Run focused tests and offline E2E.

### Task 3: Page Layout and Feedback

**Files:**
- Modify: `src/components/workspace/session-workspace.tsx`
- Modify: `src/app/explorer/page.tsx`
- Modify: `src/app/queries/page.tsx`
- Modify: `src/app/globals.css` only if an existing token-based utility cannot express the required responsive behavior
- Modify: `scripts/final_ui_smoke.py`

**Interfaces:**
- No public API or state contract changes.
- Preserve existing button accessible names and add `aria-busy`/disabled state only where execution is active.

- [x] Add or update smoke assertions for 360px and desktop widths: no page overflow, visible primary actions, and stable result area.
- [x] Implement explicit responsive flex constraints, scroll ownership, and visible loading/error feedback using existing tokens.
- [x] Run the UI smoke script and inspect screenshots at 360, 768, 1280, and 1440 widths.

### Task 4: Documentation and Decision Sync

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/implementation-status.md`
- Modify: `docs/maintenance-checklist.md`
- Modify: `src/README.md`
- Create: `.agents/notes/2026-09-04-workbench-execution-lifecycle.md`

**Interfaces:**
- Documentation records shipped behavior and the maintenance route; no code interface changes.

- [x] Record the launcher restart and single navigation helper in architecture and decision notes, including alternatives considered.
- [x] Update implementation status and checklist without duplicating user-facing usage instructions.
- [x] Run `python scripts/check-links.py .`; fix every broken link.
- [x] Run the line-ending checker with `.next`, `node_modules`, and `.git` excluded; separately verify `Start Dev.cmd` is CRLF, GBK, and BOM-free.

### Task 5: Full Verification

**Files:**
- No additional files.

- [x] Run `npm test` and record the complete passing count.
- [x] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] Run `python scripts/offline_workspace_e2e.py` against `http://localhost:4321`.
- [x] Run `python scripts/final_ui_smoke.py` against `http://localhost:4321`.
- [x] Run link, line-ending, and diff checks.
- [x] Review `git diff`, `git status -sb`, and changed-file scope; report any remaining manual acceptance items.
