import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

// ─── 1. Known Malicious Bot / Vulnerability Scanner Signatures ───────────────
const BOT_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /dirbuster/i,
  /gobuster/i,
  /wpscan/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /shodan/i,
  /censys/i,
  /acunetix/i,
  /havij/i,
  /hydra/i,
  /burpcollaborator/i,
  /openvas/i,
  /nessus/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /ahrefsbot/i,
];

// ─── 2. Vulnerability Probe / Attack Path Signatures ──────────────────────────
const BLOCKED_PATHS = [
  /wp-login/i,
  /wp-admin/i,
  /wp-content/i,
  /wp-includes/i,
  /xmlrpc\.php/i,
  /phpmyadmin/i,
  /pma/i,
  /\.env/i,
  /\.git/i,
  /\.aws/i,
  /\.ssh/i,
  /cgi-bin/i,
  /actuator/i,
  /\.ds_store/i,
  /etc\/passwd/i,
  /win\.ini/i,
  /solr/i,
  /eval-stdin\.php/i,
  /vendor\/phpunit/i,
];

// ─── 3. Exploit Payload Signatures (SQLi, XSS, Path Traversal) ───────────────
const INJECTION_PATTERNS = [
  /(\b(union(\s+all)?)\s+select\b)/i,
  /(\bselect\b.+\bfrom\b.+\bwhere\b)/i,
  /(<script\b[^>]*>[\s\S]*?<\/script>)/i,
  /(javascript:\s*[\s\S]+)/i,
  /(onerror\s*=\s*['"][^'"]*['"])/i,
  /(onload\s*=\s*['"][^'"]*['"])/i,
  /(\.\.\/|\.\.\\){2,}/, // Path traversal ../../ or ..\..\
];

/**
 * Checks whether a given string value contains known exploit payload patterns.
 */
function containsMaliciousPayload(value: unknown): boolean {
  if (typeof value === "string") {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((v) => containsMaliciousPayload(v));
  }
  return false;
}

/**
 * Extracts client IP from x-forwarded-for or Express connection remoteAddress.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

// ─── 4. Core WAF Middleware ──────────────────────────────────────────────────
/**
 * Inspects all incoming HTTP requests for bot User-Agents, exploit paths,
 * honeypot triggers, and malicious injection payloads.
 */
export function wafMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Block known scanner User-Agents
  const userAgent = req.headers["user-agent"] || "";
  if (BOT_USER_AGENTS.some((pattern) => pattern.test(userAgent))) {
    res.status(403).json({ error: "Access denied by WAF: suspicious user agent detected" });
    return;
  }

  // 2. Block vulnerability probes and scanner attack paths
  const urlPath = req.path || req.originalUrl || "";
  if (BLOCKED_PATHS.some((pattern) => pattern.test(urlPath))) {
    res.status(403).json({ error: "Access denied by WAF: prohibited resource probe" });
    return;
  }

  // 3. Honeypot trap validation for bot submissions
  if (req.body && typeof req.body === "object") {
    if (req.body.hp_field || req.body.website_url || req.body.phone_secondary) {
      res.status(403).json({ error: "Access denied: automated bot detected" });
      return;
    }
  }

  // 4. Payload inspection (query params & JSON body)
  if (containsMaliciousPayload(req.query) || containsMaliciousPayload(req.body)) {
    res.status(403).json({ error: "Access denied by WAF: malicious payload detected" });
    return;
  }

  next();
}

// ─── 5. In-Memory Sliding-Window Rate Limiter ────────────────────────────────
interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipInTests?: boolean;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, message = "Too many requests. Please try again later.", skipInTests = true } = options;
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up old entries every 5 minutes to avoid memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it doesn't block process exit in test/script environments
  if (interval.unref) interval.unref();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    if (skipInTests && config.NODE_ENV === "test") {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    let record = store.get(ip);
    if (!record) {
      record = { timestamps: [] };
      store.set(ip, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);

      res.setHeader("Retry-After", Math.max(1, retryAfterSec));
      res.setHeader("RateLimit-Limit", maxRequests);
      res.setHeader("RateLimit-Remaining", 0);
      res.setHeader("RateLimit-Reset", retryAfterSec);

      res.status(429).json({ error: message, retryAfterSeconds: Math.max(1, retryAfterSec) });
      return;
    }

    record.timestamps.push(now);
    res.setHeader("RateLimit-Limit", maxRequests);
    res.setHeader("RateLimit-Remaining", Math.max(0, maxRequests - record.timestamps.length));

    next();
  };
}

// ─── 6. Pre-configured Limiters ──────────────────────────────────────────────
/**
 * Strict rate limiter for authentication routes (login / register).
 * Max 10 requests per 5 minutes per IP to stop credential-stuffing and brute-force bots.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,
  message: "Too many authentication attempts. Please wait 5 minutes before trying again.",
});

/**
 * Standard rate limiter for all API endpoints.
 * Max 150 requests per minute per IP to block scraper bots and API flooding.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 150,
  message: "Rate limit exceeded. Too many requests from this IP.",
});
