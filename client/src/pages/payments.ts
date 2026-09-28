import { api } from "../api.js";
import { esc, money, kg, today } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { PaymentDTO, PartyDTO, ItemDTO, FundDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const [payments, parties, items, funds] = await Promise.all([
    api.get<PaymentDTO[]>("/payments"),
    api.get<PartyDTO[]>("/parties"),
    api.get<ItemDTO[]>("/items"),
    api.get<FundDTO[]>("/funds"),
  ]);

  const cashFunds = funds.filter((f) => f.type === "CASH");
  const bankFunds = funds.filter((f) => f.type !== "CASH");

  const rows = payments.length
    ? payments.map((p) => `
      <tr>
        <td>${p.date}</td>
        <td>${esc(p.billNo)}</td>
        <td>${p.direction === "PAY" ? '<span class="tag pay">Purchase (Pay)</span>' : '<span class="tag receive">Sale (Receive)</span>'}</td>
        <td>${esc(p.partyName)}</td>
        <td>${p.fundName}</td>
        <td class="num">${p.priceKg ? kg(p.priceKg) : "—"}</td>
        <td class="num">${money(p.amount)}</td>
        <td>${p.direction === "PAY" ? `<span class="tag pay">− ${money(p.amount)}</span>` : `<span class="tag receive">+ ${money(p.amount)}</span>`}</td>
        <td>${esc(p.notes || "")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="empty">No payments yet.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Payments</h2>
        <p>Purchase and sale are realized only when you save a payment with a bill number.</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Record payment</h3>
      <form class="stack" id="payment-form">
        <div class="row">
          <label>Date <input required type="date" name="date" value="${today()}"></label>
          <label>Bill number <input required name="billNo" placeholder="Mandatory bill / voucher no."></label>
        </div>
        <label>Amount ₹ <input required type="number" step="0.01" min="0.01" name="amount" placeholder="Auto-fills from kg × rate"></label>
        <label>Transaction type
          <select required name="tradeType">
            <option value="PURCHASE">Purchase (Pay) — money given to supplier</option>
            <option value="SALE">Sale (Receive) — money received from buyer</option>
          </select>
        </label>
        <label>Party <select required name="partyId">${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
        <label>Item to price <select name="itemId"><option value="">Any pending item</option>${items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></label>
        <div class="row">
          <label>Quantity to price (kg) <input type="number" step="0.001" min="0" name="priceKg" placeholder="e.g. 200"></label>
          <label>Rate ₹/kg <input type="number" step="0.01" min="0" name="rate" placeholder="Required if quantity is entered"></label>
        </div>
        <div class="row">
          <label>Payment method
            <select required name="method">
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </label>
          <label>Account <select required name="fundId" id="pay-account"></select></label>
        </div>
        <label>Notes <input name="notes" placeholder="Bill no., cheque no., UPI, etc."></label>
        <div class="actions"><button class="btn gold" type="submit">Save payment</button></div>
      </form>
    </div>
    <div class="card">
      <h3>Payment history</h3>
      <table>
        <thead><tr><th>Date</th><th>Bill No.</th><th>Type</th><th>Party</th><th>Account</th><th class="num">Qty priced</th><th class="num">Amount</th><th>Effect</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  // Fund account selector
  const methodSel = document.querySelector('[name=method]') as HTMLSelectElement;
  const accountSel = document.getElementById("pay-account") as HTMLSelectElement;

  function fillAccounts() {
    const list = methodSel.value === "cash" ? cashFunds : bankFunds;
    accountSel.innerHTML = list.length
      ? list.map((f) => `<option value="${f.id}">${esc(f.name)} · ${money(f.balance)}</option>`).join("")
      : `<option value="">No ${methodSel.value} account</option>`;
  }
  methodSel.addEventListener("change", fillAccounts);
  fillAccounts();

  // Auto-fill amount from kg × rate
  const priceKgEl = document.querySelector('[name=priceKg]') as HTMLInputElement;
  const rateEl = document.querySelector('[name=rate]') as HTMLInputElement;
  const amountEl = document.querySelector('[name=amount]') as HTMLInputElement;

  function syncAmount() {
    const qty = Number(priceKgEl.value) || 0;
    const rate = Number(rateEl.value) || 0;
    if (qty > 0 && rate > 0 && document.activeElement !== amountEl) {
      amountEl.value = (qty * rate).toFixed(2);
    }
  }
  priceKgEl.addEventListener("input", syncAmount);
  rateEl.addEventListener("input", syncAmount);

  document.getElementById("payment-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.post("/payments", {
        partyId: fd.get("partyId"),
        date: fd.get("date"),
        amount: Number(fd.get("amount")),
        billNo: fd.get("billNo"),
        tradeType: fd.get("tradeType"),
        fundId: fd.get("fundId"),
        itemId: fd.get("itemId") || undefined,
        priceKg: fd.get("priceKg") ? Number(fd.get("priceKg")) : undefined,
        rate: fd.get("rate") ? Number(fd.get("rate")) : undefined,
        method: fd.get("method"),
        notes: fd.get("notes") || undefined,
      });
      toast("Payment recorded", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  });
}
