import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { config } from "./config.js";
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
import { dashboardRouter } from "./modules/statements/routes.js";
import { errorHandler } from "./lib/errorHandler.js";
import { notFound } from "./lib/notFound.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

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
      if (
        allowedOrigins.includes(origin) ||
        (config.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());

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
  console.log(`Hill Trade Ledger API running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

