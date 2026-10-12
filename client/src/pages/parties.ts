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
    <div class="card">
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
        <div class="row3">
          <label>Pin code <input name="pincode" placeholder="6-digit PIN" maxlength="6" inputmode="numeric"></label>
          <label>State <input name="state" value="Kerala" placeholder="Kerala"></label>
          <label>GSTIN <input class="upper" name="gstin" placeholder="GST number (optional)" maxlength="15"></label>
        </div>
        <label>Address <textarea name="address" rows="2" placeholder="House / estate, street, post, district"></textarea></label>
        <div class="actions"><button class="btn" type="submit">Save party</button></div>
      </form>
    </div>
    <div class="card">
      <h3>All parties</h3>
      <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Name</th><th scope="col">Place</th><th scope="col">Address</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
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
        pincode: fd.get("pincode") || undefined,
        state: fd.get("state") || undefined,
        gstin: (fd.get("gstin") as string || "").toUpperCase() || undefined,
        address: fd.get("address") || undefined,
      });
      toast("Party created", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  });
}
