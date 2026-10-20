import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { adminDb } from "@/lib/firebase/admin";
import { connection } from "next/server";
import {
  buildChecklist,
  buildBudgetEstimates,
  getRelocationDisclaimer,
  checklistItemSchema,
  type ChecklistItem,
} from "@domain/relocation/planner";
import { z } from "zod";

const getQuery = z.object({ country: z.enum(["NL", "BE"]).default("NL") });

/** GET /api/relocation/plan?country=NL — checklist + budget estimates. */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const url = new URL(request.url);
  const parsed = getQuery.safeParse({ country: url.searchParams.get("country") ?? "NL" });
  const country = parsed.success ? parsed.data.country : "NL";

  await connection();
  const snap = await adminDb().doc(`relocationPlans/${user.uid}_${country}`).get();
  const storedItems = snap.exists ? (snap.data()?.items as ChecklistItem[] | undefined) : undefined;

  const defaults = buildChecklist(country);
  // Merge stored completion state into defaults by id.
  const items = defaults.map((item) => {
    const stored = storedItems?.find((s) => s.id === item.id);
    return stored ? { ...item, completed: stored.completed, completedAt: stored.completedAt } : item;
  });

  return jsonOk({
    country,
    items,
    budgetEstimates: buildBudgetEstimates(country),
    disclaimer: getRelocationDisclaimer(country),
  });
}

const toggleSchema = z.object({
  country: z.enum(["NL", "BE"]),
  itemId: z.string().min(1).max(200),
  completed: z.boolean(),
});

/** POST /api/relocation/plan — toggle a checklist item. */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.relocation.plan", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, "validation", "Invalid toggle request.", correlationId);
  }
  const { country, itemId, completed } = parsed.data;

  await connection();
  const docId = `${user.uid}_${country}`;
  const snap = await adminDb().doc(`relocationPlans/${docId}`).get();
  const existing = snap.exists ? (snap.data()?.items as ChecklistItem[] | undefined) ?? [] : [];

  const now = new Date().toISOString();
  const updated = existing.map((item) =>
    item.id === itemId
      ? { ...item, completed, completedAt: completed ? now : null }
      : item,
  );
  // If item not yet in stored list, add it.
  if (!updated.find((i) => i.id === itemId)) {
    const defaults = buildChecklist(country);
    const base = defaults.find((i) => i.id === itemId);
    if (base) {
      updated.push({ ...base, completed, completedAt: completed ? now : null });
    }
  }

  await adminDb()
    .doc(`relocationPlans/${docId}`)
    .set({ uid: user.uid, targetCountry: country, items: updated, updatedAt: now }, { merge: true });

  log.info("relocation_item_toggled", { uid: user.uid, itemId, completed });
  return jsonOk({ ok: true });
}
