import { api } from "../api.js";
import { money, kg, esc } from "../format.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const fixingId = params.get("fixingId");

  if (!fixingId) {
    document.getElementById("app")!.innerHTML = `<div class="print-doc"><p>No fixing ID provided.</p></div>`;
    return;
  }

  try {
    const data = await api.get<any>(`/bills/formal/${fixingId}`);
    const COMPANY = data.company;
    const party = data.party;
    const item = data.item;

    document.title = `Bill ${data.billNo} · ${COMPANY.name}`;

    document.getElementById("app")!.innerHTML = `
      <div class="print-bar no-print">
        <button class="btn secondary" onclick="window.history.back()">Back</button>
        <button class="btn gold" onclick="window.print()">Print Bill</button>
      </div>

      <div class="print-doc bb">
        <!-- Header band -->
        <div class="bb-head">
          <div><span class="bb-form-name">Bill of Supply</span></div>
          <div class="bb-head-center">
            <h1>${esc(COMPANY.name).toUpperCase()}</h1>
            <p class="bb-tagline">${esc(COMPANY.tagline)}</p>
            <p class="bb-addr">${esc(COMPANY.address)} · Pin Code: <strong>${esc(COMPANY.pincode)}</strong></p>
          </div>
          <div class="bb-head-right">Phone: ${esc(COMPANY.phone)}</div>
        </div>
        <div class="bb-gstin">GSTIN: ${esc(COMPANY.gstin)}</div>

        <!-- Top Information Block -->
        <div class="bb-info">
          <div>
            <div class="bb-field"><span class="lbl">Details of Party:</span></div>
            <div class="bb-field"><span class="lbl">Name:</span> <strong>${esc(party.name)}</strong></div>
            <div class="bb-field"><span class="lbl">Address:</span> <span>${esc(party.address || "—")}</span></div>
            ${party.place ? `<div class="bb-field"><span class="lbl">Place:</span> <span>${esc(party.place)}</span></div>` : ""}
            <div class="bb-inline-pair">
              <div class="bb-field"><span class="lbl">Pin Code:</span> <span>${esc(party.pincode || "—")}</span></div>
              <div class="bb-field"><span class="lbl">State:</span> <span>${esc(party.state || "Kerala")}</span></div>
            </div>
            <div class="bb-field"><span class="lbl">GSTIN:</span> <span>${esc(party.gstin || "Unregistered")}</span></div>
          </div>
          <div>
            <div class="bb-field"><span class="lbl">Bill Details:</span></div>
            <div class="bb-field"><span class="lbl">Bill Serial No:</span> <span class="bb-serial">${esc(data.billNo)}</span></div>
            <div class="bb-field"><span class="lbl">Date &amp; Time:</span> <strong>${esc(data.dateTime || data.date)}</strong></div>
            <div class="bb-field"><span class="lbl">Transaction:</span> <span>${data.kind === "PURCHASE" ? "Purchase Bill" : "Sale Bill"}</span></div>
          </div>
        </div>

        <!-- Goods Table -->
        <table class="bb-table">
          <thead>
            <tr>
              <th class="ctr" style="width: 50px;">Sl. No.</th>
              <th>Description of Goods</th>
              <th class="ctr" style="width: 90px;">HSN/SAC</th>
              <th class="ctr" style="width: 80px;">GST Rate</th>
              <th class="num" style="width: 100px;">Quantity</th>
              <th class="num" style="width: 120px;">Rate/per KG</th>
              <th class="num" style="width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ctr">1</td>
              <td><strong>${esc(item.description)}</strong></td>
              <td class="ctr">${esc(item.hsnCode || "—")}</td>
              <td class="ctr">${item.gstRate}%</td>
              <td class="num">${kg(item.qty)}</td>
              <td class="num">${money(item.unitPrice)}</td>
              <td class="num">${money(item.total)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Tax & Summary Breakdown -->
        <div class="bill-summary-wrap">
          <div class="bill-rcm-block">
            <div><span class="lbl">Amount of Tax Subject To Reverse Charge:</span> <strong>₹ 0.00 (No)</strong></div>
            ${data.tcsAmount > 0 ? `<div><span class="lbl">TCS (${data.tcsRate}%):</span> <strong>${money(data.tcsAmount)}</strong></div>` : ""}
            ${data.tdsAmount > 0 ? `<div><span class="lbl">Less TDS (${data.tdsRate}%):</span> <strong>− ${money(data.tdsAmount)}</strong></div>` : ""}
          </div>
          <table class="bill-tax-table">
            <tr>
              <td>Taxable Value:</td>
              <td class="num">${money(data.taxableValue)}</td>
            </tr>
            <tr>
              <td>CGST (${data.cgstRate}%):</td>
              <td class="num">${money(data.cgstAmount)}</td>
            </tr>
            <tr>
              <td>SGST (${data.sgstRate}%):</td>
              <td class="num">${money(data.sgstAmount)}</td>
            </tr>
            <tr class="grand-row">
              <td><strong>Grand Total:</strong></td>
              <td class="num"><strong>${money(data.grandTotal)}</strong></td>
            </tr>
          </table>
        </div>

        <!-- Footer / Signature -->
        <div class="bill-footer-wrap">
          <div class="bill-sig-box">
            <p>for, <strong>${esc(COMPANY.name)}</strong></p>
            <div class="bill-sig-line">Authorised Signature</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById("app")!.innerHTML = `<div class="print-doc"><p>Error loading bill: ${esc(String(err))}</p></div>`;
  }
}
