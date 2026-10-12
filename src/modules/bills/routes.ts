import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import { partyTrade } from "../../lib/compute.js";
import { getCompanyInfo } from "../../lib/company.js";
import { getNextBookSerial } from "../../lib/billSequence.js";
import type { PartyBill, BillRecordDTO } from "../../../shared/types.js";

export const billsRouter = Router();
billsRouter.use(requireAuth);

/** HSN from the item's own record — not from a name guess. */
function hsnForItem(item: { hsnCode?: string }): string {
  return item.hsnCode || "";
}

/**
 * Digital bill register: every issued Bill of Supply, newest first.
 * Powers the Bill Register page so a trade can be produced, searched and
 * sent as a digital document without touching a paper bill book.
 */
billsRouter.get("/", async (req, res, next) => {
  try {
    const { partyId, kind, paid, from, to } = req.query;
    const lotFilter: any = {
      ...(partyId ? { partyId: String(partyId) } : {}),
      ...(kind === "PURCHASE" || kind === "SALE" ? { kind } : {}),
    };

    const fixings = await prisma.fixing.findMany({
      where: {
        ...(partyId || (kind === "PURCHASE" || kind === "SALE") ? { lot: lotFilter } : {}),
        ...(paid === "true" ? { paymentId: { not: null } } : paid === "false" ? { paymentId: null } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(String(from)) } : {}),
                ...(to ? { lte: new Date(String(to)) } : {}),
              },
            }
          : {}),
      },
      include: { lot: { include: { party: true, item: true } }, payment: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const records: BillRecordDTO[] = fixings.map((f: any) => {
      const amount = f.kg * f.rate;
      const net = amount + (f.tcsAmount || 0) - (f.tdsAmount || 0);
      return {
        id: f.id,
        billNo: f.billNo,
        date: f.date.toISOString().slice(0, 10),
        kind: f.lot.kind,
        partyId: f.lot.partyId,
        partyName: f.lot.party.name,
        itemName: f.lot.item.name,
        hsnCode: hsnForItem(f.lot.item),
        kg: f.kg.toString(),
        rate: f.rate.toString(),
        amount: amount.toFixed(2),
        tcsRate: f.tcsRate?.toString() ?? null,
        tcsAmount: f.tcsAmount?.toString() ?? null,
        tdsRate: f.tdsRate?.toString() ?? null,
        tdsAmount: f.tdsAmount?.toString() ?? null,
        netAmount: net.toFixed(2),
        paid: Boolean(f.paymentId),
        paymentBillNo: f.payment?.billNo ?? null,
        paymentDate: f.payment ? f.payment.date.toISOString().slice(0, 10) : null,
      };
    });

    res.json(records);
  } catch (err) {
    next(err);
  }
});

/**
 * Serial for the next blank sheet from the printed bill book. Declared before
 * the `/:partyId` route so the literal path is not captured as a party id.
 */
billsRouter.get("/book-serial", async (_req, res, next) => {
  try {
    res.json(await getNextBookSerial());
  } catch (err) {
    next(err);
  }
});

billsRouter.get("/:partyId", async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.partyId } });
    if (!party) throw new ApiError(404, "Party not found");

    const [payments, lots, fixings, items] = await Promise.all([
      prisma.payment.findMany({ where: { partyId: party.id }, include: { fund: true }, orderBy: { date: "asc" } }),
      prisma.lot.findMany({ where: { partyId: party.id }, include: { item: true }, orderBy: { date: "asc" } }),
      prisma.fixing.findMany({ where: { lot: { partyId: party.id } }, orderBy: { date: "desc" } }),
      prisma.item.findMany(),
    ]);

    const itemNameById = new Map(items.map((i) => [i.id, i.name]));
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
        billNo: p.billNo, itemId: p.itemId, itemName: p.itemId ? itemNameById.get(p.itemId) ?? null : null,
        priceKg: p.priceKg, rate: p.rate, method: p.method, notes: p.notes,
      })),
      realizedSales: inflow.map((p: any) => ({
        id: p.id, partyId: p.partyId, partyName: party.name, date: p.date.toISOString().slice(0, 10),
        amount: p.amount, direction: p.direction, tradeType: p.tradeType, fundId: p.fundId, fundName: p.fund.name,
        billNo: p.billNo, itemId: p.itemId, itemName: p.itemId ? itemNameById.get(p.itemId) ?? null : null,
        priceKg: p.priceKg, rate: p.rate, method: p.method, notes: p.notes,
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

/** Single-bill payload for the shareable digital bill view. */
billsRouter.get("/:fixingId/document", async (req, res, next) => {
  try {
    const fixing = await prisma.fixing.findUnique({
      where: { id: req.params.fixingId },
      include: { lot: { include: { party: true, item: true } }, payment: true },
    });
    if (!fixing) throw new ApiError(404, "Bill not found");

    const amount = fixing.kg * fixing.rate;
    const net = amount + (fixing.tcsAmount || 0) - (fixing.tdsAmount || 0);
    const record: BillRecordDTO = {
      id: fixing.id,
      billNo: fixing.billNo,
      date: fixing.date.toISOString().slice(0, 10),
      kind: fixing.lot.kind,
      partyId: fixing.lot.partyId,
      partyName: fixing.lot.party.name,
      itemName: fixing.lot.item.name,
      hsnCode: hsnForItem(fixing.lot.item),
      kg: fixing.kg.toString(),
      rate: fixing.rate.toString(),
      amount: amount.toFixed(2),
      tcsRate: fixing.tcsRate?.toString() ?? null,
      tcsAmount: fixing.tcsAmount?.toString() ?? null,
      tdsRate: fixing.tdsRate?.toString() ?? null,
      tdsAmount: fixing.tdsAmount?.toString() ?? null,
      netAmount: net.toFixed(2),
      paid: Boolean(fixing.paymentId),
      paymentBillNo: fixing.payment?.billNo ?? null,
      paymentDate: fixing.payment ? fixing.payment.date.toISOString().slice(0, 10) : null,
    };
    res.json(record);
  } catch (err) {
    next(err);
  }
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

    // HSN code by commodity
    const hsnCode = hsnForItem(fixing.lot.item);

    const company = await getCompanyInfo();

    res.json({
      company: {
        name: company.name,
        tagline: company.tagline,
        gstin: company.gstin,
        address: company.address,
        phone: company.phone,
        state: company.state,
        stateCode: company.stateCode,
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
