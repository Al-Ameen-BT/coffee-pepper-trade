import { api } from "../api.js";
import { esc, money, today } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { LoanDTO, PartyDTO, ItemDTO, FundDTO } from "../../../shared/types.js";

export async function render(): Promise<void> {
  const [loans, parties, items, funds] = await Promise.all([
    api.get<LoanDTO[]>("/loans"),
    api.get<PartyDTO[]>("/parties"),
    api.get<ItemDTO[]>("/items"),
    api.get<FundDTO[]>("/funds"),
  ]);

  const labels: Record<string, string> = {
    LOAN_GIVEN: "Loan given (lent)",
    LOAN_TAKEN: "Loan taken (borrowed)",
    ADVANCE_GIVEN: "Advance given (before purchase)",
    ADVANCE_TAKEN: "Advance received (before sale)",
  };

  const rows = loans.length
    ? loans.map((l) => {
        const given = l.kind === "LOAN_GIVEN" || l.kind === "ADVANCE_GIVEN";
        return `
          <tr>
            <td>${l.date}</td>
            <td><span class="tag ${given ? "pay" : "receive"}">${labels[l.kind]}</span></td>
            <td>${esc(l.partyName)}</td>
            <td>${l.itemName ? esc(l.itemName) : "—"}</td>
            <td>${esc(l.fundName)}</td>
            <td class="num">${money(l.amount)}</td>
            <td>${given ? `<span class="tag pay">− ${money(l.amount)}</span>` : `<span class="tag receive">+ ${money(l.amount)}</span>`}</td>
            <td>${esc(l.notes || "")}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="8" class="empty">No loans or advances yet.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Loans & Advances</h2>
        <p>Record loans and advances given or taken.</p>
      </div>
    </div>
    <div class="grid two" style="margin-bottom:16px">
      <div class="card">
        <h3>New advance</h3>
        <form class="stack" id="advance-form">
          <div class="row">
            <label>Date <input required type="date" name="date" value="${today()}"></label>
            <label>Party <select required name="partyId">${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
          </div>
          <div class="row">
            <label>Amount ₹ <input required type="number" step="0.01" min="0.01" name="amount"></label>
            <label>Direction
              <select name="kind">
                <option value="ADVANCE_GIVEN">Advance given (before purchase)</option>
                <option value="ADVANCE_TAKEN">Advance received (before sale)</option>
              </select>
            </label>
          </div>
          <label>Item (optional) <select name="itemId"><option value="">Not specified</option>${items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></label>
          <div class="row">
            <label>Method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label>Account <select name="fundId" id="advance-account"></select></label>
          </div>
          <label>Notes <input name="notes"></label>
          <div class="actions"><button class="btn" type="submit">Save advance</button></div>
        </form>
      </div>
      <div class="card">
        <h3>New loan</h3>
        <form class="stack" id="loan-form">
          <div class="row">
            <label>Date <input required type="date" name="date" value="${today()}"></label>
            <label>Party <select required name="partyId">${parties.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
          </div>
          <div class="row">
            <label>Amount ₹ <input required type="number" step="0.01" min="0.01" name="amount"></label>
            <label>Direction
              <select name="kind">
                <option value="LOAN_GIVEN">Loan given (lent)</option>
                <option value="LOAN_TAKEN">Loan taken (borrowed)</option>
              </select>
            </label>
          </div>
          <div class="row">
            <label>Method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label>Account <select name="fundId" id="loan-account"></select></label>
          </div>
          <label>Notes <input name="notes"></label>
          <div class="actions"><button class="btn" type="submit">Save loan</button></div>
        </form>
      </div>
    </div>
    <div class="card">
      <h3>All loans & advances</h3>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Person</th><th>Against</th><th>Account</th><th class="num">Amount</th><th>Fund effect</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  // Fund account selectors
  function fillAccounts(methodId: string, accountId: string) {
    const methodSel = document.querySelector(`#${methodId} [name=method]`) as HTMLSelectElement;
    const accountSel = document.getElementById(accountId) as HTMLSelectElement;
    const fill = () => {
      const list = methodSel.value === "cash" ? funds.filter((f) => f.type === "CASH") : funds.filter((f) => f.type !== "CASH");
      accountSel.innerHTML = list.map((f) => `<option value="${f.id}">${esc(f.name)} · ${money(f.balance)}</option>`).join("");
    };
    methodSel.addEventListener("change", fill);
    fill();
  }
  fillAccounts("advance-form", "advance-account");
  fillAccounts("loan-form", "loan-account");

  // Form handlers
  async function handleForm(formId: string, kind: string) {
    const form = document.getElementById(formId) as HTMLFormElement;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api.post("/loans", {
          partyId: fd.get("partyId"),
          date: fd.get("date"),
          amount: Number(fd.get("amount")),
          kind: fd.get("kind"),
          fundId: fd.get("fundId"),
          itemId: fd.get("itemId") || undefined,
          method: fd.get("method"),
          notes: fd.get("notes") || undefined,
          purpose: kind,
        });
        toast("Saved", "success");
        render();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed", "error");
      }
    });
  }
  handleForm("advance-form", "trade_advance");
  handleForm("loan-form", "loan");
}
