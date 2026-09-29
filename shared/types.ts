// Shared API types used by both server and client

export type Role = "USER" | "ADMIN";
export type PartyRole = "SUPPLIER" | "BUYER" | "BOTH";
export type FundType = "CASH" | "CURRENT" | "CC";
export type LotKind = "PURCHASE" | "SALE";
export type Direction = "PAY" | "RECEIVE";
export type TradeType = "PURCHASE" | "SALE";
export type LoanKind = "LOAN_GIVEN" | "LOAN_TAKEN" | "ADVANCE_GIVEN" | "ADVANCE_TAKEN";
export type LoanStatus = "ACTIVE" | "PARTIALLY_SETTLED" | "SETTLED";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface PartyDTO {
  id: string;
  name: string;
  phone: string | null;
  role: PartyRole;
  place: string | null;
  address: string | null;
  createdAt: string;
}

export interface ItemDTO {
  id: string;
  name: string;
  slug: string;
}

export interface FundDTO {
  id: string;
  name: string;
  type: FundType;
  opening: string;
  bankName: string | null;
  accountNumber: string | null;
  accountNumberMasked: string | null;
  balance: string;
}

export interface LotDTO {
  id: string;
  kind: LotKind;
  partyId: string;
  partyName: string;
  itemId: string;
  itemName: string;
  date: string;
  totalKg: string;
  grossWeightKg?: string | null;
  bagCount?: number | null;
  bagTareKg?: string | null;
  moisturePercent?: string | null;
  driageDeductionKg?: string | null;
  notes: string | null;
  billNo: string | null;
  pricedKg: string;
  unpricedKg: string;
  fixingValue: string;
}

export interface FixingDTO {
  id: string;
  lotId: string;
  date: string;
  kg: string;
  rate: string;
  notes: string | null;
}

export interface PaymentDTO {
  id: string;
  partyId: string;
  partyName: string;
  date: string;
  amount: string;
  advanceDeducted?: string | null;
  grossAmount?: string | null;
  direction: Direction;
  tradeType: TradeType;
  fundId: string;
  fundName: string;
  billNo: string;
  itemId: string | null;
  priceKg: string | null;
  rate: string | null;
  method: string | null;
  notes: string | null;
}

export interface LoanDTO {
  id: string;
  partyId: string;
  partyName: string;
  date: string;
  amount: string;
  balanceAmount: string;
  status: LoanStatus;
  kind: LoanKind;
  fundId: string;
  fundName: string;
  itemId: string | null;
  itemName: string | null;
  method: string | null;
  purpose: string | null;
  notes: string | null;
}

export interface AdvanceAdjustmentDTO {
  id: string;
  paymentId: string;
  loanId: string;
  amount: string;
  date: string;
  notes: string | null;
}

export interface LoanRepaymentDTO {
  id: string;
  loanId: string;
  fundId: string;
  fundName: string;
  amount: string;
  date: string;
  method: string | null;
  notes: string | null;
}

export interface DashboardData {
  cash: string;
  bank: string;
  toGet: string;
  toPay: string;
  funds: FundDTO[];
  unpriced: Record<string, string>;
  stock: Record<string, string>;
  items: ItemDTO[];
  parties: PartySummaryDTO[];
}

export interface PartySummaryDTO {
  id: string;
  name: string;
  role: PartyRole;
  place: string | null;
  unpricedByItem: Record<string, string>;
  outstanding: string;
  settled: boolean;
}

export interface LedgerRow {
  date: string;
  particular: string;
  debit: string;
  credit: string;
  balance: string;
  kind: "lot" | "pay";
}

export interface PartyLedger {
  party: PartyDTO;
  rows: LedgerRow[];
  totalPaid: string;
  totalReceived: string;
  net: string;
  settled: boolean;
  unpricedByItem: Record<string, string>;
  quantitiesByItem: Record<string, { boughtKg: string; soldKg: string }>;
}

export interface PnLReport {
  from: string;
  to: string;
  salesIncome: string;
  purchaseExpense: string;
  grossProfit: string;
  loanGiven: string;
  loanTaken: string;
  advGiven: string;
  advTaken: string;
  otherIncome: string;
  otherExpense: string;
  netProfit: string;
  cashIn: string;
  cashOut: string;
  closingCash: string;
  payCount: number;
  loanCount: number;
}

export interface BalanceSheetReport {
  from: string;
  to: string;
  assets: {
    cash: string;
    loansGiven: string;
    advancesGiven: string;
  };
  liabilities: {
    overdraft: string;
    loansTaken: string;
    advancesTaken: string;
  };
  totalAssets: string;
  totalLiab: string;
  equity: string;
}

export interface PartyBill {
  party: PartyDTO;
  outstanding: string;
  settled: boolean;
  totalPaid: string;
  totalReceived: string;
  realizedPurchases: PaymentDTO[];
  realizedSales: PaymentDTO[];
  goodsOnFile: LotDTO[];
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
