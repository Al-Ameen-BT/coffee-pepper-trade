import { api } from "../api.js";
import { esc, money, kg, today } from "../format.js";
import { renderShell } from "../main.js";
import type { PartyBill, PartyDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const partyId = params.get("party");

  const parties = await api.get<PartyDTO[]>("/parties");
  if (parties.length === 0) {
    renderShell(`<div class="card empty">Add a party first.</div>`);
    return;
  }

  const selected = parties.find((p) => p.id === partyId) || parties[0];
  const bill = await api.get<PartyBill>(`/bills/${selected.id}`);

  const due = bill.settled ? "Settled" : bill.outstanding.startsWith("-") ? `To pay ${money(bill.outstanding)}` : `To receive ${money(bill.outstanding)}`;

  const rowPay = (list: any[]) => list.length
    ? list.map((x) => `
      <tr>
        <td>${x.date}</td>
        <td>${esc(x.billNo || "—")}</td>
        <td>${x.itemId ? esc(x.itemId) : "—"}</td>
        <td class="num">${x.priceKg ? kg(x.priceKg) : "—"}</td>
        <td class="num">${x.rate ? money(x.rate) : "—"}</td>
        <td class="num">${money(x.amount)}</td>
        <td>${esc(x.fundName || "")}</td>
        <td>${esc(x.notes || "")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">None</td></tr>`;

  renderShell(`
    <div class="topbar no-print">
      <div>
        <h2>Party bill / PDF</h2>
        <p>Party-wise statement of realized purchases, realized sales, cash paid, and cash received.</p>
      </div>
      <div class="actions">
        <label>Party
          <select id="bill-party">
            ${parties.map((p) => `<option value="${p.id}" ${p.id === selected.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select>
        </label>
        <button class="btn gold" type="button" id="print-pdf">Print / Save PDF</button>
      </div>
    </div>
    <div class="card" id="bill">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--espresso);padding-bottom:12px">
        <div>
          <div style="font-family:Fraunces,serif;font-size:28px">Hill Trade Ledger</div>
          <div style="color:var(--muted)">Party statement · Cash accounting (realized on payment)</div>
        </div>
        <div style="text-align:right">
          <strong>${esc(bill.party.name)}</strong><br>
          ${esc(bill.party.place || "")} ${esc(bill.party.phone || "")}<br>
          ${esc(bill.party.address || "")}<br>
          Printed ${today()}
        </div>
      </div>
      <p style="margin:16px 0 8px"><strong>Outstanding:</strong> ${due} · Outflow ${money(bill.totalPaid)} · Inflow ${money(bill.totalReceived)}</p>
      <h3>Realized purchases (items bought — via payment)</h3>
      <table><thead><tr><th>Date</th><th>Bill No.</th><th>Item</th><th class="num">Kg</th><th class="num">Rate</th><th class="num">Amount</th><th>Account</th><th>Notes</th></tr></thead><tbody>${rowPay(bill.realizedPurchases)}</tbody></table>
      <h3 style="margin-top:18px">Realized sales (items sold — via payment)</h3>
      <table><thead><tr><th>Date</th><th>Bill No.</th><th>Item</th><th class="num">Kg</th><th class="num">Rate</th><th class="num">Amount</th><th>Account</th><th>Notes</th></tr></thead><tbody>${rowPay(bill.realizedSales)}</tbody></table>
      <h3 style="margin-top:18px">Goods on file (not realized until payment)</h3>
      <table><thead><tr><th>Date</th><th>Type</th><th>Item</th><th class="num">Kg received / delivered</th><th>Notes</th></tr></thead><tbody>
        ${bill.goodsOnFile.length ? bill.goodsOnFile.map((l) => `
          <tr>
            <td>${l.date}</td>
            <td>${l.kind === "PURCHASE" ? "Purchase lot" : "Sale lot"}</td>
            <td>${esc(l.itemName)}</td>
            <td class="num">${kg(l.totalKg)}</td>
            <td>${esc(l.notes || "")}</td>
          </tr>
        `).join("") : `<tr><td colspan="5" class="empty">No goods lots</td></tr>`}
      </tbody></table>
    </div>
  `);

  document.getElementById("bill-party")!.addEventListener("change", (e) => {
    window.location.href = `/bills?party=${(e.target as HTMLSelectElement).value}`;
  });

  document.getElementById("print-pdf")!.addEventListener("click", () => {
    window.print();
  });
}
