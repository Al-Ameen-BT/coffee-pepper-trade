import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { encrypt } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.fixing.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.party.deleteMany();
  await prisma.item.deleteMany();
  await prisma.fund.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminHashed = await bcrypt.hash("admin12345", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@uzhunnungal.com" },
    update: { password: adminHashed, role: "ADMIN", name: "Admin" },
    create: {
      email: "admin@uzhunnungal.com",
      password: adminHashed,
      name: "Admin",
      role: "ADMIN",
    },
  });
  console.log("Created user:", adminUser.email, `(${adminUser.role})`);

  // Create standard operator user
  const userHashed = await bcrypt.hash("user12345", 12);
  const standardUser = await prisma.user.upsert({
    where: { email: "user@hilltrade.com" },
    update: { password: userHashed, role: "USER", name: "Trader" },
    create: {
      email: "user@hilltrade.com",
      password: userHashed,
      name: "Trader",
      role: "USER",
    },
  });
  console.log("Created user:", standardUser.email, `(${standardUser.role})`);

  // Create default items
  const defaultItems = [
    { name: "Cherry Coffee", slug: "cherry-coffee", hsnCode: "0901", cgstRate: 5 },
    { name: "Coffee Beans", slug: "coffee-beans", hsnCode: "0901", cgstRate: 5 },
    { name: "Coffee", slug: "coffee", hsnCode: "0901", cgstRate: 5 },
    { name: "Black Pepper", slug: "pepper", hsnCode: "0904", cgstRate: 5 },
  ];

  for (const item of defaultItems) {
    await prisma.item.upsert({
      where: { slug: item.slug },
      update: { hsnCode: item.hsnCode, cgstRate: item.cgstRate },
      create: item,
    });
  }
  console.log("Created default items");

  // Create parties
  const ramesh = await prisma.party.create({
    data: {
      name: "Ramesh Coffee Estate",
      phone: "98450 11223",
      role: "SUPPLIER",
      place: "Madikeri",
      pincode: "571201",
      state: "Karnataka",
      gstin: "29AAAAA0000A1Z5",
      address: "Near Abbey Falls Road, Madikeri, Kodagu",
    },
  });

  const kodagu = await prisma.party.create({
    data: {
      name: "Kodagu Traders",
      phone: "821 240 1188",
      role: "BUYER",
      place: "Mysuru",
      pincode: "570001",
      state: "Karnataka",
      gstin: "29BBBBB1111B1Z2",
      address: "No. 12, Bannimantap Industrial Area, Mysuru",
    },
  });

  const lakshmi = await prisma.party.create({
    data: {
      name: "Lakshmi Pepper House",
      phone: "97401 55670",
      role: "BOTH",
      place: "Virajpet",
      pincode: "571218",
      state: "Karnataka",
      gstin: "29CCCCC2222C1Z9",
      address: "Main Road, Virajpet, Kodagu",
    },
  });

  // Additional parties
  const arun = await prisma.party.create({
    data: {
      name: "Arun Coffee Curing",
      phone: "99001 23456",
      role: "SUPPLIER",
      place: "Gonikoppal",
      pincode: "571213",
      state: "Karnataka",
      gstin: "29DDDDD3333D1Z6",
      address: "Curing Works, Gonikoppal, Kodagu",
    },
  });

  const meena = await prisma.party.create({
    data: {
      name: "Meena Exports",
      phone: "98860 78901",
      role: "BUYER",
      place: "Bengaluru",
      pincode: "560058",
      state: "Karnataka",
      gstin: "29EEEEE4444E1Z3",
      address: "Export House, Peenya, Bengaluru",
    },
  });

  const soma = await prisma.party.create({
    data: {
      name: "Soma Pepper Traders",
      phone: "97412 34567",
      role: "BOTH",
      place: "Suntikoppa",
      pincode: "571237",
      state: "Karnataka",
      gstin: "29FFFFF5555F1Z0",
      address: "Market Road, Suntikoppa, Kodagu",
    },
  });
  console.log("Created parties");

  // Create funds
  const cash = await prisma.fund.create({
    data: { name: "Cash in Hand", type: "CASH", opening: 185000 },
  });

  const current = await prisma.fund.create({
    data: { name: "SBI Current A/c", type: "CURRENT", opening: 642000 },
  });

  const cc = await prisma.fund.create({
    data: { name: "Canara Bank CC A/c", type: "CC", opening: -125000 },
  });

  const savings = await prisma.fund.create({
    data: { name: "HDFC Savings", type: "CURRENT", opening: 50000, bankName: "HDFC Bank", accountNumber: encrypt("50200012345678") },
  });
  console.log("Created funds");

  // Get item IDs
  const coffee = await prisma.item.findUnique({ where: { slug: "coffee" } });
  const pepper = await prisma.item.findUnique({ where: { slug: "pepper" } });
  const cherry = await prisma.item.findUnique({ where: { slug: "cherry-coffee" } });

  // Create lots
  const p1 = await prisma.lot.create({
    data: {
      kind: "PURCHASE", partyId: ramesh.id, itemId: coffee!.id,
      date: new Date("2026-09-12"), grossWeightKg: 1275, bagCount: 25, bagTareKg: 25, totalKg: 1250, notes: "Cherry, first lot", billNo: "P-001",
    },
  });

  const p2 = await prisma.lot.create({
    data: {
      kind: "PURCHASE", partyId: lakshmi.id, itemId: pepper!.id,
      date: new Date("2026-09-18"), totalKg: 420, notes: "MG1", billNo: "P-002",
    },
  });

  const s1 = await prisma.lot.create({
    data: {
      kind: "SALE", partyId: kodagu.id, itemId: coffee!.id,
      date: new Date("2026-09-20"), totalKg: 800, notes: "Parchment", billNo: "S-001",
    },
  });

  const s2 = await prisma.lot.create({
    data: {
      kind: "SALE", partyId: lakshmi.id, itemId: pepper!.id,
      date: new Date("2026-09-22"), totalKg: 150, notes: "", billNo: "S-002",
    },
  });

  // Additional lots
  const p3 = await prisma.lot.create({
    data: {
      kind: "PURCHASE", partyId: arun.id, itemId: cherry!.id,
      date: new Date("2026-09-25"), totalKg: 600, notes: "Cherry, second lot", billNo: "P-003",
    },
  });

  const s3 = await prisma.lot.create({
    data: {
      kind: "SALE", partyId: meena.id, itemId: coffee!.id,
      date: new Date("2026-09-26"), totalKg: 500, notes: "Export quality", billNo: "S-003",
    },
  });

  const p4 = await prisma.lot.create({
    data: {
      kind: "PURCHASE", partyId: soma.id, itemId: pepper!.id,
      date: new Date("2026-09-27"), totalKg: 300, notes: "Bulk purchase", billNo: "P-004",
    },
  });

  const s4 = await prisma.lot.create({
    data: {
      kind: "SALE", partyId: soma.id, itemId: coffee!.id,
      date: new Date("2026-09-28"), totalKg: 200, notes: "Local sale", billNo: "S-004",
    },
  });
  console.log("Created lots");

  // Create fixings — each is a trade bill, so each gets a real PUR/SAL number
  // from the same FY counter the app uses. Numbers here must match the format
  // the running application produces, otherwise seeded bills look unnumbered.
  const fixCurrentFY = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 3 ? `${year % 100}-${(year + 1) % 100}` : `${(year - 1) % 100}-${year % 100}`;
  })();

  let purSeq = 0;
  let salSeq = 0;
  const purNo = () => `PUR/${fixCurrentFY}/${String(++purSeq).padStart(4, "0")}`;
  const salNo = () => `SAL/${fixCurrentFY}/${String(++salSeq).padStart(4, "0")}`;

  await prisma.fixing.createMany({
    data: [
      { lotId: p1.id, date: new Date("2026-09-14"), kg: 500, rate: 268, billNo: purNo(), notes: "1st tranche" },
      { lotId: p1.id, date: new Date("2026-09-21"), kg: 400, rate: 274, billNo: purNo(), notes: "2nd tranche" },
      { lotId: p2.id, date: new Date("2026-09-19"), kg: 200, rate: 642, billNo: purNo(), notes: "Partial" },
      { lotId: s1.id, date: new Date("2026-09-20"), kg: 800, rate: 312, billNo: salNo(), notes: "Full lot" },
      { lotId: p3.id, date: new Date("2026-09-26"), kg: 300, rate: 270, billNo: purNo(), notes: "First fix" },
      { lotId: s3.id, date: new Date("2026-09-27"), kg: 500, rate: 315, billNo: salNo(), notes: "Export rate" },
      { lotId: p4.id, date: new Date("2026-09-28"), kg: 150, rate: 645, billNo: purNo(), notes: "Partial" },
    ],
  });

  // Advance the live counters so app-generated numbers never reuse seeded ones
  for (const [prefix, last] of [
    ["PUR", purSeq],
    ["SAL", salSeq],
  ] as const) {
    await prisma.billSequence.upsert({
      where: { prefix_financialYear: { prefix, financialYear: fixCurrentFY } },
      update: { lastNumber: last },
      create: { prefix, financialYear: fixCurrentFY, lastNumber: last },
    });
  }

  console.log(`Created fixings (numbered ${purSeq} PUR, ${salSeq} SAL for ${fixCurrentFY})`);

  // Create payments
  await prisma.payment.createMany({
    data: [
      {
        partyId: ramesh.id, date: new Date("2026-09-15"), amount: 80000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: `PAY/${fixCurrentFY}/0001`, notes: "Part payment P-001",
      },
      {
        partyId: kodagu.id, date: new Date("2026-09-23"), amount: 150000,
        direction: "RECEIVE", tradeType: "SALE", fundId: current.id,
        billNo: `REC/${fixCurrentFY}/0001`, notes: "Part receipt S-001",
      },
      {
        partyId: arun.id, date: new Date("2026-09-26"), amount: 50000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: `PAY/${fixCurrentFY}/0002`, notes: "Advance for P-003",
      },
      {
        partyId: meena.id, date: new Date("2026-09-27"), amount: 120000,
        direction: "RECEIVE", tradeType: "SALE", fundId: current.id,
        billNo: `REC/${fixCurrentFY}/0002`, notes: "Full receipt S-003",
      },
      {
        partyId: soma.id, date: new Date("2026-09-28"), amount: 30000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: `PAY/${fixCurrentFY}/0003`, notes: "Part payment P-004",
      },
    ],
  });

  // Advance PAY/REC counters past the seeded numbers
  for (const [prefix, last] of [
    ["PAY", 3],
    ["REC", 2],
  ] as const) {
    await prisma.billSequence.upsert({
      where: { prefix_financialYear: { prefix, financialYear: fixCurrentFY } },
      update: { lastNumber: last },
      create: { prefix, financialYear: fixCurrentFY, lastNumber: last },
    });
  }
  console.log("Created payments (numbered PAY/REC)");

  // Create loans
  await prisma.loan.createMany({
    data: [
      {
        partyId: lakshmi.id, date: new Date("2026-09-10"), amount: 25000, balanceAmount: 25000, status: "ACTIVE",
        kind: "LOAN_GIVEN", fundId: cash.id, notes: "Personal loan, not against goods",
      },
      {
        partyId: arun.id, date: new Date("2026-09-20"), amount: 15000, balanceAmount: 15000, status: "ACTIVE",
        kind: "ADVANCE_GIVEN", fundId: current.id, itemId: coffee!.id,
        purpose: "trade_advance", notes: "Advance against P-003",
      },
      {
        partyId: meena.id, date: new Date("2026-09-25"), amount: 50000, balanceAmount: 50000, status: "ACTIVE",
        kind: "LOAN_TAKEN", fundId: current.id, notes: "Short term loan",
      },
    ],
  });
  console.log("Created loans");

  // Company identity (printed on bills & statements) — editable later in Company Settings
  await prisma.companyInfo.deleteMany();
  await prisma.companyInfo.create({
    data: {
      name: "UZHUNNUNGAL TRADERS",
      tagline: "Hill Produce Dealer",
      gstin: "32APFPJ6004B1ZP",
      address: "KARIAMBADI P.O., WAYANAD DT., KERALA",
      state: "Kerala",
      pincode: "673591",
      stateCode: "32",
      phone: "9447204847",
    },
  });
  console.log("Created company info");

  console.log("Seed complete!");
  console.log("Login with: admin@uzhunnungal.com / admin12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
