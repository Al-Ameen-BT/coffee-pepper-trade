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

    const [payments, lots, fixings] = await Promise.all([
      prisma.payment.findMany({ where: { partyId: party.id }, include: { fund: true }, orderBy: { date: "asc" } }),
      prisma.lot.findMany({ where: { partyId: party.id }, include: { item: true }, orderBy: { date: "asc" } }),
      prisma.fixing.findMany({ where: { lot: { partyId: party.id } }, orderBy: { date: "desc" } }),
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
      fixings: fixings.map(f => ({
        id: f.id,
        lotId: f.lotId,
        date: f.date.toISOString().slice(0, 10),
        kg: f.kg.toString(),
        rate: f.rate.toString(),
        notes: f.notes,
        billNo: f.billNo
      }))
    };

    res.json(result);
  } catch (err) { next(err); }
});

billsRouter.get("/formal/:fixingId", async (req, res, next) => {
  try {
    const fixing = await prisma.fixing.findUnique({
      where: { id: req.params.fixingId },
      include: {
        lot: {
          include: { party: true, item: true }
        }
      }
    });

    if (!fixing) throw new ApiError(404, "Fixing not found");

    const tcsRate = fixing.tcsRate || 0;
    const tcsAmount = fixing.tcsAmount || 0;
    const tdsRate = fixing.tdsRate || 0;
    const tdsAmount = fixing.tdsAmount || 0;
    
    // Determine HSN code
    const itemNameLower = fixing.lot.item.name.toLowerCase();
    let hsnCode = "";
    if (itemNameLower.includes("coffee")) hsnCode = "0901";
    else if (itemNameLower.includes("pepper")) hsnCode = "0904";

    res.json({
      company: {
        name: "UZHUNNUNGAL TRADERS",
        tagline: "Hill Produce Dealer",
        gstin: "32APFPJ6004B1ZP",
        address: "KARIAMBADI P.O., WAYANAD DT., KERALA - 673591",
        phone: "9447204847",
        state: "Kerala",
        stateCode: "32"
      },
      billNo: fixing.billNo,
      date: fixing.date.toISOString().slice(0, 10),
      kg: fixing.kg,
      rate: fixing.rate,
      tcsRate,
      tcsAmount,
      tdsRate,
      tdsAmount,
      lot: {
        item: { name: fixing.lot.item.name, hsnCode },
        party: { 
          name: fixing.lot.party.name, 
          address: fixing.lot.party.address || "",
          place: fixing.lot.party.place || ""
        }
      }
    });
  } catch (err) { next(err); }
});
