import { api } from "../api.js";
import { esc, money, today } from "../format.js";

export async function render(): Promise<void> {
  const container = document.getElementById("page-root")!;
  container.innerHTML = `
    <div class="header">
      <h2>Other Expense / Income</h2>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Record Transaction</h3>
      <form class="stack" id="txn-form">
        <div class="row">
          <label>Type 
            <select required name="type">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </label>
          <label>Category <input required name="category" list="categories" placeholder="Transport, Labour, etc."></label>
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
          <label>Fund account <select required name="fundId" id="txn-fund"></select></label>
          <label>Date <input required type="date" name="date" value="${today()}"></label>
        </div>
        <label>Description <input name="description" placeholder="Optional details"></label>
        <button class="btn primary" type="submit">Save Transaction</button>
      </form>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3>Recent Transactions</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Bill No</th>
              <th>Type</th>
              <th>Category</th>
              <th class="num">Amount ₹</th>
              <th>Fund</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody id="txn-tbody">
            <tr><td colspan="7">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let funds: any[] = [];
  let txns: any[] = [];

  const load = async () => {
    [funds, txns] = await Promise.all([
      api.get("/funds"),
      api.get("/other-txn")
    ]);
  };

  const renderTxns = () => {
    const tbody = document.getElementById("txn-tbody")!;
    if (txns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">No transactions found</td></tr>`;
      return;
    }

    tbody.innerHTML = txns.map(t => `
      <tr>
        <td>${esc(t.date)}</td>
        <td>${esc(t.billNo || "-")}</td>
        <td>
          <span style="color: ${t.type === 'INCOME' ? 'var(--success)' : 'var(--danger)'}">
            ${esc(t.type)}
          </span>
        </td>
        <td>${esc(t.category)}</td>
        <td class="num">${money(t.amount)}</td>
        <td>${esc(t.fundName)}</td>
        <td>${esc(t.description || "-")}</td>
      </tr>
    `).join("");
  };

  const init = async () => {
    try {
      await load();
      const sel = document.getElementById("txn-fund") as HTMLSelectElement;
      sel.innerHTML = funds.map((f: any) => `<option value="${f.id}">${esc(f.name)} (${f.type})</option>`).join("");
      renderTxns();
    } catch (err: any) {
      container.innerHTML = `<p class="error">Failed to load data: ${esc(err.message)}</p>`;
    }
  };

  await init();

  document.getElementById("txn-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.post("/other-txn", {
        type: fd.get("type"),
        category: fd.get("category"),
        amount: Number(fd.get("amount")),
        fundId: fd.get("fundId"),
        date: fd.get("date"),
        description: fd.get("description") || undefined,
      });
      (e.target as HTMLFormElement).reset();
      await init();
    } catch (err: any) {
      alert(err.message);
    }
  });
}
