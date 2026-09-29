import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { authRouter } from "../src/auth/routes.js";
import { errorHandler } from "../src/lib/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use(errorHandler);

describe("Auth Routes (/api/v1/auth/login)", () => {
  it("successfully logs in with valid admin credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@hilltrade.com", password: "admin12345" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("admin@hilltrade.com");
    expect(res.body.user.role).toBe("USER");
  });

  it("successfully logs in with valid standard user credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user@hilltrade.com", password: "user12345" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("user@hilltrade.com");
    expect(res.body.user.role).toBe("USER");
  });

  it("returns 401 when given an incorrect password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@hilltrade.com", password: "wrongPassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("returns 401 when given a non-existent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@hilltrade.com", password: "somePassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("can fetch dashboard data after logging in", async () => {
    const { dashboardRouter } = await import("../src/modules/statements/routes.js");
    app.use("/api/v1/dashboard", dashboardRouter);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@hilltrade.com", password: "admin12345" });

    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    const dashRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.cash).toBeDefined();
    expect(dashRes.body.bank).toBeDefined();
    expect(dashRes.body.parties).toBeInstanceOf(Array);
  });
});

