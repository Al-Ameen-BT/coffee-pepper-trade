import { api } from "../api.js";
import { money, kg, esc } from "../format.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  let fixingId = params.get("fixingId") || params.get("id");
  const kind = params.get("kind") || "";

  // Fetch list of available bills of this kind (or all bills) for the selector
  let billsList: any[] = [];
  try {
    billsList = await api.get<any[]>(`/bills${kind ? `?kind=${kind}` : ""}`);
  } catch (e) {
    console.error("Could not load bills list", e);
  }

  // If no fixingId was specified in URL, auto-select the latest bill from the list
  if (!fixingId && billsList.length > 0) {
    fixingId = billsList[0].id;
  }

  (window as any).goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (window.opener) {
      window.close();
    } else {
      window.location.href = kind === "SALE" ? "/sales" : "/bill-register";
    }
  };

  if (!fixingId) {
    document.getElementById("app")!.innerHTML = `
      <div class="print-bar no-print">
        <button class="btn secondary" onclick="goBack()">Back</button>
      </div>
      <div class="card" style="max-width: 600px; margin: 40px auto; padding: 30px; text-align: center;">
        <h3>No ${kind === "SALE" ? "Sales" : kind === "PURCHASE" ? "Purchases" : "Invoices"} Available</h3>
        <p style="margin: 15px 0 25px; color: #555;">
          There are no priced ${kind === "SALE" ? "sale trades" : kind === "PURCHASE" ? "purchase trades" : "trades"} yet to generate an invoice.
          Record and price a trade in the ${kind === "SALE" ? "Sales" : "Purchases"} module first.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <a href="${kind === "SALE" ? "/sales" : "/purchases"}" class="btn gold">Go to ${kind === "SALE" ? "Sales" : "Purchases"}</a>
          <button class="btn secondary" onclick="goBack()">Back</button>
        </div>
      </div>
    `;
    return;
  }

  try {
    const data = await api.get<any>(`/bills/formal/${fixingId}`);
    const COMPANY = data.company;
    const party = data.party;
    const item = data.item;

    const isPurchase = data.kind === "PURCHASE";
    document.title = `${isPurchase ? "Purchase Invoice" : "Tax Invoice Cum Bill of Supply"} ${data.billNo} · ${COMPANY.name}`;

    document.getElementById("app")!.innerHTML = `
      <div class="print-bar no-print">
        <button class="btn secondary" onclick="goBack()">Back</button>
        ${billsList.length > 1 ? `
        <label class="field-inline" style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:600; font-size:13px;">Invoice:</span>
          <select id="invoice-selector" style="padding:6px 12px; font-weight:600; border-radius:6px; border:1px solid #ccc; max-width:360px;">
            ${billsList.map(b => `<option value="${b.id}" ${b.id === data.id || b.id === fixingId ? "selected" : ""}>${esc(b.billNo || "Bill")} — ${esc(b.partyName)} (${b.date})</option>`).join("")}
          </select>
        </label>
        ` : ""}
        <button class="btn gold" onclick="window.print()">Print ${isPurchase ? "Purchase Invoice" : "Tax Invoice"}</button>
      </div>

      <div class="print-doc bb">
        <!-- Header band -->
        <div class="bb-head">
          <div>
            <span class="bb-form-name">${isPurchase ? "Purchase Invoice" : "TAX INVOICE CUM BILL OF SUPPLY"}</span>
            ${isPurchase ? `<div style="font-size: 10.5px; font-weight: 600; text-align: center; margin-top: 3px; color: #333; letter-spacing: 0.02em;">(purchase from unregistered)</div>` : ""}
          </div>
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
            <div class="bb-field"><span class="lbl">${isPurchase ? "Supplier Details:" : "Bill To:"}</span></div>
            <div class="bb-field"><span class="lbl">Name:</span> <strong>${esc(party.name)}</strong></div>
            <div class="bb-field"><span class="lbl">Address:</span> <span>${esc(party.address || "—")}</span></div>
            ${party.place ? `<div class="bb-field"><span class="lbl">Place:</span> <span>${esc(party.place)}</span></div>` : ""}
            <div class="bb-inline-pair">
              <div class="bb-field"><span class="lbl">State:</span> <span>${esc(party.state || "Kerala")}</span></div>
              <div class="bb-field"><span class="lbl">State Code:</span> <span>${esc(party.stateCode || "32")}</span></div>
              <div class="bb-field"><span class="lbl">PIN Code:</span> <span>${esc(party.pincode || "—")}</span></div>
            </div>
            <div class="bb-field"><span class="lbl">GSTIN:</span> <span>${esc(party.gstin || "Unregistered")}</span></div>
          </div>
          <div>
            <div class="bb-field"><span class="lbl">Invoice Details:</span></div>
            <div class="bb-field"><span class="lbl">Invoice Number:</span> <span class="bb-serial">${esc(data.billNo)}</span></div>
            <div class="bb-field"><span class="lbl">Invoice Date:</span> <strong>${esc(data.dateTime || data.date)}</strong></div>
            <div class="bb-inline-pair">
              <div class="bb-field"><span class="lbl">State:</span> <span>${esc(COMPANY.state || "Kerala")}</span></div>
              <div class="bb-field"><span class="lbl">State Code:</span> <span>${esc(COMPANY.stateCode || "32")}</span></div>
              <div class="bb-field"><span class="lbl">PIN Code:</span> <span>${esc(COMPANY.pincode || "673591")}</span></div>
            </div>
            <div class="bb-field"><span class="lbl">Transaction:</span> <span>${isPurchase ? "Purchase Invoice" : "Sales Invoice"}</span></div>
          </div>
        </div>

        <!-- Goods Table -->
        ${isPurchase ? `
        <table class="bb-table">
          <thead>
            <tr>
              <th class="ctr" style="width: 50px;">Sl. No.</th>
              <th>Description of Goods</th>
              <th class="ctr" style="width: 100px;">HSN/SAC</th>
              <th class="num" style="width: 110px;">Quantity</th>
              <th class="num" style="width: 130px;">Rate/per KG</th>
              <th class="num" style="width: 130px;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ctr">1</td>
              <td><strong>${esc(item.description)}</strong></td>
              <td class="ctr">${esc(item.hsnCode || "—")}</td>
              <td class="num">${kg(item.qty)}</td>
              <td class="num">${money(item.unitPrice)}</td>
              <td class="num">${money(item.total)}</td>
            </tr>
            ${Array.from({ length: 3 }, () => `
            <tr class="bb-empty-row">
              <td class="ctr"></td>
              <td></td>
              <td class="ctr"></td>
              <td class="num"></td>
              <td class="num"></td>
              <td class="num"></td>
            </tr>`).join("")}
          </tbody>
        </table>
        ` : `
        <table class="bb-table">
          <thead>
            <tr>
              <th class="ctr" style="width: 45px;">Sl. No.</th>
              <th>Name of Product</th>
              <th class="ctr" style="width: 70px;">HSN</th>
              <th class="num" style="width: 75px;">Qty (kg)</th>
              <th class="num" style="width: 75px;">Rate</th>
              <th class="num" style="width: 90px;">Taxable Value</th>
              <th class="num" style="width: 70px;">CGST</th>
              <th class="num" style="width: 70px;">SGST</th>
              <th class="num" style="width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ctr">1</td>
              <td><strong>${esc(item.description)}</strong></td>
              <td class="ctr">${esc(item.hsnCode || "—")}</td>
              <td class="num">${kg(item.qty)}</td>
              <td class="num">${money(item.unitPrice)}</td>
              <td class="num">${money(data.taxableValue)}</td>
              <td class="num">${money(data.cgstAmount)}</td>
              <td class="num">${money(data.sgstAmount)}</td>
              <td class="num"><strong>${money(data.taxableValue + data.cgstAmount + data.sgstAmount)}</strong></td>
            </tr>
            ${Array.from({ length: 3 }, () => `
            <tr class="bb-empty-row">
              <td class="ctr"></td>
              <td></td>
              <td class="ctr"></td>
              <td class="num"></td>
              <td class="num"></td>
              <td class="num"></td>
              <td class="num"></td>
              <td class="num"></td>
              <td class="num"></td>
            </tr>`).join("")}
          </tbody>
        </table>
        `}

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
          <div class="bb-terms" style="font-size: 11.5px; text-align: left;">
            <div class="bb-terms-head" style="font-weight: 700; text-decoration: underline; margin-bottom: 2px;">Terms &amp; Conditions</div>
            <ol style="margin: 0; padding-left: 16px;">
              <li>Goods once sold will not be taken back or exchanged.</li>
            </ol>
          </div>
          <div class="bill-sig-box">
            <p>for, <strong>${esc(COMPANY.name)}</strong></p>
            <div class="bill-sig-line">Authorised Signature</div>
          </div>
        </div>
      </div>
    `;

    const selector = document.getElementById("invoice-selector") as HTMLSelectElement | null;
    if (selector) {
      selector.addEventListener("change", (e) => {
        const nextId = (e.target as HTMLSelectElement).value;
        const newUrl = `/print-bill?fixingId=${nextId}${kind ? `&kind=${kind}` : ""}`;
        window.history.pushState({}, "", newUrl);
        render();
      });
    }
  } catch (err) {
    document.getElementById("app")!.innerHTML = `
      <div class="print-bar no-print">
        <button class="btn secondary" onclick="goBack()">Back</button>
      </div>
      <div class="print-doc"><p>Error loading bill: ${esc(String(err))}</p></div>
    `;
  }
}
