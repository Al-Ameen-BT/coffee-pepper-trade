import { api } from "../api.js";
import { esc, money, kg, today } from "../format.js";
import { toast } from "../main.js";
import type { BillRecordDTO, CompanyInfoDTO } from "../../../shared/types.js";

/**
 * Shareable digital Bill of Supply — the primary way a bill leaves the
 * business. Rendered inside the app (for WhatsApp / email sharing and on-screen
 * reading); the same document prints to PDF via the print stylesheet, so one
 * source produces both the digital and the paper artefact.
 */
export async function render(): Promise<void> {
  const fixingId = window.location.pathname.split("/").filter(Boolean)[1];
  if (!fixingId) {
    document.getElementById("app")!.innerHTML = `<div class="card empty">No bill specified.</div>`;
    return;
  }

  const [bill, company] = await Promise.all([
    api.get<BillRecordDTO>(`/bills/${fixingId}/document`),
    api.get<CompanyInfoDTO>("/settings/company"),
  ]);

  const subtotal = Number(bill.amount);
  const tcs = Number(bill.tcsAmount || 0);
  const tds = Number(bill.tdsAmount || 0);
  const net = subtotal + tcs - tds;

  const isPurchase = bill.kind === "PURCHASE";
  document.title = `${isPurchase ? "Purchase Invoice" : (bill.billNo || "Bill")} · ${company.name}`;

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
      <button class="btn secondary" onclick="copyBillLink()">Copy link</button>
      <button class="btn secondary" onclick="shareBill()">Share</button>
      <a href="/print-bill?fixingId=${bill.id}" class="btn secondary">Print / PDF</a>
      <button class="btn gold" onclick="window.print()">Print bill</button>
    </div>

    <div class="print-doc">
      <div class="center" style="margin-bottom: var(--s2)">
        <p class="doc-title" style="margin: 0">${isPurchase ? "Purchase Invoice" : "SALE BILL"}</p>
        ${isPurchase ? `<p class="doc-sub" style="margin: 2px 0 0; font-size: 12px; font-weight: 600;">(purchase from unregistered)</p>` : ""}
      </div>

      <div class="print-head">
        <div>
          <h1>${esc(company.name)}</h1>
          <p><strong>${esc(company.tagline)}</strong></p>
          <p class="doc-sub">${esc(company.address)}</p>
        </div>
        <div class="right">
          <p><strong>GSTIN:</strong> ${esc(company.gstin)}</p>
          <p><strong>Phone:</strong> ${esc(company.phone)}</p>
          <p><strong>State:</strong> ${esc(company.state)}, <strong>Code:</strong> ${esc(company.stateCode)}</p>
        </div>
      </div>

      <div class="print-meta">
        <div>
          <p><strong>Bill To:</strong></p>
          <p><strong>${esc(bill.partyName)}</strong></p>
          <p><strong>Place of Supply:</strong> ${esc(company.state)} (${esc(company.stateCode)})</p>
        </div>
        <div class="right">
          <p><strong>Bill No:</strong> ${esc(bill.billNo || "—")}</p>
          <p><strong>Date:</strong> ${bill.date}</p>
          <p><strong>${isPurchase ? "Purchase Invoice" : "Sales Invoice"}</strong></p>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th scope="col">S.No</th>
            <th scope="col">Description of Goods</th>
            <th scope="col">HSN Code</th>
            <th scope="col" class="num">Qty (Kg)</th>
            <th scope="col" class="num">Rate (₹)</th>
            <th scope="col" class="num">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>${esc(bill.itemName)}</td>
            <td>${esc(bill.hsnCode)}</td>
            <td class="num">${kg(bill.kg)}</td>
            <td class="num">${money(bill.rate)}</td>
            <td class="num">${money(subtotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="print-totals">
        <table>
          <tr>
            <td><strong>Sub Total</strong></td>
            <td class="num">${money(subtotal)}</td>
          </tr>
          ${tcs > 0 ? `
          <tr>
            <td><strong>Add: TCS @ ${esc(bill.tcsRate)}%</strong></td>
            <td class="num">${money(tcs)}</td>
          </tr>` : ""}
          ${tds > 0 ? `
          <tr>
            <td><strong>Less: TDS @ ${esc(bill.tdsRate)}%</strong></td>
            <td class="num">${money(tds)}</td>
          </tr>` : ""}
          <tr class="total-row">
            <td>Total Amount</td>
            <td class="num">${money(net)}</td>
          </tr>
        </table>
      </div>

      <p class="doc-sub" style="margin-top:var(--s4)">
        ${bill.paid
          ? `Paid${bill.paymentBillNo ? ` — against ${esc(bill.paymentBillNo)} on ${bill.paymentDate}` : ""}`
          : "Payment pending"}
        · Issued ${today()}
      </p>

      <div class="print-foot">
        <div class="sign-box">
          <p>Receiver's Signature</p>
        </div>
        <div class="sign-box">
          <p>For <strong>${esc(company.name)}</strong></p>
          <div class="sign-box-line">Authorised Signatory</div>
        </div>
      </div>
    </div>
  `;

  // Sharing: copy link, or hand off to WhatsApp / other apps on a phone
  (window as any).copyBillLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Bill link copied", "success");
    } catch {
      toast("Could not copy — select the address bar instead", "error");
    }
  };

  (window as any).shareBill = async () => {
    const text = `Bill No ${bill.billNo} — ${bill.partyName}, ${kg(bill.kg)} ${bill.itemName} — ${money(net)}. ${window.location.href}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Bill ${bill.billNo}`, text, url: window.location.href });
        return;
      } catch {
        return;
      }
    }
    // WhatsApp fallback — the channel Indian traders actually use
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
}