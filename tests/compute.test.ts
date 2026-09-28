import { describe, it, expect } from "vitest";
import {
  pricedKg,
  unpricedKg,
  fixingValue,
  partyTrade,
  fundBalance,
  applyPricingQty,
  cashReports,
  type LotWithFixings,
  type PaymentWithParty,
  type LoanWithParty,
  type FundWithData,
} from "../src/lib/compute.js";

describe("pricedKg", () => {
  it("sums all fixing kg for a lot", () => {
    const lot: LotWithFixings = {
      id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1",
      date: new Date(), totalKg: "1000", notes: null, billNo: null,
      fixings: [
        { id: "f1", kg: "300", rate: "100", date: new Date(), notes: null },
        { id: "f2", kg: "200", rate: "110", date: new Date(), notes: null },
      ],
    };
    expect(pricedKg(lot)).toBe(500);
  });

  it("returns 0 for lot with no fixings", () => {
    const lot: LotWithFixings = {
      id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1",
      date: new Date(), totalKg: "500", notes: null, billNo: null,
      fixings: [],
    };
    expect(pricedKg(lot)).toBe(0);
  });
});

describe("unpricedKg", () => {
  it("returns totalKg minus pricedKg", () => {
    const lot: LotWithFixings = {
      id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1",
      date: new Date(), totalKg: "1000", notes: null, billNo: null,
      fixings: [{ id: "f1", kg: "400", rate: "100", date: new Date(), notes: null }],
    };
    expect(unpricedKg(lot)).toBe(600);
  });

  it("never returns negative", () => {
    const lot: LotWithFixings = {
      id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1",
      date: new Date(), totalKg: "100", notes: null, billNo: null,
      fixings: [{ id: "f1", kg: "150", rate: "100", date: new Date(), notes: null }],
    };
    expect(unpricedKg(lot)).toBe(0);
  });
});

describe("fixingValue", () => {
  it("sums kg * rate for all fixings", () => {
    const lot: LotWithFixings = {
      id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1",
      date: new Date(), totalKg: "1000", notes: null, billNo: null,
      fixings: [
        { id: "f1", kg: "100", rate: "200", date: new Date(), notes: null },
        { id: "f2", kg: "50", rate: "300", date: new Date(), notes: null },
      ],
    };
    expect(fixingValue(lot)).toBe(35000);
  });
});

describe("partyTrade", () => {
  it("calculates paid, received, and net correctly", () => {
    const payments: PaymentWithParty[] = [
      { id: "p1", partyId: "party1", date: new Date(), amount: "5000", direction: "PAY", tradeType: "PURCHASE", fundId: "f1", billNo: "B1", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
      { id: "p2", partyId: "party1", date: new Date(), amount: "3000", direction: "RECEIVE", tradeType: "SALE", fundId: "f1", billNo: "B2", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
    ];
    const result = partyTrade(payments);
    expect(result.paid).toBe(5000);
    expect(result.received).toBe(3000);
    expect(result.net).toBe(2000);
  });
});

describe("fundBalance", () => {
  it("computes opening + payments + loans", () => {
    const fund: FundWithData = { id: "f1", name: "Cash", type: "CASH", opening: "10000", bankName: null, accountNumber: null };
    const payments: PaymentWithParty[] = [
      { id: "p1", partyId: "party1", date: new Date(), amount: "5000", direction: "PAY", tradeType: "PURCHASE", fundId: "f1", billNo: "B1", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
      { id: "p2", partyId: "party1", date: new Date(), amount: "2000", direction: "RECEIVE", tradeType: "SALE", fundId: "f1", billNo: "B2", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
    ];
    const loans: LoanWithParty[] = [
      { id: "l1", partyId: "party1", date: new Date(), amount: "1000", kind: "LOAN_GIVEN", fundId: "f1", itemId: null, method: null, purpose: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" }, item: null },
    ];
    expect(fundBalance(fund, payments, loans)).toBe(6000);
  });
});

describe("applyPricingQty", () => {
  it("allocates kg across lots in date order", () => {
    const lots: LotWithFixings[] = [
      { id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1", date: new Date("2026-01-01"), totalKg: "100", notes: null, billNo: null, fixings: [{ id: "f1", kg: "30", rate: "100", date: new Date(), notes: null }] },
      { id: "l2", kind: "PURCHASE", partyId: "p1", itemId: "i1", date: new Date("2026-01-02"), totalKg: "200", notes: null, billNo: null, fixings: [] },
    ];
    const result = applyPricingQty(lots, { partyId: "p1", kind: "PURCHASE", kg: 100, rate: 150 });
    expect(result.allocated).toHaveLength(2);
    expect(result.allocated[0].kg).toBe(70); // 100 - 30 already priced
    expect(result.allocated[1].kg).toBe(30);
    expect(result.leftover).toBe(0);
  });

  it("returns leftover when not enough unpriced kg", () => {
    const lots: LotWithFixings[] = [
      { id: "l1", kind: "PURCHASE", partyId: "p1", itemId: "i1", date: new Date(), totalKg: "50", notes: null, billNo: null, fixings: [] },
    ];
    const result = applyPricingQty(lots, { partyId: "p1", kind: "PURCHASE", kg: 100, rate: 150 });
    expect(result.allocated).toHaveLength(1);
    expect(result.allocated[0].kg).toBe(50);
    expect(result.leftover).toBe(50);
  });
});

describe("cashReports", () => {
  it("computes P&L correctly", () => {
    const payments: PaymentWithParty[] = [
      { id: "p1", partyId: "party1", date: new Date("2026-09-01"), amount: "10000", direction: "PAY", tradeType: "PURCHASE", fundId: "f1", billNo: "B1", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
      { id: "p2", partyId: "party1", date: new Date("2026-09-02"), amount: "15000", direction: "RECEIVE", tradeType: "SALE", fundId: "f1", billNo: "B2", itemId: null, priceKg: null, rate: null, method: null, notes: null, party: { id: "party1", name: "Test" }, fund: { id: "f1", name: "Cash", type: "CASH" } },
    ];
    const loans: LoanWithParty[] = [];
    const report = cashReports(payments, loans, "", "");
    expect(report.salesIncome).toBe(15000);
    expect(report.purchaseExpense).toBe(10000);
    expect(report.grossProfit).toBe(5000);
    expect(report.netProfit).toBe(5000);
  });
});
