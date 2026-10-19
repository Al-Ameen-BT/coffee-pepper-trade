import { api } from "../api.js";
import { esc, money, kg } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { BillRecordDTO, PartyDTO, InvoiceDTO } from "../../../shared/types.js";

/**
 * Bill Register — the digital-first ledger of issued Bills of Supply.
 * Replaces flipping through a paper bill book: every priced trade appears
 * here with its number, tax treatment, and paid status, and links to a
 * shareable digital bill.
 */
export async function render(): Promise<void> {
  const [bills, parties] = await Promise.all([
    api.get<BillRecordDTO[]>("/bills"),
    api.get<PartyDTO[]>("/parties"),
  ]);

  const params = new URLSearchParams(window.location.search);
  const partyFilter = params.get("party") || "";
  const kindFilter = params.get("kind") || "";
  const statusFilter = params.get("status") || "";

  // Server-side filters keep this working at trade scale
  const query = new URLSearchParams();
  if (partyFilter) query.set("partyId", partyFilter);
  if (kindFilter) query.set("kind", kindFilter);
  if (statusFilter) query.set("paid", statusFilter === "paid" ? "true" : "false");

  const rows = statusFilter || partyFilter || kindFilter
    ? await api.get<BillRecordDTO[]>(`/bills${query.toString() ? `?${query}` : ""}`)
    : bills;

  const totals = rows.reduce(
    (acc, b) => {
      acc.count += 1;
      acc.net += Number(b.netAmount);
      if (!b.paid) acc.unpaid += Number(b.netAmount);
      return acc;
    },
    { count: 0, net: 0, unpaid: 0 },
  );

  const invoices = await api.get<InvoiceDTO[]>("/invoices");
  const invTotals = invoices.reduce(
    (acc, i) => {
      acc.count += 1;
      acc.total += Number(i.total);
      return acc;
    },
    { count: 0, total: 0 },
  );

  const invBody = invoices.length
    ? invoices.map((i) => `
      <tr>
        <td><a href="/invoice/${i.id}" data-nav="/invoice/${i.id}">${esc(i.billNo)}</a></td>
        <td class="nowrap">${i.date}</td>
        <td><span class="tag ${i.kind === "SALE" ? "receive" : "pay"}">${i.kind === "SALE" ? "Sale" : "Purchase"}</span></td>
        <td>${esc(i.partyName)}</td>
        <td class="num">${i.lines.length}</td>
        <td class="num">${money(i.taxableValue)}</td>
        <td class="num">${Number(i.cgstAmount) > 0 ? money(Number(i.cgstAmount) + Number(i.sgstAmount)) : "—"}</td>
        <td class="num"><strong>${money(i.total)}</strong></td>
        <td class="nowrap">${i.paymentBillNo ? `<span class="tag ok">Paid</span> <small class="muted">${esc(i.paymentBillNo)}</small>` : '<span class="tag warn">Unpaid</span>'}</td>
        <td><div class="actions"><a href="/invoice/${i.id}" class="btn secondary sm">Open</a></div></td>
      </tr>
    `).join("")
    : `<tr><td colspan="10" class="empty">No invoices yet. Open a payment and choose "Create invoice" to bill its priced trades.</td></tr>`;

  const body = rows.length
    ? rows.map((b) => `
      <tr>
        <td><a href="/bill/${b.id}" data-nav="/bill/${b.id}">${esc(b.billNo || "—")}</a></td>
        <td class="nowrap">${b.date}</td>
        <td><span class="tag ${b.kind === "SALE" ? "receive" : "pay"}">${b.kind === "SALE" ? "Tax Invoice" : "Purchase Invoice"}</span></td>
        <td>${esc(b.partyName)}</td>
        <td>${esc(b.itemName)} <span class="muted">${b.hsnCode}</span></td>
        <td class="num">${kg(b.kg)}</td>
        <td class="num">${money(b.rate)}</td>
        <td class="num">${Number(b.tcsAmount) > 0 ? `<span class="tag gold">+ ${money(b.tcsAmount!)}</span>` : "—"}</td>
        <td class="num">${Number(b.tdsAmount) > 0 ? `<span class="tag warn">− ${money(b.tdsAmount!)}</span>` : "—"}</td>
        <td class="num"><strong>${money(b.netAmount)}</strong></td>
        <td class="nowrap">${b.paid ? `<span class="tag ok">Paid</span>${b.paymentBillNo ? ` <small class="muted">${esc(b.paymentBillNo)}</small>` : ""}` : '<span class="tag warn">Unpaid</span>'}</td>
        <td><div class="actions">
          <a href="/bill/${b.id}" class="btn secondary sm">Digital Bill</a>
          <a href="/print-bill?fixingId=${b.id}" class="btn ${b.kind === "SALE" ? "gold" : "secondary"} sm">${b.kind === "SALE" ? "Tax Invoice" : "Purchase Invoice"}</a>
        </div></td>
      </tr>
    `).join("")
    : `<tr><td colspan="12" class="empty">No bills match these filters. Bills appear here when a trade is priced.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Invoices &amp; Bills Register</h2>
        <p>Issued Purchase Invoices (unregistered) and Tax Invoices cum Bill of Supply. Open digitally or print.</p>
      </div>
      <div class="actions">
        <a href="/print-bill?kind=SALE" class="btn gold">Tax Invoice Generator</a>
        <a href="/bill-book" class="btn secondary">Blank Bill Book</a>
      </div>
    </div>
    <div class="grid kpis">
      <div class="card"><h3>Bills issued</h3><p class="metric">${totals.count}</p></div>
      <div class="card"><h3>Total value</h3><p class="metric">${money(totals.net)}</p></div>
      <div class="card"><h3>Unpaid value</h3><p class="metric">${money(totals.unpaid)}</p></div>
      <div class="card"><h3>Settled</h3><p class="metric">${totals.count - rows.filter((b) => !b.paid).length} of ${totals.count}</p></div>
    </div>
    <p class="note">Invoices are the customer-facing document (one per payment, GST split). Trade bills are the per-lot priced records underneath.</p>
    <div class="card">
      <div class="card-head">
        <h3>Invoices — one per payment</h3>
        <a href="/bill-register" class="btn sm secondary">Payments</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th scope="col">Invoice No.</th>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col">Party</th>
            <th scope="col" class="num">Lines</th>
            <th scope="col" class="num">Taxable</th>
            <th scope="col" class="num">GST</th>
            <th scope="col" class="num">Total</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${invBody}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>Trade bills — per priced lot</h3>
        <form class="date-filter register-filter" id="register-filter">
          <label class="field-inline">Party
            <select name="party">
              <option value="">All parties</option>
              ${parties.map((p) => `<option value="${p.id}" ${p.id === partyFilter ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
            </select>
          </label>
          <label class="field-inline">Type
            <select name="kind">
              <option value="">All</option>
              <option value="PURCHASE" ${kindFilter === "PURCHASE" ? "selected" : ""}>Purchase</option>
              <option value="SALE" ${kindFilter === "SALE" ? "selected" : ""}>Sale</option>
            </select>
          </label>
          <label class="field-inline">Status
            <select name="status">
              <option value="">All</option>
              <option value="paid" ${statusFilter === "paid" ? "selected" : ""}>Paid</option>
              <option value="unpaid" ${statusFilter === "unpaid" ? "selected" : ""}>Unpaid</option>
            </select>
          </label>
          <button class="btn" type="submit">Apply</button>
        </form>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th scope="col">Bill No.</th>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col">Party</th>
            <th scope="col">Item</th>
            <th scope="col" class="num">Qty</th>
            <th scope="col" class="num">Rate</th>
            <th scope="col" class="num">TCS</th>
            <th scope="col" class="num">TDS</th>
            <th scope="col" class="num">Net</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById("register-filter")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const q = new URLSearchParams();
    const party = fd.get("party") as string;
    const kind = fd.get("kind") as string;
    const status = fd.get("status") as string;
    if (party) q.set("party", party);
    if (kind) q.set("kind", kind);
    if (status) q.set("status", status);
    window.history.pushState({}, "", `/bill-register${q.toString() ? `?${q}` : ""}`);
    window.dispatchEvent(new Event("popstate"));
  });
}