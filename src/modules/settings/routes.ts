import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { getCompanyInfo } from "../../lib/company.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const companySchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  tagline: z.string().trim().max(120).default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN must be a valid 15-character GST number")
    .or(z.literal("")),
  address: z.string().trim().max(200).default(""),
  state: z.string().trim().max(60).default(""),
  stateCode: z.string().trim().regex(/^[0-9]{2}$/, "State code must be 2 digits").or(z.literal("")),
  phone: z.string().trim().regex(/^[0-9+\- ]{8,15}$/, "Phone must be 8–15 digits").or(z.literal("")),
  bankName: z.string().trim().max(120).nullable().optional(),
  bankAccount: z.string().trim().max(30).nullable().optional(),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must be a valid 11-character code")
    .or(z.literal(""))
    .nullable()
    .optional(),
});

settingsRouter.get("/company", async (_req, res, next) => {
  try {
    res.json(await getCompanyInfo());
  } catch (err) {
    next(err);
  }
});

settingsRouter.put("/company", async (req, res, next) => {
  try {
    const data = companySchema.parse(req.body);
    const existing = await prisma.companyInfo.findFirst({ orderBy: { id: "asc" } });
    const row = existing
      ? await prisma.companyInfo.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            tagline: data.tagline,
            gstin: data.gstin,
            address: data.address,
            state: data.state,
            stateCode: data.stateCode,
            phone: data.phone,
            bankName: data.bankName || null,
            bankAccount: data.bankAccount || null,
            bankIfsc: data.bankIfsc || null,
          },
        })
      : await prisma.companyInfo.create({
          data: {
            name: data.name,
            tagline: data.tagline,
            gstin: data.gstin,
            address: data.address,
            state: data.state,
            stateCode: data.stateCode,
            phone: data.phone,
            bankName: data.bankName || null,
            bankAccount: data.bankAccount || null,
            bankIfsc: data.bankIfsc || null,
          },
        });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
