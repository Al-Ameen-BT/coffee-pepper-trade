import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { applyPricingQty, unpricedKg } from "../../lib/compute.js";
import type { PaymentDTO } from "../../../shared/types.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentSchema = z.object({
  partyId: z.string().min(1),
  date: z.string(),
  amount: z.number().positive(),
  billNo: z.string().min(1),
  direction: z.enum(["PAY", "RECEIVE"]),
  tradeType: z.enum(["PURCHASE", "SALE"]),
  fundId: z.string().min(1),
  itemId: z.string().optional(),
  priceKg: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  method: z.string().optional(),
  notes: z.string().optional(),
});

function toDTO(p: {
  id: string; partyId: string; date: Date; amount: { toString(): string }; direction: string;
  tradeType: string; fundId: string; billNo: string; itemId: string | null;
  priceKg: { toString(): string } | null; rate: { toString(): string } | null; method: string | null; notes: string | null;
  party: { name: string }; fund: { name: string };
}): PaymentDTO {
  return {
    id: p.id, partyId: p.partyId, partyName: p.party.name, date: p.date.toISOString().slice(0, 10),
    amount: p.amount.toString(), direction: p.direction as PaymentDTO["direction"],
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

    const payment = await prisma.$transaction(async (tx) => {
      // Apply pricing if kg specified
      if (data.priceKg && data.priceKg > 0 && data.rate) {
        const lots = await tx.lot.findMany({
          where: { partyId: data.partyId, kind: data.tradeType, ...(data.itemId ? { itemId: data.itemId } : {}) },
          include: { fixings: true },
          orderBy: { date: "asc" },
        });
        const result = applyPricingQty(lots as any, {
          partyId: data.partyId, kind: data.tradeType, itemId: data.itemId,
          kg: data.priceKg, rate: data.rate,
        });
        for (const alloc of result.allocated) {
          await tx.fixing.create({
            data: { lotId: alloc.lotId, date: new Date(data.date), kg: alloc.kg, rate: data.rate!, notes: `Priced with payment ${data.billNo}` },
          });
        }
        if (result.leftover > 0.0001) {
          throw new ApiError(400, `Only part of the quantity could be priced. ${result.leftover.toFixed(3)} kg could not be allocated.`);
        }
      }

      return tx.payment.create({
        data: {
          partyId: data.partyId, date: new Date(data.date), amount: data.amount,
          billNo: data.billNo, direction: data.direction, tradeType: data.tradeType,
          fundId: data.fundId, itemId: data.itemId || null,
          priceKg: data.priceKg || null, rate: data.rate || null,
          method: data.method || null, notes: data.notes || null,
        },
        include,
      });
    });

    res.status(201).json(toDTO(payment));
  } catch (err) { next(err); }
});
