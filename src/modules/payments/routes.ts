import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { applyPricingQty, unpricedKg } from "../../lib/compute.js";
import { getNextBillNo } from "../../lib/billSequence.js";
import { computeTCS } from "../../lib/tax.js";
import type { PaymentDTO } from "../../../shared/types.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentSchema = z.object({
  partyId: z.string().min(1),
  date: z.string(),
  amount: z.number().positive(),
  advanceDeducted: z.number().nonnegative().optional(),
  grossAmount: z.number().positive().optional(),
  billNo: z.string().optional(),
  // Optional — derived from tradeType below (PURCHASE→PAY, SALE→RECEIVE) when omitted
  direction: z.enum(["PAY", "RECEIVE"]).optional(),
  tradeType: z.enum(["PURCHASE", "SALE"]),
  fundId: z.string().min(1),
  itemId: z.string().optional(),
  priceKg: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  tcsRate: z.number().nonnegative().optional(),
  tdsRate: z.number().nonnegative().optional(),
  method: z.string().optional(),
  notes: z.string().optional(),
  advanceDeductions: z.array(z.object({
    loanId: z.string(),
    amount: z.number().positive(),
  })).optional(),
});

function toDTO(p: {
  id: string; partyId: string; date: Date; amount: { toString(): string };
  advanceDeducted?: { toString(): string } | number | null;
  grossAmount?: { toString(): string } | number | null;
  direction: string; tradeType: string; fundId: string; billNo: string; itemId: string | null;
  priceKg: { toString(): string } | null; rate: { toString(): string } | null; method: string | null; notes: string | null;
  party: { name: string }; fund: { name: string };
}): PaymentDTO {
  return {
    id: p.id, partyId: p.partyId, partyName: p.party.name, date: p.date.toISOString().slice(0, 10),
    amount: p.amount.toString(),
    advanceDeducted: p.advanceDeducted != null ? p.advanceDeducted.toString() : "0",
    grossAmount: p.grossAmount != null ? p.grossAmount.toString() : p.amount.toString(),
    direction: p.direction as PaymentDTO["direction"],
    tradeType: p.tradeType as PaymentDTO["tradeType"], fundId: p.fundId, fundName: p.fund.name,
    billNo: p.billNo, itemId: p.itemId, priceKg: p.priceKg?.toString() ?? null, rate: p.rate?.toString() ?? null,
    method: p.method, notes: p.notes,
  };
}


const include = { party: true, fund: true } as const;

paymentsRouter.get("/", async (req, res, next) => {
  try {
    const { partyId, fundId } = req.query;
    const payments = await prisma.payment.findMany({
      where: {
        ...(partyId ? { partyId: String(partyId) } : {}),
        ...(fundId ? { fundId: String(fundId) } : {}),
      },
      include,
      orderBy: { date: "desc" },
    });
    res.json(payments.map(toDTO));
  } catch (err) { next(err); }
});

paymentsRouter.get("/:id", async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include });
    if (!payment) throw new ApiError(404, "Payment not found");
    res.json(toDTO(payment as any));
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/", async (req, res, next) => {
  try {
    const data = paymentSchema.parse(req.body);

    if (data.priceKg && data.priceKg > 0 && !(data.rate && data.rate > 0)) {
      throw new ApiError(400, "Rate is required when pricing quantity");
    }

    // Check pending unpriced weight
    if (data.priceKg && data.priceKg > 0) {
      const lots = await prisma.lot.findMany({
        where: { partyId: data.partyId, kind: data.tradeType, ...(data.itemId ? { itemId: data.itemId } : {}) },
        include: { fixings: true },
      });
      const totalPending = lots.reduce((s, l) => s + unpricedKg(l as any), 0);
      if (data.priceKg > totalPending + 0.0001) {
        throw new ApiError(400, `Cannot price ${data.priceKg} kg. Only ${totalPending.toFixed(3)} kg pending.`);
      }
    }
    
    const direction = data.direction || (data.tradeType === "PURCHASE" ? "PAY" : "RECEIVE");
    const billNo = data.billNo || await getNextBillNo(direction === "PAY" ? "PAY" : "REC");

    // Work out how the quantity spreads across pending lots, and reserve a
    // numbered bill for each resulting fixing. Allocated outside the
    // transaction because getNextBillNo does its own write.
    let pricingPlan: { lotId: string; kg: number; billNo: string }[] | null = null;
    if (data.priceKg && data.priceKg > 0 && data.rate) {
      const lots = await prisma.lot.findMany({
        where: { partyId: data.partyId, kind: data.tradeType, ...(data.itemId ? { itemId: data.itemId } : {}) },
        include: { fixings: true },
        orderBy: { date: "asc" },
      });
      const result = applyPricingQty(lots as any, {
        partyId: data.partyId, kind: data.tradeType, itemId: data.itemId,
        kg: data.priceKg, rate: data.rate,
      });
      if (result.leftover > 0.0001) {
        throw new ApiError(400, `Only part of the quantity could be priced. ${result.leftover.toFixed(3)} kg could not be allocated.`);
      }
      const prefix = data.tradeType === "PURCHASE" ? "PUR" : "SAL";
      pricingPlan = [];
      for (const alloc of result.allocated) {
        pricingPlan.push({ lotId: alloc.lotId, kg: alloc.kg, billNo: await getNextBillNo(prefix) });
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Validate advance deductions if provided
      let totalAdvanceDeducted = 0;
      if (data.advanceDeductions && data.advanceDeductions.length > 0) {
        for (const item of data.advanceDeductions) {
          const loan = await tx.loan.findUnique({ where: { id: item.loanId } });
          if (!loan || loan.partyId !== data.partyId) {
            throw new ApiError(400, `Advance record ${item.loanId} not found or does not belong to party`);
          }
          const bal = Number(loan.balanceAmount);
          if (item.amount > bal + 0.0001) {
            throw new ApiError(400, `Cannot deduct ${item.amount} from advance. Remaining balance is ${bal.toFixed(2)}`);
          }
          totalAdvanceDeducted += item.amount;
        }
      }

      // Create one numbered, tax-treated bill per allocation
      const createdFixingIds: string[] = [];
      if (pricingPlan) {
        for (const alloc of pricingPlan) {
          const fixingValue = alloc.kg * data.rate!;
          const tcs = await computeTCS(tx, data.partyId, new Date(data.date), fixingValue, data.tcsRate ?? null);
          const tdsAmount = data.tdsRate ? (fixingValue * data.tdsRate) / 100 : 0;
          const createdFixing = await tx.fixing.create({
            data: {
              lotId: alloc.lotId,
              date: new Date(data.date),
              kg: alloc.kg,
              rate: data.rate!,
              tcsRate: tcs.tcsRate,
              tcsAmount: tcs.tcsAmount,
              tdsRate: data.tdsRate || null,
              tdsAmount: tdsAmount || null,
              billNo: alloc.billNo,
              notes: `Priced with payment ${billNo}`,
            },
          });
          createdFixingIds.push(createdFixing.id);
        }
      }

      const gross = data.grossAmount ?? (data.amount + (totalAdvanceDeducted || (data.advanceDeducted ?? 0)));
      const createdPayment = await tx.payment.create({
        data: {
          partyId: data.partyId, date: new Date(data.date), amount: data.amount,
          advanceDeducted: totalAdvanceDeducted || (data.advanceDeducted ?? 0),
          grossAmount: gross,
          billNo: billNo,
          direction: direction,
          tradeType: data.tradeType,
          fundId: data.fundId, itemId: data.itemId || null,
          priceKg: data.priceKg || null, rate: data.rate || null,
          method: data.method || null, notes: data.notes || null,
        },
        include,
      });

      // Bills priced by this payment are settled by it
      for (const fixingId of createdFixingIds) {
        await tx.fixing.update({ where: { id: fixingId }, data: { paymentId: createdPayment.id } });
      }

      // Adjust loans and record AdvanceAdjustment links
      if (data.advanceDeductions && data.advanceDeductions.length > 0) {
        for (const item of data.advanceDeductions) {
          const loan = await tx.loan.findUnique({ where: { id: item.loanId } });
          if (loan) {
            const bal = Number(loan.balanceAmount);
            const newBal = Math.max(0, bal - item.amount);
            const newStatus = newBal <= 0.001 ? "SETTLED" : "PARTIALLY_SETTLED";
            await tx.advanceAdjustment.create({
              data: {
                paymentId: createdPayment.id,
                loanId: loan.id,
                amount: item.amount,
                date: new Date(data.date),
                notes: `Adjusted against payment bill ${billNo}`,
              },
            });
            await tx.loan.update({
              where: { id: loan.id },
              data: {
                balanceAmount: newBal,
                status: newStatus as any,
              },
            });
          }
        }
      }

      return createdPayment;
    });

    res.status(201).json(toDTO(payment));
  } catch (err) { next(err); }
});
