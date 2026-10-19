import { prisma } from "../db.js";

export function getCurrentFY(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = validDate.getMonth(); // 0-based
  // FY starts April 1
  if (month >= 3) {
    return `${year % 100}-${(year + 1) % 100}`;
  } else {
    return `${(year - 1) % 100}-${year % 100}`;
  }
}

export async function getNextBillNo(prefix: string, dateInput?: Date | string | null): Promise<string> {
  const fy = getCurrentFY(dateInput);
  
  const seq = await prisma.billSequence.upsert({
    where: {
      prefix_financialYear: { prefix, financialYear: fy }
    },
    update: {
      lastNumber: { increment: 1 }
    },
    create: {
      prefix,
      financialYear: fy,
      lastNumber: 1
    }
  });

  return `${prefix}/${fy}/${String(seq.lastNumber).padStart(4, '0')}`;
}

/**
 * Serial for a blank sheet pulled from the printed bill book.
 *
 * Uses its own `BB` series so it never consumes an invoice number, and draws
 * from the same FY counter as everything else. Returns the number drawn and
 * the following one, so the form can show both.
 */
export async function getNextBookSerial(increment = false): Promise<{ serial: string; next: string }> {
  const fy = getCurrentFY();

  let seq = await prisma.billSequence.findUnique({
    where: { prefix_financialYear: { prefix: "BB", financialYear: fy } },
  });

  if (!seq) {
    seq = await prisma.billSequence.create({
      data: { prefix: "BB", financialYear: fy, lastNumber: 1 },
    });
  } else if (increment) {
    seq = await prisma.billSequence.update({
      where: { prefix_financialYear: { prefix: "BB", financialYear: fy } },
      data: { lastNumber: { increment: 1 } },
    });
  }

  const n = seq.lastNumber;
  return {
    serial: String(n),
    next: String(n + 1),
  };
}
