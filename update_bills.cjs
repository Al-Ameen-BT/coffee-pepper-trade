const fs = require('fs');
let code = fs.readFileSync('client/src/pages/bills.ts', 'utf8');

const replacement = `
    <div class="topbar no-print">
      <div>
        <h2>Bills & Print Module</h2>
        <p>Select a party to view their statements or print individual formal bills.</p>
      </div>
      <div class="actions">
        <label class="field-inline">Party
          <select id="bill-party">
            \${parties.map((p) => \`<option value="\${p.id}" \${p.id === selected.id ? "selected" : ""}>\${esc(p.name)}</option>\`).join("")}
          </select>
        </label>
        <label class="field-inline">Bill Number
          <select id="bill-select">
            <option value="">-- Select Bill --</option>
            \${(bill.fixings || []).map(f => f.billNo ? \`<option value="\${f.id}">\${esc(f.billNo)} (\${f.date})</option>\` : '').join('')}
          </select>
        </label>
        <button class="btn gold" type="button" id="print-formal-bill">Print Selected Bill</button>
        <a href="/bill-book" target="_blank" class="btn secondary">Blank Bill Book</a>
      </div>
    </div>
`;
code = code.replace(/<div class="topbar no-print">[\s\S]*?<\/div>\s*<\/div>/, replacement);

const eventReplacement = `
  document.getElementById("print-formal-bill")!.addEventListener("click", () => {
    const sel = document.getElementById("bill-select") as HTMLSelectElement;
    if (!sel.value) {
      toast("Please select a bill number first", "error");
      return;
    }
    window.open("/print-bill?fixingId=" + sel.value, "_blank");
  });
`;

code = code.replace(/document\.getElementById\("print-pdf"\)!\.addEventListener[^}]+\}\);/, eventReplacement);

fs.writeFileSync('client/src/pages/bills.ts', code);
