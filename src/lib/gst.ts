// Intra-state (Kerala → Kerala) GST. Every buyer of this business is inside
// state code 32, so tax is always a CGST + SGST split of the same rate — half
// each. Interstate sales (IGST) are deliberately not modelled.

export function splitCgstSgst(
  taxableValue: number,
  cgstRate: number,
): { cgstAmount: number; sgstAmount: number } {
  const half = (taxableValue * cgstRate) / 100 / 2;
  return {
    cgstAmount: round2(half),
    sgstAmount: round2(half),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Round the invoice total to the nearest rupee and report the adjustment, so the
 * printed grand total is the figure that matches the payment exactly.
 */
export function roundOff(total: number): { roundOff: number; total: number } {
  const rounded = Math.round(total);
  return { roundOff: round2(rounded - total), total: rounded };
}