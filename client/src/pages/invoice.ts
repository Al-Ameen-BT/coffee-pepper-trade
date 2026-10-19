import { api } from "../api.js";
import { esc, money, kg } from "../format.js";
import { toast } from "../main.js";
import type { InvoiceDTO } from "../../../shared/types.js";

/**
 * Multi-line Bill of Supply — one invoice per payment, intra-state GST
 * (CGST + SGST). The digital document is the record; Print/PDF renders the
 * same markup, so screen and paper are one artefact.
 */
export async function render(): Promise<void> {
  const invoiceId = window.location.pathname.split("/").filter(Boolean)[1];
  if (!invoiceId) {
    document.getElementById("app")!.innerHTML = `<div class="card empty">No invoice specified.</div>`;
    return;
  }

  const inv = await api.get<InvoiceDTO>(`/invoices/${invoiceId}`);
  const c = inv.company;

  const isPurchase = inv.kind === "PURCHASE";
  document.title = `${isPurchase ? "Purchase Invoice" : "Invoice"} ${inv.billNo} · ${c.name}`;

  const cgstPct = inv.lines.length ? Number(inv.lines[0].cgstRate) : 0;

  (window as any).goBack = (fallback = "/bill-register") => {
    const hasLocalReferrer = document.referrer && new URL(document.referrer, window.location.origin).origin === window.location.origin;

    if (hasLocalReferrer && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (window.opener) {
      try { window.close(); return; } catch {}
    }

    try { window.close(); } catch {}
    setTimeout(() => {
      window.location.href = fallback;
    }, 100);
  };

  document.getElementById("app")!.innerHTML = `
    <div class="print-bar no-print">
      <button class="btn secondary" onclick="goBack()">Back</button>
      <button class="btn secondary" onclick="copyInvoiceLink()">Copy link</button>
      <button class="btn secondary" onclick="shareInvoice()">Share</button>
      <button class="btn gold" onclick="window.print()">Print / Save PDF</button>
    </div>

    <div class="print-doc">
      <div class="center" style="margin-bottom: var(--s2)">
        <p class="doc-title" style="margin: 0">${isPurchase ? "Purchase Invoice" : "TAX INVOICE CUM BILL OF SUPPLY"}</p>
        ${isPurchase ? `<p class="doc-sub" style="margin: 2px 0 0; font-size: 12px; font-weight: 600;">(purchase from unregistered)</p>` : ""}
      </div>

      <div class="print-head">
        <div>
          <h1>${esc(c.name)}</h1>
          <p><strong>${esc(c.tagline)}</strong></p>
          <p class="doc-sub">${esc(c.address)}</p>
        </div>
        <div class="right">
          <p><strong>GSTIN:</strong> ${esc(c.gstin)}</p>
          <p><strong>Phone:</strong> ${esc(c.phone)}</p>
          <p><strong>State:</strong> ${esc(c.state)}, <strong>Code:</strong> ${esc(c.stateCode)}</p>
        </div>
      </div>

      <div class="print-meta">
        <div>
          <p><strong>Bill To:</strong></p>
          <p><strong>${esc(inv.partyName)}</strong></p>
          <p><strong>Place of Supply:</strong> ${esc(inv.placeOfSupply || `${c.state} (${c.stateCode})`)}</p>
        </div>
        <div class="right">
          <p><strong>Invoice No:</strong> ${esc(inv.billNo)}</p>
          <p><strong>Date:</strong> ${inv.date}</p>
          <p><strong>${isPurchase ? "Purchase Invoice" : "Sales Invoice"}</strong></p>
          ${inv.paymentBillNo ? `<p><strong>Payment:</strong> ${esc(inv.paymentBillNo)}</p>` : ""}
        </div>
      </div>

      <table class="print-table">
        <colgroup>
          <col class="c-sno" /><col class="c-desc" /><col class="c-hsn" /><col class="c-lot" />
          <col class="c-num" /><col class="c-num" /><col class="c-num" /><col class="c-num" />
          <col class="c-num" /><col class="c-num" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">S.No</th>
            <th scope="col">Description of Goods</th>
            <th scope="col">HSN</th>
            <th scope="col">Lot</th>
            <th scope="col" class="num">Qty (Kg)</th>
            <th scope="col" class="num">Rate</th>
            <th scope="col" class="num">Taxable</th>
            <th scope="col" class="num">CGST</th>
            <th scope="col" class="num">SGST</th>
            <th scope="col" class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${inv.lines.map((l, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(l.description)}</td>
              <td>${esc(l.hsnCode || "—")}</td>
              <td>${esc(l.lotNo || "—")}</td>
              <td class="num">${kg(l.kg)}</td>
              <td class="num">${money(l.rate)}</td>
              <td class="num">${money(l.amount)}</td>
              <td class="num">${money(l.cgstAmount)}</td>
              <td class="num">${money(l.sgstAmount)}</td>
              <td class="num"><strong>${money(Number(l.amount) + Number(l.cgstAmount) + Number(l.sgstAmount))}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="print-totals">
        <table>
          <tr><td>Taxable value</td><td class="num">${money(inv.taxableValue)}</td></tr>
          <tr><td>CGST @ ${cgstPct}%</td><td class="num">${money(inv.cgstAmount)}</td></tr>
          <tr><td>SGST @ ${cgstPct}%</td><td class="num">${money(inv.sgstAmount)}</td></tr>
          ${Number(inv.tcsAmount) > 0 ? `<tr><td>Add: TCS</td><td class="num">${money(inv.tcsAmount)}</td></tr>` : ""}
          ${Number(inv.tdsAmount) > 0 ? `<tr><td>Less: TDS</td><td class="num">− ${money(inv.tdsAmount)}</td></tr>` : ""}
          ${Number(inv.roundOff) !== 0 ? `<tr><td>Round off</td><td class="num">${money(inv.roundOff)}</td></tr>` : ""}
          <tr class="total-row"><td>Invoice total</td><td class="num">${money(inv.total)}</td></tr>
        </table>
      </div>

      <p class="doc-sub" style="margin-top:var(--s4)">
        <strong>Amount in words:</strong> ${esc(inv.amountInWords)}
        ${inv.notes ? `<br>${esc(inv.notes)}` : ""}
      </p>

      <div class="print-foot">
        <div class="sign-box"><p>Receiver's Signature</p></div>
        <div class="sign-box">
          <p>For <strong>${esc(c.name)}</strong></p>
          <div class="sign-box-line">Authorised Signatory</div>
        </div>
      </div>
    </div>
  `;

  (window as any).copyInvoiceLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Invoice link copied", "success");
    } catch {
      toast("Could not copy — select the address bar instead", "error");
    }
  };

  (window as any).shareInvoice = async () => {
    const text = `${inv.kind === "SALE" ? "Invoice" : "Purchase bill"} ${inv.billNo} — ${inv.partyName}, total ${money(inv.total)}. ${window.location.href}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: inv.billNo, text, url: window.location.href });
        return;
      } catch {
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
}