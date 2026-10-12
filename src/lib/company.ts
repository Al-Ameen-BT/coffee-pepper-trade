import { prisma } from "../db.js";
import type { CompanyInfoDTO } from "../../shared/types.js";

// Printed identity of the business — used when no CompanyInfo row exists yet.
export const COMPANY_DEFAULTS: CompanyInfoDTO = {
  name: "UZHUNNUNGAL TRADERS",
  tagline: "Hill Produce Dealer",
  gstin: "32APFPJ6004B1ZP",
  address: "KARIAMBADI P.O., WAYANAD DT., KERALA - 673591",
  state: "Kerala",
  stateCode: "32",
  phone: "9447204847",
  bankName: null,
  bankAccount: null,
  bankIfsc: null,
};

export async function getCompanyInfo(): Promise<CompanyInfoDTO> {
  const row = await prisma.companyInfo.findFirst({ orderBy: { id: "asc" } });
  if (!row) return COMPANY_DEFAULTS;
  return {
    name: row.name,
    tagline: row.tagline,
    gstin: row.gstin,
    address: row.address,
    state: row.state,
    stateCode: row.stateCode,
    phone: row.phone,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    bankIfsc: row.bankIfsc,
  };
}
