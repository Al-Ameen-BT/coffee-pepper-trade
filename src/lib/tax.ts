// Tax computation shared by every document-creating path (price fixings and payments).
//
// TCS (Tax Collected at Source) applies when a buyer's fiscal-year-to-date value
// crosses ₹50,00,000. A caller-supplied rate always wins, so the user can
// force or suppress it.

const TCS_THRESHOLD = 5000000;
const TCS_RATE = 0.1; // 0.1%

function currentFYBounds(date: Date): { start: Date; end: Date } {
  const month = date.getMonth();
  const year = date.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59),
  };
}

export async function computeTCS(
  tx: any,
  partyId: string,
  fixingDate: Date,
  currentFixingValue: number,
  providedTcsRate?: number | null,
): Promise<{ tcsRate: number | null; tcsAmount: number | null }> {
  if (providedTcsRate !== undefined && providedTcsRate !== null) {
    return {
      tcsRate: providedTcsRate,
      tcsAmount: (currentFixingValue * providedTcsRate) / 100,
    };
  }

  const { start: fyStart, end: fyEnd } = currentFYBounds(fixingDate);

  // Sum all fixings for this party in this FY
  const fixings = await tx.fixing.findMany({
    where: {
      lot: { partyId },
      date: { gte: fyStart, lte: fyEnd },
    },
  });

  const ytd = fixings.reduce((sum: number, f: any) => sum + f.kg * f.rate, 0);

  if (ytd + currentFixingValue > TCS_THRESHOLD) {
    return {
      tcsRate: TCS_RATE,
      tcsAmount: (currentFixingValue * TCS_RATE) / 100,
    };
  }

  return { tcsRate: null, tcsAmount: null };
}