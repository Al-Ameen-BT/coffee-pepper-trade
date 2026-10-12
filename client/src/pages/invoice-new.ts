import { api } from "../api.js";
import { esc, money, kg, today } from "../format.js";
import { renderShell, toast, routerNavigate } from "../main.js";
import type { PaymentDTO, InvoiceDTO } from "../../../shared/types.js";

interface CandidateDTO {
  fixingId: string;
  billNo: string | null;
  date: string;
  description: string;
  hsnCode: string;
  kg: number;
  rate: number;
  amount: number;
}

const params = new URLSearchParams(window.location.search);
const paymentId = params.get("paymentId");

export async function render(): Promise<void> {
  if (!paymentId) {
    renderShell(`<div class="card empty">No payment selected.</div>`);
    return;
  }

  const [payment, candidates] = await Promise.all([
    api.get<PaymentDTO>(`/payments/${paymentId}`),
    api.get<CandidateDTO[]>(`/invoices/payment/${paymentId}/available`),
  ]);

  const preChecked = candidates.filter((c) => c.date === payment.date).slice(0, 5);

  renderShell(`
    <div class="topbar">
      <div>
        <h2>New invoice</h2>
        <p>One invoice per payment. Select the priced trades this payment settles.</p>
      </div>
    </div>
    <div class="grid two">
      <div class="card">
        <h3>Select priced trades</h3>
        ${candidates.length === 0 ? `
          <p class="empty">No uninvoiced priced trades for ${esc(payment.partyName)}.</p>
        ` : `
        <form class="stack" id="invoice-form">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th scope="col"><span class="sr-only">Include</span></th>
                <th scope="col">Trade bill</th>
                <th scope="col">Date</th>
                <th scope="col">Item</th>
                <th scope="col" class="num">Qty</th>
                <th scope="col" class="num">Rate</th>
                <th scope="col" class="num">Amount</th>
              </tr></thead>
              <tbody>
                ${candidates.map((c, i) => `
                  <tr>
                    <td class="cb-cell"><input type="checkbox" name="fixingId" value="${c.fixingId}" ${preChecked.some((p) => p.fixingId === c.fixingId) ? "checked" : ""} aria-label="Include ${esc(c.billNo || "trade")}"></td>
                    <td>${esc(c.billNo || "—")}</td>
                    <td class="nowrap">${c.date}</td>
                    <td>${esc(c.description)} ${c.hsnCode ? `<span class="muted">${esc(c.hsnCode)}</span>` : ""}</td>
                    <td class="num">${kg(c.kg)}</td>
                    <td class="num">${money(c.rate)}</td>
                    <td class="num">${money(c.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <label>Notes <input name="notes" placeholder="Optional note printed on the invoice"></label>
          <div class="actions">
            <button class="btn gold" type="submit" id="invoice-save">Create invoice</button>
          </div>
        </form>
        `}
      </div>
      <div class="card">
        <h3>Payment being invoiced</h3>
        <p class="metric" style="font-size:22px">${esc(payment.partyName)}</p>
        <p class="note">
          ${payment.tradeType === "SALE" ? "Sale (Receive)" : "Purchase (Pay)"} · ${money(payment.amount)} net cash<br>
          Payment bill ${esc(payment.billNo)} · ${payment.date}<br>
          ${Number(payment.advanceDeducted) > 0 ? `Advance deducted ${money(payment.advanceDeducted!)}<br>` : ""}
          ${Number(payment.grossAmount) > Number(payment.amount) ? `Gross ${money(payment.grossAmount!)}<br>` : ""}
        </p>
        <p class="note">GST is split CGST + SGST (Kerala, state code 32). TCS/TDS carry through from the payment.</p>
      </div>
    </div>
  `);

  const form = document.getElementById("invoice-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("invoice-save") as HTMLButtonElement;
    const fd = new FormData(form as HTMLFormElement);
    const fixingIds = fd.getAll("fixingId") as string[];

    if (fixingIds.length === 0) {
      toast("Select at least one priced trade", "error");
      return;
    }

    saveBtn.disabled = true;
    try {
      const invoice = await api.post<InvoiceDTO>("/invoices", {
        paymentId,
        partyId: payment.partyId,
        date: payment.date,
        kind: payment.tradeType,
        fixingIds,
        tcsAmount: Number(payment.advanceDeducted || 0),
        notes: fd.get("notes") || undefined,
      });
      toast(`Invoice ${invoice.billNo} created`, "success");
      window.open(`/invoice/${invoice.id}`, "_blank");
      routerNavigate("/bill-register");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create invoice", "error");
      saveBtn.disabled = false;
    }
  });
}