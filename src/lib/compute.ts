// Port of all business logic from js/db.js
// These functions work with Prisma query results (plain objects)

import type {
  Direction,
  FundType,
  ItemDTO,
  LoanDTO,
  LotDTO,
  PartyDTO,
  PartyRole,
  PaymentDTO,
  TradeType,
} from "../../shared/types.js";

// ─── Types matching Prisma query results ──────────────────────────────────────

export interface LotWithFixings {
  id: string;
  kind: "PURCHASE" | "SALE";
  partyId: string;
  itemId: string;
  date: Date;
  totalKg: string; // Decimal serialized
  notes: string | null;
  billNo: string | null;
  fixings: { id: string; kg: string; rate: string; date: Date; notes: string | null }[];
}

export interface PaymentWithParty {
  id: string;
  partyId: string;
  date: Date;
  amount: string;
  direction: "PAY" | "RECEIVE";
  tradeType: "PURCHASE" | "SALE";
  fundId: string;
  billNo: string;
  itemId: string | null;
  priceKg: string | null;
  rate: string | null;
  method: string | null;
  notes: string | null;
  party: { id: string; name: string };
  fund: { id: string; name: string; type: string };
}

export interface LoanWithParty {
  id: string;
  partyId: string;
  date: Date;
  amount: string;
  kind: string;
  fundId: string;
  itemId: string | null;
  method: string | null;
  purpose: string | null;
  notes: string | null;
  party: { id: string; name: string };
  fund: { id: string; name: string; type: string };
  item: { id: string; name: string } | null;
}

export interface FundWithData {
  id: string;
  name: string;
  type: string;
  opening: string;
  bankName: string | null;
  accountNumber: string | null;
}

// ─── Lot / Fixing computations ───────────────────────────────────────────────

export function pricedKg(lot: LotWithFixings): number {
  return lot.fixings.reduce((s, f) => s + Number(f.kg), 0);
}

export function unpricedKg(lot: LotWithFixings): number {
  return Math.max(0, Number(lot.totalKg) - pricedKg(lot));
}

export function fixingValue(lot: LotWithFixings): number {
  return lot.fixings.reduce((s, f) => s + Number(f.kg) * Number(f.rate), 0);
}

// Helper to convert Prisma Decimal to number
export function decimalToNumber(d: { toString(): string } | string | number): number {
  return Number(d.toString());
}

// Helper to convert Prisma Decimal to string
export function decimalToString(d: { toString(): string } | string | number): string {
  return d.toString();
}

// ─── Party-level computations ────────────────────────────────────────────────

export interface PartyTradeResult {
  paid: number;
  received: number;
  debit: number;
  credit: number;
  net: number;
  realizedBuyKg: number;
  realizedSellKg: number;
}

export function partyTrade(payments: PaymentWithParty[]): PartyTradeResult {
  let paid = 0;
  let received = 0;
  let realizedBuyKg = 0;
  let realizedSellKg = 0;

  for (const p of payments) {
    const amt = Number(p.amount.toString()) || 0;
    const qty = Number(p.priceKg?.toString() ?? 0) || 0;
    if (p.direction === "PAY") {
      paid += amt;
      realizedBuyKg += qty;
    } else {
      received += amt;
      realizedSellKg += qty;
    }
  }

  return {
    paid,
    received,
    debit: paid,
    credit: received,
    net: paid - received,
    realizedBuyKg,
    realizedSellKg,
  };
}

export function partyUnpriced(lots: LotWithFixings[], partyId: string, itemId?: string): number {
  return lots
    .filter((l) => l.partyId === partyId && (!itemId || l.itemId === itemId))
    .reduce((s, l) => s + unpricedKg(l), 0);
}

export interface PartyCommodityResult {
  boughtKg: number;
  soldKg: number;
  unpricedKg: number;
}

export function partyCommodity(
  lots: LotWithFixings[],
  partyId: string,
  itemId: string,
): PartyCommodityResult {
  const partyLots = lots.filter((l) => l.partyId === partyId && l.itemId === itemId);
  let boughtKg = 0;
  let soldKg = 0;
  for (const l of partyLots) {
    const w = Number(l.totalKg) || 0;
    if (l.kind === "PURCHASE") boughtKg += w;
    else soldKg += w;
  }
  return {
    boughtKg,
    soldKg,
    unpricedKg: partyUnpriced(lots, partyId, itemId),
  };
}

// ─── Fund computations ────────────────────────────────────────────────────────

export function fundBalance(
  fund: FundWithData,
  payments: PaymentWithParty[],
  loans: LoanWithParty[],
): number {
  let bal = Number(fund.opening.toString()) || 0;

  for (const p of payments) {
    if (p.fundId !== fund.id) continue;
    bal += p.direction === "RECEIVE" ? Number(p.amount.toString()) : -Number(p.amount.toString());
  }

  for (const l of loans) {
    if (l.fundId !== fund.id) continue;
    if (l.kind === "LOAN_GIVEN" || l.kind === "ADVANCE_GIVEN") bal -= Number(l.amount.toString());
    else bal += Number(l.amount.toString());
  }

  return bal;
}

// ─── Dashboard totals ────────────────────────────────────────────────────────

export interface TotalsResult {
  funds: (FundWithData & { balance: number })[];
  cash: number;
  bank: number;
  toPay: number;
  toGet: number;
  unpriced: Record<string, number>;
  stock: Record<string, number>;
}

export function computeTotals(
  funds: FundWithData[],
  payments: PaymentWithParty[],
  loans: LoanWithParty[],
  lots: LotWithFixings[],
  items: { id: string }[],
): TotalsResult {
  const fundBalances = funds.map((f) => ({
    ...f,
    balance: fundBalance(f, payments, loans),
  }));

  const cash = fundBalances
    .filter((f) => f.type === "CASH")
    .reduce((s, f) => s + f.balance, 0);
  const bank = fundBalances
    .filter((f) => f.type !== "CASH")
    .reduce((s, f) => s + f.balance, 0);

  let toPay = 0;
  let toGet = 0;
  const partyIds = new Set(lots.map((l) => l.partyId));
  for (const partyId of partyIds) {
    const partyPayments = payments.filter((p) => p.partyId === partyId);
    const n = partyTrade(partyPayments).net;
    if (n > 0) toGet += n;
    else toPay += -n;
  }

  const unpriced: Record<string, number> = {};
  const stock: Record<string, number> = {};
  for (const item of items) {
    unpriced[item.id] = lots
      .filter((l) => l.itemId === item.id)
      .reduce((s, l) => s + unpricedKg(l), 0);
    stock[item.id] = lots
      .filter((l) => l.itemId === item.id)
      .reduce((s, l) => s + (l.kind === "PURCHASE" ? Number(l.totalKg.toString()) : -Number(l.totalKg.toString())), 0);
  }

  return { funds: fundBalances, cash, bank, toPay, toGet, unpriced, stock };
}

// ─── Ledger rows ──────────────────────────────────────────────────────────────

export interface LedgerRowResult {
  date: string;
  particular: string;
  debit: string;
  credit: string;
  balance: string;
  kind: "lot" | "pay";
}

export function ledgerRows(
  lots: LotWithFixings[],
  payments: PaymentWithParty[],
  partyId: string,
  itemName: (id: string) => string,
): LedgerRowResult[] {
  const rows: LedgerRowResult[] = [];

  for (const l of lots.filter((x) => x.partyId === partyId)) {
    rows.push({
      date: l.date.toISOString().slice(0, 10),
      particular: `${l.kind === "PURCHASE" ? "Purchase (goods in)" : "Sale (goods out)"} · ${itemName(l.itemId)} ${l.totalKg} kg — not realized until payment`,
      debit: "0",
      credit: "0",
      balance: "0",
      kind: "lot",
    });
  }

  for (const p of payments.filter((x) => x.partyId === partyId)) {
    const isPay = p.direction === "PAY";
    const qty = Number(p.priceKg) || 0;
    const item = p.itemId ? itemName(p.itemId) : "";
    const realized = qty
      ? ` · realized ${qty} kg${item ? " " + item : ""}${p.rate ? " @ ₹" + p.rate + "/kg" : ""}`
      : "";
    rows.push({
      date: p.date.toISOString().slice(0, 10),
      particular: `${isPay ? "Cash outflow · Purchase payment" : "Cash inflow · Sale receipt"} · Bill ${p.billNo || "—"} · ${p.fund.name}${realized}${p.notes ? " · " + p.notes : ""}`,
      debit: isPay ? String(Number(p.amount)) : "0",
      credit: isPay ? "0" : String(Number(p.amount)),
      balance: "0",
      kind: "pay",
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.particular.localeCompare(b.particular));

  let bal = 0;
  return rows.map((r) => {
    bal += Number(r.debit) - Number(r.credit);
    return { ...r, balance: bal.toFixed(2) };
  });
}

// ─── Cash reports (P&L + Balance Sheet) ──────────────────────────────────────

export interface CashReportResult {
  from: string;
  to: string;
  salesIncome: number;
  purchaseExpense: number;
  grossProfit: number;
  loanGiven: number;
  loanTaken: number;
  advGiven: number;
  advTaken: number;
  otherIncome: number;
  otherExpense: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  closingCash: number;
  assets: { cash: number; loansGiven: number; advancesGiven: number };
  liabilities: { overdraft: number; loansTaken: number; advancesTaken: number };
  totalAssets: number;
  totalLiab: number;
  equity: number;
  payCount: number;
  loanCount: number;
}

function inDateRange(date: Date, from: string, to: string): boolean {
  const d = date.toISOString().slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function cashReports(
  payments: PaymentWithParty[],
  loans: LoanWithParty[],
  from: string,
  to: string,
): CashReportResult {
  const pays = payments.filter((p) => inDateRange(p.date, from, to));
  const lns = loans.filter((l) => inDateRange(l.date, from, to));

  let salesIncome = 0;
  let purchaseExpense = 0;
  for (const p of pays) {
    const amt = Number(p.amount) || 0;
    if (p.direction === "RECEIVE") salesIncome += amt;
    else purchaseExpense += amt;
  }

  let loanGiven = 0;
  let loanTaken = 0;
  let advGiven = 0;
  let advTaken = 0;
  for (const l of lns) {
    const amt = Number(l.amount) || 0;
    if (l.kind === "LOAN_GIVEN") loanGiven += amt;
    else if (l.kind === "LOAN_TAKEN") loanTaken += amt;
    else if (l.kind === "ADVANCE_GIVEN") advGiven += amt;
    else advTaken += amt;
  }

  const grossProfit = salesIncome - purchaseExpense;
  const otherIncome = loanTaken + advTaken;
  const otherExpense = loanGiven + advGiven;
  const netProfit = salesIncome + otherIncome - purchaseExpense - otherExpense;
  const cashIn = salesIncome + otherIncome;
  const cashOut = purchaseExpense + otherExpense;
  const closingCash = cashIn - cashOut;

  const assets = {
    cash: Math.max(0, closingCash),
    loansGiven: loanGiven,
    advancesGiven: advGiven,
  };
  const liabilities = {
    overdraft: Math.max(0, -closingCash),
    loansTaken: loanTaken,
    advancesTaken: advTaken,
  };
  const totalAssets = assets.cash + assets.loansGiven + assets.advancesGiven;
  const totalLiab = liabilities.overdraft + liabilities.loansTaken + liabilities.advancesTaken;
  const equity = totalAssets - totalLiab;

  return {
    from,
    to,
    salesIncome,
    purchaseExpense,
    grossProfit,
    loanGiven,
    loanTaken,
    advGiven,
    advTaken,
    otherIncome,
    otherExpense,
    netProfit,
    cashIn,
    cashOut,
    closingCash,
    assets,
    liabilities,
    totalAssets,
    totalLiab,
    equity,
    payCount: pays.length,
    loanCount: lns.length,
  };
}

// ─── Pricing allocation (for payments with kg) ───────────────────────────────

export interface PricingAllocation {
  lotId: string;
  billNo: string | null;
  kg: number;
}

export interface PricingResult {
  allocated: PricingAllocation[];
  leftover: number;
}

export function applyPricingQty(
  lots: LotWithFixings[],
  opts: { partyId: string; kind: "PURCHASE" | "SALE"; itemId?: string; kg: number; rate: number },
): PricingResult {
  let remaining = opts.kg;
  const allocated: PricingAllocation[] = [];

  if (!(remaining > 0) || !(opts.rate > 0)) {
    return { allocated, leftover: remaining };
  }

  const sorted = lots
    .filter((l) => l.partyId === opts.partyId && l.kind === opts.kind && (!opts.itemId || l.itemId === opts.itemId))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const pending = unpricedKg(lot);
    if (pending <= 0) continue;
    const take = Math.min(pending, remaining);
    allocated.push({ lotId: lot.id, billNo: lot.billNo, kg: take });
    remaining -= take;
  }

  return { allocated, leftover: Math.max(0, remaining) };
}
