import { prisma } from "../db.js";

function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  // FY starts April 1
  if (month >= 3) {
    return `${year % 100}-${(year + 1) % 100}`;
  } else {
    return `${(year - 1) % 100}-${year % 100}`;
  }
}

export async function getNextBillNo(prefix: string): Promise<string> {
  const fy = getCurrentFY();
  
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
