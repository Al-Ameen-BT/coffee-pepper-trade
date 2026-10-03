import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { fundBalance } from "../../lib/compute.js";
import { encrypt, decrypt, maskAccountNumber } from "../../lib/crypto.js";
import { ApiError } from "../../lib/errorHandler.js";
import type { FundDTO } from "../../../shared/types.js";

export const fundsRouter = Router();
fundsRouter.use(requireAuth);

const fundSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CASH", "CURRENT", "CC"]),
  opening: z.number().default(0),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
});

function toDTO(f: {
  id: string; name: string; type: string; opening: { toString(): string };
  bankName: string | null; accountNumber: string | null;
}, balance: number): FundDTO {
  const masked = maskAccountNumber(f.accountNumber);
  return {
    id: f.id, name: f.name, type: f.type as FundDTO["type"],
    opening: f.opening.toString(), bankName: f.bankName,
    accountNumber: masked, // Default to safe masked display
    accountNumberMasked: masked,
    balance: balance.toFixed(2),
  };
}

fundsRouter.get("/", async (_req, res, next) => {
  try {
    const [funds, payments, loans, otherTxns] = await Promise.all([
      prisma.fund.findMany({ orderBy: { name: "asc" } }),
      prisma.payment.findMany(),
      prisma.loan.findMany(),
      prisma.otherTransaction.findMany(),
    ]);
    res.json(funds.map((f) => toDTO(f, fundBalance(f as any, payments as any, loans as any, otherTxns as any))));
  } catch (err) { next(err); }
});

fundsRouter.post("/", async (req, res, next) => {
  try {
    const data = fundSchema.parse(req.body);
    const fund = await prisma.fund.create({
      data: {
        ...data,
        accountNumber: data.accountNumber ? encrypt(data.accountNumber) : null,
      },
    });
    res.status(201).json(toDTO(fund, Number(fund.opening)));
  } catch (err) { next(err); }
});

fundsRouter.put("/:id/opening", async (req, res, next) => {
  try {
    const { amount } = z.object({ amount: z.number() }).parse(req.body);
    const fund = await prisma.fund.update({
      where: { id: req.params.id },
      data: { opening: amount },
    });
    // We don't necessarily have all transactions to re-compute full balance easily here without a large query,
    // so we return the updated opening. The frontend will likely refetch the list.
    res.json({ id: fund.id, opening: fund.opening.toString() });
  } catch (err) { next(err); }
});

// Secure endpoint to reveal full decrypted bank account number to authorized authenticated users
fundsRouter.get("/:id/reveal-account", async (req, res, next) => {
  try {
    const fund = await prisma.fund.findUnique({ where: { id: req.params.id } });
    if (!fund) throw new ApiError(404, "Account not found");
    const decryptedNumber = decrypt(fund.accountNumber);
    res.json({ id: fund.id, accountNumber: decryptedNumber });
  } catch (err) { next(err); }
});

fundsRouter.get("/:id/movements", async (req, res, next) => {
  try {
    const [payments, loans, otherTxns] = await Promise.all([
      prisma.payment.findMany({ where: { fundId: req.params.id }, include: { party: true }, orderBy: { date: "desc" } }),
      prisma.loan.findMany({ where: { fundId: req.params.id }, include: { party: true }, orderBy: { date: "desc" } }),
      prisma.otherTransaction.findMany({ where: { fundId: req.params.id }, orderBy: { date: "desc" } }),
    ]);

    const rows = [
      ...payments.map((p) => ({
        date: p.date, type: "payment" as const, direction: p.direction,
        particular: `${p.direction === "PAY" ? "Purchase (Pay) to" : "Sale (Receive) from"} ${p.party.name}`,
        amount: Number(p.amount),
      })),
      ...loans.map((l) => ({
        date: l.date, type: "loan" as const, direction: l.kind === "LOAN_GIVEN" || l.kind === "ADVANCE_GIVEN" ? "PAY" as const : "RECEIVE" as const,
        particular: `${l.kind.replaceAll("_", " ")} · ${l.party.name}`,
        amount: Number(l.amount),
      })),
      ...otherTxns.map((o) => ({
        date: o.date, type: "other" as const, direction: o.type === "EXPENSE" ? "PAY" as const : "RECEIVE" as const,
        particular: `${o.type === "EXPENSE" ? "Expense" : "Income"} - ${o.category}${o.description ? ` (${o.description})` : ""}`,
        amount: Number(o.amount),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json(rows);
  } catch (err) { next(err); }
});
