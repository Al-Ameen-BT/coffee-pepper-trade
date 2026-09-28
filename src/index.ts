import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
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

app.use(helmet());
app.use(cors({ origin: config.CLIENT_URL, credentials: true }));
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

// Serve client build in production
if (config.NODE_ENV === "production") {
  const clientDist = path.resolve(import.meta.dirname, "../client");
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
