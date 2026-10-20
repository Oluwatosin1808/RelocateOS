import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

/**
 * Phase 1: minimal functions entrypoint so the emulator and deploy pipeline
 * are wired. Scheduled scans and workers live under functions/src/{scheduled,jobs,...}.
 */
export const health = onRequest({ region: "europe-west4" }, (_req, res) => {
  logger.info("health_check");
  res.status(200).json({
    ok: true,
    service: "relocateos-functions",
    time: new Date().toISOString(),
  });
});

// Scheduled discovery scan — runs every 6 hours.
export { scheduledScan } from "./scheduled/scan";
