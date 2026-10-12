# Billing System — Digital-First Plan

**Principle: the digital bill is the primary artefact.** Paper is a rendering of the
digital record, never the other way round. A trade is digitalised the moment it is
priced — numbered, tax-treated, stored, searchable, shareable. Printing is a one-click
output of that record, not the system of record.

Status: **Phases 1–5 shipped.** Phase 6 proposed.

## Decisions taken

- **One invoice per payment.** A payment settles several priced lots; the invoice is
  the multi-line document that covers them. One-to-one with `Payment`.
- **Kerala only.** Every buyer is inside state code 32, so tax is always a
  **CGST + SGST split of the same rate, half each**. IGST is deliberately not modelled.
- **A4 portrait, one page** for every printed document.

## What a trade becomes

```
Lot (goods in/out) → Fixing (priced) → Trade bill (per lot)
                                    └ grouped per payment
Payment ──────────────────────────→ Invoice (multi-line, GST split)
                                    └ shareable + A4 PDF
```

`Fixing` keeps lot traceability: every `InvoiceLine` holds a unique FK back to the
fixing it priced, so a priced lot can be invoiced exactly once.

## Shipped

### Phase 1 — Numbering and tax on every path

All three pricing paths produce identically numbered, tax-treated bills.

- `src/lib/tax.ts` — shared `computeTCS`: honours a caller-supplied rate, otherwise
  0.1% once a party's FY-to-date fixing value crosses ₹50,00,000.
- `POST /lots/:id/fixings`, `POST /payments` (kg × rate), `POST /lots` (inline rate)
  all reserve a `PUR`/`SAL` number and compute TCS/TDS.

**Numbering rule (load-bearing):** every `getNextBillNo` call is allocated *outside*
the interactive transaction. It performs its own write; called inside, it deadlocks
on SQLite (`P2028`). Three call sites were violating this — one pre-existing.

### Phase 2 — Bills know their payment status

`Fixing.paymentId` (nullable FK, indexed) links a bill to the payment settling it.
Set in every path that creates both. Powers "what is unpaid?" without guesswork.

### Phase 3 — Bill register + shareable digital bill

- `GET /api/v1/bills` — every trade bill, filterable by party, type, paid status, date.
- `GET /api/v1/bills/:fixingId/document` — single-bill payload.
- **`/bill-register`** — digital ledger: KPIs incl. unpaid value, filters, Open/PDF.
- **`/bill/:id`** — shareable digital bill, copy link, native share with WhatsApp
  fallback, print/PDF. One document serves screen and paper.

### Phase 4 — Multi-line invoice, one per payment

- `Invoice` header (`INV/` series, subtotal, CGST, SGST, TCS, TDS, round-off, total,
  place of supply) + `InvoiceLine` rows with **unique FK to `Fixing`**.
- `POST /invoices` builds the invoice from a payment's uninvoiced fixings, one
  transaction, rejecting a second invoice for the same payment and rejecting
  already-invoiced trades.
- `GET /invoices/payment/:id/available` — the candidate trades for a payment.
- **`/invoice/new?paymentId=…`** — pick the trades this payment settles.
- **`/invoice/:id`** — the multi-line Bill of Supply: per-line HSN, lot reference,
  taxable value, CGST and SGST columns, and the totals block.
- Payments page gained a per-row **Create invoice** action.

Verified live: a ₹1,00,000 payment across two lots produced `INV/26-27/0001` with
2 lines, CGST ₹1,500 + SGST ₹1,500 per line (5% each), lines summing to subtotal,
CGST = SGST, and the duplicate guard rejecting a second invoice for the same payment.

### Phase 5 — Intra-state GST correctness

- **HSN and rate live on the item**, not in a name-string match. `hsnForItem()` used
  to infer `0901` from the words "coffee" — rename an item and the tax code silently
  changed. Now `Item.hsnCode` + `Item.cgstRate`, seeded 0901/0904 at 5%.
- `src/lib/gst.ts` — `splitCgstSgst` (half-half) and `roundOff` to the nearest rupee,
  reported as an explicit line so the printed total matches the payment exactly.
- **Amount in words** — `src/lib/amountInWords.ts`, Indian lakh/crore grouping,
  printed under the total.
- Place of supply captured on the invoice.

### A4 confirmation

Every printed document verified by rendering to PDF with headless Chrome and reading
the page geometry:

| Document | Pages | Page size |
|---|---|---|
| Multi-line invoice (`/invoice/:id`) | 1 | 594.96 × 841.92 pts = **A4** |
| Bill book page (`/bill-book`) | 1 | **A4** |
| Digital bill (`/bill/:id`) | 1 | **A4** |

`@page { size: A4 portrait; margin: 15mm }` is set once in `print.css` for all of
them, with `print-color-adjust: exact` so the tints and rules print.

## Proposed

### Phase 6 — Correction trail, then compliance

- **Credit notes, not edits.** Issued bills and invoices become immutable; returns and
  corrections flow through a `CreditNote` against the original, with a `CRN/` series.
- GSTR-1 (B2B/CS vs B2CS) and GSTR-3B exports; sales/purchase registers.
- E-invoicing (IRN/QR) only if turnover makes it mandatory — the Phase 4 invoice model
  must not foreclose it.

## Sequence

Phase 6 last: compliance reporting needs correct invoices to report on.

## Open question

**Is the paper bill book being retired?** Digital-first means yes — the app is the sole
numbering authority and the bill book becomes a manual fallback only. Confirm before
printing a new book.