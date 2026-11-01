# CSS / UI review checklist

Use with [SKILL.md](SKILL.md). Each section lists **what** is checked and **how** to check it. Apply every section to every inventory row it is relevant to.

## 1. Architecture & cascade

What:
- Every rule lives in the correct layer file: tokens → `tokens.css`; element defaults → `base.css`; shell/grid → `layout.css`; reusable pieces → `components/*`; route-specific → `pages/*`; single-purpose helpers → `utilities.css`.
- Reusable component styles are not hidden in a page file (and page files do not restyle shared components without a scoped modifier).
- No duplicated rule blocks for the same pattern across files.
- Low, flat specificity: class selectors; no ids, no `!important`, no long descendant chains; nesting ≤ 3.
- Each new CSS file is imported in `styles/index.css` inside the right layer.

How:
- `rg -n '^\.[a-z-]+' frontend/src/styles -g '*.css'` and look for the same class defined in multiple files.
- For each page CSS file, check whether its classes are used outside that page (`rg -l '<class>' frontend/src -g '*.tsx'`); if yes, move to `components/`.
- `npm run lint:css` must pass with 0 warnings.

## 2. Design tokens

What:
- Colors only via `--color-*`, `--chart-*`, `--sidebar-*` (Stylelint blocks hex; also watch `rgb()`/`rgba()`/named colors outside tokens).
- Spacing via `--space-*`, radii via `--radius-*`, font sizes via `--text-*`, weights via `--weight-*`, shadows via `--shadow-*`.
- Controls meet `--tap-target` height on touch layouts.
- No magic numbers that duplicate a token value (e.g. `1rem` instead of `var(--space-md)`); repeated literal values signal a missing token.
- z-index values come from a small documented scale (add tokens if there are more than ~3 distinct values).
- Every token used exists; every token in light theme has a dark counterpart when it is a color.

How:
- `rg -n 'rgba?\(|#[0-9a-fA-F]{3,8}\b' frontend/src/styles -g '!tokens.css'`
- `rg -n '(margin|padding|gap)[^;]*[0-9.]+(rem|px)' frontend/src/styles` — compare to the `--space-*` scale.
- `rg -n 'font-size' frontend/src/styles | rg -v 'var\(--text'`
- `rg -o 'var\(--[a-z0-9-]+' frontend/src/styles frontend/src -g '*.{css,tsx,ts}' | sort -u` vs definitions in `tokens.css`.

## 3. Layout & responsiveness

What:
- No page-level horizontal scroll at 360px; content reflows rather than shrinking text.
- Breakpoints only `40rem` / `64rem` / `80rem`, one consistent direction per file (current code is desktop-first `max-width`; do not mix in the same component).
- Wide screens (≥ 80rem) use space sensibly: max content width or more grid columns, not stretched single lines of text.
- Grids use `repeat(auto-fit, minmax(…))` or explicit breakpoint columns; flex/grid children holding text or charts have `min-width: 0`.
- No fixed `width`/`height` in px on containers; use `max-width`, `min()`, `clamp()`, `aspect-ratio`.
- Sidebar / topbar shell works at every breakpoint (navigation reachable on phone, no content hidden behind fixed bars).
- Reusable cards/charts placed in different-width slots adapt with container queries (`container-type: inline-size`).
- Long strings (account names, descriptions, instrument names, emails) wrap or truncate with `overflow-wrap: anywhere` / ellipsis + `title`.

How:
- Overflow probe from SKILL.md Step 4 on every route x viewport.
- `rg -n '\bwidth:\s*[0-9]+px|\bheight:\s*[0-9]+px' frontend/src/styles`
- Inspect grids: `rg -n 'grid-template-columns' frontend/src/styles`.

## 4. Component consistency

What:
- One visual pattern per concept: card (`card.css`), button variants (`btn-primary`, secondary, `btn-link`, danger), badge, segmented control, page header (`PageHeader`), KPI card (`KpiCard`), chart card (`ChartCard`), status states (`StatusBlock`, `error-banner`, `empty-state`), setup checklist.
- Same spacing between section title and content on every page; consistent section gaps (`page-stack` or equivalent).
- Interactive states present and consistent: `:hover`, `:focus-visible`, `:active`, `[disabled]`/`:disabled`, `[aria-current]`, `[aria-pressed]`/`[aria-selected]`.
- Loading / error / empty states styled identically everywhere they occur.

How:
- For each concept, list every place it is rendered (`rg -n 'className="[^"]*<concept>' frontend/src`) and compare computed styles in the browser (`CSS.getComputedStyleForNode` via `browser_cdp`, or visual comparison).
- Look for ad-hoc lookalikes: elements styled like a card/button/badge without using the shared class.

## 5. Tables & data density

What:
- Tables (`table.css`, `LedgerTable`, `TransferTable`, `DetailTable`, `TagDetailTable`, holdings/trades) are usable at 360px: horizontal scroll inside a wrapper (never the page), or stacked/card layout for key columns.
- Numeric columns right-aligned with `font-variant-numeric: tabular-nums`; money and sign colors use `--color-positive` / `--color-negative` consistently.
- Header styles, row height, zebra/hover and sortable header affordance (`SortableTh`) consistent across tables.
- Inline-edit rows (`LedgerCreateRow`, `TransferCreateRow`, `CategoryCreateRow`) align with their columns and stay usable on touch.

How:
- At 360 and 768, scroll each table; confirm the page itself does not scroll horizontally.
- `rg -n 'tabular-nums|\.num' frontend/src/styles`.

## 6. Charts (Recharts)

What:
- Every chart sits in a parent with a defined height (or `aspect-ratio`) so `ResponsiveContainer` never collapses to 0 or overflows.
- Series and fills use `--chart-*` (through `chartColors.ts` / CSS vars), so dark theme switches automatically; no hardcoded colors in TSX.
- Axis ticks, legends, tooltips readable at 360px: tick font from `--text-xs`/`--text-sm`, fewer ticks or rotated/abbreviated labels on narrow widths, legend wraps instead of overflowing.
- Tooltip background/text/border follow theme tokens (check dark mode).
- Charts have an accessible name (`ChartCard` title / `aria-label`) and a non-color cue where meaning depends on color.
- Donut/allocation layouts (`.donut-layout`) reflow to a column on narrow containers.

How:
- Screenshot each chart at 360 / 768 / 1280 in both themes; resize the window and confirm the chart resizes.
- `rg -n '#[0-9a-fA-F]{3,8}|rgb' frontend/src/components -g '*.tsx' -g '*.ts'`.
- `rg -n 'ResponsiveContainer' -A2 frontend/src/components` — check `height`/`minHeight`.

## 7. Forms & controls

What:
- Inputs/selects outside auth/ledger cells use `.field-control`; consistent height, padding, radius, border and focus ring (`--focus-ring`).
- Labels always visible and associated; error text styled consistently (`error-banner` or field-level).
- Form grids (`form-grid`) collapse to one column on phones; buttons do not overflow.
- Inputs use `font-size` ≥ `1rem` on mobile to avoid iOS zoom.
- Touch targets ≥ `--tap-target`.

How:
- `rg -n '<(input|select|textarea)' frontend/src -g '*.tsx' -g '!*.test.tsx'` and confirm the class used.
- Tab through every form; check focus visibility in both themes.

## 8. Theming & contrast

What:
- Every color used in components resolves differently in light and dark where needed; no element unreadable in one theme.
- Text contrast ≥ 4.5:1 (body) / 3:1 (large text, UI component boundaries, focus ring, chart lines against background).
- `color-scheme` set per theme so native controls (date input, scrollbars) match.
- Muted text (`--color-text-muted`) still meets contrast on `--color-surface` and `--color-bg-elevated`.

How:
- Compute contrast for token pairs used together (text on surface, accent on surface, on-accent on accent, negative/positive on subtle backgrounds) for both themes.
- Visual pass of every route in dark theme.

## 9. Accessibility & motion

What:
- Visible `:focus-visible` on every interactive element; no `outline: none` without replacement.
- No information only on hover (tooltips, actions revealed on hover must also appear on focus and be reachable on touch).
- `prefers-reduced-motion: reduce` disables or shortens non-essential transitions/animations.
- Layout survives 200% zoom and user font-size increases (rem-based sizing, no fixed heights cutting text).
- Visually hidden text uses one shared utility class.

How:
- `rg -n 'outline:\s*(none|0)' frontend/src/styles`
- `rg -n 'transition|animation' frontend/src/styles` vs `rg -n 'prefers-reduced-motion' frontend/src/styles`.
- Keyboard pass per route.

## 10. Modern CSS & maintainability

What:
- Prefer logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) in new/edited rules.
- `gap` instead of margin hacks; `clamp()` for fluid type/spacing; `aspect-ratio` for media/charts; `:where()` to keep base selectors at zero specificity; `color-mix()` for tints (allowed by Stylelint).
- Container queries for components reused in slots of different width.
- Inline `style={{…}}` only for truly dynamic values — and then as a CSS custom property (`style={{ "--pct": … }}`) consumed by a class.
- No dead selectors; no commented-out blocks; class names describe purpose (BEM-like `block__element--modifier` where the file already uses it).
- Animations only on `transform`/`opacity`.

How:
- `bash .cursor/skills/css-ui-review/scripts/unused-classes.sh` then confirm each candidate with `rg -n '<class>' frontend/src`.
- `rg -n 'style=\{\{' frontend/src -g '*.tsx' -g '!*.test.tsx'`.
- `rg -n 'margin-(left|right|top|bottom)|padding-(left|right|top|bottom)' frontend/src/styles` as modernization candidates (do not mass-rewrite untouched rules; convert when editing a block).
