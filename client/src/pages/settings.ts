import { api } from "../api.js";
import { esc } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { CompanyInfoDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const c = await api.get<CompanyInfoDTO>("/settings/company");

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Company settings</h2>
        <p>Business identity printed on bills, statements, and the Bill of Supply bill book.</p>
      </div>
    </div>
    <form class="stack" id="company-form">
      <div class="card">
        <h3>Business details</h3>
        <div class="row">
          <label>Business name <input required name="name" value="${esc(c.name)}" maxlength="120"></label>
          <label>Tagline <input name="tagline" value="${esc(c.tagline)}" maxlength="120" placeholder="Hill Produce Dealer"></label>
        </div>
        <label>Address <textarea name="address" rows="2" maxlength="200">${esc(c.address)}</textarea></label>
        <div class="row3">
          <label>Phone <input name="phone" value="${esc(c.phone)}" placeholder="9447204847"></label>
          <label>State <input name="state" value="${esc(c.state)}" placeholder="Kerala"></label>
          <label>Pin code <input name="pincode" value="${esc(c.pincode || "673591")}" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="673591"></label>
        </div>
        <label>GSTIN <input class="upper" name="gstin" value="${esc(c.gstin)}" maxlength="15" placeholder="32APFPJ6004B1ZP"></label>
      </div>
      <div class="card">
        <h3>Bank details</h3>
        <p class="note">Pre-printed in the bank box of the Bill of Supply bill book.</p>
        <div class="row3">
          <label>Bank name <input name="bankName" value="${esc(c.bankName || "")}" maxlength="120" placeholder="Canara Bank"></label>
          <label>Bank A/c. No <input name="bankAccount" value="${esc(c.bankAccount || "")}" maxlength="30" inputmode="numeric"></label>
          <label>Branch IFSC <input class="upper" name="bankIfsc" value="${esc(c.bankIfsc || "")}" maxlength="11" placeholder="CNRB0001234"></label>
        </div>
      </div>
      <div class="actions">
        <button class="btn gold" type="submit" id="company-save">Save company details</button>
      </div>
    </form>
  `);

  const form = document.getElementById("company-form") as HTMLFormElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("company-save") as HTMLButtonElement;
    saveBtn.disabled = true;
    const fd = new FormData(form);
    try {
      await api.put("/settings/company", {
        name: fd.get("name"),
        tagline: fd.get("tagline") || "",
        address: fd.get("address") || "",
        phone: fd.get("phone") || "",
        state: fd.get("state") || "",
        pincode: fd.get("pincode") || "673591",
        gstin: (fd.get("gstin") as string || "").toUpperCase(),
        bankName: fd.get("bankName") || null,
        bankAccount: fd.get("bankAccount") || null,
        bankIfsc: (fd.get("bankIfsc") as string || "").toUpperCase() || null,
      });
      toast("Company details saved", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
      saveBtn.disabled = false;
    }
  });
}
