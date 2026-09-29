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
        <label>Gross Amount ₹ <input required type="number" step="0.01" min="0.01" name="grossAmount" id="pay-gross" placeholder="Auto-fills from kg × rate"></label>
        <div id="advance-box" style="display:none;background:var(--card-bg, #fff);border:1px dashed var(--gold);padding:12px;border-radius:6px;margin:6px 0">
          <h4 style="margin:0 0 6px;color:var(--coffee)">Deduct from Active Harvest Advances:</h4>
          <div id="advance-list" class="stack" style="gap:6px"></div>
          <p style="margin:8px 0 0;font-size:13px;color:var(--muted)">Advance deduction: <strong id="adv-deduct-total">₹0</strong></p>
        </div>
        <label>Net Cash to Pay / Receive ₹ <input required type="number" step="0.01" min="0.01" name="amount" id="pay-net" placeholder="Net cash after advance deduction"></label>
        <label>Transaction type
          <select required name="tradeType" id="pay-trade-type">
            <option value="PURCHASE">Purchase (Pay) — money given to supplier</option>
            <option value="SALE">Sale (Receive) — money received from buyer</option>
          </select>
        </label>
        <label>Party <select required name="partyId" id="pay-party">${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
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
        <thead><tr><th>Date</th><th>Bill No.</th><th>Type</th><th>Party</th><th>Account</th><th class="num">Qty priced</th><th class="num">Gross</th><th class="num">Adv Deducted</th><th class="num">Net Cash</th><th>Notes</th></tr></thead>
        <tbody>
          ${payments.length ? payments.map((p) => `
            <tr>
              <td>${p.date}</td>
              <td>${esc(p.billNo)}</td>
              <td>${p.direction === "PAY" ? '<span class="tag pay">Purchase (Pay)</span>' : '<span class="tag receive">Sale (Receive)</span>'}</td>
              <td>${esc(p.partyName)}</td>
              <td>${p.fundName}</td>
              <td class="num">${p.priceKg ? kg(p.priceKg) : "—"}</td>
              <td class="num">${money(p.grossAmount ?? p.amount)}</td>
              <td class="num">${Number(p.advanceDeducted) > 0 ? `<span class="tag gold font-mono">− ${money(p.advanceDeducted!)}</span>` : "—"}</td>
              <td class="num font-bold">${money(p.amount)}</td>
              <td>${esc(p.notes || "")}</td>
            </tr>
          `).join("") : '<tr><td colspan="10" class="empty">No payments yet.</td></tr>'}
        </tbody>
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

  // Elements for dynamic calculation
  const priceKgEl = document.querySelector('[name=priceKg]') as HTMLInputElement;
  const rateEl = document.querySelector('[name=rate]') as HTMLInputElement;
  const grossEl = document.getElementById("pay-gross") as HTMLInputElement;
  const netEl = document.getElementById("pay-net") as HTMLInputElement;
  const partySel = document.getElementById("pay-party") as HTMLSelectElement;
  const advanceBox = document.getElementById("advance-box")!;
  const advanceList = document.getElementById("advance-list")!;
  const advDeductTotalEl = document.getElementById("adv-deduct-total")!;

  let currentAdvances: LoanDTO[] = [];

  async function loadPartyAdvances() {
    const partyId = partySel.value;
    try {
      const loans = await api.get<LoanDTO[]>(`/loans?partyId=${partyId}`);
      currentAdvances = loans.filter((l) => Number(l.balanceAmount) > 0 && (l.kind === "ADVANCE_GIVEN" || l.kind === "LOAN_GIVEN"));
      if (currentAdvances.length > 0) {
        advanceBox.style.display = "block";
        advanceList.innerHTML = currentAdvances.map((adv) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:13px">
            <input type="checkbox" data-adv-id="${adv.id}" data-adv-bal="${adv.balanceAmount}" class="adv-check">
            <span>${adv.date} · <strong>${money(adv.balanceAmount)}</strong> remaining (${adv.kind.replaceAll("_", " ")}${adv.itemName ? " · " + esc(adv.itemName) : ""})</span>
          </label>
        `).join("");

        document.querySelectorAll(".adv-check").forEach((cb) => {
          cb.addEventListener("change", syncNetFromAdvances);
        });
      } else {
        advanceBox.style.display = "none";
        advanceList.innerHTML = "";
        advDeductTotalEl.textContent = "₹0";
      }
      syncNetFromAdvances();
    } catch {
      advanceBox.style.display = "none";
    }
  }

  function getSelectedAdvanceDeductions(): { loanId: string; amount: number }[] {
    const deductions: { loanId: string; amount: number }[] = [];
    const gross = Number(grossEl.value) || 0;
    let availableDeductionRoom = gross;

    document.querySelectorAll(".adv-check:checked").forEach((el) => {
      const cb = el as HTMLInputElement;
      const loanId = cb.dataset.advId!;
      const bal = Number(cb.dataset.advBal) || 0;
      const take = Math.min(bal, Math.max(0, availableDeductionRoom));
      if (take > 0) {
        deductions.push({ loanId, amount: take });
        availableDeductionRoom -= take;
      }
    });
    return deductions;
  }

  function syncNetFromAdvances() {
    const gross = Number(grossEl.value) || 0;
    const deductions = getSelectedAdvanceDeductions();
    const totalDeducted = deductions.reduce((s, d) => s + d.amount, 0);
    advDeductTotalEl.textContent = money(totalDeducted);
    const net = Math.max(0, gross - totalDeducted);
    netEl.value = net > 0 ? net.toFixed(2) : (gross > 0 ? "0.00" : "");
  }

  function syncGrossAmount() {
    const qty = Number(priceKgEl.value) || 0;
    const rate = Number(rateEl.value) || 0;
    if (qty > 0 && rate > 0) {
      grossEl.value = (qty * rate).toFixed(2);
    }
    syncNetFromAdvances();
  }

  priceKgEl.addEventListener("input", syncGrossAmount);
  rateEl.addEventListener("input", syncGrossAmount);
  grossEl.addEventListener("input", syncNetFromAdvances);
  partySel.addEventListener("change", loadPartyAdvances);
  loadPartyAdvances();

  document.getElementById("payment-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const deductions = getSelectedAdvanceDeductions();
    const totalDeducted = deductions.reduce((s, d) => s + d.amount, 0);
    const grossVal = Number(fd.get("grossAmount")) || Number(fd.get("amount"));
    const netVal = Number(fd.get("amount"));

    try {
      await api.post("/payments", {
        partyId: fd.get("partyId"),
        date: fd.get("date"),
        amount: netVal,
        grossAmount: grossVal,
        advanceDeducted: totalDeducted,
        advanceDeductions: deductions.length > 0 ? deductions : undefined,
        billNo: fd.get("billNo"),
        tradeType: fd.get("tradeType"),
        fundId: fd.get("fundId"),
        itemId: fd.get("itemId") || undefined,
        priceKg: fd.get("priceKg") ? Number(fd.get("priceKg")) : undefined,
        rate: fd.get("rate") ? Number(fd.get("rate")) : undefined,
        method: fd.get("method"),
        notes: fd.get("notes") || undefined,
      });
      toast("Payment recorded with advance adjustment", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  });
}
