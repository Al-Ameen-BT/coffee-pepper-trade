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
          const sgst = it.sgstRate ?? cgst;
          const totalGst = it.gstRate ?? cgst * 2;
          return `
      <tr>
        <td><strong>${esc(it.name)}</strong></td>
        <td><code>${esc(it.hsnCode || "—")}</code></td>
        <td class="num">${cgst.toFixed(2)}%</td>
        <td class="num">${sgst.toFixed(2)}%</td>
        <td class="num"><span class="tag gold">${totalGst.toFixed(2)}%</span></td>
        <td>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn secondary sm" data-edit-item="${it.id}">Edit GST &amp; HSN</button>
          </div>
        </td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">No products configured yet.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Company &amp; GST Settings</h2>
        <p>Business identity, products, customized GST / CGST rates, and tax application rules.</p>
      </div>
      <div class="actions">
        <button class="btn gold" id="add-product-btn">+ Add Product</button>
      </div>
    </div>

    <div class="stack" style="gap: var(--s4);">
      <!-- Products & GST Rates Management Card -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--s3);">
          <div>
            <h3>Products &amp; Customized GST Rates</h3>
            <p class="note" style="margin:2px 0 0;">Configure specific HSN codes, CGST, and SGST rates per product for automatic tax calculation on sales bills.</p>
          </div>
          <button class="btn gold sm" id="add-product-btn-2">+ Add Product</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Product Name</th>
                <th scope="col">HSN / SAC</th>
                <th scope="col" class="num">CGST Rate</th>
                <th scope="col" class="num">SGST Rate</th>
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
          <span>📋</span> Specification: Where GST Values Apply on Invoices &amp; Bills
        </h3>
        <p style="margin: 6px 0 16px; color: #555; font-size: 13.5px;">
          GST tax rules and how product-level CGST &amp; SGST rates are applied across documents:
        </p>

        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <!-- Sales Invoice Specification -->
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:16px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span class="tag gold" style="font-weight:700;">SALES BILLS</span>
              <strong>Tax Invoice Cum Bill of Supply</strong>
            </div>
            <ul style="font-size:12.5px; line-height:1.6; margin:0; padding-left:18px; color:#333;">
              <li><strong>Item Row Calculation:</strong>
                <br>• Taxable Value = <code>Quantity (kg) × Rate (₹/kg)</code>
                <br>• <strong>CGST Amount</strong> = <code>Taxable Value × CGST Rate %</code>
                <br>• <strong>SGST Amount</strong> = <code>Taxable Value × SGST Rate %</code>
                <br>• Row Total = <code>Taxable Value + CGST + SGST</code>
              </li>
              <li style="margin-top:6px;"><strong>Table Headers:</strong> Dynamically state the applied rates: <code>CGST (2.5%)</code> and <code>SGST (2.5%)</code> based on the product.</li>
              <li style="margin-top:6px;"><strong>Bottom Summary:</strong>
                <br>• <strong>Taxable Value:</strong> Sum of line amounts
                <br>• <strong>CGST (X%):</strong> Total central tax
                <br>• <strong>SGST (X%):</strong> Total state tax
                <br>• <strong>TCS / TDS:</strong> Added or deducted if applicable
                <br>• <strong>Grand Total:</strong> <code>Taxable + CGST + SGST + TCS − TDS</code>
              </li>
            </ul>
          </div>

          <!-- Purchase Invoice Specification -->
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:16px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span class="tag" style="font-weight:700; background:#edf2f7;">PURCHASE BILLS</span>
              <strong>Purchase Invoice (Unregistered)</strong>
            </div>
            <ul style="font-size:12.5px; line-height:1.6; margin:0; padding-left:18px; color:#333;">
              <li><strong>Farmer / Supplier Billing:</strong> Purchases from farmers or unregistered vendors do <em>not</em> include GST charged by the supplier.</li>
              <li style="margin-top:6px;"><strong>Reverse Charge Mechanism (RCM):</strong>
                <br>• Governed under <strong>Section 9(4) / 9(3)</strong> of the CGST Act.
                <br>• Raw agricultural produce (raw green coffee, raw dried pepper) from agriculturists is <strong>Nil / Exempt</strong> from reverse charge.
              </li>
              <li style="margin-top:6px;"><strong>Table Columns:</strong> Sl. No., Description, HSN/SAC, Quantity, Rate/kg, and Total (no GST Rate column).</li>
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
  const addBtn1 = document.getElementById("add-product-btn");
  const addBtn2 = document.getElementById("add-product-btn-2");
  if (addBtn1) addBtn1.addEventListener("click", () => showItemModal());
  if (addBtn2) addBtn2.addEventListener("click", () => showItemModal());

  // Bind edit buttons
  document.querySelectorAll("[data-edit-item]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = (b as HTMLElement).dataset.editItem!;
      const item = items.find((it) => it.id === id);
      if (item) showItemModal(item);
    });
  });
}
