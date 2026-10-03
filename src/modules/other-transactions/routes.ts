import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { getNextBillNo } from "../../lib/billSequence.js";

export const otherTxnRouter = Router();
otherTxnRouter.use(requireAuth);

const txnSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  category: z.string().min(1),
  amount: z.number().positive(),
  fundId: z.string().min(1),
  date: z.string(),
  description: z.string().optional(),
});

otherTxnRouter.get("/", async (req, res, next) => {
  try {
    const txns = await prisma.otherTransaction.findMany({
      include: { fund: true },
      orderBy: { date: "desc" },
    });
    res.json(txns.map(t => ({
      ...t,
      fundName: t.fund.name,
      amount: t.amount.toString(),
      date: t.date.toISOString().slice(0, 10),
    })));
  } catch (err) { next(err); }
});

otherTxnRouter.post("/", async (req, res, next) => {
  try {
    const data = txnSchema.parse(req.body);
    const prefix = data.type === "EXPENSE" ? "EXP" : "INC";
    const billNo = await getNextBillNo(prefix);

    const txn = await prisma.otherTransaction.create({
      data: {
        type: data.type,
        category: data.category,
        amount: data.amount,
        fundId: data.fundId,
        date: new Date(data.date),
        billNo,
        description: data.description || null,
      },
      include: { fund: true }
    });

    res.status(201).json({
      ...txn,
      fundName: txn.fund.name,
      amount: txn.amount.toString(),
      date: txn.date.toISOString().slice(0, 10),
    });
  } catch (err) { next(err); }
});
