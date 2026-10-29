import { api } from "../api.js";
import { esc } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { ItemDTO } from "../../../shared/types.js";

/**
 * GST Customisation Page:
 * Displays only the products listed in the application DB.
 * When the user selects or edits GST / CGST values, they are updated directly at the DB level.
 */
export async function render(): Promise<void> {
  // Fetch strictly the products stored in the application database
  const items = await api.get<ItemDTO[]>("/items");

  const productCards = items.length
    ? items
        .map((it) => {
          const currentCgst = it.cgstRate ?? 2.5;
          const currentSgst = it.sgstRate ?? currentCgst;
          const currentTotal = it.gstRate ?? currentCgst * 2;

          // Preset matches
          const isStandard5 = Math.abs(currentTotal - 5) < 0.01;
          const isStandard12 = Math.abs(currentTotal - 12) < 0.01;
          const isStandard18 = Math.abs(currentTotal - 18) < 0.01;
          const isStandard28 = Math.abs(currentTotal - 28) < 0.01;
          const isExempt0 = Math.abs(currentTotal) < 0.01;
          const isCustom = !isStandard5 && !isStandard12 && !isStandard18 && !isStandard28 && !isExempt0;

          return `
      <div class="card" style="border: 1px solid #e2e8f0; border-top: 3px solid var(--gold); padding: 18px;" id="item-card-${it.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:17px; display:flex; align-items:center; gap:8px;">
              <span>📦</span> ${esc(it.name)}
              <span class="tag gold" id="badge-total-${it.id}">${currentTotal.toFixed(2)}% GST</span>
            </h3>
            <p class="note" style="margin:3px 0 0;">Database ID: <code>${esc(it.id)}</code> · Slug: <code>${esc(it.slug)}</code></p>
          </div>
          <div style="text-align:right;">
            <span class="tag" style="background:#edf2f7; color:#4a5568; font-weight:600;" id="status-tag-${it.id}">DB Synced</span>
          </div>
        </div>

        <div class="row" style="gap:16px; align-items:flex-end;">
          <div style="flex: 1; min-width: 140px;">
            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:4px;">HSN / SAC Code (DB):</label>
            <input type="text" id="hsn-${it.id}" value="${esc(it.hsnCode || "")}" placeholder="e.g. 0901" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600;">
          </div>

          <div style="flex: 2; min-width: 260px;">
            <label style="font-weight:600; font-size:13px; display:block; margin-bottom:4px;">Select GST Rate for this product:</label>
            <select id="select-gst-${it.id}" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; background:#fff;">
              <option value="5" ${isStandard5 ? "selected" : ""}>5.00% GST — (CGST 2.5% + SGST 2.5%) [Standard Hill Produce]</option>
              <option value="12" ${isStandard12 ? "selected" : ""}>12.00% GST — (CGST 6.0% + SGST 6.0%) [Processed Produce]</option>
              <option value="18" ${isStandard18 ? "selected" : ""}>18.00% GST — (CGST 9.0% + SGST 9.0%) [Commercial Goods]</option>
              <option value="28" ${isStandard28 ? "selected" : ""}>28.00% GST — (CGST 14.0% + SGST 14.0%) [Special Bracket]</option>
              <option value="0" ${isExempt0 ? "selected" : ""}>0.00% GST — (CGST 0% + SGST 0%) [Tax Exempt / Nil]</option>
              <option value="custom" ${isCustom ? "selected" : ""}>Custom GST Rate...</option>
            </select>
          </div>
        </div>

        <!-- Custom Rate inputs (shown if Custom selected) -->
        <div id="custom-wrap-${it.id}" style="display: ${isCustom ? "flex" : "none"}; gap:12px; margin-top:12px; background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <div style="flex:1;">
            <label style="font-size:12px; font-weight:600;">Custom Total GST %</label>
            <input type="number" step="0.01" min="0" max="100" id="custom-gst-${it.id}" value="${currentTotal.toFixed(2)}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
          </div>
          <div style="flex:1;">
            <label style="font-size:12px; font-weight:600;">CGST % (DB Column)</label>
            <input type="number" step="0.01" min="0" max="100" id="custom-cgst-${it.id}" value="${currentCgst.toFixed(2)}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px;">
          </div>
          <div style="flex:1;">
            <label style="font-size:12px; font-weight:600;">SGST % (Equal to CGST)</label>
            <input type="number" step="0.01" min="0" max="100" id="custom-sgst-${it.id}" value="${currentSgst.toFixed(2)}" readonly style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; background:#eee;">
          </div>
        </div>

        <!-- Live DB values preview -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px dashed #e2e8f0; font-size:12.5px; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="muted">Applied at DB level:</span>
            <strong>CGST: <span id="lbl-cgst-${it.id}">${currentCgst.toFixed(2)}%</span></strong> |
            <strong>SGST: <span id="lbl-sgst-${it.id}">${currentSgst.toFixed(2)}%</span></strong> |
            <strong>Total: <span id="lbl-total-${it.id}">${currentTotal.toFixed(2)}%</span></strong>
          </div>
          <button class="btn gold sm" data-save-btn="${it.id}">Save to Database</button>
        </div>
      </div>
          `;
        })
        .join("")
    : `
      <div class="card empty" style="text-align:center; padding:30px;">
        <p>No products found in the application database.</p>
      </div>
    `;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>GST Customisation</h2>
        <p>Directly update and manage GST &amp; CGST tax rates in the application database for each registered product.</p>
      </div>
      <div class="actions">
        <a href="/settings" class="btn secondary">Company Settings</a>
      </div>
    </div>

    <div class="stack" style="gap: var(--s4);">
      <!-- Information Banner: Where selected GST values apply -->
      <div class="card" style="border-left: 4px solid var(--gold); background: #fdfcf9; padding: 18px;">
        <h3 style="margin:0 0 6px; font-size:15px; display:flex; align-items:center; gap:8px;">
          <span>ℹ️</span> Where Selected GST Values Apply on Invoices &amp; Bills
        </h3>
        <p style="margin:0 0 10px; font-size:13px; color:#4a5568;">
          All changes below are written directly to the <code>Item</code> table in the database and immediately apply to:
        </p>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px; font-size:12.5px;">
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px;">
            <strong style="color:#b45309;">1. Sales Bills (Tax Invoice Cum Bill of Supply):</strong>
            <div style="margin-top:4px; color:#4b5563;">
              • Line item calculates: <code>Taxable Value × Selected CGST%</code> &amp; <code>Taxable Value × Selected SGST%</code>.<br>
              • Table header shows the updated percentage, e.g. <code>CGST (${items[0]?.cgstRate ?? 2.5}%)</code>.<br>
              • Grand Total &amp; Amount in Words include the exact computed tax.
            </div>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px;">
            <strong style="color:#2563eb;">2. Purchase Bills (From Unregistered Suppliers):</strong>
            <div style="margin-top:4px; color:#4b5563;">
              • Supplier does not charge GST.<br>
              • Handled under Reverse Charge Mechanism (RCM - Section 9(4)) as <strong>Nil / Exempt</strong> for agricultural produce.
            </div>
          </div>
        </div>
      </div>

      <!-- Products from application DB -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
        <h3 style="margin:0; font-size:16px;">Products Listed in Application DB (${items.length})</h3>
        <span class="muted" style="font-size:12px;">Changes persist in application SQLite / MySQL database</span>
      </div>

      <div class="stack" style="gap: 14px;">
        ${productCards}
      </div>
    </div>
  `);

  // Wire interactive selectors for each DB product
  items.forEach((it) => {
    const selectGst = document.getElementById(`select-gst-${it.id}`) as HTMLSelectElement | null;
    const customWrap = document.getElementById(`custom-wrap-${it.id}`) as HTMLElement | null;
    const customGst = document.getElementById(`custom-gst-${it.id}`) as HTMLInputElement | null;
    const customCgst = document.getElementById(`custom-cgst-${it.id}`) as HTMLInputElement | null;
    const customSgst = document.getElementById(`custom-sgst-${it.id}`) as HTMLInputElement | null;

    const lblCgst = document.getElementById(`lbl-cgst-${it.id}`) as HTMLElement | null;
    const lblSgst = document.getElementById(`lbl-sgst-${it.id}`) as HTMLElement | null;
    const lblTotal = document.getElementById(`lbl-total-${it.id}`) as HTMLElement | null;
    const badgeTotal = document.getElementById(`badge-total-${it.id}`) as HTMLElement | null;
    const statusTag = document.getElementById(`status-tag-${it.id}`) as HTMLElement | null;

    function getSelectedCgst(): number {
      if (!selectGst) return 2.5;
      if (selectGst.value === "custom") {
        return Number(customCgst?.value) || 0;
      }
      const total = Number(selectGst.value) || 0;
      return Math.round((total / 2) * 100) / 100;
    }

    function updatePreviewLabels(cgst: number) {
      const total = Math.round(cgst * 2 * 100) / 100;
      if (lblCgst) lblCgst.textContent = `${cgst.toFixed(2)}%`;
      if (lblSgst) lblSgst.textContent = `${cgst.toFixed(2)}%`;
      if (lblTotal) lblTotal.textContent = `${total.toFixed(2)}%`;
      if (badgeTotal) badgeTotal.textContent = `${total.toFixed(2)}% GST`;
      if (statusTag) {
        statusTag.textContent = "Unsaved Changes";
        statusTag.style.background = "#fef3c7";
        statusTag.style.color = "#92400e";
      }
    }

    if (selectGst) {
      selectGst.addEventListener("change", () => {
        if (selectGst.value === "custom") {
          if (customWrap) customWrap.style.display = "flex";
          const cgst = getSelectedCgst();
          updatePreviewLabels(cgst);
        } else {
          if (customWrap) customWrap.style.display = "none";
          const cgst = getSelectedCgst();
          updatePreviewLabels(cgst);
        }
      });
    }

    if (customGst && customCgst && customSgst) {
      customGst.addEventListener("input", () => {
        const g = Number(customGst.value) || 0;
        const half = Math.round((g / 2) * 100) / 100;
        customCgst.value = String(half);
        customSgst.value = String(half);
        updatePreviewLabels(half);
      });

      customCgst.addEventListener("input", () => {
        const c = Number(customCgst.value) || 0;
        customSgst.value = String(c);
        customGst.value = String(Math.round(c * 2 * 100) / 100);
        updatePreviewLabels(c);
      });
    }

    // Save to Database button
    const saveBtn = document.querySelector(`[data-save-btn="${it.id}"]`) as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving to DB...";

        const hsnInput = document.getElementById(`hsn-${it.id}`) as HTMLInputElement | null;
        const hsnCode = hsnInput ? hsnInput.value.trim() : it.hsnCode;
        const cgstRate = getSelectedCgst();

        try {
          await api.put(`/items/${it.id}`, {
            name: it.name,
            hsnCode,
            cgstRate,
          });

          if (statusTag) {
            statusTag.textContent = "✓ Saved in DB";
            statusTag.style.background = "#dcfce7";
            statusTag.style.color = "#166534";
          }

          toast(`Updated ${it.name} in DB: GST ${(cgstRate * 2).toFixed(2)}% (CGST ${cgstRate.toFixed(2)}%)`, "success");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Failed to update in DB", "error");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save to Database";
        }
      });
    }
  });
}
