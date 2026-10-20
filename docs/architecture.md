# RelocateOS — Architecture

## 1. System overview

```
┌───────────────────────────────┐
│ Next.js 16 (Vercel)           │  UI · Server Components · Server Actions/API
│  - Cache Components (PPR)     │  Data Access Layer (session → Firestore)
│  - Session-cookie auth        │
└──────────────┬────────────────┘
               │ Firestore (owner-scoped docs) · Storage (private)
┌──────────────▼────────────────┐
│ Firebase                      │
│  - Auth (email/password)      │
│  - Firestore + rules          │
│  - Storage + rules            │
│  - Cloud Functions            │
│     · scheduler tick (1/min)  │
│     · daily scan (06:00 AMS)  │
│     · task workers            │
│  - Cloud Scheduler            │
└──────┬───────────┬────────────┘
       │           │
       ▼           ▼
  Job sources   AI provider / Email provider
  (Greenhouse   (openai-compatible, Resend —
   public API,   both optional; honest
   Lever, …)     disabled states)
```

## 2. Request path & Cache Components

Next.js 16 runs with `cacheComponents: true` + `partialPrefetching: true`:

- Every authenticated page prerenders a **static shell** and streams user-specific content
  behind `<Suspense>` boundaries.
- `getCurrentUser` / `getCurrentUserDoc` (Data Access Layer, `src/lib/auth/dal.ts`) use
  `use cache: private` — session reads stay in the browser cache, never the server cache.
- `src/proxy.ts` performs an **optimistic** cookie-presence redirect to `/login`. It is
  not a security boundary; the DAL re-verifies the session cookie on every private render,
  and every API route calls `getSessionUser()` explicitly.

## 3. Authentication

1. Client signs in with the Firebase JS SDK (emulator locally, real project in prod).
2. Client POSTs the fresh ID token to `/api/auth/session`.
3. Server verifies the ID token (Admin SDK), creates a **Firebase session cookie**
   (14-day TTL, httpOnly, SameSite=Lax, Secure in prod), bootstraps `users/{uid}`.
4. All server code verifies the session cookie via `adminAuth().verifySessionCookie`.
5. Logout clears the cookie server-side and signs the client out.

## 4. Shared domain code

Pure, dependency-free domain modules live in `functions/src/domain/**` as the single
source of truth (schemas, normalisation, scoring, state machines, quota rules…).

- Cloud Functions compile them in place.
- Next.js imports them via the `@domain/*` tsconfig/turbopack alias (server-side only).
- Vitest aliases the same path.

No copying, no workspaces, no drift. Integration-only code (Admin SDK pipelines) stays in
`functions/src/**`; Next.js never imports it.

## 5. Background processing (Firestore-backed task queue)

Instead of Cloud Tasks (which has no official emulator and would fork local/prod
behaviour), RelocateOS uses a **durable Firestore task queue**:

- Producers (scheduled triggers, API routes) write `taskQueue/{taskId}` documents with
  `{ type, payload, status: "pending", runAt, attempts, correlationId }`.
- A worker tick (Cloud Scheduler → functions trigger, every minute in prod; same code in
  the functions emulator) claims tasks with a **Firestore transaction**
  (`pending → processing`) so two workers can never process the same task.
- Completion sets `done`; transient failures retry with **bounded exponential backoff +
  jitter** (respecting `Retry-After` when present); exhausted tasks move to `dead` (DLQ)
  and are visible in Automation → Queue with an owner-only retry action.
- Every stage is **idempotent**: side effects are keyed by deterministic IDs
  (e.g. job id = `provider__sourceJobId`), and runs are guarded by scan-run locks.

Pipeline stages (added across phases): source discovery → normalise/dedup → AI analysis →
sponsorship assessment → document drafting → submission → notifications.

## 6. Scheduling

**Cloud Scheduler is the single authoritative scheduler** (Vercel Cron is deliberately
unused for scanning to avoid duplicate execution):

| Job | Schedule | Target |
|---|---|---|
| Worker tick | every minute (prod) | functions `workerTick` |
| Daily scan | 06:00 Europe/Amsterdam (DST-aware) | functions `dailyScan` → enqueues tasks |

Stored timestamps are UTC; the user-facing schedule timezone is `Europe/Amsterdam`
(same civil zone as Brussels); DST is handled by IANA rules, never fixed offsets.

Manual "Run Scout Now" hits an authenticated API route that enqueues a scan with
concurrency + rate guards.

## 7. Data model (summary)

Owner key = Firebase Auth UID. Full field lists in the spec/§11 and in
`functions/src/domain/schemas/*`. Collections: `users`, `candidateProfiles`,
`jobSources`, `jobs`, `jobScores`, `sponsorshipAssessments`, `documents`,
`applications`, `submissionLedger` (server-write-only), `automationRuns`, `taskQueue`,
`notifications`, `auditLogs`, `immigrationRules`, `userSettings`, `relocationTasks`.

## 8. Security model (summary)

- Default-deny Firestore/Storage rules; owner-scoped reads/writes; ledger and queue are
  server-only; document files are readable only through short-lived signed URLs.
- Rules are the perimeter; **every write is also validated server-side with Zod**.
- Secrets live only in env/Secret Manager; the Admin SDK never ships to the browser.
- Structured logs redact tokens/keys/emails; CV contents never logged.
- See `docs/security.md` for the full review checklist.

## 9. Failure handling & observability

- Correlation IDs on every request and task; structured JSON logs.
- Source adapters report real health (last success/failure, credential state); a missing
  credential disables the capability with an explanation — never a fake success.
- Partial failures are recorded per source; one bad source never aborts the run.
- Dead-letter set for exhausted tasks; owner retry actions.

## 10. Local vs production parity

| Concern | Local | Production |
|---|---|---|
| Auth/Firestore/Storage | Emulator Suite | Real project |
| Functions | Emulator (watch mode) | Deployed (europe-west4) |
| Scheduler | Emulator doesn't run cron; use "Run Scout Now" or `npm run emulators` + manual | Cloud Scheduler |
| AI / Email | Optional (deterministic fallbacks) | Configured providers |
| Test adapter | Allowed when `ALLOW_TEST_ADAPTERS=true` | Hard-disabled at startup |
