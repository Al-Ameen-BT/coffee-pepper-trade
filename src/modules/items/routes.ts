import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import type { ItemDTO } from "../../../shared/types.js";

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const itemCreateSchema = z.object({
  name: z.string().min(1),
  hsnCode: z.string().optional(),
  cgstRate: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(100).optional(),
});

const itemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  hsnCode: z.string().optional(),
  cgstRate: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(100).optional(),
});

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function uniqueSlug(base: string, existing: string[]): string {
  let slug = base;
  let n = 2;
  while (existing.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}

function toDTO(i: { id: string; name: string; slug: string; hsnCode?: string | null; cgstRate?: number | null }): ItemDTO {
  const cgst = Number(i.cgstRate ?? 2.5);
  return {
    id: i.id,
    name: i.name,
    slug: i.slug,
    hsnCode: i.hsnCode || "",
    cgstRate: cgst,
    sgstRate: cgst,
    gstRate: Math.round(cgst * 2 * 100) / 100,
  };
}

// Default items seeded on first run
const DEFAULT_ITEMS = [
  { name: "Cherry Coffee", slug: "cherry-coffee", hsnCode: "0901", cgstRate: 2.5 },
  { name: "Coffee Beans", slug: "coffee-beans", hsnCode: "0901", cgstRate: 2.5 },
  { name: "Coffee", slug: "coffee", hsnCode: "0901", cgstRate: 2.5 },
  { name: "Black Pepper", slug: "pepper", hsnCode: "0904", cgstRate: 2.5 },
];

itemsRouter.get("/", async (_req, res, next) => {
  try {
    let items = await prisma.item.findMany({ orderBy: { name: "asc" } });
    if (items.length === 0) {
      for (const item of DEFAULT_ITEMS) {
        await prisma.item.create({ data: item });
      }
      items = await prisma.item.findMany({ orderBy: { name: "asc" } });
    }
    res.json(items.map(toDTO));
  } catch (err) { next(err); }
});

itemsRouter.post("/", async (req, res, next) => {
  try {
    const data = itemCreateSchema.parse(req.body);
    const existing = await prisma.item.findMany();
    if (existing.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
      throw new ApiError(409, "Item with this name already exists");
    }

    const calculatedCgst = data.cgstRate !== undefined
      ? data.cgstRate
      : data.gstRate !== undefined
      ? data.gstRate / 2
      : 2.5;

    const slug = uniqueSlug(slugify(data.name), existing.map((i) => i.slug));
    const item = await prisma.item.create({
      data: {
        name: data.name.trim(),
        slug,
        hsnCode: (data.hsnCode || "").trim(),
        cgstRate: Math.round(calculatedCgst * 100) / 100,
      },
    });
    res.status(201).json(toDTO(item));
  } catch (err) { next(err); }
});

itemsRouter.put("/:id", async (req, res, next) => {
  try {
    const data = itemUpdateSchema.parse(req.body);
    const existing = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Product not found");

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.item.findFirst({
        where: { name: { equals: data.name }, id: { not: req.params.id } },
      });
      if (duplicate) throw new ApiError(409, "Another product with this name already exists");
    }

    let calculatedCgst = existing.cgstRate;
    if (data.cgstRate !== undefined) {
      calculatedCgst = data.cgstRate;
    } else if (data.gstRate !== undefined) {
      calculatedCgst = data.gstRate / 2;
    }

    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.hsnCode !== undefined ? { hsnCode: data.hsnCode.trim() } : {}),
        cgstRate: Math.round(calculatedCgst * 100) / 100,
      },
    });

    res.json(toDTO(updated));
  } catch (err) { next(err); }
});

itemsRouter.delete("/:id", async (req, res, next) => {
  try {
    const [lotsCount, loansCount] = await Promise.all([
      prisma.lot.count({ where: { itemId: req.params.id } }),
      prisma.loan.count({ where: { itemId: req.params.id } }),
    ]);

    if (lotsCount > 0 || loansCount > 0) {
      throw new ApiError(400, "Cannot delete product that is used in existing trades or loans");
    }

    await prisma.item.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) { next(err); }
});
