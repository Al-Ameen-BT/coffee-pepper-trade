import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { cashReports, computeTotals, partyTrade, partyUnpriced } from "../../lib/compute.js";
import { maskAccountNumber } from "../../lib/crypto.js";
import type { DashboardData, BalanceSheetReport, PnLReport, PartySummaryDTO, FundDTO } from "../../../shared/types.js";

export const statementsRouter = Router();
statementsRouter.use(requireAuth);

function toPnL(r: ReturnType<typeof cashReports>): PnLReport {
  return {
    from: r.from, to: r.to,
    salesIncome: r.salesIncome.toFixed(2), purchaseExpense: r.purchaseExpense.toFixed(2),
    grossProfit: r.grossProfit.toFixed(2), loanGiven: r.loanGiven.toFixed(2),
    loanTaken: r.loanTaken.toFixed(2), advGiven: r.advGiven.toFixed(2), advTaken: r.advTaken.toFixed(2),
    otherIncome: r.otherIncome.toFixed(2), otherExpense: r.otherExpense.toFixed(2),
    netProfit: r.netProfit.toFixed(2), cashIn: r.cashIn.toFixed(2), cashOut: r.cashOut.toFixed(2),
    closingCash: r.closingCash.toFixed(2), payCount: r.payCount, loanCount: r.loanCount,
  };
}

function toBalanceSheet(r: ReturnType<typeof cashReports>): BalanceSheetReport {
  return {
    from: r.from, to: r.to,
    assets: { cash: r.assets.cash.toFixed(2), loansGiven: r.assets.loansGiven.toFixed(2), advancesGiven: r.assets.advancesGiven.toFixed(2) },
    liabilities: { overdraft: r.liabilities.overdraft.toFixed(2), loansTaken: r.liabilities.loansTaken.toFixed(2), advancesTaken: r.liabilities.advancesTaken.toFixed(2) },
    totalAssets: r.totalAssets.toFixed(2), totalLiab: r.totalLiab.toFixed(2), equity: r.equity.toFixed(2),
  };
}

statementsRouter.get("/pnl", async (req, res, next) => {
  try {
    const { from = "", to = "" } = req.query as { from?: string; to?: string };
    const [payments, loans] = await Promise.all([
      prisma.payment.findMany(),
      prisma.loan.findMany(),
    ]);
    res.json(toPnL(cashReports(payments as any, loans as any, from, to)));
  } catch (err) { next(err); }
});

statementsRouter.get("/balance-sheet", async (req, res, next) => {
  try {
    const { from = "", to = "" } = req.query as { from?: string; to?: string };
    const [payments, loans] = await Promise.all([
      prisma.payment.findMany(),
      prisma.loan.findMany(),
    ]);
    res.json(toBalanceSheet(cashReports(payments as any, loans as any, from, to)));
  } catch (err) { next(err); }
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (_req, res, next) => {
  try {
    const [funds, payments, loans, lots, items, parties] = await Promise.all([
      prisma.fund.findMany(),
      prisma.payment.findMany(),
      prisma.loan.findMany(),
      prisma.lot.findMany({ include: { fixings: true } }),
      prisma.item.findMany(),
      prisma.party.findMany(),
    ]);

    const t = computeTotals(funds as any, payments as any, loans as any, lots as any, items as any);

    const partySummaries: PartySummaryDTO[] = parties.map((p) => {
      const pPayments = (payments as any).filter((x: any) => x.partyId === p.id);
      const net = partyTrade(pPayments).net;
      const unpricedByItem: Record<string, string> = {};
      for (const item of items) {
        unpricedByItem[item.id] = partyUnpriced(lots as any, p.id, item.id).toFixed(3);
      }
      return {
        id: p.id, name: p.name, role: p.role, place: p.place,
        unpricedByItem, outstanding: net.toFixed(2), settled: Math.abs(net) < 0.5,
      };
    });

    const result: DashboardData = {
      cash: t.cash.toFixed(2),
      bank: t.bank.toFixed(2),
      toGet: t.toGet.toFixed(2),
      toPay: t.toPay.toFixed(2),
      funds: t.funds.map((f) => {
        const masked = maskAccountNumber(f.accountNumber);
        return {
          id: f.id, name: f.name, type: f.type as FundDTO["type"], opening: f.opening.toString(),
          bankName: f.bankName, accountNumber: masked, accountNumberMasked: masked, balance: f.balance.toFixed(2),
        };
      }),
      unpriced: Object.fromEntries(Object.entries(t.unpriced).map(([k, v]) => [k, v.toFixed(3)])),
      stock: Object.fromEntries(Object.entries(t.stock).map(([k, v]) => [k, v.toFixed(3)])),
      items: items.map((i) => ({ id: i.id, name: i.name, slug: i.slug })),
      parties: partySummaries,
    };

    res.json(result);
  } catch (err) { next(err); }
});
