import { api } from "../api.js";
import { esc, money, today, fundType } from "../format.js";
import { renderShell, toast } from "../main.js";
import type { FundDTO } from "../../../shared/types.js";

interface OtherTxnDTO {
  id: string;
  type: "EXPENSE" | "INCOME";
  category: string;
  amount: string;
  fundId: string;
  fundName: string;
  billNo: string | null;
  date: string;
  description: string | null;
}

export async function render(): Promise<void> {
  let funds: FundDTO[] = [];
  let txns: OtherTxnDTO[] = [];
  try {
    [funds, txns] = await Promise.all([
      api.get<FundDTO[]>("/funds"),
      api.get<OtherTxnDTO[]>("/other-txn"),
    ]);
  } catch (err) {
    renderShell(`
      <div class="topbar"><div><h2>Other expense / income</h2></div></div>
      <div class="card"><p class="empty">Failed to load data: ${esc(err instanceof Error ? err.message : String(err))}</p></div>
    `);
    return;
  }

  const rows = txns.length
    ? txns.map((t) => `
      <tr>
        <td>${esc(t.date)}</td>
        <td>${esc(t.billNo || "—")}</td>
        <td><span class="tag ${t.type === "INCOME" ? "receive" : "pay"}">${t.type === "INCOME" ? "Income" : "Expense"}</span></td>
        <td>${esc(t.category)}</td>
        <td class="num">${money(t.amount)}</td>
        <td>${esc(t.fundName)}</td>
        <td>${esc(t.description || "—")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">No transactions yet. Record the first one above.</td></tr>`;

  renderShell(`
    <div class="topbar">
      <div>
        <h2>Other expense / income</h2>
        <p>Non-trade cash movements — transport, labour, rent, commission, and miscellaneous income.</p>
      </div>
    </div>
    <div class="card">
      <h3>Record transaction</h3>
      ${funds.length === 0 ? `
        <p class="empty">Create a fund account on the Cash &amp; Bank page before recording transactions.</p>
      ` : `
      <form class="stack" id="txn-form">
        <div class="row">
          <label>Type
            <select required name="type">
              <option value="EXPENSE">Expense — money out</option>
              <option value="INCOME">Income — money in</option>
            </select>
          </label>
          <label>Category <input required name="category" list="categories" placeholder="Transport, Labour, etc." maxlength="60"></label>
          <datalist id="categories">
            <option value="Transport"></option>
            <option value="Labour"></option>
            <option value="Rent"></option>
            <option value="Commission"></option>
            <option value="Electricity"></option>
            <option value="Water"></option>
          </datalist>
        </div>
        <div class="row3">
          <label>Amount ₹ <input required type="number" step="0.01" min="0.01" name="amount"></label>
          <label>Fund account
            <select required name="fundId">
              ${funds.map((f) => `<option value="${f.id}">${esc(f.name)} · ${fundType(f.type)}</option>`).join("")}
            </select>
          </label>
          <label>Date <input required type="date" name="date" value="${today()}"></label>
        </div>
        <label>Description <input name="description" placeholder="Optional details" maxlength="200"></label>
        <div class="actions"><button class="btn gold" type="submit" id="txn-save">Save transaction</button></div>
      </form>
      `}
    </div>
    <div class="card">
      <h3>Recent transactions</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Bill No</th>
              <th scope="col">Type</th>
              <th scope="col">Category</th>
              <th scope="col" class="num">Amount ₹</th>
              <th scope="col">Fund</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);

  const form = document.getElementById("txn-form") as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("txn-save") as HTMLButtonElement;
    saveBtn.disabled = true;
    const fd = new FormData(form);
    try {
      await api.post("/other-txn", {
        type: fd.get("type"),
        category: fd.get("category"),
        amount: Number(fd.get("amount")),
        fundId: fd.get("fundId"),
        date: fd.get("date"),
        description: fd.get("description") || undefined,
      });
      toast("Transaction saved", "success");
      render();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save transaction", "error");
      saveBtn.disabled = false;
    }
  });
}
