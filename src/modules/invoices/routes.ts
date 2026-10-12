import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { getCompanyInfo } from "../../lib/company.js";
import { buildInvoiceSchema, createInvoiceFromFixings, toInvoiceDTO } from "../../lib/invoice.js";
import type { InvoiceDTO } from "../../../shared/types.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

/** List invoices, newest first. */
invoicesRouter.get("/", async (req, res, next) => {
  try {
    const { partyId, kind } = req.query;
    const company = await getCompanyInfo();
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(partyId ? { partyId: String(partyId) } : {}),
        ...(kind === "PURCHASE" || kind === "SALE" ? { kind } : {}),
      },
      include: { lines: true, party: true, payment: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json(invoices.map((i) => toInvoiceDTO(i, company)));
  } catch (err) {
    next(err);
  }
});

/** Candidate fixings for a payment — the trades this payment can invoice. */
invoicesRouter.get("/payment/:paymentId/available", async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { party: true },
    });
    if (!payment) throw new ApiError(404, "Payment not found");

    // Priced trades for this party that no invoice has claimed yet
    const fixings = await prisma.fixing.findMany({
      where: {
        billNo: { not: null },
        lot: { partyId: payment.partyId },
      },
      include: { lot: { include: { item: true } }, invoiceLine: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    res.json(
      fixings
        .filter((f: any) => !f.invoiceLine)
        .map((f: any) => ({
          fixingId: f.id,
          billNo: f.billNo,
          date: f.date.toISOString().slice(0, 10),
          description: f.lot.item.name,
          hsnCode: f.lot.item.hsnCode,
          kg: f.kg,
          rate: f.rate,
          amount: f.kg * f.rate,
        })),
    );
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id", async (req, res, next) => {
  try {
    const company = await getCompanyInfo();
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lines: true, party: true, payment: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    res.json(toInvoiceDTO(invoice, company));
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post("/", async (req, res, next) => {
  try {
    const input = buildInvoiceSchema.parse(req.body);
    const company = await getCompanyInfo();
    // Bill numbers are reserved inside createInvoiceFromFixings, which runs on
    // this transaction's connection — safe because no nested $transaction is
    // opened and the counter upsert joins the same unit of work.
    const invoice = await createInvoiceFromFixings(prisma, company, input);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});