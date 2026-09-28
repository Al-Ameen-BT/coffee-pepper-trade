import { api } from "../api.js";
import { esc, kg, money, today } from "../format.js";
import { renderShell, toast, openModal, closeModal } from "../main.js";
import type { LotDTO, PartyDTO, ItemDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const [lots, parties, items] = await Promise.all([
    api.get<LotDTO[]>("/lots?kind=PURCHASE"),
    api.get<PartyDTO[]>("/parties"),
    api.get<ItemDTO[]>("/items"),
  ]);

  const rows = lots.length
    ? lots.map((l) => `
      <tr>
        <td>${l.date}</td>
        <td>${esc(l.partyName)}</td>
        <td><span class="tag ${l.itemName === "Black Pepper" ? "pepper" : ""}">${esc(l.itemName)}</span></td>
        <td class="num">${kg(l.totalKg)}</td>
        <td class="num">${kg(l.pricedKg)}</td>
        <td class="num pending">${kg(l.unpricedKg)}</td>
        <td class="num">${money(l.fixingValue)}</td>
        <td>${Number(l.unpricedKg) > 0 ? `<button class="btn secondary" data-fix="${l.id}">Fix price</button>` : '<span class="tag ok">Fully priced</span>'}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">No purchase lots yet.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Purchases</h2>
        <p>Record total weight first. Price can be fixed later in multiple tranches.</p>
      </div>
      <button class="btn" id="add-btn">New purchase</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Date</th><th>Party</th><th>Item</th><th class="num">Weight</th><th class="num">Priced</th><th class="num">Pending</th><th class="num">Value</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  document.getElementById("add-btn")!.addEventListener("click", () => {
    openModal(`
      <h3 style="font-family:Fraunces,serif;font-size:22px;margin:0 0 12px">New Purchase</h3>
      <form class="stack" id="lot-form">
        <label>Date <input required type="date" name="date" value="${today()}"></label>
        <label>Party <select name="partyId" required>${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
        <div class="row">
          <label>Item <select name="itemId">${items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></label>
          <label>Total weight (kg) <input required type="number" step="0.001" min="0" name="totalKg"></label>
        </div>
        <div class="row">
          <label>Price now? (optional ₹/kg) <input type="number" step="0.01" min="0" name="rate" placeholder="Leave blank to fix later"></label>
          <label>Kg to price now <input type="number" step="0.001" min="0" name="fixKg" placeholder="Blank = all"></label>
        </div>
        <label>Bill No. <input name="billNo" placeholder="P-003"></label>
        <label>Notes <textarea name="notes" rows="2"></textarea></label>
        <div class="actions">
          <button class="btn" type="submit">Save lot</button>
          <button class="btn secondary" type="button" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    `);

    document.getElementById("lot-form")!.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      try {
        await api.post("/lots", {
          kind: "PURCHASE",
          partyId: fd.get("partyId"),
          itemId: fd.get("itemId"),
          date: fd.get("date"),
          totalKg: Number(fd.get("totalKg")),
          rate: Number(fd.get("rate")) || undefined,
          fixKg: fd.get("fixKg") ? Number(fd.get("fixKg")) : undefined,
          billNo: fd.get("billNo") || undefined,
          notes: fd.get("notes") || undefined,
        });
        closeModal();
        toast("Purchase recorded", "success");
        render();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed", "error");
      }
    });
  });

  // Wire fix buttons
  document.querySelectorAll("[data-fix]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lotId = (btn as HTMLElement).dataset.fix!;
      const lot = lots.find((l) => l.id === lotId)!;
      openModal(`
        <h3 style="font-family:Fraunces,serif;font-size:22px;margin:0 0 8px">Price fixing tranche</h3>
        <p style="margin:0 0 12px;color:var(--muted)">${lot.billNo} · ${esc(lot.partyName)} · ${esc(lot.itemName)} · pending ${kg(lot.unpricedKg)}</p>
        <form class="stack" id="fix-form">
          <div class="row3">
            <label>Date <input required type="date" name="date" value="${today()}"></label>
            <label>Weight (kg) <input required type="number" step="0.001" min="0.001" max="${lot.unpricedKg}" name="kg" value="${lot.unpricedKg}"></label>
            <label>Rate ₹/kg <input required type="number" step="0.01" min="0" name="rate"></label>
          </div>
          <label>Notes <input name="notes" placeholder="Market rate, QC, etc."></label>
          <div class="row">
            <label>Pay/receive now? <select name="settleNow"><option value="">No</option><option value="yes">Yes</option></select></label>
            <label>Fund account <select name="fundId" id="fix-fund"></select></label>
          </div>
          <div class="actions">
            <button class="btn gold" type="submit">Save tranche</button>
            <button class="btn secondary" type="button" onclick="closeModal()">Cancel</button>
          </div>
        </form>
      `);

      // Load funds
      api.get("/funds").then((funds: any) => {
        const sel = document.getElementById("fix-fund") as HTMLSelectElement;
        sel.innerHTML = funds.map((f: any) => `<option value="${f.id}">${esc(f.name)} (${f.type})</option>`).join("");
      });

      document.getElementById("fix-form")!.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          await api.post(`/lots/${lotId}/fixings`, {
            date: fd.get("date"),
            kg: Number(fd.get("kg")),
            rate: Number(fd.get("rate")),
            notes: fd.get("notes") || undefined,
            settleNow: fd.get("settleNow") === "yes",
            fundId: fd.get("fundId") || undefined,
          });
          closeModal();
          toast("Price fixed", "success");
          render();
        } catch (err) {
          toast(err instanceof Error ? err.message : "Failed", "error");
        }
      });
    });
  });
}
