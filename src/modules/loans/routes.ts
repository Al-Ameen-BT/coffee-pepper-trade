import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import type { LoanDTO } from "../../../shared/types.js";

export const loansRouter = Router();
loansRouter.use(requireAuth);

const loanSchema = z.object({
  partyId: z.string().min(1),
  date: z.string(),
  amount: z.number().positive(),
  kind: z.enum(["LOAN_GIVEN", "LOAN_TAKEN", "ADVANCE_GIVEN", "ADVANCE_TAKEN"]),
  fundId: z.string().min(1),
  itemId: z.string().optional(),
  method: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
});

const repaySchema = z.object({
  date: z.string(),
  amount: z.number().positive(),
  fundId: z.string().min(1),
  method: z.string().optional(),
  notes: z.string().optional(),
});

function toDTO(l: {
  id: string; partyId: string; date: Date; amount: { toString(): string };
  balanceAmount: { toString(): string } | number; status: string;
  kind: string; fundId: string; itemId: string | null; method: string | null; purpose: string | null; notes: string | null;
  party: { name: string }; fund: { name: string }; item: { name: string } | null;
}): LoanDTO {
  return {
    id: l.id, partyId: l.partyId, partyName: l.party.name, date: l.date.toISOString().slice(0, 10),
    amount: l.amount.toString(),
    balanceAmount: l.balanceAmount.toString(),
    status: l.status as LoanDTO["status"],
    kind: l.kind as LoanDTO["kind"], fundId: l.fundId, fundName: l.fund.name,
    itemId: l.itemId, itemName: l.item?.name || null, method: l.method, purpose: l.purpose, notes: l.notes,
  };
}

const include = { party: true, fund: true, item: true } as const;

loansRouter.get("/", async (req, res, next) => {
  try {
    const { partyId, status, kind } = req.query;
    const loans = await prisma.loan.findMany({
      where: {
        ...(partyId ? { partyId: String(partyId) } : {}),
        ...(status ? { status: status as any } : {}),
        ...(kind ? { kind: kind as any } : {}),
      },
      include,
      orderBy: { date: "desc" },
    });
    res.json(loans.map(toDTO));
  } catch (err) { next(err); }
});

loansRouter.post("/", async (req, res, next) => {
  try {
    const data = loanSchema.parse(req.body);
    const loan = await prisma.loan.create({
      data: {
        partyId: data.partyId, date: new Date(data.date), amount: data.amount,
        balanceAmount: data.amount, status: "ACTIVE",
        kind: data.kind, fundId: data.fundId, itemId: data.itemId || null,
        method: data.method || null, purpose: data.purpose || null, notes: data.notes || null,
      },
      include,
    });
    res.status(201).json(toDTO(loan));
  } catch (err) { next(err); }
});

loansRouter.post("/:id/repay", async (req, res, next) => {
  try {
    const data = repaySchema.parse(req.body);
    const loan = await prisma.loan.findUnique({ where: { id: req.params.id } });
    if (!loan) throw new ApiError(404, "Loan or advance not found");

    const bal = Number(loan.balanceAmount);
    if (data.amount > bal + 0.0001) {
      throw new ApiError(400, `Cannot repay more than remaining balance (${bal.toFixed(2)})`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newBalance = Math.max(0, bal - data.amount);
      const newStatus = newBalance <= 0.001 ? "SETTLED" : "PARTIALLY_SETTLED";

      await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          fundId: data.fundId,
          amount: data.amount,
          date: new Date(data.date),
          method: data.method || null,
          notes: data.notes || null,
        },
      });

      return tx.loan.update({
        where: { id: loan.id },
        data: {
          balanceAmount: newBalance,
          status: newStatus as any,
        },
        include,
      });
    });

    res.json(toDTO(updated));
  } catch (err) { next(err); }
});
