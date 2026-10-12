import { api } from "../api.js";
import { esc, money, today, kg } from "../format.js";
import type { CompanyInfoDTO } from "../../../shared/types.js";

interface StatementTxn {
  date: string;
  amount: string | number;
  isDebit: boolean;
  billNo?: string | null;
  notes?: string | null;
  itemId?: string | null;
  itemName?: string | null;
  priceKg?: string | null;
  rate?: string | null;
}

export async function render(): Promise<void> {
  const dataStr = sessionStorage.getItem("print-statement-data");
  if (!dataStr) {
    document.getElementById("app")!.innerHTML = `<div class="print-doc"><p>No data found to print. Please close this tab and try again from the Bills page.</p></div>`;
    return;
  }

  const data = JSON.parse(dataStr);
  const { party, transactions } = data;
  const company = await api.get<CompanyInfoDTO>("/settings/company").catch(() => null);
  const companyName = company?.name || "Uzhunnungal Traders";

  transactions.sort((a: StatementTxn, b: StatementTxn) => a.date.localeCompare(b.date));

  let totalDebit = 0;
  let totalCredit = 0;
  let bodyRows = "";

  for (const t of transactions as StatementTxn[]) {
    const isDebit = t.isDebit;
    const amt = Number(t.amount);
    let debitStr = "";
    let creditStr = "";

    if (isDebit) {
      debitStr = money(amt);
      totalDebit += amt;
    } else {
      creditStr = money(amt);
      totalCredit += amt;
    }

    let particular = "";
    if (t.priceKg) {
      particular = `${isDebit ? "Purchase" : "Sale"} Payment · ${kg(t.priceKg)}${t.itemName ? ` ${esc(t.itemName)}` : ""}${t.rate ? ` @ ₹${t.rate}` : ""}`;
    } else {
      particular = `${isDebit ? "Payment Made" : "Payment Received"}`;
    }
    if (t.billNo) particular += ` · Bill No: ${esc(t.billNo)}`;
    if (t.notes) particular += ` · ${esc(t.notes)}`;

    bodyRows += `
      <tr>
        <td>${esc(t.date)}</td>
        <td>${particular}</td>
        <td class="num">${debitStr}</td>
        <td class="num">${creditStr}</td>
      </tr>
    `;
  }

  const net = totalDebit - totalCredit;
  const balanceText = net >= 0 ? `${money(net)} Dr` : `${money(-net)} Cr`;

  document.getElementById("app")!.innerHTML = `
    <div class="print-bar no-print">
      <button class="btn secondary" onclick="window.close()">Close</button>
      <button class="btn gold" onclick="window.print()">Print Statement</button>
    </div>
    <div class="print-doc">
      <h1 class="center">${esc(companyName)}</h1>
      <p class="doc-title center">Account Statement</p>

      <div class="print-meta">
        <div>
          <p><strong>To:</strong></p>
          <p><strong>${esc(party.name)}</strong></p>
          <p>${esc(party.place || "")}</p>
          <p>${esc(party.address || "")}</p>
          <p>${esc(party.phone || "")}</p>
        </div>
        <div class="right">
          <p><strong>Date:</strong> ${today()}</p>
          <p>Statement for selected transactions</p>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Particulars / Bill No.</th>
            <th scope="col" class="num">Debit (₹)</th>
            <th scope="col" class="num">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <div class="print-totals">
        <table>
          <tr>
            <td>Total Debit:</td>
            <td class="num">${money(totalDebit)}</td>
          </tr>
          <tr>
            <td>Total Credit:</td>
            <td class="num">${money(totalCredit)}</td>
          </tr>
          <tr class="total-row">
            <td>Net Balance (Selected):</td>
            <td class="num">${balanceText}</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 500);
}
