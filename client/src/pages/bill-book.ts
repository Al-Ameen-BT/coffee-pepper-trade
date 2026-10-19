// Blank Bill of Supply — traditional bill-book form for physical printing.
// Company identity and bank details come from Company Settings (/settings);
// bank fields stay as dotted fill lines until saved there.

import { api } from "../api.js";
import { esc } from "../format.js";
import type { CompanyInfoDTO } from "../../../shared/types.js";

const EMPTY_ROWS = 8;

// Pre-print a saved value, or keep the dotted fill line when unset
const fill = (value: string | null): string =>
  value ? `<strong>${esc(value)}</strong>` : `<span class="bb-fill"></span>`;

export async function render(): Promise<void> {
  const COMPANY = await api.get<CompanyInfoDTO>("/settings/company");

  // The pre-printed serial advances with each blank sheet pulled from the
  // book. It is drawn from the same BillSequence counters the app bills from,
  // so the manual book and the digital bills never collide.
  const serial = await api.get<{ serial: string; next: string }>("/bills/book-serial");
  document.title = `Tax Invoice Cum Bill of Supply ${serial.serial} · ${COMPANY.name}`;

  const itemRows = Array.from({ length: EMPTY_ROWS }, () => `
      <tr>
        <td class="ctr"></td>
        <td></td>
        <td class="ctr"></td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num"></td>
      </tr>`).join("");

  document.getElementById("app")!.innerHTML = `
    <div class="print-bar no-print">
      <button class="btn secondary" onclick="window.history.back()">Back</button>
      <button class="btn secondary" onclick="window.close()">Close</button>
      <button class="btn gold" onclick="window.print()">Print Tax Invoice cum Bill of Supply</button>
    </div>

    <div class="print-doc bb">
      <!-- Header band -->
      <div class="bb-head">
        <div><span class="bb-form-name">TAX INVOICE CUM BILL OF SUPPLY</span></div>
        <div class="bb-head-center">
          <h1>${esc(COMPANY.name).toUpperCase()}</h1>
          <p class="bb-tagline">${esc(COMPANY.tagline)}</p>
          <p class="bb-addr">${esc(COMPANY.address)}</p>
        </div>
        <div class="bb-head-right">Phone : ${esc(COMPANY.phone)}</div>
      </div>
      <div class="bb-gstin">GSTIN : ${esc(COMPANY.gstin)}</div>

      <!-- Top information: two ruled columns -->
      <div class="bb-info">
        <div>
          <div class="bb-section-label" style="font-weight: 700; margin-bottom: 6px;">Invoice Details:</div>
          <div class="bb-field"><span class="lbl">Invoice Number :</span> <span class="bb-serial">${esc(serial.serial)}</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">Invoice Date :</span> <span class="bb-fill"></span></div>
          <div class="bb-inline-pair">
            <div class="bb-field"><span class="lbl">State :</span> ${esc(COMPANY.state || "Kerala")}</div>
            <div class="bb-field"><span class="lbl">State Code :</span> ${esc(COMPANY.stateCode || "32")}</div>
            <div class="bb-field"><span class="lbl">PIN Code :</span> ${esc(COMPANY.pincode || "673591")}</div>
          </div>
        </div>
        <div>
          <div class="bb-field" style="margin-top: 22px;"><span class="lbl">Transportation Mode :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">Vehicle No :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">Date &amp; Time of Supply :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">Place of Supply :</span> <span class="bb-fill"></span></div>
        </div>
      </div>

      <!-- Details of receiver -->
      <div class="bb-receiver">
        <div class="bb-section-label">Bill To</div>
        <div class="bb-field"><span class="lbl">Name :</span> <span class="bb-fill wide"></span></div>
        <div class="bb-field"><span class="lbl">Address :</span> <span class="bb-fill wide"></span></div>
        <div class="bb-inline-pair">
          <div class="bb-field"><span class="lbl">State :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">State Code :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">PIN Code :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">GSTIN :</span> <span class="bb-fill"></span></div>
        </div>
        <div class="bb-inline-pair">
          <div class="bb-field"><span class="lbl">From :</span> <span class="bb-fill"></span></div>
          <div class="bb-field"><span class="lbl">To :</span> <span class="bb-fill"></span></div>
        </div>
      </div>

      <!-- Product table -->
      <table class="bb-table">
        <thead>
          <tr>
            <th class="ctr" style="width: 45px;">Sl. No.</th>
            <th>Name of Product</th>
            <th class="ctr" style="width: 70px;">HSN</th>
            <th class="num" style="width: 75px;">Qty (kg)</th>
            <th class="num" style="width: 75px;">Rate</th>
            <th class="num" style="width: 90px;">Taxable Value</th>
            <th class="num" style="width: 70px;">CGST</th>
            <th class="num" style="width: 70px;">SGST</th>
            <th class="num" style="width: 90px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td></td>
            <td><strong>Total</strong></td>
            <td></td>
            <td class="num"></td>
            <td></td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num"></td>
          </tr>
        </tfoot>
      </table>

      <!-- Bottom summary -->
      <div class="bb-bottom">
        <section>
          <div class="bb-words">
            <span class="lbl"><strong>Total Amount in Words:</strong></span>
            <span class="bb-fill"></span>
            <span class="bb-fill"></span>
          </div>
          <div class="bb-bank">
            <div class="bb-field"><span class="lbl">Bank Name :</span> ${fill(COMPANY.bankName)}</div>
            <div class="bb-field"><span class="lbl">Bank A/c. No :</span> ${fill(COMPANY.bankAccount)}</div>
            <div class="bb-field"><span class="lbl">Branch IFSC :</span> ${fill(COMPANY.bankIfsc)}</div>
          </div>
          <div class="bb-terms">
            <div class="bb-terms-head">Terms &amp; Conditions</div>
            <ol>
              <li>Goods once sold will not be taken back or exchanged.</li>
            </ol>
          </div>
        </section>

        <section class="bb-seal">
          <div class="bb-seal-box">Seal</div>
        </section>

        <section>
          <div class="bb-amounts">
            <div class="bb-field"><span class="lbl">Total Amount :</span> <span class="bb-fill"></span></div>
            <div class="bb-field bb-total-value"><span class="lbl">Grand Total :</span> <span class="bb-fill"></span></div>
          </div>
          <p class="bb-cert">Certified that the particulars given above are true and correct.</p>
          <p class="bb-for">for, ${esc(COMPANY.name)}</p>
          <p class="bb-sign">(Authorised Signatory)</p>
        </section>
      </div>
    </div>
  `;
}
