# RelocateOS

A personal, production-minded AI job-discovery, application-automation and European
relocation workspace for a Nigerian technology professional targeting the Netherlands
and Belgium.

RelocateOS discovers **genuine vacancies** from permitted sources, scores them against a
**verified candidate profile**, assesses work-permit routes with **evidence (never
assumptions)**, generates **traceable application documents**, and submits applications
**only** through explicitly permitted, authorised integrations — with an atomically
enforced daily submission cap.

It never promises a job, a visa, sponsorship or a relocation date.

## Stack

- **Frontend:** Next.js 16 (App Router, Cache Components), React 19, TypeScript strict,
  Tailwind CSS 4, hand-rolled accessible UI kit, Lucide icons.
- **Backend:** Firebase Authentication (session cookies), Cloud Firestore, Firebase
  Storage, Cloud Functions (TypeScript), Cloud Scheduler-driven task queue.
- **AI:** provider abstraction (`openai-compatible` with structured outputs, or a
  deterministic `local-lexical` fallback — clearly labelled).
- **Email:** provider abstraction (Resend); notifications persist even when unconfigured.
- **Testing:** Vitest (unit + web), Firebase Emulator Suite (integration), Playwright (e2e).

## Quick start (local development — no cloud credentials required)

Prerequisites:

- Node.js 22+ (25 recommended)
- JDK 21+ (Firebase Emulator Suite requirement)
- npm 11+

```powershell
npm install
npm --prefix functions install
cp .env.example .env.local   # defaults are fine for emulator-based dev
npm run build:functions      # Cloud Functions must be compiled before the emulator loads them
npm run dev                  # starts Next.js (:3000) + Firebase emulators
```

Open http://localhost:3000, create an account, and complete onboarding.

Emulator ports (see `firebase.json`): Auth 9099, Firestore 8080, Storage 9199,
Functions 5001, Emulator UI 4000.

To run emulators and the web app separately:

```powershell
npm run emulators   # terminal 1
npm run dev:web     # terminal 2
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Build functions, then run web + emulators |
| `npm run build` | Production Next.js build |
| `npm run build:functions` | Compile Cloud Functions |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | CI checks |
| `npm test` | Unit + web tests (Vitest) |
| `npm run test:integration` | Emulator-backed integration tests |
| `npm run test:e2e` | Playwright end-to-end tests (mock adapters only) |
| `npm run emulators` | Firebase Emulator Suite only |

## Configuration

All configuration lives in `.env.example` (copy to `.env.local`).

- **No Firebase cloud project needed for local dev** — the app defaults to the emulator
  suite with project id `relocateos-dev`.
- **AI** (`AI_API_KEY` + `AI_PROVIDER=openai-compatible`) enables LLM-assisted analysis;
  without it the app uses deterministic rule-based analysis and labels it as such.
- **Email** (`EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`) enables digest delivery; without it
  notifications are stored with `deliveryStatus=provider_unconfigured`.
- **`ALLOW_TEST_ADAPTERS`** enables the mock-ATS submission adapter used by automated
  tests. It must remain `false` in production (enforced at startup).

Never prefix secrets with `NEXT_PUBLIC_`. Never commit `.env.local` or service-account
JSON files.

## Honesty model (important)

- Discovery ≠ application. Opening an application URL ≠ submission. Only a server-persisted
  receipt from a real submission system counts as "submitted".
- Greenhouse/Lever **public** APIs do **not** grant application-submission rights; jobs
  from them are classified `external_apply` / `manual_required`. The supported-auto-apply
  engine is real and quota-enforced, but today only activates for integrations that
  explicitly declare `submitApplications: true` (currently: the test adapter, and any
  future employer-authorised integration).
- Sponsorship status is an independent, evidence-backed assessment — never inferred from
  a salary filter or an AI guess.
- Immigration thresholds are stored as versioned rules with official source URLs, effective
  dates and freshness indicators. They are research aids, not legal advice.

## Documentation

- `design.md` — design system and product design specification
- `context.md` — engineering log, ADRs, phase checklist
- `docs/architecture.md` — system architecture and data flow
- `docs/integrations.md` — job-source capabilities and limitations
- `docs/security.md` — security model and rules
- `docs/deployment.md` — production deployment
- `docs/operations-runbook.md` — operating, pausing and troubleshooting

## Phased delivery

See the checklist in `context.md`. The app is runnable and tested at every phase boundary.
