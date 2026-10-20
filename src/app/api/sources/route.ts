import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { jobSourceSchema } from "@domain/schemas/job";
import { buildSourceId, searchOnlyCapabilities, sourceCreateSchema } from "@/lib/sources/schema";
import { buildAdapterForSource } from "@fn/integrations/registry";

const COLLECTION = "jobSources";

export async function GET() {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.sources.get", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "asc").get();
  const sources = snap.docs.map((d) => {
    const parsed = jobSourceSchema.safeParse({ id: d.id, ...d.data() });
    return parsed.success ? parsed.data : null;
  });
  log.info("sources_listed", { uid: user.uid, count: sources.length });
  return jsonOk({
    sources: sources.filter((s): s is NonNullable<typeof s> => s !== null),
  });
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.sources.post", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }
  const parsed = sourceCreateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(
      422,
      "validation",
      issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid source",
      correlationId,
    );
  }
  const input = parsed.data;
  // Reject incomplete adapter configuration up-front.
  const stub = buildAdapterForSource({
    id: buildSourceId(input.provider, input.configuration),
    provider: input.provider,
    displayName: input.displayName,
    enabled: input.enabled,
    capabilities: searchOnlyCapabilities(),
    supportedCountries: [],
    lastSuccessfulSyncAt: null,
    lastFailureAt: null,
    lastFailureReason: "",
    healthStatus: "unconfigured",
    jobsLastScan: 0,
    configuration: input.configuration,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  if (!stub) {
    return jsonError(
      422,
      "incomplete_config",
      input.provider === "greenhouse"
        ? "Greenhouse sources require configuration.boardToken."
        : "Lever sources require configuration.company.",
      correlationId,
    );
  }
  const id = buildSourceId(input.provider, input.configuration);
  const existing = await adminDb().doc(`${COLLECTION}/${id}`).get();
  if (existing.exists) {
    return jsonError(409, "exists", `Source "${id}" already exists.`, correlationId);
  }
  const now = new Date().toISOString();
  const record = {
    provider: input.provider,
    displayName: input.displayName,
    enabled: input.enabled,
    capabilities: searchOnlyCapabilities(),
    supportedCountries: [] as string[],
    lastSuccessfulSyncAt: null,
    lastFailureAt: null,
    lastFailureReason: "",
    healthStatus: "unconfigured",
    jobsLastScan: 0,
    configuration: input.configuration,
    updatedAt: now,
    createdAt: now,
  };
  const validated = jobSourceSchema.safeParse({ id, ...record });
  if (!validated.success) {
    return jsonError(500, "internal", "Built an invalid source record.", correlationId);
  }
  await adminDb().doc(`${COLLECTION}/${id}`).set(record);
  log.info("source_created", { uid: user.uid, sourceId: id, provider: input.provider });
  return jsonOk({ source: validated.data }, { status: 201 });
}
