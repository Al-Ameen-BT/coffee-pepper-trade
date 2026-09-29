import { api } from "../api.js";
import { esc, money, fundType } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { FundDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const funds = await api.get<FundDTO[]>("/funds");

  const cards = funds.length
    ? funds.map((f) => `
      <div class="card">
        <h3>${fundType(f.type)}</h3>
        <p class="metric">${money(f.balance)}</p>
        <p>${esc(f.name)}<br><small>Opening ${money(f.opening)}${f.bankName ? " · " + esc(f.bankName) : ""}${
          f.accountNumberMasked
            ? `<br><span style="color:var(--muted)">A/c:</span> <strong id="acc-${f.id}">${esc(f.accountNumberMasked)}</strong> <button class="btn secondary" style="padding:2px 8px;font-size:11px;margin-left:6px" data-reveal="${f.id}">Reveal</button>`
            : ""
        }</small></p>
      </div>
    `).join("")
    : `<div class="card empty">No accounts yet. Create one above.</div>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Cash & Bank</h2>
        <p>Manage fund accounts, view movements, and secure encrypted bank details.</p>
      </div>
    </div>
    <div class="grid three" style="margin-bottom:16px">${cards}</div>
    <div class="card" style="margin-bottom:16px">
      <h3>Create new account</h3>
      <form class="stack" id="new-fund-form">
        <div class="row">
          <label>Name <input required name="name" placeholder="Account name"></label>
          <label>Type
            <select name="type">
              <option value="CASH">Cash</option>
              <option value="CURRENT">Current A/c</option>
              <option value="CC">Cash Credit (CC)</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label>Opening balance ₹ <input type="number" step="0.01" name="opening" value="0"></label>
          <label>Bank name <input name="bankName" placeholder="Bank name (SBI, HDFC, Canara...)"></label>
        </div>
        <label>Account number <input name="accountNumber" placeholder="Securely encrypted at rest with AES-256-GCM"></label>
        <div class="actions"><button class="btn" type="submit">Create account</button></div>
      </form>
    </div>
    <div class="card">
      <h3>All movements</h3>
      <div id="movements-table"><div class="empty">Loading...</div></div>
    </div>
  `);

  // Wire reveal buttons
  document.querySelectorAll("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fundId = (btn as HTMLElement).dataset.reveal!;
      try {
        const res = await api.get<{ accountNumber: string }>(`/funds/${fundId}/reveal-account`);
        const accEl = document.getElementById(`acc-${fundId}`);
        if (accEl) {
          accEl.textContent = res.accountNumber || "—";
          (btn as HTMLElement).style.display = "none";
        }
      } catch (err) {
        toast("Failed to reveal account number", "error");
      }
    });
  });

  document.getElementById("new-fund-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.post("/funds", {
        name: fd.get("name"),
        type: fd.get("type"),
        opening: Number(fd.get("opening")) || 0,
        bankName: fd.get("bankName") || undefined,
        accountNumber: fd.get("accountNumber") || undefined,
      });
      toast("Account created", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  });

  // Load movements for each fund
  const movementsDiv = document.getElementById("movements-table")!;
  try {
    const allMovements = await Promise.all(
      funds.map((f) => api.get<any[]>(`/funds/${f.id}/movements`).then((m) => ({ fund: f, movements: m }))),
    );

    const rows = allMovements.flatMap(({ fund, movements }) =>
      movements.map((m: any) => `
        <tr>
          <td>${m.date}</td>
          <td>${esc(fund.name)}</td>
          <td>${esc(m.particular)}</td>
          <td class="num">${m.direction === "RECEIVE" ? money(m.amount) : ""}</td>
          <td class="num">${m.direction === "PAY" ? money(m.amount) : ""}</td>
        </tr>
      `),
    );

    movementsDiv.innerHTML = rows.length
      ? `<table><thead><tr><th>Date</th><th>Account</th><th>Particular</th><th class="num">In</th><th class="num">Out</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : `<div class="empty">No movements yet.</div>`;
  } catch {
    movementsDiv.innerHTML = `<div class="empty">Failed to load movements.</div>`;
  }
}
