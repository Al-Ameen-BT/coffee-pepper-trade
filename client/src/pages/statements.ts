import { api } from "../api.js";
import { esc, money } from "../format.js";
import { renderShell } from "../main.js";
import type { PnLReport, BalanceSheetReport } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const [pnl, bs] = await Promise.all([
    api.get<PnLReport>(`/reports/pnl?from=${from}&to=${to}`),
    api.get<BalanceSheetReport>(`/reports/balance-sheet?from=${from}&to=${to}`),
  ]);

  const period = (from || to) ? `${from || "start"} to ${to || "today"}` : "All dates";

  renderShell(`
    <div class="topbar no-print">
      <div>
        <h2>Financial statements</h2>
        <p>Cash-basis P&L and Balance Sheet. Built only from Payments and Loans & Advances.</p>
      </div>
      <div class="actions">
        <label>From <input type="date" id="stmt-from" value="${from}"></label>
        <label>To <input type="date" id="stmt-to" value="${to}"></label>
        <button class="btn" type="button" id="stmt-apply">Refresh</button>
        <button class="btn gold" type="button" id="stmt-print">Print / Save PDF</button>
      </div>
    </div>
    <p class="no-print" style="color:var(--muted);margin:0 0 16px">Period: ${esc(period)} · ${pnl.payCount} payment(s) · ${pnl.loanCount} loan/advance entry(ies). Unpaid purchase/sale lots are excluded.</p>
    <div class="grid two" id="stmt-print-area">
      <div class="card">
        <h3>Profit & Loss account (cash basis)</h3>
        <p style="color:var(--muted);font-size:13px;margin:0 0 12px">${esc(period)}</p>
        <table>
          <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td colspan="2"><strong>Income (from Payments & Loans)</strong></td></tr>
            <tr><td>Sales realized (payments received)</td><td class="num">${money(pnl.salesIncome)}</td></tr>
            <tr><td>Loans taken</td><td class="num">${money(pnl.loanTaken)}</td></tr>
            <tr><td>Advances received</td><td class="num">${money(pnl.advTaken)}</td></tr>
            <tr><td><strong>Total income</strong></td><td class="num"><strong>${money(Number(pnl.salesIncome) + Number(pnl.otherIncome))}</strong></td></tr>
            <tr><td colspan="2"><strong>Expenses (from Payments & Loans)</strong></td></tr>
            <tr><td>Purchases realized (payments made)</td><td class="num">${money(pnl.purchaseExpense)}</td></tr>
            <tr><td>Loans given</td><td class="num">${money(pnl.loanGiven)}</td></tr>
            <tr><td>Advances given</td><td class="num">${money(pnl.advGiven)}</td></tr>
            <tr><td><strong>Total expenses</strong></td><td class="num"><strong>${money(Number(pnl.purchaseExpense) + Number(pnl.otherExpense))}</strong></td></tr>
            <tr><td>Gross trading result (sales − purchases)</td><td class="num">${money(pnl.grossProfit)}</td></tr>
            <tr><td><strong>${Number(pnl.netProfit) >= 0 ? "Net profit" : "Net loss"}</strong></td><td class="num"><strong>${money(Math.abs(Number(pnl.netProfit)))}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3>Balance sheet (cash basis)</h3>
        <p style="color:var(--muted);font-size:13px;margin:0 0 12px">Assets and liabilities from cash movement in Payments and Loans & Advances. ${esc(period)}</p>
        <table>
          <thead><tr><th>Assets</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td>Cash & bank (net inflow in period)</td><td class="num">${money(bs.assets.cash)}</td></tr>
            <tr><td>Loans given (receivable)</td><td class="num">${money(bs.assets.loansGiven)}</td></tr>
            <tr><td>Advances given (receivable)</td><td class="num">${money(bs.assets.advancesGiven)}</td></tr>
            <tr><td><strong>Total assets</strong></td><td class="num"><strong>${money(bs.totalAssets)}</strong></td></tr>
          </tbody>
        </table>
        <table style="margin-top:16px">
          <thead><tr><th>Liabilities & equity</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td>Cash overdrawn (net outflow)</td><td class="num">${money(bs.liabilities.overdraft)}</td></tr>
            <tr><td>Loans taken (payable)</td><td class="num">${money(bs.liabilities.loansTaken)}</td></tr>
            <tr><td>Advances received (payable)</td><td class="num">${money(bs.liabilities.advancesTaken)}</td></tr>
            <tr><td>Capital / retained cash profit</td><td class="num">${money(bs.equity)}</td></tr>
            <tr><td><strong>Total liabilities & equity</strong></td><td class="num"><strong>${money(Number(bs.totalLiab) + Number(bs.equity))}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById("stmt-apply")!.addEventListener("click", () => {
    const fromVal = (document.getElementById("stmt-from") as HTMLInputElement).value;
    const toVal = (document.getElementById("stmt-to") as HTMLInputElement).value;
    const q = new URLSearchParams();
    if (fromVal) q.set("from", fromVal);
    if (toVal) q.set("to", toVal);
    window.location.href = `/statements${q.toString() ? "?" + q.toString() : ""}`;
  });

  document.getElementById("stmt-print")!.addEventListener("click", () => window.print());
}
