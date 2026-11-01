---
name: css-ui-review
description: >-
  Performs an exhaustive CSS and UI-styling review of the finance-dashboard
  frontend: inventories every page, component, section, table, form and chart,
  audits each for consistency with the design system, responsiveness (mobile,
  tablet, desktop, wide), accessibility, theming and modern CSS best practices,
  then fixes defects and unifies shared styles in verified, committed chunks.
  Use when the user asks for a CSS review, styling audit, responsive/mobile
  audit, UI consistency pass, or design-system cleanup of this project.
disable-model-invocation: true
---

# CSS / UI Review

Review **all** styling in `frontend/` against the rubric in [checklist.md](checklist.md), report findings, then **fix them** (this skill implements changes by default — unlike `fullstack-architecture-review`).

Skip implementation only when the user says `review only`, `plan only`, `no commits`, or the session is in Ask/Plan mode. Then deliver the report and the fix roadmap only.

## Ground truth (read first)

| Source | What it defines |
|--------|-----------------|
| `frontend/src/styles/index.css` | Layer order: `tokens, base, layout, components, pages, utilities` + import list |
| `frontend/src/styles/tokens.css` | Colors (light + `[data-theme='dark']`), `--space-*`, `--text-*`, `--radius-*`, `--shadow-card`, `--tap-target`, `--chart-1…6`, breakpoint note |
| `frontend/stylelint.config.js` | Enforced: no hex outside tokens, no `px` font-size, no `!important`, max 1 id, nesting ≤ 3 |
| [docs/reference/frontend.md](../../../docs/reference/frontend.md) | "Visual system" paragraph: layers, tokens, breakpoints `40rem / 64rem / 80rem`, container queries, `.field-control`, routes |
| `frontend/src/App.tsx` | Every route = every page to review |

If docs disagree with code, **trust the code** and record doc drift as a finding.

## Hard constraints

- No new styling stack: no Tailwind, CSS Modules, CSS-in-JS, Sass, UI kits. Plain CSS in the existing layer files.
- Keep the `@layer` architecture and file split (`components/*` for reusable pieces, `pages/*` for page-scoped rules).
- Colors only through tokens; every new color token needs **both** light and dark values.
- Breakpoints: only `40rem` / `64rem` / `80rem` media queries; component-width adaptation uses container queries.
- Do not change brand identity (palette, fonts) except to fix contrast failures.
- TSX changes limited to `className`, wrapper elements needed for layout, ARIA needed for a11y, and moving inline `style={{…}}` to classes / custom properties. No logic changes.
- Before renaming or removing a class, search tests: `rg -n "<class>" frontend/src -g '*.test.tsx'` and keep them green.
- LF line endings; minimal, reviewable diffs per chunk.

## Workflow

Copy and track:

```text
CSS review progress:
- [ ] Step 1: Baseline (tokens, layers, lint, unused-class scan)
- [ ] Step 2: Full inventory table (every route, component, CSS file)
- [ ] Step 3: Static audit of every inventory row against checklist.md
- [ ] Step 4: Visual audit — all viewports x both themes
- [ ] Step 5: Findings report
- [ ] Step 6: Fix chunk A — broken / non-responsive / inaccessible
- [ ] Step 7: Fix chunk B — consistency + token unification
- [ ] Step 8: Fix chunk C — structural / modernization
- [ ] Step 9: Re-verify viewports, docs sync, final summary
```

### Step 1: Baseline

```bash
cd frontend && npm run lint:css
bash .cursor/skills/css-ui-review/scripts/unused-classes.sh   # from repo root
rg -n 'style=\{\{' frontend/src -g '*.tsx' -g '!*.test.tsx'
rg -n '@media|@container' frontend/src/styles
rg -n '[0-9]+px' frontend/src/styles -g '!tokens.css'
rg -n 'z-index' frontend/src/styles
```

Record: lint state, candidate dead classes (confirm manually — dynamic class names give false positives), inline styles, every media/container query and its breakpoint, raw `px` values, z-index values.

### Step 2: Inventory (mandatory, exhaustive)

Build one row per **page** (from `App.tsx` routes) and per **component** (`frontend/src/components/**/*.tsx`, excluding tests). List components with:

```bash
rg --files frontend/src/pages frontend/src/components -g '*.tsx' -g '!*.test.tsx'
```

For each row collect: classes used (`rg -o 'className=\{?["`][^"`]*' <file>`), CSS file(s) defining them, sections/charts/tables/forms it renders.

| Item | Kind (page/section/chart/table/form/control/shell) | CSS file(s) | Static | 360 | 768 | 1280 | 1920 | Dark | Notes |

The review is **not complete** until every row has every column filled. Charts: `AccountBalanceChart`, `InstrumentHistoryChart`, `CashflowHistoryChart`, `WealthHero`, `AllocationCard`, `BreakdownPanel` (+ `chartColors.ts`, `ChartCard`).

### Step 3: Static audit

Walk every inventory row through **all 10 sections** of [checklist.md](checklist.md). Note file:line evidence for each problem. Look for the same pattern implemented differently in two places — that is the main source of consistency findings.

### Step 4: Visual audit

1. Start the app: `npm run dev` (root; frontend `:5173`). Log in as the demo user ([docs/tutorials/demo-seed.md](../../../docs/tutorials/demo-seed.md)) so charts and tables have data.
2. Use the `cursor-ide-browser` tools. For each viewport set metrics via `browser_cdp` → `Emulation.setDeviceMetricsOverride` (`mobile: true` below 64rem), visit every route, screenshot, then repeat in dark theme (topbar `ThemeToggle`). Clear with `Emulation.clearDeviceMetricsOverride` when done.

| Viewport | Size | Represents |
|----------|------|------------|
| Small phone | 360 x 740 | below `40rem` |
| Phone | 390 x 844 | below `40rem` |
| Tablet | 768 x 1024 | `40rem`–`64rem` |
| Laptop | 1280 x 800 | `64rem`–`80rem` |
| Desktop wide | 1920 x 1080 | above `80rem` |

3. On every route and viewport run the overflow probe via `Runtime.evaluate`:

```js
(() => {
  const w = document.documentElement.clientWidth;
  return {
    pageOverflow: document.documentElement.scrollWidth > w,
    offenders: [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > w + 1)
      .slice(0, 15)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`),
  };
})()
```

4. Also check: keyboard Tab through each page (visible focus), 200% zoom at 1280 (`Emulation.setPageScaleFactor` or `deviceScaleFactor`), loading/error/empty states where reachable.

If the browser cannot be used (no dev server, login blocked), say so explicitly in the report and mark the visual columns `not verified` — never claim visual results without screenshots.

### Step 5: Findings report

Use the template in **Report format** below. Every finding maps to a checklist section (1–10) and cites evidence.

### Steps 6–8: Fix in chunks

Implement in this order; each chunk = one commit (golden-rule §5):

| Chunk | Contents |
|-------|----------|
| A — Correctness | Horizontal overflow, broken layout at any viewport, unreadable contrast, missing focus states, hover-only affordances, clipped/overlapping content, charts not resizing |
| B — Consistency | Replace magic numbers with tokens, unify duplicated patterns (cards, headers, toolbars, empty/error states, numeric cells), align breakpoints, move inline styles to classes |
| C — Structural | Extract shared component styles, new tokens (e.g. z-index or control-height scale), container queries for reusable cards/charts, `:where()` to flatten specificity, delete confirmed dead CSS, file moves between `components/` and `pages/` |

Structural changes must make the UI more consistent, scalable or user-friendly — not just different. Justify each in the report before implementing.

Per chunk:

1. Edit.
2. `npm test` from repo root (includes frontend ESLint + Stylelint). Run `npm run test:coverage` only if `src/api`, `src/hooks` or `src/utils` changed.
3. Re-run the overflow probe + screenshots for affected routes at 360 / 768 / 1280, both themes.
4. Commit locally (`Fix …` / `Refactor …` styles message). Never push unless asked.

### Step 9: Docs sync and summary

Update [docs/reference/frontend.md](../../../docs/reference/frontend.md) "Visual system" (and the CSS row in [docs/meta/code-map.md](../../../docs/meta/code-map.md)) when tokens, layers, breakpoints, shared classes or file layout changed. Same commit as the change.

Final message: what was fixed per chunk (commit hash + subject), before/after screenshots for the most significant fixes, verification results, remaining items deferred with reason.

## Severity

| Severity | Meaning |
|----------|---------|
| Critical | Content unusable or unreadable at a supported viewport or theme: page-level horizontal scroll, overlapping/clipped controls, contrast below WCAG AA for body text, invisible focus |
| High | Clear inconsistency or responsiveness defect users will notice; pattern likely to be copied (e.g. table unreadable on phone, chart fixed height breaks layout) |
| Medium | Token/pattern drift, duplicated rules, missing states (hover/disabled/empty), fragile selectors |
| Low | Polish, modernization opportunities, dead CSS |

## Report format

```markdown
# CSS / UI Review — [YYYY-MM-DD]

## Summary
[3–6 sentences: overall state, worst viewport/theme, biggest consistency gaps, what will be fixed]

## Inventory coverage
[Counts: pages N/N, components N/N, charts N/N, viewports x themes verified; link to full inventory table below]

## Scorecard
| Area (checklist.md) | Status (Pass/Partial/Fail) | Notes |
|---|---|---|
| 1. Architecture & cascade | | |
| 2. Design tokens | | |
| 3. Layout & responsiveness | | |
| 4. Component consistency | | |
| 5. Tables & data density | | |
| 6. Charts | | |
| 7. Forms & controls | | |
| 8. Theming & contrast | | |
| 9. Accessibility & motion | | |
| 10. Modern CSS & maintainability | | |

## Findings
### Critical / High / Medium / Low
- **[Title]** — area: [N], where: [component/route @ viewport/theme]
  - Evidence: [file:line, screenshot, probe output]
  - Fix: [concrete change] — chunk: [A/B/C]

## Structural proposals
[Each: problem, proposed shared pattern, files touched, why it is more scalable/user-friendly]

## Inventory
[Full table from Step 2]
```

## Additional resources

- Detailed criteria and how to check each: [checklist.md](checklist.md)
- Dead-class scan: [scripts/unused-classes.sh](scripts/unused-classes.sh)
