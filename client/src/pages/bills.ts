import { api } from "../api.js";
import { esc, money, kg, today } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { PartyBill, PartyDTO, CompanyInfoDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const partyId = params.get("party");

  const parties = await api.get<PartyDTO[]>("/parties");
  if (parties.length === 0) {
    renderShell(`<div class="card empty">Add a party first.</div>`);
    return;
  }

  const selected = parties.find((p) => p.id === partyId) || parties[0];
  const [bill, company] = await Promise.all([
    api.get<PartyBill>(`/bills/${selected.id}`),
    api.get<CompanyInfoDTO>("/settings/company"),
  ]);

  const due = bill.settled ? "Settled" : bill.outstanding.startsWith("-") ? `To pay ${money(bill.outstanding)}` : `To receive ${money(bill.outstanding)}`;

  const rowPay = (list: any[], isDebit: boolean) => list.length
    ? list.map((x) => `
      <tr>
        <td class="no-print cb-cell"><input type="checkbox" class="stmt-cb" aria-label="Select ${esc(x.billNo || `transaction of ${x.date}`)}" data-json="${esc(JSON.stringify({...x, isDebit}))}"></td>
        <td>${x.date}</td>
        <td>${esc(x.billNo || "—")}</td>
        <td>${esc(x.itemName || "—")}</td>
        <td class="num">${x.priceKg ? kg(x.priceKg) : "—"}</td>
        <td class="num">${x.rate ? money(x.rate) : "—"}</td>
        <td class="num">${money(x.amount)}</td>
        <td>${esc(x.fundName || "")}</td>
        <td>${esc(x.notes || "")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="empty">None</td></tr>`;

  renderShell(`
    
    <div class="topbar no-print">
      <div>
        <h2>Bills & Print Module</h2>
        <p>Select a party to view their statements or print individual formal bills.</p>
      </div>
      <div class="actions">
        <label class="field-inline">Party
          <select id="bill-party">
            ${parties.map((p) => `<option value="${p.id}" ${p.id === selected.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select>
        </label>
        <label class="field-inline">Bill Number
          <select id="bill-select">
            <option value="">-- Select Bill --</option>
            ${(bill.fixings || []).map(f => f.billNo ? `<option value="${f.id}">${esc(f.billNo)} (${f.date})</option>` : '').join('')}
          </select>
        </label>
        <a href="/bill-register" data-nav="/bill-register" class="btn secondary">Bill Register</a>
        <a href="/bill-book" target="_blank" class="btn secondary">Blank Bill Book</a>
        <button class="btn secondary" type="button" id="print-formal-bill">Open Selected Bill</button>
        <button class="btn gold" type="button" id="print-selected">Print Statement</button>
      </div>
    </div>

    <div class="card" id="bill">
      <div class="print-head">
        <div>
          <div class="bill-brand">${esc(company.name)}</div>
          <div class="note">Party statement · Cash accounting (realized on payment)</div>
        </div>
        <div class="right">
          <strong>${esc(bill.party.name)}</strong><br>
          ${esc(bill.party.place || "")} ${esc(bill.party.phone || "")}<br>
          ${esc(bill.party.address || "")}<br>
          Printed ${today()}
        </div>
      </div>
      <p class="bill-outstanding"><strong>Outstanding:</strong> ${due} · Outflow ${money(bill.totalPaid)} · Inflow ${money(bill.totalReceived)}</p>
      <h3>Realized purchases (items bought — via payment)</h3>
      <div class="table-wrap"><table><thead><tr><th class="no-print"><span class="sr-only">Select</span></th><th scope="col">Date</th><th scope="col">Bill No.</th><th scope="col">Item</th><th scope="col" class="num">Kg</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th><th scope="col">Account</th><th scope="col">Notes</th></tr></thead><tbody>${rowPay(bill.realizedPurchases, true)}</tbody></table></div>
      <h3>Realized sales (items sold — via payment)</h3>
      <div class="table-wrap"><table><thead><tr><th class="no-print"><span class="sr-only">Select</span></th><th scope="col">Date</th><th scope="col">Bill No.</th><th scope="col">Item</th><th scope="col" class="num">Kg</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th><th scope="col">Account</th><th scope="col">Notes</th></tr></thead><tbody>${rowPay(bill.realizedSales, false)}</tbody></table></div>
      <h3>Goods on file (not realized until payment)</h3>
      <div class="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Item</th><th scope="col" class="num">Kg received / delivered</th><th scope="col">Notes</th></tr></thead><tbody>
        ${bill.goodsOnFile.length ? bill.goodsOnFile.map((l) => `
          <tr>
            <td>${l.date}</td>
            <td>${l.kind === "PURCHASE" ? "Purchase lot" : "Sale lot"}</td>
            <td>${esc(l.itemName)}</td>
            <td class="num">${kg(l.totalKg)}</td>
            <td>${esc(l.notes || "")}</td>
          </tr>
        `).join("") : `<tr><td colspan="5" class="empty">No goods lots</td></tr>`}
      </tbody></table></div>
      <h3>Price fixings</h3>
      <div class="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Bill No.</th><th scope="col" class="num">Kg</th><th scope="col" class="num">Rate</th><th scope="col">Notes</th><th scope="col">Action</th></tr></thead><tbody>
        ${(bill.fixings || []).length ? (bill.fixings || []).map((f) => `
          <tr>
            <td>${f.date}</td>
            <td>${esc(f.billNo || "—")}</td>
            <td class="num">${kg(f.kg)}</td>
            <td class="num">${money(f.rate)}</td>
            <td>${esc(f.notes || "")}</td>
            <td><a href="/print-bill?fixingId=${f.id}" class="btn secondary sm" target="_blank">Print Formal Bill</a></td>
          </tr>
        `).join("") : `<tr><td colspan="6" class="empty">No price fixings</td></tr>`}
      </tbody></table></div>
    </div>
  `);

  document.getElementById("bill-party")!.addEventListener("change", (e) => {
    window.location.href = `/bills?party=${(e.target as HTMLSelectElement).value}`;
  });

  document.getElementById("print-selected")!.addEventListener("click", () => {
    const selectedRows = Array.from(document.querySelectorAll('.stmt-cb:checked')).map(cb => {
      const data = (cb as HTMLElement).dataset.json;
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);

    if (selectedRows.length === 0) {
      toast("Select at least one transaction to print.", "error");
      return;
    }

    sessionStorage.setItem("print-statement-data", JSON.stringify({
      party: bill.party,
      transactions: selectedRows
    }));
    window.open("/print-statement", "_blank");
  });

  
  document.getElementById("print-formal-bill")!.addEventListener("click", () => {
    const sel = document.getElementById("bill-select") as HTMLSelectElement;
    if (!sel.value) {
      toast("Please select a bill number first", "error");
      return;
    }
    window.open("/bill/" + sel.value, "_blank");
  });

}
