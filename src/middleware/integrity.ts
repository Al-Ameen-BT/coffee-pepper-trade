import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config.js";

// ─── Request Integrity & Security Middleware ─────────────────────────────────
// Validates request timestamps, body integrity hashes, and adds audit headers.
// Designed for internal-only services where all traffic must be verified.

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes max clock drift

/**
 * Verifies request integrity:
 * 1. Validates X-Request-Timestamp is within acceptable drift (prevents replay attacks)
 * 2. Validates X-Body-Integrity SHA-256 hash matches the actual request body
 * 3. Logs X-Request-ID for audit trail
 */
export function integrityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip integrity checks for health endpoint and static assets
  if (req.path === "/api/health" || !req.path.startsWith("/api/")) {
    return next();
  }

  // 1. Timestamp validation — reject stale or future-dated requests (anti-replay)
  const timestamp = req.headers["x-request-timestamp"] as string | undefined;
  if (timestamp) {
    const requestTime = new Date(timestamp).getTime();
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_TIMESTAMP_DRIFT_MS) {
      res.status(400).json({ error: "Request timestamp expired or invalid. Clock drift exceeds 5 minutes." });
      return;
    }
  }

  // 2. Body integrity verification — detect tampered payloads
  const bodyIntegrity = req.headers["x-body-integrity"] as string | undefined;
  if (bodyIntegrity && req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    const computed = crypto.createHash("sha256").update(bodyStr).digest("hex");
    if (computed !== bodyIntegrity) {
      res.status(400).json({ error: "Request body integrity check failed. Payload may have been tampered with." });
      return;
    }
  }

  // 3. Attach request ID to response for audit correlation
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);

  next();
}
