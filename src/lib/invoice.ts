import { z } from "zod";
import { ApiError } from "./errorHandler.js";
import { getNextBillNo } from "./billSequence.js";
import { splitCgstSgst, roundOff, round2 } from "./gst.js";
import { amountInWords } from "./amountInWords.js";
import type { CompanyInfoDTO, InvoiceDTO } from "../../shared/types.js";

const COMPANY_STATE_CODE = "32"; // Kerala — single-state operation

/**
 * One payment → one invoice. Builds the multi-line Bill of Supply from the
 * fixings a payment just created, applying intra-state GST per line and
 * rounding the grand total.
 *
 * `fixings` must be the rows created by this payment; each keeps its link back
 * to the lot it priced.
 */
export const buildInvoiceSchema = z.object({
  paymentId: z.string().min(1),
  partyId: z.string().min(1),
  date: z.string(),
  kind: z.enum(["PURCHASE", "SALE"]),
  fixingIds: z.array(z.string().min(1)).min(1, "Select at least one priced trade"),
  tcsAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function createInvoiceFromFixings(
  tx: any,
  company: CompanyInfoDTO,
  input: z.infer<typeof buildInvoiceSchema>,
): Promise<InvoiceDTO> {
  const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new ApiError(404, "Payment not found");

  const already = await tx.invoice.findUnique({ where: { paymentId: payment.id } });
  if (already) throw new ApiError(400, `Invoice ${already.billNo} already exists for this payment`);

  const fixings = await tx.fixing.findMany({
    where: { id: { in: input.fixingIds } },
    include: { lot: { include: { item: true } }, invoiceLine: true },
  });
  if (fixings.length !== input.fixingIds.length) {
    throw new ApiError(400, "One or more priced trades could not be found");
  }

  const billable = fixings.filter((f: any) => !f.invoiceLine);
  if (billable.length === 0) {
    throw new ApiError(400, "Those priced trades have already been invoiced");
  }

  const lines = billable.map((f: any) => {
    const amount = round2(f.kg * f.rate);
    const rate = f.lot.item.cgstRate !== undefined && f.lot.item.cgstRate !== null ? f.lot.item.cgstRate : 2.5;
    const { cgstAmount, sgstAmount } = splitCgstSgst(amount, rate);
    return {
      fixingId: f.id,
      description: f.lot.item.name,
      hsnCode: f.lot.item.hsnCode || "",
      kg: f.kg,
      rate: f.rate,
      amount,
      cgstRate: rate,
      cgstAmount,
      sgstRate: rate,
      sgstAmount,
      lotNo: f.lot.billNo,
    };
  });

  const subtotal = round2(lines.reduce((s: number, l: any) => s + l.amount, 0));
  const cgstAmount = round2(lines.reduce((s: number, l: any) => s + l.cgstAmount, 0));
  const sgstAmount = round2(lines.reduce((s: number, l: any) => s + l.sgstAmount, 0));
  const tcsAmount = round2(input.tcsAmount || 0);
  const tdsAmount = round2(payment.tdsAmount || 0);
  const taxableValue = subtotal;

  // The invoice total is the goods value plus GST (CGST + SGST), plus TCS when
  // collected at source, minus TDS when deducted. GST is the buyer's liability,
  // not income, so it must be inside the total or the printed figure will not
  // match the sum of its own line rows.
  const gstTotal = round2(cgstAmount + sgstAmount);
  const beforeRound = taxableValue + gstTotal + tcsAmount - tdsAmount;
  const rounding = roundOff(beforeRound);
  const roundOffValue = rounding.roundOff;
  const total = rounding.total;

  const billNo = await getNextBillNo("INV");

  const invoice = await tx.invoice.create({
    data: {
      billNo,
      date: new Date(input.date),
      kind: input.kind,
      partyId: input.partyId,
      subtotal,
      taxableValue,
      cgstAmount,
      sgstAmount,
      tcsAmount,
      tdsAmount,
      roundOff: roundOffValue,
      total,
      placeOfSupply: `${company.state} (${company.stateCode || COMPANY_STATE_CODE})`,
      notes: input.notes || null,
      paymentId: payment.id,
      lines: { create: lines },
    },
    include: { lines: true, party: true },
  });

  return toInvoiceDTO(invoice, company);
}

export function toInvoiceDTO(invoice: any, company: CompanyInfoDTO): InvoiceDTO {
  return {
    id: invoice.id,
    billNo: invoice.billNo,
    date: invoice.date.toISOString().slice(0, 10),
    kind: invoice.kind,
    partyId: invoice.partyId,
    partyName: invoice.party?.name ?? "",
    subtotal: invoice.subtotal.toFixed(2),
    taxableValue: invoice.taxableValue.toFixed(2),
    cgstAmount: invoice.cgstAmount.toFixed(2),
    sgstAmount: invoice.sgstAmount.toFixed(2),
    tcsAmount: invoice.tcsAmount.toFixed(2),
    tdsAmount: invoice.tdsAmount.toFixed(2),
    roundOff: invoice.roundOff.toFixed(2),
    total: invoice.total.toFixed(2),
    placeOfSupply: invoice.placeOfSupply,
    notes: invoice.notes,
    paymentId: invoice.paymentId,
    paymentBillNo: invoice.payment?.billNo ?? null,
    amountInWords: amountInWords(invoice.total),
    company,
    lines: (invoice.lines ?? []).map((l: any) => ({
      id: l.id,
      fixingId: l.fixingId,
      description: l.description,
      hsnCode: l.hsnCode,
      kg: l.kg.toString(),
      rate: l.rate.toString(),
      amount: l.amount.toFixed(2),
      cgstRate: l.cgstRate.toString(),
      cgstAmount: l.cgstAmount.toFixed(2),
      sgstRate: l.sgstRate.toString(),
      sgstAmount: l.sgstAmount.toFixed(2),
      lotNo: l.lotNo,
    })),
  };
}