import { api } from "../api.js";
import { money, kg, esc } from "../format.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const fixingId = params.get("fixingId");

  if (!fixingId) {
    document.getElementById("app")!.innerHTML = `<div style="padding:20px;">No fixing ID provided.</div>`;
    return;
  }

  try {
    const data = await api.get<any>(`/bills/formal/${fixingId}`);

    const subtotal = data.kg * data.rate;
    const tcsAmt = data.tcsAmount || 0;
    const tdsAmt = data.tdsAmount || 0;
    const net = subtotal + tcsAmt - tdsAmt;

    const html = `
      <style>
        /* Print Styles */
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
          #app, .app { display: block !important; height: auto !important; overflow: visible !important; }
          .sidebar, .topbar { display: none !important; }
          .print-btn-container { display: none !important; }
        }

        .print-view-wrapper {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 30px;
          color: #000;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        @media print {
          .print-view-wrapper {
            box-shadow: none;
            padding: 0;
            max-width: none;
          }
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .print-header-left h1 {
          font-size: 24px;
          margin: 0 0 5px 0;
          text-transform: uppercase;
        }

        .print-header-left p, .print-header-right p {
          margin: 2px 0;
          font-size: 13px;
        }

        .print-header-right {
          text-align: right;
        }

        .print-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          font-size: 14px;
        }

        .print-meta-left p, .print-meta-right p {
          margin: 4px 0;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
        }

        .print-table th, .print-table td {
          border: 1px solid #000;
          padding: 10px;
          text-align: left;
        }

        .print-table th {
          background-color: #f2f2f2;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .print-table .num {
          text-align: right;
        }

        .print-totals {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 50px;
        }

        .print-totals-table {
          border-collapse: collapse;
          width: 300px;
        }

        .print-totals-table td {
          padding: 6px 10px;
          font-size: 14px;
        }

        .print-totals-table .totals-label {
          font-weight: bold;
        }

        .print-totals-table .totals-val {
          text-align: right;
        }

        .print-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 50px;
        }

        .sign-box {
          text-align: center;
          font-size: 14px;
        }

        .sign-box-line {
          border-top: 1px solid #000;
          width: 200px;
          margin-top: 50px;
          padding-top: 10px;
        }

        .btn-print {
          padding: 8px 16px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-print:hover {
          background: #333;
        }
      </style>

      <div class="print-btn-container" style="text-align:center; padding:20px; background:#f9fafb;">
        <button class="btn-print" onclick="window.print()">Print Bill</button>
        <button class="btn-print" style="background:#6b7280; margin-left:10px" onclick="window.history.back()">Back</button>
      </div>

      <div class="print-view-wrapper">
        <h2 style="text-align:center; text-transform:uppercase; margin-top:0; margin-bottom:20px; letter-spacing:2px; font-size:18px;">Bill of Supply</h2>
        
        <div class="print-header">
          <div class="print-header-left">
            <h1>${esc(data.company.name)}</h1>
            <p><strong>${esc(data.company.tagline)}</strong></p>
            <p>Address: ${esc(data.company.address)}</p>
          </div>
          <div class="print-header-right">
            <p><strong>GSTIN:</strong> ${esc(data.company.gstin)}</p>
            <p><strong>Phone:</strong> ${esc(data.company.phone)}</p>
            <p><strong>State:</strong> ${esc(data.company.state)}, <strong>Code:</strong> ${esc(data.company.stateCode)}</p>
          </div>
        </div>

        <div class="print-meta">
          <div class="print-meta-left">
            <p><strong>Bill To:</strong></p>
            <p><strong>${esc(data.lot.party.name)}</strong></p>
            <p>${esc(data.lot.party.address || "")}</p>
            ${data.lot.party.place ? `<p>${esc(data.lot.party.place)}</p>` : ''}
          </div>
          <div class="print-meta-right">
            <p><strong>Bill No:</strong> ${esc(data.billNo || "—")}</p>
            <p><strong>Date:</strong> ${esc(data.date)}</p>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Description of Goods</th>
              <th>HSN Code</th>
              <th class="num">Qty (Kg)</th>
              <th class="num">Rate (₹)</th>
              <th class="num">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>${esc(data.lot.item.name)}</td>
              <td>${esc(data.lot.item.hsnCode)}</td>
              <td class="num">${kg(data.kg)}</td>
              <td class="num">${money(data.rate)}</td>
              <td class="num">${money(subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-totals">
          <table class="print-totals-table">
            <tr>
              <td class="totals-label">Sub Total</td>
              <td class="totals-val">${money(subtotal)}</td>
            </tr>
            ${tcsAmt > 0 ? `
            <tr>
              <td class="totals-label">Add: TCS @ ${data.tcsRate}%</td>
              <td class="totals-val">${money(tcsAmt)}</td>
            </tr>` : ''}
            ${tdsAmt > 0 ? `
            <tr>
              <td class="totals-label">Less: TDS @ ${data.tdsRate}%</td>
              <td class="totals-val">${money(tdsAmt)}</td>
            </tr>` : ''}
            <tr style="border-top:2px solid #000; border-bottom:2px solid #000;">
              <td class="totals-label" style="font-size:16px;">Total Amount</td>
              <td class="totals-val" style="font-size:16px; font-weight:bold;">${money(net)}</td>
            </tr>
          </table>
        </div>

        <div class="print-footer">
          <div class="sign-box">
            <p>Receiver's Signature</p>
          </div>
          <div class="sign-box">
            <p>For <strong>${esc(data.company.name)}</strong></p>
            <div class="sign-box-line">Authorized Signatory</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("app")!.innerHTML = html;
  } catch (err) {
    document.getElementById("app")!.innerHTML = `<div style="padding:20px;color:red;">Error loading bill: ${esc(String(err))}</div>`;
  }
}
