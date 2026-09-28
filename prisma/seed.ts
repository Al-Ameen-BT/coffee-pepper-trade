import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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
  const hashedPassword = await bcrypt.hash("admin12345", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@hilltrade.com" },
    update: {},
    create: {
      email: "admin@hilltrade.com",
      password: hashedPassword,
      name: "Admin",
      role: "ADMIN",
    },
  });
  console.log("Created user:", user.email);

  // Create default items
  const defaultItems = [
    { name: "Cherry Coffee", slug: "cherry-coffee" },
    { name: "Coffee Beans", slug: "coffee-beans" },
    { name: "Coffee", slug: "coffee" },
    { name: "Black Pepper", slug: "pepper" },
  ];

  for (const item of defaultItems) {
    await prisma.item.upsert({
      where: { slug: item.slug },
      update: {},
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
      address: "Near Abbey Falls Road, Madikeri, Kodagu",
    },
  });

  const kodagu = await prisma.party.create({
    data: {
      name: "Kodagu Traders",
      phone: "821 240 1188",
      role: "BUYER",
      place: "Mysuru",
      address: "No. 12, Bannimantap Industrial Area, Mysuru",
    },
  });

  const lakshmi = await prisma.party.create({
    data: {
      name: "Lakshmi Pepper House",
      phone: "97401 55670",
      role: "BOTH",
      place: "Virajpet",
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
      address: "Curing Works, Gonikoppal, Kodagu",
    },
  });

  const meena = await prisma.party.create({
    data: {
      name: "Meena Exports",
      phone: "98860 78901",
      role: "BUYER",
      place: "Bengaluru",
      address: "Export House, Peenya, Bengaluru",
    },
  });

  const soma = await prisma.party.create({
    data: {
      name: "Soma Pepper Traders",
      phone: "97412 34567",
      role: "BOTH",
      place: "Suntikoppa",
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
    data: { name: "HDFC Savings", type: "CURRENT", opening: 50000, bankName: "HDFC Bank", accountNumber: "50200012345678" },
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
      date: new Date("2026-09-12"), totalKg: 1250, notes: "Cherry, first lot", billNo: "P-001",
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

  // Create fixings
  await prisma.fixing.createMany({
    data: [
      { lotId: p1.id, date: new Date("2026-09-14"), kg: 500, rate: 268, notes: "1st tranche" },
      { lotId: p1.id, date: new Date("2026-09-21"), kg: 400, rate: 274, notes: "2nd tranche" },
      { lotId: p2.id, date: new Date("2026-09-19"), kg: 200, rate: 642, notes: "Partial" },
      { lotId: s1.id, date: new Date("2026-09-20"), kg: 800, rate: 312, notes: "Full lot" },
      { lotId: p3.id, date: new Date("2026-09-26"), kg: 300, rate: 270, notes: "First fix" },
      { lotId: s3.id, date: new Date("2026-09-27"), kg: 500, rate: 315, notes: "Export rate" },
      { lotId: p4.id, date: new Date("2026-09-28"), kg: 150, rate: 645, notes: "Partial" },
    ],
  });
  console.log("Created fixings");

  // Create payments
  await prisma.payment.createMany({
    data: [
      {
        partyId: ramesh.id, date: new Date("2026-09-15"), amount: 80000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: "PAY-001", notes: "Part payment P-001",
      },
      {
        partyId: kodagu.id, date: new Date("2026-09-23"), amount: 150000,
        direction: "RECEIVE", tradeType: "SALE", fundId: current.id,
        billNo: "PAY-002", notes: "Part receipt S-001",
      },
      {
        partyId: arun.id, date: new Date("2026-09-26"), amount: 50000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: "PAY-003", notes: "Advance for P-003",
      },
      {
        partyId: meena.id, date: new Date("2026-09-27"), amount: 120000,
        direction: "RECEIVE", tradeType: "SALE", fundId: current.id,
        billNo: "PAY-004", notes: "Full receipt S-003",
      },
      {
        partyId: soma.id, date: new Date("2026-09-28"), amount: 30000,
        direction: "PAY", tradeType: "PURCHASE", fundId: cash.id,
        billNo: "PAY-005", notes: "Part payment P-004",
      },
    ],
  });
  console.log("Created payments");

  // Create loans
  await prisma.loan.createMany({
    data: [
      {
        partyId: lakshmi.id, date: new Date("2026-09-10"), amount: 25000,
        kind: "LOAN_GIVEN", fundId: cash.id, notes: "Personal loan, not against goods",
      },
      {
        partyId: arun.id, date: new Date("2026-09-20"), amount: 15000,
        kind: "ADVANCE_GIVEN", fundId: current.id, itemId: coffee!.id,
        purpose: "trade_advance", notes: "Advance against P-003",
      },
      {
        partyId: meena.id, date: new Date("2026-09-25"), amount: 50000,
        kind: "LOAN_TAKEN", fundId: current.id, notes: "Short term loan",
      },
    ],
  });
  console.log("Created loans");

  console.log("Seed complete!");
  console.log("Login with: admin@hilltrade.com / admin12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
