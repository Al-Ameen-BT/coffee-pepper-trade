const fs = require('fs');

function patchSchema(file, isMysql) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Add to Fixing
  const fixingPatch = isMysql 
    ? `  rate      Decimal  @db.Decimal(12, 2)
  tcsRate   Decimal? @db.Decimal(5, 2)
  tcsAmount Decimal? @db.Decimal(14, 2)
  tdsRate   Decimal? @db.Decimal(5, 2)
  tdsAmount Decimal? @db.Decimal(14, 2)
  billNo    String?  @unique`
    : `  rate      Decimal
  tcsRate   Decimal?
  tcsAmount Decimal?
  tdsRate   Decimal?
  tdsAmount Decimal?
  billNo    String?  @unique`;
  
  const fixingMatch = isMysql ? /  rate\s+Decimal\s+@db\.Decimal\(12, 2\)/ : /  rate\s+Decimal/;
  if(!content.includes('tcsRate')) {
    content = content.replace(fixingMatch, fixingPatch);
  }
  
  // Add relation to Fund
  const fundMatch = /  repayments    LoanRepayment\[\]\n\}/;
  if(!content.includes('otherTransactions')) {
    content = content.replace(fundMatch, `  repayments    LoanRepayment[]\n  otherTransactions OtherTransaction[]\n}`);
  }

  // Add models
  const models = isMysql ? `
model BillSequence {
  id            String @id @default(cuid())
  prefix        String
  financialYear String
  lastNumber    Int    @default(0)
  
  @@unique([prefix, financialYear])
}

model OtherTransaction {
  id          String         @id @default(cuid())
  type        OtherTxnType
  category    String
  amount      Decimal        @db.Decimal(14, 2)
  fundId      String
  fund        Fund           @relation(fields: [fundId], references: [id])
  date        DateTime       @db.Date
  billNo      String?
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  
  @@index([fundId])
  @@index([date])
}

model CompanyInfo {
  id          String  @id @default(cuid())
  name        String
  tagline     String
  gstin       String
  address     String
  state       String
  stateCode   String
  phone       String
  bankName    String?
  bankAccount String?
  bankIfsc    String?
}

enum OtherTxnType {
  EXPENSE
  INCOME
}
` : `
model BillSequence {
  id            String @id @default(cuid())
  prefix        String
  financialYear String
  lastNumber    Int    @default(0)
  
  @@unique([prefix, financialYear])
}

model OtherTransaction {
  id          String         @id @default(cuid())
  type        OtherTxnType
  category    String
  amount      Decimal
  fundId      String
  fund        Fund           @relation(fields: [fundId], references: [id])
  date        DateTime
  billNo      String?
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  
  @@index([fundId])
  @@index([date])
}

model CompanyInfo {
  id          String  @id @default(cuid())
  name        String
  tagline     String
  gstin       String
  address     String
  state       String
  stateCode   String
  phone       String
  bankName    String?
  bankAccount String?
  bankIfsc    String?
}

enum OtherTxnType {
  EXPENSE
  INCOME
}
`;

  if(!content.includes('model BillSequence')) {
    content += models;
  }
  
  fs.writeFileSync(file, content);
}

patchSchema('prisma/schema.mysql.prisma', true);
patchSchema('prisma/schema.prisma', true);
patchSchema('prisma/schema.sqlite.prisma', false);
