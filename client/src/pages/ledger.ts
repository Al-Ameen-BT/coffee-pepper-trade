import { api } from "../api.js";
import { esc, money, kg } from "../format.js";
import { renderShell } from "../main.js";
import type { PartyLedger, PartyDTO, ItemDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const partyId = params.get("party");

  const [parties, items, allSummary] = await Promise.all([
    api.get<PartyDTO[]>("/parties"),
    api.get<ItemDTO[]>("/items"),
    api.get<{ summaries: Record<string, {
      partyId: string;
      totalPaid: string;
      totalReceived: string;
      net: string;
      settled: boolean;
      quantitiesByItem: Record<string, { boughtKg: string; soldKg: string }>;
      unpricedByItem: Record<string, string>;
    }> }>("/ledger"),
  ]);

  if (parties.length === 0) {
    renderShell(`<div class="card empty">No parties yet. Create them on the Parties page.</div>`);
    return;
  }

  const selected = parties.find((p) => p.id === partyId) || parties[0];
  const startDate = params.get("startDate") || "";
  const endDate = params.get("endDate") || "";
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  const qStr = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const ledger = await api.get<PartyLedger>(`/ledger/${selected.id}${qStr}`);

  const partyRows = parties.map((p) => {
    const s = allSummary.summaries[p.id];
    const isSettled = s ? s.settled : true;
    const net = s ? Number(s.net) : 0;
    const netStr = s ? s.net : "0.00";

    return `
      <tr class="${p.id === selected.id ? "selected" : ""}">
        <td><a href="/ledger?party=${p.id}" data-nav="/ledger?party=${p.id}">${esc(p.name)}</a></td>
        <td>${esc(p.place || "—")}</td>
        <td>${esc(p.role)}</td>
        ${items.map((it) => {
          const c = s?.quantitiesByItem[it.id] || { boughtKg: "0", soldKg: "0" };
          return `<td class="num">${kg(c.boughtKg)}</td><td class="num">${kg(c.soldKg)}</td>`;
        }).join("")}
        <td>${isSettled ? '<span class="tag ok">Settled</span>' : net < 0 ? `<span class="tag pay">To pay ${money(netStr)}</span>` : `<span class="tag receive">To receive ${money(netStr)}</span>`}</td>
      </tr>
    `;
  }).join("");

  const ledgerRows = ledger.rows.length
    ? ledger.rows.map((r) => `
      <tr>
        <td>${r.date}</td>
        <td>${esc(r.particular)}</td>
        <td class="num">${r.debit && r.debit !== "0" ? money(r.debit) : ""}</td>
        <td class="num">${r.credit && r.credit !== "0" ? money(r.credit) : ""}</td>
        <td class="num">${Number(r.balance) >= 0 ? money(r.balance) + " Dr" : money(-r.balance) + " Cr"}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="empty">No transactions yet for this period.</td></tr>`;

  const dueText = ledger.settled
    ? "Settled — nothing outstanding"
    : ledger.net.startsWith("-")
      ? `We owe them ${money(ledger.net)} (to pay)`
      : `They owe us ${money(ledger.net)} (to receive)`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Personal ledger</h2>
        <p>Outstanding is cash-basis: only Payments count as realized purchases and sales.</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>All parties and outstanding</h3>
      <table>
        <thead><tr><th>Party</th><th>Place</th><th>Role</th>${items.map((it) => `<th class="num">${esc(it.name)} bought</th><th class="num">${esc(it.name)} sold</th>`).join("")}<th>Outstanding</th></tr></thead>
        <tbody>${partyRows}</tbody>
      </table>
    </div>
    <div class="ledger-head">
      <div class="card">
        <h3>Party details</h3>
        <p class="metric" style="font-size:26px">${esc(ledger.party.name)}</p>
        <p style="color:var(--muted);margin:8px 0 0">
          ${esc(ledger.party.role)} · ${esc(ledger.party.place || "Place not set")}<br>
          ${esc(ledger.party.address || "Address not set")}<br>
          ${esc(ledger.party.phone || "Phone not set")}
        </p>
      </div>
      <div class="card due-box ${ledger.settled ? "ok" : ledger.net.startsWith("-") ? "pay" : "receive"}">
        <h3>Outstanding (cash)</h3>
        <p class="metric">${dueText}</p>
        <p style="color:var(--muted);margin:8px 0 0;font-size:13px">
          Cash outflow (payments made): ${money(ledger.totalPaid)}<br>
          Cash inflow (payments received): ${money(ledger.totalReceived)}
        </p>
      </div>
      <div class="card">
        <h3>Unpriced weight still pending</h3>
        ${items.map((it) => `<div class="weight-box" style="margin-top:8px"><span class="tag ${it.slug === "pepper" ? "pepper" : ""}">${esc(it.name)}</span><strong>${kg(ledger.unpricedByItem[it.id] || 0)}</strong></div>`).join("")}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Quantities bought from / sold to ${esc(ledger.party.name)}</h3>
      <table>
        <thead><tr><th>Item</th><th class="num">Bought from them (kg)</th><th class="num">Sold to them (kg)</th><th class="num">Unpriced pending (kg)</th></tr></thead>
        <tbody>
          ${items.map((it) => {
            const c = ledger.quantitiesByItem[it.id] || { boughtKg: "0", soldKg: "0" };
            return `<tr><td><span class="tag ${it.slug === "pepper" ? "pepper" : ""}">${esc(it.name)}</span></td><td class="num">${kg(c.boughtKg)}</td><td class="num">${kg(c.soldKg)}</td><td class="num pending">${kg(ledger.unpricedByItem[it.id] || 0)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3>Account statement</h3>
        <form class="date-filter" style="display:flex;gap:8px;align-items:center;">
          <input type="hidden" name="party" value="${esc(selected.id)}">
          <input type="date" name="startDate" value="${esc(startDate)}">
          <span>to</span>
          <input type="date" name="endDate" value="${esc(endDate)}">
          <button type="submit" class="btn">Filter</button>
          <button type="button" class="btn" id="export-csv">Export to CSV</button>
        </form>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Particulars</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Running balance</th></tr></thead>
        <tbody>
          ${ledgerRows}
          <tr><td></td><td><strong>Closing outstanding</strong></td><td class="num"><strong>${money(ledger.totalPaid)}</strong></td><td class="num"><strong>${money(ledger.totalReceived)}</strong></td><td class="num"><strong>${dueText}</strong></td></tr>
        </tbody>
      </table>
    </div>
  `);

  setTimeout(() => {
    document.querySelector(".date-filter")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const s = fd.get("startDate") as string;
      const en = fd.get("endDate") as string;
      const url = new URL(window.location.href);
      if (s) url.searchParams.set("startDate", s);
      else url.searchParams.delete("startDate");
      if (en) url.searchParams.set("endDate", en);
      else url.searchParams.delete("endDate");
      window.history.pushState({}, "", url);
      window.dispatchEvent(new Event("popstate"));
    });

    document.getElementById("export-csv")?.addEventListener("click", () => {
      let csv = "Date,Particulars,Debit,Credit,Running Balance\\n";
      for (const r of ledger.rows) {
        const balNum = Number(r.balance);
        const balStr = balNum >= 0 ? r.balance + " Dr" : (-balNum).toFixed(2) + " Cr";
        csv += `"${r.date}","${r.particular.replace(/"/g, '""')}","${r.debit !== "0" ? r.debit : ""}","${r.credit !== "0" ? r.credit : ""}","${balStr}"\n`;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `ledger_${selected.name}_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }, 0);
}
