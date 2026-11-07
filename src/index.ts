import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { config } from "./config.js";
import { wafMiddleware, apiRateLimiter, authRateLimiter } from "./middleware/waf.js";
import { authRouter } from "./auth/routes.js";
import { partiesRouter } from "./modules/parties/routes.js";
import { itemsRouter } from "./modules/items/routes.js";
import { lotsRouter } from "./modules/lots/routes.js";
import { paymentsRouter } from "./modules/payments/routes.js";
import { fundsRouter } from "./modules/funds/routes.js";
import { loansRouter } from "./modules/loans/routes.js";
import { ledgerRouter } from "./modules/ledger/routes.js";
import { statementsRouter } from "./modules/statements/routes.js";
import { billsRouter } from "./modules/bills/routes.js";
import { otherTxnRouter } from "./modules/other-transactions/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { invoicesRouter } from "./modules/invoices/routes.js";
import { dashboardRouter } from "./modules/statements/routes.js";
import { errorHandler } from "./lib/errorHandler.js";
import { integrityMiddleware } from "./middleware/integrity.js";
import { notFound } from "./lib/notFound.js";

const app = express();
const appVersion = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")).version;

// Trust Nginx reverse proxy headers for real client IP rate limiting
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Pages use inline onclick handlers (share, print, close) and the print
        // stylesheet relies on inline style attributes. Without these the SPA
        // boots to a blank page in production while working fine in dev.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use((req, res, next) => {
  if (config.FORCE_HTTPS && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`${config.CLIENT_URL}${req.url}`);
  }
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
  res.setHeader("X-Request-ID", crypto.randomUUID());
  next();
});

// CORS Configuration: Allow same-host, configured CLIENT_URL, localhost, and LAN IPs
app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    const host = req.header("Host");

    // Direct / non-CORS requests
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }

    // Same-origin check: if origin matches current host header
    try {
      const originUrl = new URL(origin);
      if (host && (originUrl.host === host || originUrl.hostname === host.split(":")[0])) {
        return callback(null, { origin: true, credentials: true });
      }
    } catch {
      // Invalid origin URL
    }

    // Configured client URL (both HTTP and HTTPS)
    const clientUrlHttp = config.CLIENT_URL.replace(/^https:\/\//, "http://");
    const clientUrlHttps = config.CLIENT_URL.replace(/^http:\/\//, "https://");
    if (
      origin === config.CLIENT_URL ||
      origin === clientUrlHttp ||
      origin === clientUrlHttps
    ) {
      return callback(null, { origin: true, credentials: true });
    }

    // Localhost, loopback, and private LAN IP networks (10.x, 172.16-31.x, 192.168.x)
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1|(10|192\.168)\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
    ) {
      return callback(null, { origin: true, credentials: true });
    }

    // Safe rejection without throwing unhandled 500 Error
    return callback(null, { origin: false, credentials: true });
  })
);

// Payload size limit to prevent memory exhaustion / DoS attacks
app.use(express.json({ limit: "1mb" }));
app.use(integrityMiddleware);

// ─── Web Application Firewall (WAF) & Bot Defense ────────────────────────────
app.use(wafMiddleware);
app.use("/api/v1/auth", authRateLimiter);
app.use("/api", apiRateLimiter);

// API routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/parties", partiesRouter);
app.use("/api/v1/items", itemsRouter);
app.use("/api/v1/lots", lotsRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/funds", fundsRouter);
app.use("/api/v1/loans", loansRouter);
app.use("/api/v1/ledger", ledgerRouter);
app.use("/api/v1/reports", statementsRouter);
app.use("/api/v1/bills", billsRouter);
app.use("/api/v1/other-txn", otherTxnRouter);
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/invoices", invoicesRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: appVersion, timestamp: new Date().toISOString() });
});

// Any unmatched /api route returns 404 JSON instead of HTML
app.all("/api/*", notFound);

// In development, attach Vite dev server middleware so `npm run dev` serves the full frontend
if (config.NODE_ENV !== "production") {
  try {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.warn("Could not start Vite middleware in dev:", err);
  }
}

// Serve client build if available (production or pre-built fallback)
const clientDistCandidates = [
  path.resolve(process.cwd(), "dist/client"),
  path.resolve(__dirname, "../client"),
  path.resolve(__dirname, "../../dist/client"),
];
const clientDist = clientDistCandidates.find((dir) => fs.existsSync(path.join(dir, "index.html")));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

app.listen(config.PORT, config.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`Uzhunnungal Traders API running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
