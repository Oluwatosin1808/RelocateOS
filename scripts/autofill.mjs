#!/usr/bin/env node
/**
 * RelocateOS autofill assistant (Tier 2).
 *
 * Opens the employer's application page in a REAL headed browser, fills the
 * standard fields it can match confidently (name, email, phone, LinkedIn,
 * uploads your generated CV + cover letter), prints a fill report — and then
 * STOPS. It never clicks Submit. You answer custom questions and submit.
 *
 * Usage:
 *   npm run autofill -- <jobId>
 *
 * Env (or .env.local):
 *   RELOCATEOS_BASE_URL   default https://relocateos.vercel.app
 *   RELOCATEOS_EMAIL / RELOCATEOS_PASSWORD   (falls back to E2E_TEST_EMAIL/PASSWORD)
 *   NEXT_PUBLIC_FIREBASE_API_KEY             (in .env.local)
 */
import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: npm run autofill -- <jobId>");
  process.exit(1);
}

function readEnvLocal() {
  const out = {};
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const envLocal = readEnvLocal();
const BASE = process.env.RELOCATEOS_BASE_URL || "https://relocateos.vercel.app";
const API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || envLocal.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const EMAIL =
  process.env.RELOCATEOS_EMAIL ||
  process.env.E2E_TEST_EMAIL ||
  envLocal.E2E_TEST_EMAIL ||
  "";
const PASSWORD =
  process.env.RELOCATEOS_PASSWORD ||
  process.env.E2E_TEST_PASSWORD ||
  envLocal.E2E_TEST_PASSWORD ||
  "";

async function login() {
  if (!EMAIL || !PASSWORD) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const email = await rl.question("RelocateOS email: ");
    const password = await rl.question("RelocateOS password: ");
    rl.close();
    return { email: email.trim(), password };
  }
  return { email: EMAIL, password: PASSWORD };
}

async function loginAndCookie(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.idToken) throw new Error("Login failed: " + JSON.stringify(body).slice(0, 200));
  const sess = await fetch(`${BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: body.idToken }),
  });
  if (!sess.ok) throw new Error("Session failed: " + sess.status);
  const cookie = (sess.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { cookie, uid: body.localId };
}

// --- field heuristics: fill only confident matches, never submit ----------------
const FIELD_PATTERNS = [
  { key: "first_name", re: /(first[\s_-]?name|^name$|full[\s_-]?name)/i, answerKey: "full_name", split: "first" },
  { key: "last_name", re: /(last[\s_-]?name|surname|family[\s_-]?name)/i, answerKey: "full_name", split: "last" },
  { key: "email", re: /(e-?mail)/i, answerKey: "email" },
  { key: "phone", re: /(phone|tel(ephone)?[\s_-]?number|mobile)/i, answerKey: "phone" },
  { key: "linkedin", re: /(linked[\s_-]?in)/i, answerKey: "linkedin" },
];

const NEVER_MATCH = /(password|otp|captcha|confirm[\s_-]?email|newsletter|how did you hear)/i;

function fieldValue(answer, split) {
  const v = (answer?.value ?? "").trim();
  if (!split) return v;
  const parts = v.split(/\s+/);
  return split === "first" ? parts[0] ?? "" : parts.slice(1).join(" ");
}

(async () => {
  console.log(`RelocateOS autofill — job ${jobId}`);
  const { email, password } = await login();
  const { cookie } = await loginAndCookie(email, password);

  const pkg = await (
    await fetch(`${BASE}/api/applications/packet?jobId=${encodeURIComponent(jobId)}&format=json`, {
      headers: { Cookie: cookie },
    })
  ).json();
  if (!pkg?.job?.applicationUrl) throw new Error("No application URL for this job.");
  const answers = Object.fromEntries(pkg.answers.map((a) => [a.key, a]));
  console.log(`Job: ${pkg.job.title} at ${pkg.job.employerName}`);
  console.log(`Opening: ${pkg.job.applicationUrl}`);

  // Download the generated documents for upload
  const dir = join(tmpdir(), "relocateos-autofill");
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [href, name] of [
    [pkg.downloads.cv, "cv.docx"],
    [pkg.downloads.coverLetter, "cover-letter.docx"],
  ]) {
    const res = await fetch(`${BASE}${href}`, { headers: { Cookie: cookie } });
    if (res.ok) {
      const path = join(dir, `${jobId.slice(0, 8)}-${name}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const { writeFileSync } = await import("node:fs");
      writeFileSync(path, buf);
      files.push(path);
      console.log(`Downloaded ${name} (${buf.length} bytes)`);
    }
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  let url = pkg.job.applicationUrl;
  if (/greenhouse\.io/.test(url) && !url.includes("#")) url += "#app";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

  const filled = [];
  const skipped = [];

  // Text inputs / textareas / selects
  const fields = await page.locator("input:visible, textarea:visible, select:visible").all();
  for (const field of fields) {
    try {
      const tag = (await field.evaluate((el) => el.tagName)).toLowerCase();
      const type = ((await field.getAttribute("type")) || "").toLowerCase();
      const name = ((await field.getAttribute("name")) || "").toLowerCase();
      const id = ((await field.getAttribute("id")) || "").toLowerCase();
      const placeholder = ((await field.getAttribute("placeholder")) || "").toLowerCase();
      const aria = ((await field.getAttribute("aria-label")) || "").toLowerCase();
      const label =
        (
          await field.evaluate((el) => {
            const l =
              el.labels?.[0]?.textContent ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              "";
            return l;
          })
        ).toLowerCase() || "";
      const haystack = [name, id, placeholder, aria, label].join(" ");
      if (type === "hidden" || type === "file" || NEVER_MATCH.test(haystack)) continue;

      const match = FIELD_PATTERNS.find((p) => p.re.test(haystack));
      if (!match) {
        skipped.push(haystack.trim().slice(0, 60) || tag);
        continue;
      }
      const raw = fieldValue(answers[match.answerKey], match.split);
      if (!raw || raw.startsWith("NOT ON PROFILE")) {
        skipped.push(`${haystack.trim().slice(0, 40)} (answer missing on profile)`);
        continue;
      }
      if (tag === "select") continue; // never guess dropdowns
      await field.fill(raw.slice(0, 300));
      filled.push(`${haystack.trim().slice(0, 50)} ← ${match.answerKey}`);
    } catch {
      /* field vanished mid-pass — skip */
    }
  }

  // File inputs: first → CV, second → cover letter
  const fileInputs = await page.locator('input[type="file"]:visible, input[type="file"]').all();
  for (let i = 0; i < fileInputs.length && i < files.length; i++) {
    try {
      await fileInputs[i].setInputFiles(files[i]);
      filled.push(`file input #${i + 1} ← ${files[i].split(/[\\/]/).pop()}`);
    } catch {
      /* ignore */
    }
  }

  console.log("\n=== FILL REPORT ===");
  console.log("Filled:");
  for (const f of filled) console.log("  ✓ " + f);
  console.log("Skipped (fill these yourself):");
  for (const s of skipped) console.log("  · " + s);

  console.log(`
==========================================================
  The browser is now YOURS.
  1. Review everything the assistant filled in.
  2. Answer the remaining questions yourself (be truthful —
     sponsorship / salary / notice period matter for your visa).
  3. Click Submit yourself.
  4. In RelocateOS: "I applied — record it".
  The assistant will NOT submit anything.
==========================================================`);

  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  await browser.close().catch(() => {});
  console.log("Browser closed. Done.");
  process.exit(0);
})().catch((err) => {
  console.error("Autofill failed:", err.message);
  process.exit(1);
});
