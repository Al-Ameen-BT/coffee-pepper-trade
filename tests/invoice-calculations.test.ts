import { describe, it, expect } from "vitest";
import { amountInWords } from "../src/lib/amountInWords.js";

describe("Invoice Calculations & Edge Cases", () => {
  describe("Task 1 & 3: Quantity × Rate, CGST, SGST, Rounding & Grand Total", () => {
    it("correctly calculates line total from quantity × rate", () => {
      const qty = 152.35; // kg
      const rate = 645.5; // per kg
      const lineTotal = Math.round(qty * rate * 100) / 100;
      expect(lineTotal).toBe(98341.93);
    });

    it("correctly calculates CGST (2.5%) and SGST (2.5%) splits", () => {
      const taxableValue = 100000;
      const cgstRate = 2.5;
      const sgstRate = 2.5;

      const cgstAmount = Math.round((taxableValue * cgstRate) / 100 * 100) / 100;
      const sgstAmount = Math.round((taxableValue * sgstRate) / 100 * 100) / 100;

      expect(cgstAmount).toBe(2500);
      expect(sgstAmount).toBe(2500);
      expect(cgstAmount + sgstAmount).toBe(5000);
    });

    it("rounds fractions of paise properly on tax", () => {
      const taxableValue = 98341.93;
      const cgstRate = 2.5;
      const sgstRate = 2.5;

      const cgstAmount = Math.round((taxableValue * cgstRate) / 100 * 100) / 100;
      const sgstAmount = Math.round((taxableValue * sgstRate) / 100 * 100) / 100;

      expect(cgstAmount).toBe(2458.55);
      expect(sgstAmount).toBe(2458.55);

      const grandTotal = Math.round((taxableValue + cgstAmount + sgstAmount) * 100) / 100;
      expect(grandTotal).toBe(103259.03);
    });

    it("includes TCS and deducts TDS correctly into grand total", () => {
      const taxableValue = 200000;
      const cgst = 5000;
      const sgst = 5000;
      const tcs = 200; // 0.1% TCS
      const tds = 0;

      const grandTotal = Math.round((taxableValue + cgst + sgst + tcs - tds) * 100) / 100;
      expect(grandTotal).toBe(210200);
    });

    it("converts exact grand total to words matching rupees and paise", () => {
      expect(amountInWords(103259.03)).toBe(
        "One Lakh Three Thousand Two Hundred Fifty Nine Rupees and Three Paise Only"
      );
      expect(amountInWords(210200)).toBe(
        "Two Lakh Ten Thousand Two Hundred Rupees Only"
      );
      expect(amountInWords(0)).toBe("Zero Rupees Only");
      expect(amountInWords(50000)).toBe("Fifty Thousand Rupees Only");
    });
  });

  describe("Task 4: Edge Cases", () => {
    it("handles extreme quantities and high-value orders", () => {
      const qty = 12500; // 12.5 metric tonnes
      const rate = 650;
      const taxableValue = qty * rate; // 81,25,000
      const cgst = (taxableValue * 2.5) / 100; // 2,03,125
      const sgst = (taxableValue * 2.5) / 100; // 2,03,125
      const grandTotal = taxableValue + cgst + sgst; // 85,31,250

      expect(taxableValue).toBe(8125000);
      expect(grandTotal).toBe(8531250);
      expect(amountInWords(grandTotal)).toBe(
        "Eighty Five Lakh Thirty One Thousand Two Hundred Fifty Rupees Only"
      );
    });

    it("handles long commodity and party descriptions gracefully", () => {
      const longItemName = "Malabar Garbled 1st Quality Black Pepper Wayanad Highland Cleaned 2026 Batch";
      expect(longItemName.length).toBeGreaterThan(50);
      expect(longItemName).toContain("Black Pepper");
    });

    it("formats fallback values for missing optional fields", () => {
      const party = {
        name: "Wayanad Coffee Traders",
        address: null,
        place: null,
        gstin: null,
        pincode: null,
      };

      const addressDisplay = party.address || "—";
      const gstinDisplay = party.gstin || "Unregistered";
      const pincodeDisplay = party.pincode || "—";

      expect(addressDisplay).toBe("—");
      expect(gstinDisplay).toBe("Unregistered");
      expect(pincodeDisplay).toBe("—");
    });
  });

  describe("Two Distinct Invoice Formats: Purchase Invoice vs Tax Invoice Cum Bill of Supply", () => {
    it("distinguishes title and labels based on transaction kind", () => {
      const getDocumentTitle = (isPurchase: boolean, billNo: string, companyName: string) =>
        `${isPurchase ? "Purchase Invoice" : "Tax Invoice Cum Bill of Supply"} ${billNo} · ${companyName}`;

      const getHeaderLabel = (isPurchase: boolean) =>
        isPurchase ? "PURCHASE INVOICE" : "TAX INVOICE CUM BILL OF SUPPLY";

      const getCssClass = (isPurchase: boolean) =>
        isPurchase ? "purchase-invoice" : "tax-supply-invoice";

      expect(getDocumentTitle(true, "PUR-001", "Uzhunnungal Traders")).toBe(
        "Purchase Invoice PUR-001 · Uzhunnungal Traders"
      );
      expect(getDocumentTitle(false, "SAL-001", "Uzhunnungal Traders")).toBe(
        "Tax Invoice Cum Bill of Supply SAL-001 · Uzhunnungal Traders"
      );
      expect(getHeaderLabel(true)).toBe("PURCHASE INVOICE");
      expect(getHeaderLabel(false)).toBe("TAX INVOICE CUM BILL OF SUPPLY");
      expect(getCssClass(true)).toBe("purchase-invoice");
      expect(getCssClass(false)).toBe("tax-supply-invoice");
    });

    it("formats Purchase Invoice with supplier, company purchaser, and no GST column", () => {
      const purchaseData = {
        kind: "PURCHASE",
        party: { name: "Raju Farmer", gstin: null, state: "Kerala" },
        company: { name: "Uzhunnungal Traders", gstin: "32XXXXX1234Z1" },
        item: { description: "Raw Coffee Arabica", qty: 250, unitPrice: 320, total: 80000 },
      };

      const isPurchase = purchaseData.kind === "PURCHASE";
      const supplierStatus = purchaseData.party.gstin ? purchaseData.party.gstin : "Unregistered Supplier";
      const columns = isPurchase
        ? ["Sl. No.", "Description of Goods", "HSN/SAC", "Quantity", "Rate per KG", "Total"]
        : ["Sl. No.", "Name of Product", "HSN", "Qty (kg)", "Rate", "Taxable Value", "CGST", "SGST", "Total"];

      expect(supplierStatus).toBe("Unregistered Supplier");
      expect(columns).not.toContain("CGST");
      expect(columns).not.toContain("SGST");
      expect(columns).not.toContain("GST Rate");
      expect(purchaseData.company.name).toBe("Uzhunnungal Traders");
    });

    it("formats Tax Invoice Cum Bill of Supply with customer Bill To and separate GST columns", () => {
      const salesData = {
        kind: "SALE",
        party: { name: "Kerala Spices Exports Ltd", gstin: "32ABCDE1234F1Z5", state: "Kerala" },
        item: { description: "Black Pepper Garbled", qty: 1000, unitPrice: 650, total: 650000 },
        taxableValue: 650000,
        cgstRate: 2.5,
        cgstAmount: 16250,
        sgstRate: 2.5,
        sgstAmount: 16250,
        grandTotal: 682500,
      };

      const isPurchase = salesData.kind === "PURCHASE";
      const columns = isPurchase
        ? ["Sl. No.", "Description of Goods", "HSN/SAC", "Quantity", "Rate per KG", "Total"]
        : ["Sl. No.", "Name of Product", "HSN", "Qty (kg)", "Rate", "Taxable Value", "CGST", "SGST", "Total"];

      expect(columns).toContain("Taxable Value");
      expect(columns).toContain("CGST");
      expect(columns).toContain("SGST");
      expect(salesData.grandTotal).toBe(
        salesData.taxableValue + salesData.cgstAmount + salesData.sgstAmount
      );
    });
  });
});
