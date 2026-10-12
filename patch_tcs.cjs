const fs = require('fs');

let code = fs.readFileSync('src/modules/lots/routes.ts', 'utf8');

const tcsLogic = `
async function computeTCS(tx: any, partyId: string, fixingDate: Date, currentFixingValue: number, providedTcsRate?: number | null) {
  if (providedTcsRate !== undefined && providedTcsRate !== null) {
    return {
      tcsRate: providedTcsRate,
      tcsAmount: (currentFixingValue * providedTcsRate) / 100
    };
  }

  const d = new Date(fixingDate);
  const month = d.getMonth();
  const year = d.getFullYear();
  
  let startYear = month >= 3 ? year : year - 1;
  const fyStart = new Date(startYear, 3, 1);
  const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59);

  // sum all fixings for this party in this FY
  const fixings = await tx.fixing.findMany({
    where: {
      lot: { partyId },
      date: { gte: fyStart, lte: fyEnd }
    }
  });

  const ytd = fixings.reduce((sum: number, f: any) => sum + (f.kg * f.rate), 0);
  
  if (ytd + currentFixingValue > 5000000) {
    return {
      tcsRate: 0.1,
      tcsAmount: (currentFixingValue * 0.1) / 100
    };
  }
  return { tcsRate: null, tcsAmount: null };
}
`;

// Insert the computeTCS function before lotsRouter
code = code.replace(/export const lotsRouter = Router\(\);/, tcsLogic + '\nexport const lotsRouter = Router();');

// Update lotsRouter.post("/")
// Find:
/*
          const prefix = data.kind === "PURCHASE" ? "PUR" : "SAL";
          const billNo = await getNextBillNo(prefix);
          await tx.fixing.create({
            data: { lotId: created.id, date: new Date(data.date), kg: kgVal, rate: data.rate, notes: "Entered with lot", billNo },
          });
*/
// Replace with:
const lotPostTarget = `const prefix = data.kind === "PURCHASE" ? "PUR" : "SAL";
          const billNo = await getNextBillNo(prefix);
          const tcs = await computeTCS(tx, data.partyId, new Date(data.date), kgVal * data.rate);
          await tx.fixing.create({
            data: { lotId: created.id, date: new Date(data.date), kg: kgVal, rate: data.rate, notes: "Entered with lot", billNo, ...tcs },
          });`;

code = code.replace(/const prefix = data\.kind === "PURCHASE" \? "PUR" : "SAL";\s*const billNo = await getNextBillNo\(prefix\);\s*await tx\.fixing\.create\(\{\s*data: \{ lotId: created\.id, date: new Date\(data\.date\), kg: kgVal, rate: data\.rate, notes: "Entered with lot", billNo \},\s*\}\);/, lotPostTarget);

// Update lotsRouter.post("/:id/fixings")
// Find:
/*
    const tcsAmount = data.tcsRate ? (data.kg * data.rate * data.tcsRate) / 100 : 0;
    const tdsAmount = data.tdsRate ? (data.kg * data.rate * data.tdsRate) / 100 : 0;

    const prefix = lot.kind === "PURCHASE" ? "PUR" : "SAL";
    const billNo = await getNextBillNo(prefix);

    const fixing = await prisma.$transaction(async (tx) => {
      const created = await tx.fixing.create({
        data: { 
          lotId: lot.id, 
          date: new Date(data.date), 
          kg: data.kg, 
          rate: data.rate, 
          tcsRate: data.tcsRate || null,
          tcsAmount: tcsAmount || null,
          tdsRate: data.tdsRate || null,
          tdsAmount: tdsAmount || null,
          billNo,
          notes: data.notes || null 
        },
      });
*/
const fixingTarget = `
    const tdsAmount = data.tdsRate ? (data.kg * data.rate * data.tdsRate) / 100 : 0;

    const prefix = lot.kind === "PURCHASE" ? "PUR" : "SAL";
    const billNo = await getNextBillNo(prefix);

    const fixing = await prisma.$transaction(async (tx) => {
      const tcs = await computeTCS(tx, lot.partyId, new Date(data.date), data.kg * data.rate, data.tcsRate);
      
      const created = await tx.fixing.create({
        data: { 
          lotId: lot.id, 
          date: new Date(data.date), 
          kg: data.kg, 
          rate: data.rate, 
          tcsRate: tcs.tcsRate,
          tcsAmount: tcs.tcsAmount,
          tdsRate: data.tdsRate || null,
          tdsAmount: tdsAmount || null,
          billNo,
          notes: data.notes || null 
        },
      });
`;
code = code.replace(/const tcsAmount = data\.tcsRate \? [^]+?notes: data\.notes \|\| null \n        \},\n      \}\);/, fixingTarget);

fs.writeFileSync('src/modules/lots/routes.ts', code);
