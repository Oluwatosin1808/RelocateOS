import "server-only";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  applicationSchema,
  createApplicationInputSchema,
  updateApplicationInputSchema,
  type Application,
  type ApplicationStatus,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from "@domain/schemas/application";
import { canTransition, utcDayKey } from "@domain/applications/quota";
import { getJob } from "@/lib/jobs/dal";

export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export async function listApplications(
  uid: string,
  opts: { status?: ApplicationStatus | null; limit?: number } = {},
): Promise<Application[]> {
  await connection();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  let query: FirebaseFirestore.Query = adminDb()
    .collection("applications")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit);
  if (opts.status) {
    query = adminDb()
      .collection("applications")
      .where("uid", "==", uid)
      .where("status", "==", opts.status)
      .orderBy("createdAt", "desc")
      .limit(limit);
  }
  const snap = await query.get();
  const apps: Application[] = [];
  for (const d of snap.docs) {
    const parsed = applicationSchema.safeParse({ id: d.id, ...d.data() });
    if (parsed.success) apps.push(parsed.data);
  }
  return apps;
}

export async function getApplication(id: string): Promise<Application | null> {
  await connection();
  const snap = await adminDb().doc(`applications/${id}`).get();
  if (!snap.exists) return null;
  const parsed = applicationSchema.safeParse({ id: snap.id, ...snap.data() });
  return parsed.success ? parsed.data : null;
}

/** Count submissions already recorded today (UTC) for quota. */
export async function countTodaySubmissions(uid: string): Promise<number> {
  await connection();
  const day = utcDayKey();
  const snap = await adminDb()
    .collection("applications")
    .where("uid", "==", uid)
    .where("quotaDay", "==", day)
    .where("status", "in", ["submitted", "external_confirmed", "in_review", "interview", "offer"])
    .count()
    .get();
  return snap.data().count;
}

/**
 * Create an application record for a real job.
 * - Loads the job to verify it exists and capture title/employer/country.
 * - Records `externalConfirmedAt` only when the user confirmed external apply.
 * - Sets `quotaDay` so the daily counter is accurate.
 */
export async function createApplication(
  uid: string,
  input: CreateApplicationInput,
): Promise<Application> {
  const parsedInput = createApplicationInputSchema.parse(input);
  const job = await getJob(parsedInput.jobId);
  if (!job) {
    throw new ApplicationError("Job not found.", "job_not_found");
  }

  const now = new Date().toISOString();
  const day = utcDayKey();

  const doc: Omit<Application, "id"> = {
    uid,
    jobId: job.id,
    jobTitle: job.title,
    employerName: job.employerName,
    country: job.country,
    status: parsedInput.externalConfirmed ? "external_confirmed" : "draft",
    methodUsed: parsedInput.methodUsed,
    notes: parsedInput.notes,
    submissionReceipt: parsedInput.submissionReceipt ?? null,
    externalConfirmedAt: parsedInput.externalConfirmed ? now : null,
    outcome: "",
    quotaDay: parsedInput.externalConfirmed || parsedInput.submissionReceipt ? day : "",
    createdAt: now,
    updatedAt: now,
  };

  const ref = await adminDb().collection("applications").add(doc);
  // Also advance the job status to shortlisted so it shows in the pipeline.
  await adminDb()
    .doc(`jobs/${job.id}`)
    .set({ status: "shortlisted", updatedAt: now }, { merge: true });

  return applicationSchema.parse({ id: ref.id, ...doc });
}

/**
 * Update an application's status or notes.
 * Enforces valid transitions server-side.
 */
export async function updateApplication(
  id: string,
  uid: string,
  input: UpdateApplicationInput,
): Promise<Application> {
  const parsedInput = updateApplicationInputSchema.parse(input);
  const existing = await getApplication(id);
  if (!existing || existing.uid !== uid) {
    throw new ApplicationError("Application not found.", "not_found");
  }

  if (parsedInput.status && parsedInput.status !== existing.status) {
    if (!canTransition(existing.status, parsedInput.status)) {
      throw new ApplicationError(
        `Cannot transition from "${existing.status}" to "${parsedInput.status}".`,
        "invalid_transition",
      );
    }
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (parsedInput.status !== undefined) patch.status = parsedInput.status;
  if (parsedInput.notes !== undefined) patch.notes = parsedInput.notes;
  if (parsedInput.outcome !== undefined) patch.outcome = parsedInput.outcome;

  await adminDb().doc(`applications/${id}`).set(patch, { merge: true });
  const updated = await getApplication(id);
  if (!updated) throw new ApplicationError("Application not found after update.", "not_found");
  return updated;
}
