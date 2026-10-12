import { api } from "../api.js";
import { esc, money, kg } from "../format.js";
import { renderShell } from "../main.js";
import type { DashboardData } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const t = await api.get<DashboardData>("/dashboard");

  const kpis = `
    <div class="grid kpis">
      <div class="card"><h3>Cash in hand</h3><p class="metric">${money(t.cash)}</p></div>
      <div class="card"><h3>Bank (Current + CC)</h3><p class="metric">${money(t.bank)}</p></div>
      <div class="card"><h3>Cash receivable</h3><p class="metric">${money(t.toGet)}<br><small>Parties owe us (to receive)</small></p></div>
      <div class="card"><h3>Cash payable</h3><p class="metric">${money(t.toPay)}<br><small>We owe parties (to pay)</small></p></div>
    </div>
  `;

  const unpricedCard = `
    <div class="card">
      <h3>Unpriced weight still pending</h3>
      ${t.items.map((it) => `<div class="weight-box"><span class="tag ${it.slug === "pepper" ? "pepper" : ""}">${esc(it.name)}</span><strong>${kg(t.unpriced[it.id] || 0)}</strong></div>`).join("")}
      <p class="note">Physical stock: ${t.items.map((it) => `${esc(it.name)} ${kg(t.stock[it.id] || 0)}`).join(" · ")}</p>
    </div>
  `;

  const fundsCard = `
    <div class="card">
      <h3>Fund accounts</h3>
      <table>
        ${t.funds.map((f) => `<tr><td>${esc(f.name)}<br><small>${f.type}</small></td><td class="num"><strong>${money(f.balance)}</strong></td></tr>`).join("")}
      </table>
    </div>
  `;

  const partiesTable = `
    <div class="card">
      <h3>Party balances at a glance</h3>
      <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Party</th><th scope="col">Role</th>${t.items.map((it) => `<th scope="col" class="num">${esc(it.name)} pending</th>`).join("")}<th scope="col">Outstanding</th></tr></thead>
        <tbody>
          ${t.parties.map((p) => `
            <tr>
              <td><a href="/ledger?party=${p.id}" data-nav="/ledger?party=${p.id}">${esc(p.name)}</a></td>
              <td>${esc(p.role)}</td>
              ${t.items.map((it) => `<td class="num">${kg(p.unpricedByItem[it.id] || 0)}</td>`).join("")}
              <td>${p.settled ? '<span class="tag ok">Settled</span>' : p.outstanding.startsWith("-") ? `<span class="tag pay">To pay ${money(p.outstanding)}</span>` : `<span class="tag receive">To receive ${money(p.outstanding)}</span>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      </div>
    </div>
  `;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Trading desk</h2>
        <p>Coffee & black pepper lots, unpriced weight, and cash position</p>
      </div>
    </div>
    ${kpis}
    <div class="grid two">
      ${unpricedCard}
      ${fundsCard}
    </div>
    ${partiesTable}
  `);
}
