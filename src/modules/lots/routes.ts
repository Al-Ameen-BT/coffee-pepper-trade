import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { pricedKg, unpricedKg, fixingValue } from "../../lib/compute.js";
import type { LotDTO } from "../../../shared/types.js";

export const lotsRouter = Router();
lotsRouter.use(requireAuth);

const lotSchema = z.object({
  kind: z.enum(["PURCHASE", "SALE"]),
  partyId: z.string().min(1),
  itemId: z.string().min(1),
  date: z.string(),
  totalKg: z.number().positive().optional(),
  grossWeightKg: z.number().positive().optional(),
  bagCount: z.number().int().nonnegative().optional(),
  bagTareKg: z.number().nonnegative().optional(),
  moisturePercent: z.number().nonnegative().optional(),
  driageDeductionKg: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  billNo: z.string().optional(),
  rate: z.number().positive().optional(),
  fixKg: z.number().positive().optional(),
});

function toDTO(l: {
  id: string; kind: string; partyId: string; itemId: string; date: Date;
  totalKg: { toString(): string };
  grossWeightKg?: { toString(): string } | number | null;
  bagCount?: number | null;
  bagTareKg?: { toString(): string } | number | null;
  moisturePercent?: { toString(): string } | number | null;
  driageDeductionKg?: { toString(): string } | number | null;
  notes: string | null; billNo: string | null;
  party: { name: string }; item: { name: string };
  fixings: { kg: { toString(): string }; rate: { toString(): string } }[];
}): LotDTO {
  const priced = pricedKg(l as any);
  const unpriced = unpricedKg(l as any);
  const value = fixingValue(l as any);
  return {
    id: l.id, kind: l.kind as LotDTO["kind"], partyId: l.partyId, partyName: l.party.name,
    itemId: l.itemId, itemName: l.item.name, date: l.date.toISOString().slice(0, 10),
    totalKg: l.totalKg.toString(),
    grossWeightKg: l.grossWeightKg != null ? l.grossWeightKg.toString() : null,
    bagCount: l.bagCount ?? null,
    bagTareKg: l.bagTareKg != null ? l.bagTareKg.toString() : null,
    moisturePercent: l.moisturePercent != null ? l.moisturePercent.toString() : null,
    driageDeductionKg: l.driageDeductionKg != null ? l.driageDeductionKg.toString() : null,
    notes: l.notes, billNo: l.billNo,
    pricedKg: priced.toFixed(3), unpricedKg: unpriced.toFixed(3), fixingValue: value.toFixed(2),
  };
}

const include = { party: true, item: true, fixings: true } as const;

lotsRouter.get("/", async (req, res, next) => {
  try {
    const { kind, partyId } = req.query;
    const lots = await prisma.lot.findMany({
      where: {
        ...(kind === "PURCHASE" || kind === "SALE" ? { kind: kind as "PURCHASE" | "SALE" } : {}),
        ...(partyId ? { partyId: String(partyId) } : {}),
      },
      include,
      orderBy: { date: "desc" },
    });
    res.json(lots.map(toDTO));
  } catch (err) { next(err); }
});

lotsRouter.post("/", async (req, res, next) => {
  try {
    const data = lotSchema.parse(req.body);

    const netWeight = data.totalKg ?? (
      data.grossWeightKg
        ? Math.max(0, data.grossWeightKg - (data.bagTareKg || 0) - (data.driageDeductionKg || 0))
        : 0
    );
    if (!(netWeight > 0)) {
      throw new ApiError(400, "Valid net weight (totalKg or gross minus tare/driage) is required");
    }

    const lot = await prisma.$transaction(async (tx) => {
      const created = await tx.lot.create({
        data: {
          kind: data.kind,
          partyId: data.partyId,
          itemId: data.itemId,
          date: new Date(data.date),
          totalKg: netWeight,
          grossWeightKg: data.grossWeightKg ?? null,
          bagCount: data.bagCount ?? null,
          bagTareKg: data.bagTareKg ?? null,
          moisturePercent: data.moisturePercent ?? null,
          driageDeductionKg: data.driageDeductionKg ?? null,
          notes: data.notes || null,
          billNo: data.billNo || null,
        },
        include,
      });

      if (data.rate && data.rate > 0) {
        const want = data.fixKg ?? netWeight;
        const kgVal = Math.min(Math.max(0, want), netWeight);
        if (kgVal > 0) {
          await tx.fixing.create({
            data: { lotId: created.id, date: new Date(data.date), kg: kgVal, rate: data.rate, notes: "Entered with lot" },
          });
        }
      }

      return created;
    });

    res.status(201).json(toDTO(lot));
  } catch (err) { next(err); }
});

lotsRouter.put("/:id", async (req, res, next) => {
  try {
    const data = lotSchema.partial().parse(req.body);
    const lot = await prisma.lot.update({
      where: { id: req.params.id },
      data: {
        ...(data.partyId && { partyId: data.partyId }),
        ...(data.itemId && { itemId: data.itemId }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.totalKg && { totalKg: data.totalKg }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.billNo !== undefined && { billNo: data.billNo || null }),
      },
      include,
    });
    res.json(toDTO(lot));
  } catch (err) { next(err); }
});

lotsRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.fixing.deleteMany({ where: { lotId: req.params.id } });
    await prisma.lot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Fixings (nested under lots) ─────────────────────────────────────────────

const fixingSchema = z.object({
  date: z.string(),
  kg: z.number().positive(),
  rate: z.number().positive(),
  notes: z.string().optional(),
  settleNow: z.boolean().optional(),
  fundId: z.string().optional(),
});

lotsRouter.get("/:id/fixings", async (req, res, next) => {
  try {
    const fixings = await prisma.fixing.findMany({
      where: { lotId: req.params.id },
      orderBy: { date: "asc" },
    });
    res.json(fixings);
  } catch (err) { next(err); }
});

lotsRouter.post("/:id/fixings", async (req, res, next) => {
  try {
    const data = fixingSchema.parse(req.body);
    const lot = await prisma.lot.findUnique({ where: { id: req.params.id }, include: { fixings: true } });
    if (!lot) throw new ApiError(404, "Lot not found");

    const currentPriced = pricedKg(lot as any);
    const pending = Math.max(0, Number(lot.totalKg) - currentPriced);
    if (data.kg > pending + 0.0001) {
      throw new ApiError(400, `Cannot price more than pending weight (${pending.toFixed(3)} kg)`);
    }

    const fixing = await prisma.$transaction(async (tx) => {
      const created = await tx.fixing.create({
        data: { lotId: lot.id, date: new Date(data.date), kg: data.kg, rate: data.rate, notes: data.notes || null },
      });

      if (data.settleNow && data.fundId) {
        await tx.payment.create({
          data: {
            partyId: lot.partyId,
            date: new Date(data.date),
            amount: data.kg * data.rate,
            direction: lot.kind === "PURCHASE" ? "PAY" : "RECEIVE",
            tradeType: lot.kind,
            fundId: data.fundId,
            billNo: `FIX-${Date.now()}`,
            priceKg: data.kg,
            rate: data.rate,
            notes: `Against ${lot.billNo} price fix ${data.kg} kg`,
          },
        });
      }

      return created;
    });

    res.status(201).json(fixing);
  } catch (err) { next(err); }
});
