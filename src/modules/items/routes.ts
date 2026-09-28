import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { requireAuth } from "../../auth/middleware.js";
import { ApiError } from "../../lib/errorHandler.js";
import type { ItemDTO } from "../../../shared/types.js";

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().min(1),
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

function toDTO(i: { id: string; name: string; slug: string }): ItemDTO {
  return { id: i.id, name: i.name, slug: i.slug };
}

// Default items seeded on first run
const DEFAULT_ITEMS = [
  { name: "Cherry Coffee", slug: "cherry-coffee" },
  { name: "Coffee Beans", slug: "coffee-beans" },
  { name: "Coffee", slug: "coffee" },
  { name: "Black Pepper", slug: "pepper" },
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
    const { name } = itemSchema.parse(req.body);
    const existing = await prisma.item.findMany();
    if (existing.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, "Item with this name already exists");
    }
    const slug = uniqueSlug(slugify(name), existing.map((i) => i.slug));
    const item = await prisma.item.create({ data: { name, slug } });
    res.status(201).json(toDTO(item));
  } catch (err) { next(err); }
});
