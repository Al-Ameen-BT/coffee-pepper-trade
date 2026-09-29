import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { wafMiddleware, createRateLimiter } from "../src/middleware/waf.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(wafMiddleware);
  app.get("/api/test", (_req, res) => res.json({ ok: true }));
  app.post("/api/test", (req, res) => res.json({ received: req.body }));
  return app;
}

describe("Web Application Firewall (WAF) & Bot Defense", () => {
  const app = createTestApp();

  describe("Malicious User-Agent Blocking", () => {
    it("allows legitimate browser User-Agents", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("blocks sqlmap automated scanning bot", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("User-Agent", "sqlmap/1.6#stable (https://sqlmap.org)");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("suspicious user agent");
    });

    it("blocks nikto scanner bot", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("User-Agent", "Mozilla/5.00 (Nikto/2.1.6)");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("suspicious user agent");
    });

    it("blocks masscan / gobuster bot", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("User-Agent", "gobuster/3.1.0");
      expect(res.status).toBe(403);
    });
  });

  describe("Probing / Exploit Path Blocking", () => {
    it("blocks requests probing for .env files", async () => {
      const res = await request(app).get("/.env");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("prohibited resource probe");
    });

    it("blocks requests probing for WordPress wp-login.php", async () => {
      const res = await request(app).get("/wp-login.php");
      expect(res.status).toBe(403);
    });

    it("blocks requests probing for phpmyadmin", async () => {
      const res = await request(app).get("/phpmyadmin/index.php");
      expect(res.status).toBe(403);
    });

    it("blocks requests probing for cgi-bin vulnerabilities", async () => {
      const res = await request(app).get("/cgi-bin/test-cgi");
      expect(res.status).toBe(403);
    });
  });

  describe("Honeypot Bot Trap", () => {
    it("blocks submissions where honeypot field is filled by an automated bot", async () => {
      const res = await request(app)
        .post("/api/test")
        .send({ email: "bot@target.com", hp_field: "spambot" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("automated bot detected");
    });

    it("allows submissions where honeypot field is empty (normal user)", async () => {
      const res = await request(app)
        .post("/api/test")
        .send({ email: "human@target.com", hp_field: "" });
      expect(res.status).toBe(200);
    });
  });

  describe("Exploit Payload Inspection", () => {
    it("blocks SQL injection payloads in JSON body", async () => {
      const res = await request(app)
        .post("/api/test")
        .send({ query: "1' UNION SELECT username, password FROM users --" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("malicious payload detected");
    });

    it("blocks XSS script tags in JSON body", async () => {
      const res = await request(app)
        .post("/api/test")
        .send({ notes: "<script>alert('xss')</script>" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("malicious payload detected");
    });

    it("blocks path traversal payloads in query parameters", async () => {
      const res = await request(app).get("/api/test?file=../../../../etc/passwd");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("malicious payload detected");
    });
  });

  describe("Rate Limiter", () => {
    it("throttles requests when limit is exceeded", async () => {
      const testLimiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        message: "Test limit exceeded",
        skipInTests: false, // force running in test
      });

      const rateLimitApp = express();
      rateLimitApp.use(testLimiter);
      rateLimitApp.get("/rate-test", (_req, res) => res.json({ ok: true }));

      // Requests 1, 2, 3 should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(rateLimitApp).get("/rate-test");
        expect(res.status).toBe(200);
      }

      // 4th request should be throttled
      const blockedRes = await request(rateLimitApp).get("/rate-test");
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBe("Test limit exceeded");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
    });
  });
});
