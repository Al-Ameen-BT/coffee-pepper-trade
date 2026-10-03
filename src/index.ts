import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
import { dashboardRouter } from "./modules/statements/routes.js";
import { errorHandler } from "./lib/errorHandler.js";
import { integrityMiddleware } from "./middleware/integrity.js";
import { notFound } from "./lib/notFound.js";

const app = express();

// Trust Nginx reverse proxy headers for real client IP rate limiting
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
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
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
  res.setHeader("X-Request-ID", crypto.randomUUID());
  next();
});

const allowedOrigins = [
  config.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      if (config.NODE_ENV === "production") {
        if (origin === config.CLIENT_URL) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      } else {
        if (
          allowedOrigins.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
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
app.use("/api/v1/dashboard", dashboardRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  path.resolve(import.meta.dirname, "../client"),
  path.resolve(import.meta.dirname, "../../dist/client"),
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

app.listen(config.PORT, () => {
  console.log(`Uzhunnungal Traders API running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
