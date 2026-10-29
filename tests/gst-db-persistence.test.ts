import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { itemsRouter } from "../src/modules/items/routes.js";
import { errorHandler } from "../src/lib/errorHandler.js";
import { prisma } from "../src/db.js";
import { signToken } from "../src/auth/jwt.js";

function createItemsApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/items", itemsRouter);
  app.use(errorHandler);
  return app;
}

describe("GST Values DB Persistence and Calculations", () => {
  const app = createItemsApp();
  const token = signToken({ userId: "test-user", email: "trader@test.com", role: "ADMIN" });
  const authHeader = `Bearer ${token}`;

  let targetItemId: string;
  let initialCgst: number;
  let initialHsn: string;

  beforeAll(async () => {
    // Ensure default items exist
    const items = await prisma.item.findMany();
    if (items.length > 0) {
      targetItemId = items[0].id;
      initialCgst = items[0].cgstRate ?? 2.5;
      initialHsn = items[0].hsnCode ?? "0901";
    }
  });

  afterAll(async () => {
    // Restore original values
    if (targetItemId) {
      await prisma.item.update({
        where: { id: targetItemId },
        data: { cgstRate: initialCgst, hsnCode: initialHsn },
      });
    }
    await prisma.$disconnect();
  });

  it("fetches items from DB with correct initial GST fields", async () => {
    const res = await request(app)
      .get("/api/v1/items")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const first = res.body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("hsnCode");
    expect(first).toHaveProperty("cgstRate");
    expect(first).toHaveProperty("sgstRate");
    expect(first).toHaveProperty("gstRate");
    expect(first.gstRate).toBe(first.cgstRate + first.sgstRate);
  });

  it("updates an item's GST and HSN values in the database via PUT", async () => {
    const newTotalGst = 18; // 18% GST (9% CGST + 9% SGST)
    const newCgst = 9;
    const newHsn = "0901-UPDATED";

    const updateRes = await request(app)
      .put(`/api/v1/items/${targetItemId}`)
      .set("Authorization", authHeader)
      .send({
        hsnCode: newHsn,
        cgstRate: newCgst,
        gstRate: newTotalGst,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.cgstRate).toBe(9);
    expect(updateRes.body.sgstRate).toBe(9);
    expect(updateRes.body.gstRate).toBe(18);
    expect(updateRes.body.hsnCode).toBe(newHsn);

    // Verify directly in Prisma SQLite DB
    const dbItem = await prisma.item.findUnique({
      where: { id: targetItemId },
    });
    expect(dbItem).not.toBeNull();
    expect(dbItem?.cgstRate).toBe(9);
    expect(dbItem?.hsnCode).toBe(newHsn);
  });

  it("persists 12% GST rate when selected via total gstRate", async () => {
    const updateRes = await request(app)
      .put(`/api/v1/items/${targetItemId}`)
      .set("Authorization", authHeader)
      .send({
        gstRate: 12,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.cgstRate).toBe(6);
    expect(updateRes.body.sgstRate).toBe(6);
    expect(updateRes.body.gstRate).toBe(12);

    const dbItem = await prisma.item.findUnique({
      where: { id: targetItemId },
    });
    expect(dbItem?.cgstRate).toBe(6);
  });

  it("persists 0% GST (Tax Exempt) accurately in DB", async () => {
    const updateRes = await request(app)
      .put(`/api/v1/items/${targetItemId}`)
      .set("Authorization", authHeader)
      .send({
        cgstRate: 0,
        gstRate: 0,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.cgstRate).toBe(0);
    expect(updateRes.body.sgstRate).toBe(0);
    expect(updateRes.body.gstRate).toBe(0);

    const dbItem = await prisma.item.findUnique({
      where: { id: targetItemId },
    });
    expect(dbItem?.cgstRate).toBe(0);
  });
});
