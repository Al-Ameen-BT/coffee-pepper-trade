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

        <!-- Top Information: two ruled columns -->
        <div class="bb-info">
          <div>
            <div class="bb-section-label" style="font-weight: 700; margin-bottom: 4px;">Invoice Details:</div>
            <div class="bb-field"><span class="lbl">Invoice Number :</span> <span class="bb-serial">${esc(data.billNo)}</span></div>
            <div class="bb-field"><span class="lbl">Invoice Date :</span> <strong>${esc(data.dateTime || data.date)}</strong></div>
            <div class="bb-inline-pair">
              <div class="bb-field"><span class="lbl">State :</span> ${esc(COMPANY.state || "Kerala")}</div>
              <div class="bb-field"><span class="lbl">State Code :</span> ${esc(COMPANY.stateCode || "32")}</div>
              <div class="bb-field"><span class="lbl">PIN Code :</span> ${esc(COMPANY.pincode || "673591")}</div>
            </div>
          </div>
          <div>
            <div class="bb-section-label" style="font-weight: 700; margin-bottom: 4px;">Transport &amp; Supply:</div>
            <div class="bb-field"><span class="lbl">Transportation Mode :</span> <span>Road</span></div>
            <div class="bb-field"><span class="lbl">Vehicle No :</span> <span>${esc(data.vehicleNo || "—")}</span></div>
            <div class="bb-field"><span class="lbl">Date &amp; Time of Supply :</span> <span>${esc(data.dateTime || data.date)}</span></div>
            <div class="bb-field"><span class="lbl">Place of Supply :</span> <span>${esc(party.state || "Kerala")} (${esc(party.stateCode || "32")})</span></div>
          </div>
        </div>

        <!-- Details of receiver (Bill To) -->
        <div class="bb-receiver">
          <div class="bb-section-label">Bill To</div>
          <div class="bb-field"><span class="lbl">Name :</span> <strong>${esc(party.name)}</strong></div>
          <div class="bb-field"><span class="lbl">Address :</span> <span>${esc(party.address || "—")}${party.place ? `, ${esc(party.place)}` : ""}</span></div>
          <div class="bb-inline-pair">
            <div class="bb-field"><span class="lbl">State :</span> <span>${esc(party.state || "Kerala")}</span></div>
            <div class="bb-field"><span class="lbl">State Code :</span> <span>${esc(party.stateCode || "32")}</span></div>
            <div class="bb-field"><span class="lbl">PIN Code :</span> <span>${esc(party.pincode || "—")}</span></div>
            <div class="bb-field"><span class="lbl">GSTIN :</span> <span>${esc(party.gstin || "Unregistered")}</span></div>
          </div>
          <div class="bb-inline-pair">
            <div class="bb-field"><span class="lbl">From :</span> <span>Kariambadi, Wayanad</span></div>
            <div class="bb-field"><span class="lbl">To :</span> <span>${esc(party.place || party.address || "—")}</span></div>
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
          <tfoot>
            <tr>
              <td></td>
              <td><strong>Total</strong></td>
              <td></td>
              <td class="num"><strong>${kg(item.qty)}</strong></td>
              <td></td>
              <td class="num"><strong>${money(item.total)}</strong></td>
            </tr>
          </tfoot>
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
          <tfoot>
            <tr>
              <td></td>
              <td><strong>Total</strong></td>
              <td></td>
              <td class="num"><strong>${kg(item.qty)}</strong></td>
              <td></td>
              <td class="num"><strong>${money(data.taxableValue)}</strong></td>
              <td class="num"><strong>${money(data.cgstAmount)}</strong></td>
              <td class="num"><strong>${money(data.sgstAmount)}</strong></td>
              <td class="num"><strong>${money(data.taxableValue + data.cgstAmount + data.sgstAmount)}</strong></td>
            </tr>
          </tfoot>
        </table>
        `}

        <!-- Bottom summary -->
        <div class="bb-bottom">
          <section>
            <div class="bb-words">
              <span class="lbl"><strong>Total Amount in Words:</strong></span>
              <div style="font-weight: 600; margin-top: 4px; font-size: 11.5px; line-height: 1.3;">${esc(data.amountInWords || "")}</div>
            </div>
            <div class="bb-bank">
              <div class="bb-field"><span class="lbl">Bank Name :</span> <strong>${esc(COMPANY.bankName || "—")}</strong></div>
              <div class="bb-field"><span class="lbl">Bank A/c. No :</span> <strong>${esc(COMPANY.bankAccount || "—")}</strong></div>
              <div class="bb-field"><span class="lbl">Branch IFSC :</span> <strong>${esc(COMPANY.bankIfsc || "—")}</strong></div>
            </div>
            <div class="bb-terms">
              <div class="bb-terms-head">Terms &amp; Conditions</div>
              <ol>
                <li>Goods once sold will not be taken back or exchanged.</li>
              </ol>
            </div>
          </section>

          <section class="bb-seal">
            <div class="bb-seal-box">Seal</div>
          </section>

          <section>
            <div class="bb-amounts">
              <div class="bb-field" style="display:flex; justify-content:space-between;"><span class="lbl">Taxable Value :</span> <strong>${money(data.taxableValue)}</strong></div>
              ${!isPurchase ? `
              <div class="bb-field" style="display:flex; justify-content:space-between;"><span class="lbl">CGST (${data.cgstRate}%) :</span> <strong>${money(data.cgstAmount)}</strong></div>
              <div class="bb-field" style="display:flex; justify-content:space-between;"><span class="lbl">SGST (${data.sgstRate}%) :</span> <strong>${money(data.sgstAmount)}</strong></div>
              ` : ""}
              ${data.tcsAmount > 0 ? `<div class="bb-field" style="display:flex; justify-content:space-between;"><span class="lbl">TCS (${data.tcsRate}%) :</span> <strong>${money(data.tcsAmount)}</strong></div>` : ""}
              ${data.tdsAmount > 0 ? `<div class="bb-field" style="display:flex; justify-content:space-between;"><span class="lbl">Less TDS (${data.tdsRate}%) :</span> <strong>− ${money(data.tdsAmount)}</strong></div>` : ""}
              <div class="bb-field bb-total-value" style="display:flex; justify-content:space-between;"><span class="lbl">Grand Total :</span> <strong>${money(data.grandTotal)}</strong></div>
            </div>
            <p class="bb-cert">Certified that the particulars given above are true and correct.</p>
            <p class="bb-for">for, ${esc(COMPANY.name)}</p>
            <p class="bb-sign">(Authorised Signatory)</p>
          </section>
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
