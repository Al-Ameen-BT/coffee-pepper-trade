import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import type { PartyDTO } from "../../../shared/types.js";

export const partiesRouter = Router();
partiesRouter.use(requireAuth);

const partySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["SUPPLIER", "BUYER", "BOTH"]),
  place: z.string().optional(),
  address: z.string().optional(),
});

function toDTO(p: { id: string; name: string; phone: string | null; role: string; place: string | null; address: string | null; createdAt: Date }): PartyDTO {
  return { id: p.id, name: p.name, phone: p.phone, role: p.role as PartyDTO["role"], place: p.place, address: p.address, createdAt: p.createdAt.toISOString() };
}

partiesRouter.get("/", async (_req, res, next) => {
  try {
    const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });
    res.json(parties.map(toDTO));
  } catch (err) { next(err); }
});

partiesRouter.post("/", async (req, res, next) => {
  try {
    const data = partySchema.parse(req.body);
    const party = await prisma.party.create({ data });
    res.status(201).json(toDTO(party));
  } catch (err) { next(err); }
});

partiesRouter.get("/:id", async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.id } });
    if (!party) throw new ApiError(404, "Party not found");
    res.json(toDTO(party));
  } catch (err) { next(err); }
});

partiesRouter.put("/:id", async (req, res, next) => {
  try {
    const data = partySchema.partial().parse(req.body);
    const party = await prisma.party.update({ where: { id: req.params.id }, data });
    res.json(toDTO(party));
  } catch (err) { next(err); }
});

partiesRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.party.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});
