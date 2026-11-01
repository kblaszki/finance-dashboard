---
name: ux-product-review
description: >-
  Performs a product-level user-interface and UX review of the finance-dashboard
  frontend: inventories shipped features, models what a personal-finance user
  needs (where money goes, how savings and net worth grow), audits every page
  and section against industry UI standards for modern finance apps, asks the
  user about preferences, then proposes and implements a better information
  architecture — page split, section order and size, charts, and new UI
  capabilities — in verified, committed chunks. Use when the user asks for a UX
  review, UI/product redesign, information-architecture review, dashboard
  redesign, or "what should the user see and how" for this project.
disable-model-invocation: true
---

# UX / Product Review

Answer two questions for every screen: **what does the user need here** and **is it shown in the best way**. Then redesign and implement.

Scope differs from sibling skills:

| Skill | Focus |
|-------|-------|
| `css-ui-review` | How it looks: tokens, responsiveness, contrast, CSS consistency |
| `fullstack-architecture-review` | How it is built: boundaries, contracts, tests |
| **`ux-product-review`** | **What is shown, where, in what order and form** — IA, page purpose, hierarchy, charts, user flows, missing capabilities |

Target product: a **modern personal-finance app for people who want to know what they spend money on and how their savings grow**. Rubric: [standards.md](standards.md). Preference questions: [questions.md](questions.md).

Implementation is on by default **after the user approves the proposal** (Step 7). Stop after the report when the user says `review only`, `plan only`, `no commits`, or the session is in Ask/Plan mode.

## Ground truth (read first)

| Source | What it gives |
|--------|---------------|
| `frontend/src/App.tsx`, `frontend/src/components/AppShell.tsx` | Routes and navigation as shipped |
| `frontend/src/pages/*.tsx`, `frontend/src/components/**` | Sections, charts, tables, forms per page |
| `frontend/src/api/*Api.ts` | Data the UI can already get (fields per DTO) |
| `backend/src/routes/*`, [docs/reference/api.md](../../../docs/reference/api.md) | Data the backend exposes, including fields the UI ignores |
| [docs/reference/requirements.md](../../../docs/reference/requirements.md) | Shipped FRs |
| [docs/reference/frontend.md](../../../docs/reference/frontend.md) | Route catalog, shared UI components, visual system |
| [mvp/CHECKLIST.md](../../../mvp/CHECKLIST.md) | Backlog intent (not shipped — verify in code) |
| [docs/tutorials/demo-seed.md](../../../docs/tutorials/demo-seed.md) | Demo user with realistic data for the visual pass |

If docs disagree with code, **trust the code** and record doc drift.

## Hard constraints

- Every number on screen comes from real data via API. No mocked or decorative figures in authenticated pages.
- Money, FX, valuation and aggregation logic stays in backend domain modules (golden-rule §1). New metrics that need aggregation → new/extended backend endpoint, not client-side math over paged lists.
- Tenancy: any new query is scoped by authenticated `userId`.
- Reuse shared UI: `PageHeader`, `KpiCard`, `ChartCard`, `StatusBlock`, `SetupChecklist`, `SortableTh`, `MonthPager`, table recipe from `docs/reference/frontend.md`. Charts stay on Recharts with `--chart-*` colors.
- Styling follows `css-ui-review` constraints: plain layered CSS, tokens only, breakpoints `40rem / 64rem / 80rem`, container queries for reusable cards.
- No new dependencies (UI kits, chart libs, state libs) without asking the user first.
- Do not remove a capability. Relocate, merge or demote it — and say where it went. Removing requires explicit user consent.
- Changing or removing a route keeps old URLs working (`<Navigate replace />`) and updates nav, deep links (`?fromAccountId=`, `?ledgerType=`) and tests.
- Each recommendation must trace to a user need (Step 3) and a standard (standards.md). No redesign for taste alone.

## Workflow

Copy and track:

```text
UX review progress:
- [ ] Step 1: Feature inventory (what is shipped, where, with what data)
- [ ] Step 2: Unused-data scan (backend/DTO fields the UI never shows)
- [ ] Step 3: User model — personas, jobs, key questions, frequency
- [ ] Step 4: Question-to-screen map (where each key question is answered, how well)
- [ ] Step 5: Page-by-page audit (static + visual, desktop and phone)
- [ ] Step 6: Ask preference questions (AskQuestion)
- [ ] Step 7: Proposal — target IA, page blueprints, chart changes, new capabilities → user approval
- [ ] Step 8: Implement chunks A → D (verify + commit each)
- [ ] Step 9: Re-verify visually, docs sync, final summary
```

### Step 1: Feature inventory

One row per capability (not per file). Find them via `App.tsx` routes, page components, and API clients.

| Capability | Route / section | Component(s) | API / data | Frequency of use (daily/weekly/monthly/rare) | Notes |

Group capabilities by user intent: **See** (overview, trends), **Understand** (breakdowns, drill-down), **Record** (transactions, transfers, trades, import), **Organize** (categories, tags, rules), **Track wealth** (accounts, holdings, markets), **Configure** (settings).

### Step 2: Unused-data scan

Compare backend responses with what the UI renders:

```bash
rg -n "res\.json|serialize" backend/src/routes backend/src -g '*.ts' -g '!*.test.ts'
rg -n "export (type|interface)" frontend/src/api -g '*Api.ts'
```

For each DTO field, check whether any page/component reads it (`rg -n '\.<field>\b' frontend/src/pages frontend/src/components`). Unused fields (e.g. `asOf`, `ratesUsed`, previous-period values, per-account breakdowns) are cheap UI wins — list them.

### Step 3: User model

Write 2 personas from standards.md §1 (adapt, do not copy blindly) and a jobs list:

| Job / question the user asks | Persona | Frequency | Ideal answer form (number + delta, trend chart, ranked list, table) | Max clicks from login |

Cover at minimum the core questions in standards.md §1. Add questions implied by shipped features (brokerage, FX, markets, tags).

### Step 4: Question-to-screen map

For every question from Step 3:

| Question | Answered where today | Clicks | Answer quality (Clear / Partial / Hidden / Missing) | Gap |

"Hidden" = data exists but the user must compute it mentally or scroll past unrelated content. "Missing" = no data/UI at all → candidate new capability.

### Step 5: Page-by-page audit

For every route in `App.tsx` (including Landing/Login/Register and empty workspace state):

1. **Static:** list sections in render order with their visual weight (grid span, height), primary action, charts and their type, empty/loading/error states.
2. **Visual:** `npm run dev` from repo root, log in as the demo user, use `cursor-ide-browser`. Screenshot each route at 1440 x 900 and 390 x 844 (`Emulation.setDeviceMetricsOverride`, `mobile: true` for phone; clear afterwards). Note what is visible above the fold.
3. **5-second test:** from the desktop screenshot only, write what the page communicates in one sentence. Compare with the page's intended purpose.
4. **Score** each page 1–5 on the page rubric in standards.md §9 with one-line evidence per score.

If the browser cannot be used, say so and mark visual columns `not verified` — never claim visual findings without screenshots.

### Step 6: Ask preference questions

Pick only questions whose answer changes the proposal (usually 3–6). Use `AskQuestion` with the recommended option first, labeled `(Recommended)`, based on Steps 3–5 evidence. Question bank: [questions.md](questions.md). Batch them in one call; ask a follow-up batch only if an answer opens a new branch.

Skip a question when the user already answered it in the conversation.

### Step 7: Proposal

Write the report (format below) containing:

- **Target IA:** Mermaid sitemap of the proposed navigation + table `current route → proposed location`.
- **Page blueprints:** for each changed page, ordered sections with size (grid span on a 12-col desktop grid, and phone order), content, chart type, primary action. ASCII wireframe for the most important pages (Dashboard at minimum).
- **Chart changes:** current chart → proposed chart, which user question it answers, data source, why (standards.md §4).
- **New capabilities:** user question → UI → required data → backend work (new endpoint / extend existing / none).
- **Work packages** grouped into chunks A–D with effort (S/M/L).

Then **stop and ask for approval** with `AskQuestion` (options: approve all / approve selected chunks / revise). Skip the gate only if the user already said to go ahead without confirmation.

### Step 8: Implement chunks

Order, one commit per chunk (golden-rule §5), smaller commits inside a chunk are fine:

| Chunk | Contents | Backend? |
|-------|----------|----------|
| A — Hierarchy | Reorder sections, resize cards (grid spans), promote/demote content, better headings and labels, add comparison context to existing KPIs from existing data, empty-state CTAs | No |
| B — Visualization | Swap or add charts using existing endpoints, surface unused DTO fields, consistent category colors, tooltips/labels | No |
| C — IA / navigation | Split/merge pages, nav regrouping, tabs inside pages, redirects for old routes, URL state for filters | No (usually) |
| D — New capabilities | Features needing new data: endpoints/aggregations, then API client, then UI | Yes |

Per chunk:

1. Implement. Chunk D follows [docs/how-to/add-api-endpoint.md](../../../docs/how-to/add-api-endpoint.md) (domain module + route + HTTP test + `api.md` row + `*Api.ts` + `apiModules.test.ts`).
2. Update or add component tests touched by the change.
3. `npm test` from repo root; `npm run test:coverage` when logic in `backend/src`, `frontend/src/api`, `hooks` or `utils` changed.
4. Screenshot affected routes at 1440 and 390, light and dark; compare with Step 5 screenshots.
5. Docs sync (docs-sync-during-work skill): `docs/reference/frontend.md` routes table, `docs/how-to/dashboard-and-statistics.md` or other affected how-to, `api.md` / `requirements.md` for chunk D.
6. Commit locally (`Redesign …` / `Add …` / `Move …`). Never push unless asked.

### Step 9: Summary

Final message (user's language): what changed per chunk with commit hash + subject, before/after screenshots of the most important pages, question-to-screen map deltas (which questions moved from Hidden/Missing to Clear), verification results, deferred items with reason.

## Severity

| Severity | Meaning |
|----------|---------|
| Critical | A core question (standards.md §1) cannot be answered, or the UI shows misleading numbers (wrong period, mixed currencies without label, stale data without as-of) |
| High | Core question answered only with many clicks or mental math; page purpose unclear in 5-second test; wrong chart type for the question |
| Medium | Suboptimal order/size, missing comparison context, inconsistent patterns between pages, weak empty states |
| Low | Labels, microcopy, polish, nice-to-have enhancements |

## Report format

Prose in the user's language; paths, identifiers and UI strings in English.

```markdown
# UX / Product Review — [YYYY-MM-DD]

## Summary
[3–6 sentences: who the app serves today, biggest gaps vs user needs, proposed direction]

## Feature inventory
[Table from Step 1, grouped by intent]

## Unused data
[Fields/endpoints available but not surfaced]

## User model
[Personas + jobs table from Step 3]

## Question-to-screen map
[Table from Step 4]

## Page scorecard
| Page | Purpose (5-second test) | Clarity | Glance | Hierarchy | Data-vis | Action | Consistency | Mobile | Top issue |

## Findings
### Critical / High / Medium / Low
- **[Title]** — page: [route/section], standard: [standards.md §N]
  - Evidence: [file:line, screenshot]
  - User impact: [which question/job suffers]
  - Proposal: [concrete change] — chunk: [A/B/C/D], effort: [S/M/L]

## Preferences
[Questions asked and answers, or assumptions used]

## Proposal
### Target IA
[Mermaid sitemap + route mapping table]
### Page blueprints
[Per page: ordered sections, spans, charts, primary action; ASCII wireframe]
### Chart changes
| Page | Current | Proposed | Answers | Data source |
### New capabilities
| Capability | User question | UI | Backend work | Effort |

## Execution plan
[Chunks A–D with work packages and success criteria]
```

## Additional resources

- Industry standards and finance-app patterns: [standards.md](standards.md)
- Preference question bank: [questions.md](questions.md)
