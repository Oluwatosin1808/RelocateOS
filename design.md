# RelocateOS — Design System & Product Design Specification

Version: 1.0 (Phase 0)
Status: Living document. UI must stay consistent with these tokens.

---

## 1. Product character

RelocateOS is a **personal career-operations workspace**, not a marketing product and not a
generic AI dashboard. The interface should read like a serious operations console used daily
by one operator (the candidate). Consequences:

- Density over decoration. Tables and lists carry the product; charts only appear where a
  real metric from persisted data exists.
- No glassmorphism, no gradient hero sections, no oversized decorative illustrations, no
  emoji-as-iconography, no "AI sparkle" motifs.
- Every number on screen is traceable to a persisted record. Unknown data is rendered as
  `Unknown` / `Not verified`, never as a fabricated value or a zero that implies zero.
- Colour is used for status and emphasis, never for ornament. One accent hue (deep navy)
  plus a small semantic status palette.

## 2. Colour tokens

Defined as CSS custom properties via Tailwind v4 `@theme` in `src/app/globals.css`.

| Token | Value | Usage |
|---|---|---|
| `--color-canvas` | `#F7F7F5` | App background (warm near-white, editorial paper feel) |
| `--color-surface` | `#FFFFFF` | Cards, panels, tables |
| `--color-surface-muted` | `#F2F2EF` | Table headers, subtle bands, hover fills |
| `--color-border` | `#E4E4E0` | Default 1px borders |
| `--color-border-strong` | `#D0D0CA` | Emphasised borders, input borders |
| `--color-ink` | `#16181D` | Primary text |
| `--color-ink-muted` | `#5C6169` | Secondary text |
| `--color-ink-subtle` | `#878C94` | Tertiary text, placeholders, timestamps |
| `--color-accent` | `#12314F` | Deep navy — primary actions, active nav, links |
| `--color-accent-hover` | `#0C2439` | Hover state |
| `--color-accent-subtle` | `#E8EEF4` | Selected rows, accent washes |
| `--color-success` | `#1B6B4A` | Verified, submitted, healthy |
| `--color-success-subtle` | `#E6F2EC` | |
| `--color-warning` | `#8A5A00` | Unverified, stale rules, quota near limit |
| `--color-warning-subtle` | `#FBF2DE` | |
| `--color-danger` | `#9B2C2C` | Failed, blocked, explicitly unavailable |
| `--color-danger-subtle` | `#F9E8E8` | |
| `--color-info` | `#1F5F8B` | Informational chips, links in prose | 
| `--color-info-subtle` | `#E7F0F6` | |

Match-score ramp (used ONLY for score meters, never decoratively):

| Range | fg | bg |
|---|---|---|
| 0–49 | `#5C6169` | `#F2F2EF` |
| 50–69 | `#8A5A00` | `#FBF2DE` |
| 70–84 | `#1F5F8B` | `#E7F0F6` |
| 85–100 | `#1B6B4A` | `#E6F2EC` |

Accessibility: all text/background pairs meet WCAG AA (≥4.5:1 for body, ≥3:1 for large text
and UI borders). Semantic colour is always paired with a text label — never colour alone.

## 3. Typography

- **UI / prose:** Geist Sans (`geist` package, self-hosted via `next/font`, no build-time
  network dependency). Weights 400, 500, 600, 700.
- **Data / identifiers / money:** Geist Mono for job IDs, hashes, URLs, salary figures in
  tables, correlation IDs. Tabular figures enabled.
- Scale (rem):

| Style | Size / line | Weight | Notes |
|---|---|---|---|
| display | 1.875 / 2.25 | 600 | Page titles, `-0.02em` tracking |
| h1 | 1.5 / 2 | 600 | Section titles |
| h2 | 1.25 / 1.75 | 600 | Card titles |
| h3 | 1.0625 / 1.5 | 600 | Subsections |
| body | 0.9375 / 1.55 | 400 | Default UI text (15px — dense but readable) |
| small | 0.8125 / 1.4 | 400 | Secondary rows, table cells |
| eyebrow | 0.6875 / 1.2 | 600 | Uppercase, `0.08em` tracking, ink-subtle — section labels |

Rules: sentence case for headings and buttons (no ALL-CAPS buttons). Uppercase only for
`eyebrow` micro-labels. Numbers in metrics use Geist Mono at 1.5rem with tabular figures.

## 4. Spacing, density, layout

- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 px.
- Radius: 6px (controls), 8px (cards), 10px (dialogs). No pill shapes except status chips.
- Borders: 1px `--color-border` default. Shadows are rare: only dialogs and popovers get
  `0 8px 24px rgba(22,24,29,0.10)`. Cards use borders, not shadows.
- App frame:
  - Sidebar: fixed 232px, `surface` background, right border; collapses to icon rail ≤1024px,
    drawer ≤768px.
  - Topbar: 56px, sticky; contains global search (later phases), **automation state switch**,
    **daily quota meter** (`3/10 submitted today`), user menu.
  - Content: max-width 1360px, horizontal padding 24px (16px mobile).
- Table density: row height 40px, cell padding 10px 12px, header 36px with eyebrow labels.
  Sticky header on scrollable tables. Zebra: none — hover fill only (`surface-muted`).
- Job cards (Scout grid view): compact horizontal layout, not tall poster cards.

## 5. Core components (hand-rolled, shadcn-equivalent, accessible)

All in `src/components/ui`, built on native HTML + Tailwind, no component-library runtime
except where noted. Every interactive element: visible focus ring
(`focus-visible:outline-2 outline-accent outline-offset-2`), min 36px hit area.

| Component | Notes |
|---|---|
| `Button` | variants: primary (accent), secondary (bordered), ghost, danger; sizes sm/md; loading state disables + spinner |
| `Input`, `Textarea`, `Select` (native), `Checkbox`, `Switch` | label association, error text via `aria-describedby`, `aria-invalid` |
| `FormField` | label + hint + error wrapper used by RHF + Zod forms |
| `Card`, `SectionHeader` | standard panel with eyebrow + title + actions slot |
| `Badge` / `StatusChip` | status palette mapping; includes text label |
| `ScoreMeter` | horizontal 100-point meter + numeric value; ramp colours; `aria-label` "Match score 76 of 100" |
| `DataTable` | typed column defs, sticky header, empty/loading/error slots, row click optional |
| `Tabs` | proper `role="tablist"` keyboard support |
| `Dialog` | native `<dialog>` + `showModal()`, focus trap, Esc close, labelled by title |
| `Toast` | minimal live-region toast system (`polite`), auto-dismiss, max 3 |
| `Skeleton` | shimmer-free pulse placeholder matching content shape |
| `EmptyState` | icon + title + explanation + primary action; used for every empty list |
| `ErrorState` | explains what failed, correlation ID if available, retry action |
| `EvidenceBlock` | renders sponsorship/rule evidence: source label, URL (external), excerpt, confidence, observed date, verification status |
| `ProvenanceTag` | small chip: `verified` / `user-asserted` / `ai-preliminary` / `unknown` — used on profile facts and generated document claims |
| `QuotaMeter` | topbar + dashboard daily submission quota |
| `RelativeTime` | client component for "2h ago" with absolute tooltip |

Icons: `lucide-react` only. No icon fonts, no emoji.

## 6. Information architecture & navigation

Sidebar (top → bottom):

1. **Overview** — `/` dashboard
2. **Job Scout** — `/scout` (+ `/scout/[jobId]` detail)
3. **Applications** — `/applications` (Kanban + table toggle, `/applications/[id]`)
4. **Documents** — `/documents` (+ `/documents/[id]` editor/preview)
5. **Candidate Profile** — `/profile`
6. **Relocation Planner** — `/relocation`
7. **Automation** — `/automation` (sources registry, scheduler health, run history, pause)
8. **Settings** — `/settings` (notifications, retention, privacy, data export, account)

Auth area: `/login`, `/onboarding` (multi-step, gated until completed).

Every page defines four states explicitly: **loading** (skeleton), **empty** (EmptyState with
next action), **error** (ErrorState with retry), **ready**. No page may flash raw JSON or
empty charts while loading.

## 7. Page-level design notes

### 7.1 Overview (dashboard)
Grid of metric tiles (label eyebrow + mono number + delta/period footnote), each tile links
to its filtered list. Metrics: jobs today, ≥ threshold matches, sponsorship-verified,
awaiting approval, submitted (today / total), interviews, quota remaining, follow-ups due.
Below: "Today's pipeline" activity feed (real `automationRuns`/audit events), "Top matches
today" list with score meters + one-line explanation, and a conversion funnel (discovered →
scored → drafted → approved → submitted → responded) computed from persisted data with the
date range printed. If a metric has no data, show `—` with "no records yet", never `0%`.

### 7.2 Job Scout
Filter bar (chips + selects): country, city/region, role family, salary min, seniority,
workplace type, English suitability, sponsorship evidence state, match score ≥, published
within, application method. Filters encode to URL query params (shareable, back-button
safe). Default sort: match score desc, then freshness. Table view default (dense), card view
optional. Row: title+employer, location, salary, score meter, sponsorship chip, method chip,
published/discovered dates, actions (open, shortlist).

Job detail page: two-column (main + rail). Main: original description (sanitised HTML or
text), match explanation (dimension scores + evidence bullets), missing qualifications list,
sponsorship assessment card (status + EvidenceBlocks + rule freshness), application history.
Rail: actions (shortlist, prepare documents, open application URL, add manual note), facts
panel (salary, type, dates, source link with rel="noopener"), provenance footer
(source, content hash, last seen).

### 7.3 Applications
Kanban: columns for the status set (grouped: Pipeline / Awaiting you / In flight / Outcome).
Cards show job, score, method, last event time. Drag-and-drop updates status via API with
audit record; manual corrections allowed and attributed ("you, 12:04"). Table view: full
columns + filters + CSV export. Detail drawer/page: timeline of state transitions with
actor + timestamp, documents attached, submission receipt (only genuine evidence), follow-up
controls.

### 7.4 Documents
List grouped by job. Each doc: type (CV/cover letter), version, validation status
(pass/needs-review), claim provenance summary ("38 claims: 36 verified, 2 need review").
Editor: structured sections (not free-form-only), per-claim provenance popover, edit → new
version, export DOCX / print-PDF. Validation panel lists any claim not traceable to profile.

### 7.5 Candidate Profile
Sectioned form (contact, summary, experience, education, skills, projects, certifications,
languages, authorisation, preferences, CV files). Facts display `ProvenanceTag`. CV import:
upload → extract → review screen showing each extracted fact with accept/edit/reject →
accepted facts written to profile as `user-asserted`. Completeness meter with "what's
missing for applications" checklist.

### 7.6 Relocation Planner
Checklist grouped by phase (permit research → documents → offer/sponsorship → visa → housing
→ budget → arrival). Every item tagged: `general-guidance` (default, styled neutral) vs
`verified-requirement` (styled with official source link + rule version). User can add/edit/
recheck items. Budget panel: transparent assumption inputs (rent, insurance, deposit) with
computed monthly buffer; assumptions visible, nothing presented as official.

### 7.7 Automation
Tabs: **Sources** (registry table: provider, config, enabled, health, last success/failure,
rate limit, capabilities as explicit chips incl. `submit: no`), **Scheduler** (next run,
last run, timezone note, Europe/Amsterdam + DST note), **Runs** (run history with per-stage
counts and errors), **Queue** (pending/failed tasks, dead-letter list, owner retry buttons).
Global pause switch at top with confirmation dialog explaining in-flight semantics.

### 7.8 Settings
Notifications (digest time, thresholds, categories, test-send), privacy (data export,
retention periods, subprocessor list, AI-processing disclosure with provider name), account
(delete with typed confirmation).

## 8. Motion & feedback

- Transitions: 120–160ms ease-out on colour/background/opacity; no layout animations.
- Skeletons pulse opacity 0.5→1 over 1.2s; used only for first load, not background refresh.
- Optimistic UI only for reversible actions (filters, view toggles). Status changes, quota
  actions, and submissions wait for server confirmation before reflecting success.
- Submission actions ALWAYS show server-confirmed state. A clicked button never renders
  "Submitted" — only a persisted receipt does.

## 9. Empty / error / loading copy guidelines

- Empty states name the gap and the next action ("No sources configured. Add a Greenhouse
  board to start discovering jobs.").
- Errors: what failed, whether data is safe, what the user can do, correlation ID in mono.
- Loading: skeleton matching final layout; long operations (>2s) show stage text
  ("Scanning 3 sources…").

## 10. Responsive behaviour

- ≥1280px: full sidebar + multi-column layouts.
- 1024–1279: icon rail sidebar; dashboard 2-col metrics.
- 768–1023: drawer nav; tables horizontally scroll with sticky first column.
- <768: single column; Kanban becomes vertical list with status filter; filters in sheet.

## 11. Files

- Tokens + base: `src/app/globals.css`
- Components: `src/components/ui/*`
- Feature composites: `src/components/{dashboard,jobs,applications,profile,relocation,automation}/*`
- This document is the source of truth for visual decisions; deviations must be recorded here.
