import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { ledgerRows, partyTrade, partyUnpriced, partyCommodity } from "../../lib/compute.js";
import type { PartyLedger } from "../../../shared/types.js";

export const ledgerRouter = Router();
ledgerRouter.use(requireAuth);

ledgerRouter.get("/", async (req, res, next) => {
  try {
    const [parties, lots, payments, items] = await Promise.all([
      prisma.party.findMany({ orderBy: { name: "asc" } }),
      prisma.lot.findMany({ include: { fixings: true } }),
      prisma.payment.findMany({ include: { fund: true } }),
      prisma.item.findMany({ orderBy: { name: "asc" } }),
    ]);

    const summaries: Record<string, {
      partyId: string;
      totalPaid: string;
      totalReceived: string;
      net: string;
      settled: boolean;
      quantitiesByItem: Record<string, { boughtKg: string; soldKg: string }>;
      unpricedByItem: Record<string, string>;
    }> = {};

    for (const party of parties) {
      const partyLots = lots.filter((l) => l.partyId === party.id);
      const partyPayments = payments.filter((p) => p.partyId === party.id);
      const trade = partyTrade(partyPayments as any);

      const quantitiesByItem: Record<string, { boughtKg: string; soldKg: string }> = {};
      const unpricedByItem: Record<string, string> = {};

      for (const item of items) {
        const c = partyCommodity(partyLots as any, party.id, item.id);
        quantitiesByItem[item.id] = {
          boughtKg: c.boughtKg.toFixed(3),
          soldKg: c.soldKg.toFixed(3),
        };
        unpricedByItem[item.id] = partyUnpriced(partyLots as any, party.id, item.id).toFixed(3);
      }

      summaries[party.id] = {
        partyId: party.id,
        totalPaid: trade.paid.toFixed(2),
        totalReceived: trade.received.toFixed(2),
        net: trade.net.toFixed(2),
        settled: Math.abs(trade.net) < 0.5,
        quantitiesByItem,
        unpricedByItem,
      };
    }

    res.json({ summaries, items });
  } catch (err) { next(err); }
});

ledgerRouter.get("/:partyId", async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.partyId } });
    if (!party) throw new ApiError(404, "Party not found");

    const [lots, payments, items] = await Promise.all([
      prisma.lot.findMany({ where: { partyId: party.id }, include: { fixings: true } }),
      prisma.payment.findMany({ where: { partyId: party.id }, include: { fund: true } }),
      prisma.item.findMany(),
    ]);

    const itemName = (id: string) => items.find((i) => i.id === id)?.name || id;
    const rows = ledgerRows(lots as any, payments as any, party.id, itemName);
    const trade = partyTrade(payments as any);

    const unpricedByItem: Record<string, string> = {};
    const quantitiesByItem: Record<string, { boughtKg: string; soldKg: string }> = {};
    for (const item of items) {
      unpricedByItem[item.id] = partyUnpriced(lots as any, party.id, item.id).toFixed(3);
      const c = partyCommodity(lots as any, party.id, item.id);
      quantitiesByItem[item.id] = { boughtKg: c.boughtKg.toFixed(3), soldKg: c.soldKg.toFixed(3) };
    }

    const result: PartyLedger = {
      party: { id: party.id, name: party.name, phone: party.phone, role: party.role, place: party.place, address: party.address, createdAt: party.createdAt.toISOString() },
      rows,
      totalPaid: trade.paid.toFixed(2),
      totalReceived: trade.received.toFixed(2),
      net: trade.net.toFixed(2),
      settled: Math.abs(trade.net) < 0.5,
      unpricedByItem,
      quantitiesByItem,
    };

    res.json(result);
  } catch (err) { next(err); }
});
