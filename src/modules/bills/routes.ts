import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { partyTrade } from "../../lib/compute.js";
import type { PartyBill } from "../../../shared/types.js";

export const billsRouter = Router();
billsRouter.use(requireAuth);

billsRouter.get("/:partyId", async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.partyId } });
    if (!party) throw new ApiError(404, "Party not found");

    const [payments, lots] = await Promise.all([
      prisma.payment.findMany({ where: { partyId: party.id }, include: { fund: true }, orderBy: { date: "asc" } }),
      prisma.lot.findMany({ where: { partyId: party.id }, include: { item: true }, orderBy: { date: "asc" } }),
    ]);

    const trade = partyTrade(payments as any);
    const outflow = (payments as any).filter((p: any) => p.direction === "PAY");
    const inflow = (payments as any).filter((p: any) => p.direction === "RECEIVE");

    const result: PartyBill = {
      party: { id: party.id, name: party.name, phone: party.phone, role: party.role, place: party.place, address: party.address, createdAt: party.createdAt.toISOString() },
      outstanding: trade.net.toFixed(2),
      settled: Math.abs(trade.net) < 0.5,
      totalPaid: trade.paid.toFixed(2),
      totalReceived: trade.received.toFixed(2),
      realizedPurchases: outflow.map((p: any) => ({
        id: p.id, partyId: p.partyId, partyName: party.name, date: p.date.toISOString().slice(0, 10),
        amount: p.amount, direction: p.direction, tradeType: p.tradeType, fundId: p.fundId, fundName: p.fund.name,
        billNo: p.billNo, itemId: p.itemId, priceKg: p.priceKg, rate: p.rate, method: p.method, notes: p.notes,
      })),
      realizedSales: inflow.map((p: any) => ({
        id: p.id, partyId: p.partyId, partyName: party.name, date: p.date.toISOString().slice(0, 10),
        amount: p.amount, direction: p.direction, tradeType: p.tradeType, fundId: p.fundId, fundName: p.fund.name,
        billNo: p.billNo, itemId: p.itemId, priceKg: p.priceKg, rate: p.rate, method: p.method, notes: p.notes,
      })),
      goodsOnFile: lots.map((l: any) => ({
        id: l.id, kind: l.kind, partyId: l.partyId, partyName: party.name, itemId: l.itemId, itemName: l.item.name,
        date: l.date.toISOString().slice(0, 10), totalKg: l.totalKg, notes: l.notes, billNo: l.billNo,
        pricedKg: "0", unpricedKg: l.totalKg, fixingValue: "0",
      })),
    };

    res.json(result);
  } catch (err) { next(err); }
});
