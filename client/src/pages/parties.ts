import { api } from "../api.js";
import { esc, kg, money } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { PartyDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const parties = await api.get<PartyDTO[]>("/parties");

  const rows = parties.length
    ? parties.map((p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.place || "")}</td>
        <td>${esc(p.address || "")}</td>
        <td>${esc(p.phone || "")}</td>
        <td>${esc(p.role)}</td>
        <td><a href="/ledger?party=${p.id}" data-nav="/ledger?party=${p.id}">Open ledger</a></td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="empty">No parties yet. Use the form above to create one.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Customers & suppliers</h2>
        <p>Create a new party, then use them on purchases, sales, payments, and the personal ledger.</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Create new party</h3>
      <form class="stack" id="new-party-form">
        <div class="row">
          <label>Name <input required name="name" placeholder="Estate / trader name"></label>
          <label>Role
            <select name="role">
              <option value="SUPPLIER">Supplier</option>
              <option value="BUYER">Buyer</option>
              <option value="BOTH" selected>Both</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label>Place <input name="place" placeholder="Town / village"></label>
          <label>Phone <input name="phone" placeholder="Mobile / landline"></label>
        </div>
        <label>Address <textarea name="address" rows="2" placeholder="House / estate, street, post, district"></textarea></label>
        <div class="actions"><button class="btn" type="submit">Save party</button></div>
      </form>
    </div>
    <div class="card">
      <h3>All parties</h3>
      <table>
        <thead><tr><th>Name</th><th>Place</th><th>Address</th><th>Phone</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  document.getElementById("new-party-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.post("/parties", {
        name: fd.get("name"),
        role: fd.get("role"),
        place: fd.get("place") || undefined,
        phone: fd.get("phone") || undefined,
        address: fd.get("address") || undefined,
      });
      toast("Party created", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  });
}
