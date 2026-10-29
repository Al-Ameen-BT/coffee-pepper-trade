import { api } from "../api.js";
import { esc } from "../format.js";
import { renderShell, toast, openModal, closeModal } from "../main.js";
import type { CompanyInfoDTO, ItemDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const [c, items] = await Promise.all([
    api.get<CompanyInfoDTO>("/settings/company"),
    api.get<ItemDTO[]>("/items"),
  ]);

  const itemRows = items.length
    ? items
        .map((it) => {
          const cgst = it.cgstRate ?? 2.5;
          const totalGst = it.gstRate ?? cgst * 2;
          const isStandard5 = Math.abs(totalGst - 5) < 0.01;
          const isStandard12 = Math.abs(totalGst - 12) < 0.01;
          const isStandard18 = Math.abs(totalGst - 18) < 0.01;
          const isStandard28 = Math.abs(totalGst - 28) < 0.01;
          const isExempt0 = Math.abs(totalGst) < 0.01;
          const isCustom = !isStandard5 && !isStandard12 && !isStandard18 && !isStandard28 && !isExempt0;

          return `
      <tr id="row-${it.id}">
        <td>
          <strong>${esc(it.name)}</strong>
          <div class="note" style="font-size:11px;">DB ID: ${esc(it.id)}</div>
        </td>
        <td>
          <input type="text" id="hsn-${it.id}" value="${esc(it.hsnCode || "")}" placeholder="e.g. 0901" style="width:90px; padding:4px 6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:600;">
        </td>
        <td>
          <select id="rate-sel-${it.id}" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-weight:600; background:#fff; font-size:12.5px;">
            <option value="5" ${isStandard5 ? "selected" : ""}>5% GST (2.5% CGST + 2.5% SGST)</option>
            <option value="12" ${isStandard12 ? "selected" : ""}>12% GST (6.0% CGST + 6.0% SGST)</option>
            <option value="18" ${isStandard18 ? "selected" : ""}>18% GST (9.0% CGST + 9.0% SGST)</option>
            <option value="28" ${isStandard28 ? "selected" : ""}>28% GST (14.0% CGST + 14.0% SGST)</option>
            <option value="0" ${isExempt0 ? "selected" : ""}>0% GST (Tax Exempt / Nil)</option>
            <option value="custom" ${isCustom ? "selected" : ""}>Custom Rate...</option>
          </select>
        </td>
        <td class="num">
          <span id="cgst-lbl-${it.id}" style="font-weight:600;">${cgst.toFixed(2)}%</span>
        </td>
        <td class="num">
          <span id="sgst-lbl-${it.id}" style="font-weight:600;">${cgst.toFixed(2)}%</span>
        </td>
        <td class="num">
          <span class="tag gold" id="total-badge-${it.id}">${totalGst.toFixed(2)}%</span>
        </td>
        <td>
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
            <button class="btn gold sm" data-quick-save="${it.id}">Save to DB</button>
            <button class="btn secondary sm" data-edit-item="${it.id}">Custom</button>
          </div>
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="empty">No products found in the application database.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Company &amp; GST Settings</h2>
        <p>Manage business details and customize GST / CGST rates for products in the database.</p>
      </div>
    </div>

    <div class="stack" style="gap: var(--s4);">
      <!-- Products & GST Rates Management Card -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: var(--s3); flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="margin:0;">Products &amp; Customized GST Rates (Database Level)</h3>
            <p class="note" style="margin:4px 0 0;">
              Select and customize the GST / CGST rate for each product listed in the application DB.
              <strong>Whenever an invoice or bill is generated for a product, it will automatically follow the GST rate set here.</strong>
            </p>
          </div>
          <button class="btn gold sm" id="add-product-btn" type="button">+ Add Product</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Product Name (DB)</th>
                <th scope="col">HSN / SAC</th>
                <th scope="col">Select GST Rate</th>
                <th scope="col" class="num">CGST %</th>
                <th scope="col" class="num">SGST %</th>
                <th scope="col" class="num">Total GST</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Specification: Where GST values are applied on invoices & bills -->
      <div class="card" style="border-left: 4px solid var(--gold); background: #fdfcf9;">
        <h3 style="display:flex; align-items:center; gap:8px;">
          <span>📋</span> How Invoices Follow the Setted GST
        </h3>
        <p style="margin: 6px 0 16px; color: #555; font-size: 13.5px;">
          Every invoice generated for a product pulls its tax rate directly from the database table:
        </p>

        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <!-- Sales Invoice Specification -->
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:16px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span class="tag gold" style="font-weight:700;">SALES BILLS</span>
              <strong>Tax Invoice Cum Bill of Supply</strong>
            </div>
            <ul style="font-size:12.5px; line-height:1.6; margin:0; padding-left:18px; color:#333;">
              <li><strong>Database Lookup:</strong> The bill inspects <code>fixing.lot.item.cgstRate</code> from the database.</li>
              <li><strong>Item Row Calculation:</strong>
                <br>• Taxable Value = <code>Quantity (kg) × Rate (₹/kg)</code>
                <br>• <strong>CGST Amount</strong> = <code>Taxable Value × DB CGST%</code>
                <br>• <strong>SGST Amount</strong> = <code>Taxable Value × DB SGST%</code>
                <br>• Row Total = <code>Taxable Value + CGST + SGST</code>
              </li>
              <li style="margin-top:6px;"><strong>Table Headers:</strong> Dynamically display the setted rate: <code>CGST (${items[0]?.cgstRate ?? 2.5}%)</code> &amp; <code>SGST (${items[0]?.cgstRate ?? 2.5}%)</code>.</li>
              <li style="margin-top:6px;"><strong>Grand Total:</strong> $\text{Taxable} + \text{CGST} + \text{SGST} + \text{TCS} - \text{TDS}$ (converted to words automatically).</li>
            </ul>
          </div>

          <!-- Purchase Invoice Specification -->
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:16px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span class="tag" style="font-weight:700; background:#edf2f7;">PURCHASE BILLS</span>
              <strong>Purchase Invoice (Unregistered)</strong>
            </div>
            <ul style="font-size:12.5px; line-height:1.6; margin:0; padding-left:18px; color:#333;">
              <li><strong>Farmer / Supplier Billing:</strong> Purchases from unregistered farmers do not include supplier GST.</li>
              <li style="margin-top:6px;"><strong>Reverse Charge Mechanism (RCM):</strong>
                <br>• Governed under <strong>Section 9(4)</strong> of the CGST Act.
                <br>• Raw agricultural produce (raw coffee, green/dried pepper) from agriculturists is <strong>Nil / Exempt</strong>.
              </li>
              <li style="margin-top:6px;"><strong>Payable Amount:</strong> Gross goods value minus TDS plus TCS. Total Amount in Words matches payable value.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Business Details Form -->
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
    </div>
  `);

  // Wire Company Form
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

  // Wire Row-level Rate Dropdowns
  items.forEach((item) => {
    const sel = document.getElementById(`rate-sel-${item.id}`) as HTMLSelectElement | null;
    const cgstLbl = document.getElementById(`cgst-lbl-${item.id}`);
    const sgstLbl = document.getElementById(`sgst-lbl-${item.id}`);
    const totalBadge = document.getElementById(`total-badge-${item.id}`);

    if (sel) {
      sel.addEventListener("change", () => {
        if (sel.value === "custom") {
          showItemModal(item);
          return;
        }
        const total = Number(sel.value) || 0;
        const half = Math.round((total / 2) * 100) / 100;
        if (cgstLbl) cgstLbl.textContent = `${half.toFixed(2)}%`;
        if (sgstLbl) sgstLbl.textContent = `${half.toFixed(2)}%`;
        if (totalBadge) totalBadge.textContent = `${total.toFixed(2)}%`;
      });
    }
  });

  // Wire Quick Save to DB buttons
  document.querySelectorAll("[data-quick-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = (btn as HTMLElement).dataset.quickSave!;
      const item = items.find((it) => it.id === id);
      if (!item) return;

      const sel = document.getElementById(`rate-sel-${id}`) as HTMLSelectElement | null;
      const hsnInput = document.getElementById(`hsn-${id}`) as HTMLInputElement | null;
      const saveBtn = btn as HTMLButtonElement;

      let totalRate = item.gstRate ?? (item.cgstRate ?? 2.5) * 2;
      if (sel && sel.value !== "custom") {
        totalRate = Number(sel.value);
      }
      const cgstRate = Math.round((totalRate / 2) * 100) / 100;
      const hsnCode = hsnInput ? hsnInput.value.trim() : (item.hsnCode || "");

      saveBtn.disabled = true;
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";

      try {
        await api.put(`/items/${id}`, {
          name: item.name,
          hsnCode,
          cgstRate,
          gstRate: totalRate,
        });
        item.cgstRate = cgstRate;
        item.sgstRate = cgstRate;
        item.gstRate = totalRate;
        item.hsnCode = hsnCode;

        saveBtn.textContent = "Saved ✓";
        saveBtn.style.background = "#2e7d32";
        toast(`Updated "${item.name}" in DB: GST ${totalRate}% (CGST ${cgstRate}% + SGST ${cgstRate}%). Invoices will follow this rate.`, "success");

        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
          saveBtn.style.background = "";
        }, 1500);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        toast(err instanceof Error ? err.message : "Failed to update GST rate in DB", "error");
      }
    });
  });

  // Modal setup for Add / Edit Product
  function showItemModal(item?: ItemDTO) {
    const isEdit = Boolean(item);
    const initialCgst = item?.cgstRate ?? 2.5;
    const initialGst = item?.gstRate ?? initialCgst * 2;

    openModal(`
      <h3 class="modal-title">${isEdit ? "Edit Product &amp; GST Rates" : "Add New Product"}</h3>
      <p class="note" style="margin-bottom:14px;">GST for Kerala intra-state sales is split equally into CGST and SGST.</p>
      <form class="stack" id="item-form">
        <label>Product Name
          <input required name="name" value="${esc(item?.name || "")}" placeholder="e.g. Raw Coffee Arabica" maxlength="100">
        </label>
        <label>HSN / SAC Code
          <input name="hsnCode" value="${esc(item?.hsnCode || "")}" placeholder="e.g. 0901 (Coffee) or 0904 (Pepper)" maxlength="20">
        </label>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
          <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Quick Presets:</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <button type="button" class="btn secondary sm preset-btn" data-preset="5">5% (Produce / Coffee / Pepper)</button>
            <button type="button" class="btn secondary sm preset-btn" data-preset="12">12% (Processed Goods)</button>
            <button type="button" class="btn secondary sm preset-btn" data-preset="18">18% (Standard Rate)</button>
            <button type="button" class="btn secondary sm preset-btn" data-preset="0">0% (Tax Exempt)</button>
          </div>

          <div class="row3">
            <label>Total GST %
              <input type="number" step="0.01" min="0" max="100" id="inp-gst" name="gstRate" value="${initialGst}">
            </label>
            <label>CGST %
              <input type="number" step="0.01" min="0" max="100" id="inp-cgst" name="cgstRate" value="${initialCgst}">
            </label>
            <label>SGST %
              <input type="number" step="0.01" min="0" max="100" id="inp-sgst" name="sgstRate" value="${initialCgst}" readonly style="background:#eee;">
            </label>
          </div>
        </div>

        <div class="actions" style="margin-top:12px;">
          <button class="btn gold" type="submit">${isEdit ? "Update Product" : "Save Product"}</button>
          <button class="btn secondary" type="button" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    `);

    const gstInp = document.getElementById("inp-gst") as HTMLInputElement;
    const cgstInp = document.getElementById("inp-cgst") as HTMLInputElement;
    const sgstInp = document.getElementById("inp-sgst") as HTMLInputElement;

    gstInp.addEventListener("input", () => {
      const g = Number(gstInp.value) || 0;
      const half = Math.round((g / 2) * 100) / 100;
      cgstInp.value = String(half);
      sgstInp.value = String(half);
    });

    cgstInp.addEventListener("input", () => {
      const cVal = Number(cgstInp.value) || 0;
      sgstInp.value = String(cVal);
      gstInp.value = String(Math.round(cVal * 2 * 100) / 100);
    });

    document.querySelectorAll(".preset-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const p = Number((b as HTMLElement).dataset.preset);
        gstInp.value = String(p);
        const half = Math.round((p / 2) * 100) / 100;
        cgstInp.value = String(half);
        sgstInp.value = String(half);
      });
    });

    const itemForm = document.getElementById("item-form") as HTMLFormElement;
    itemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(itemForm);
      const name = String(fd.get("name") || "").trim();
      const hsnCode = String(fd.get("hsnCode") || "").trim();
      const cgstRate = Number(fd.get("cgstRate")) || 0;

      try {
        if (isEdit) {
          await api.put(`/items/${item!.id}`, { name, hsnCode, cgstRate });
          toast("Product updated", "success");
        } else {
          await api.post("/items", { name, hsnCode, cgstRate });
          toast("Product created", "success");
        }
        closeModal();
        render();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to save product", "error");
      }
    });
  }

  // Bind add button
  const addBtn = document.getElementById("add-product-btn");
  if (addBtn) addBtn.addEventListener("click", () => showItemModal());

  // Bind edit buttons
  document.querySelectorAll("[data-edit-item]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = (b as HTMLElement).dataset.editItem!;
      const item = items.find((it) => it.id === id);
      if (item) showItemModal(item);
    });
  });
}
