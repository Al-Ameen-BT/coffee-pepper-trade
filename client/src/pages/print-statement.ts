import { esc, money, today, kg } from "../format.js";

export async function render(): Promise<void> {
  const dataStr = sessionStorage.getItem("print-statement-data");
  if (!dataStr) {
    document.getElementById("app")!.innerHTML = `<div style="padding:20px;text-align:center;">No data found to print. Please close this tab and try again from the Bills page.</div>`;
    return;
  }

  const data = JSON.parse(dataStr);
  const { party, transactions } = data;

  transactions.sort((a: any, b: any) => a.date.localeCompare(b.date));

  let html = `
    <style>
      @media print {
        @page { margin: 15mm; }
        body { margin: 0; padding: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        .sidebar { display: none !important; }
        .app { display: block !important; }
        .main { padding: 0 !important; width: 100% !important; margin: 0 !important; max-width: none !important; }
        .print-stmt-page { font-size: 11pt; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
        .num { text-align: right; }
        h1 { font-family: Fraunces, serif; font-size: 24pt; margin: 0 0 5px 0; text-align: center; }
        h2 { font-size: 14pt; margin: 0 0 20px 0; text-align: center; font-weight: normal; }
        .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .footer-totals { margin-top: 20px; display: flex; justify-content: flex-end; }
        .totals-table { width: auto; min-width: 300px; margin-top: 0; }
        .totals-table th, .totals-table td { border: none; padding: 4px 8px; }
        .totals-table .border-top { border-top: 1px solid #000; }
        .totals-table .border-bottom-double { border-bottom: 3px double #000; }
        .print-btn-container { text-align: right; padding: 20px; background: #f8f9fa; border-bottom: 1px solid #ddd; }
      }
      
      /* Screen styles */
      .print-stmt-page { max-width: 210mm; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); min-height: 297mm; }
      .print-btn-container { text-align: right; padding: 20px; background: #f8f9fa; margin-bottom: 20px; }
      .print-stmt-page table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
      .print-stmt-page th, .print-stmt-page td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      .print-stmt-page .num { text-align: right; }
      .print-stmt-page h1 { font-family: Fraunces, serif; font-size: 28px; margin: 0 0 5px 0; text-align: center; }
      .print-stmt-page h2 { font-size: 16px; margin: 0 0 20px 0; text-align: center; font-weight: normal; color: #666; }
      .print-stmt-page .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
      .print-stmt-page .footer-totals { margin-top: 20px; display: flex; justify-content: flex-end; }
      .print-stmt-page .totals-table { width: auto; min-width: 300px; }
      .print-stmt-page .totals-table th, .print-stmt-page .totals-table td { border: none; }
      .print-stmt-page .totals-table .border-top { border-top: 1px solid #ddd; }
      .print-stmt-page .totals-table .border-bottom-double { border-bottom: 3px double #ddd; }
    </style>
    <div class="print-btn-container no-print">
      <button class="btn gold" onclick="window.print()">Print Statement</button>
      <button class="btn secondary" onclick="window.close()">Close</button>
    </div>
    <div class="print-stmt-page">
      <h1>Uzhunnungal Traders</h1>
      <h2>Account Statement</h2>
      
      <div class="header-info">
        <div>
          <strong>To:</strong><br>
          <strong>${esc(party.name)}</strong><br>
          ${esc(party.place || "")}<br>
          ${esc(party.address || "")}<br>
          ${esc(party.phone || "")}
        </div>
        <div style="text-align:right">
          <strong>Date:</strong> ${today()}<br>
          <strong>Statement for Selected Transactions</strong>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars / Bill No.</th>
            <th class="num">Debit (₹)</th>
            <th class="num">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totalDebit = 0;
  let totalCredit = 0;

  for (const t of transactions) {
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
    if (t.itemId && t.priceKg) {
      particular = `${isDebit ? "Purchase" : "Sale"} Payment · ${kg(t.priceKg)}kg ${esc(t.itemId)}${t.rate ? ` @ ₹${t.rate}` : ""}`;
    } else {
      particular = `${isDebit ? "Payment Made" : "Payment Received"}`;
    }
    if (t.billNo) particular += ` · Bill No: ${esc(t.billNo)}`;
    if (t.notes) particular += ` · ${esc(t.notes)}`;

    html += `
      <tr>
        <td>${t.date}</td>
        <td>${particular}</td>
        <td class="num">${debitStr}</td>
        <td class="num">${creditStr}</td>
      </tr>
    `;
  }

  const net = totalDebit - totalCredit;
  const balanceText = net >= 0 ? `${money(net)} Dr` : `${money(-net)} Cr`;

  html += `
        </tbody>
      </table>
      
      <div class="footer-totals">
        <table class="totals-table">
          <tr>
            <td>Total Debit:</td>
            <td class="num">${money(totalDebit)}</td>
          </tr>
          <tr>
            <td>Total Credit:</td>
            <td class="num">${money(totalCredit)}</td>
          </tr>
          <tr>
            <td class="border-top border-bottom-double"><strong>Net Balance (Selected):</strong></td>
            <td class="num border-top border-bottom-double"><strong>${balanceText}</strong></td>
          </tr>
        </table>
      </div>
    </div>
  `;

  document.getElementById("app")!.innerHTML = html;
  
  setTimeout(() => {
    window.print();
  }, 500);
}
