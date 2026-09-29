import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";
import { signToken, verifyToken, type TokenPayload } from "../src/auth/jwt.js";
import { requireAuth } from "../src/auth/middleware.js";
import { ApiError } from "../src/lib/errorHandler.js";
import { encrypt, decrypt, maskAccountNumber, isEncrypted } from "../src/lib/crypto.js";

describe("JWT Authentication & Token Security", () => {
  const samplePayload: TokenPayload = {
    userId: "usr_12345",
    email: "trader@hilltrade.com",
    role: "ADMIN",
  };

  it("successfully signs and verifies a valid token", () => {
    const token = signToken(samplePayload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.email).toBe(samplePayload.email);
    expect(decoded.role).toBe(samplePayload.role);
  });

  it("rejects a tampered token", () => {
    const token = signToken(samplePayload);
    const tampered = token.slice(0, -6) + "xxxxxx";
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("rejects an empty or malformed token string", () => {
    expect(() => verifyToken("invalid-token-string")).toThrow();
  });
});

describe("Authentication Middleware", () => {
  it("throws 401 ApiError if Authorization header is missing", () => {
    const req: any = { headers: {} };
    const res: any = {};
    const next = () => {};

    expect(() => requireAuth(req, res, next)).toThrowError(ApiError);
    try {
      requireAuth(req, res, next);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Authentication required");
    }
  });

  it("throws 401 ApiError if Authorization header does not start with Bearer", () => {
    const req: any = { headers: { authorization: "Basic dXNlcjpwYXNz" } };
    const res: any = {};
    const next = () => {};

    expect(() => requireAuth(req, res, next)).toThrowError(ApiError);
  });

  it("throws 401 ApiError if Bearer token is invalid", () => {
    const req: any = { headers: { authorization: "Bearer invalid.token.payload" } };
    const res: any = {};
    const next = () => {};

    expect(() => requireAuth(req, res, next)).toThrowError(ApiError);
  });

  it("attaches decoded user to req and calls next() on valid token", () => {
    const token = signToken({ userId: "u1", email: "admin@hilltrade.com", role: "ADMIN" });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    requireAuth(req, res, next);
    expect(nextCalled).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe("u1");
  });
});

describe("Password Security with bcrypt", () => {
  it("hashes password with salt and successfully verifies", async () => {
    const password = "secureTradePass2026";
    const hashed = await bcrypt.hash(password, 10);

    expect(hashed).not.toBe(password);
    const match = await bcrypt.compare(password, hashed);
    expect(match).toBe(true);

    const wrongMatch = await bcrypt.compare("wrongPassword", hashed);
    expect(wrongMatch).toBe(false);
  });
});

describe("Bank Detail Encryption (AES-256-GCM) & Masking", () => {
  const plainAccount = "50200012345678";

  it("encrypts and decrypts bank account numbers accurately", () => {
    const cipher = encrypt(plainAccount);
    expect(cipher).toBeDefined();
    expect(typeof cipher).toBe("string");
    expect(cipher!.startsWith("enc:")).toBe(true);
    expect(cipher).not.toBe(plainAccount);

    const decrypted = decrypt(cipher);
    expect(decrypted).toBe(plainAccount);
  });

  it("detects encryption prefix accurately with isEncrypted", () => {
    const cipher = encrypt(plainAccount);
    expect(isEncrypted(cipher)).toBe(true);
    expect(isEncrypted(plainAccount)).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("prevents double encryption if string is already encrypted", () => {
    const cipher1 = encrypt(plainAccount);
    const cipher2 = encrypt(cipher1);
    expect(cipher2).toBe(cipher1);
  });

  it("fails to decrypt tampered ciphertext or auth tag", () => {
    const cipher = encrypt(plainAccount)!;
    const parts = cipher.split(":");
    // Corrupt ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}ff`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("handles unencrypted legacy plain text gracefully in decrypt", () => {
    expect(decrypt("1234567890")).toBe("1234567890");
    expect(decrypt(null)).toBeNull();
  });

  it("masks account numbers securely for display", () => {
    // Plain account masking
    expect(maskAccountNumber("50200012345678")).toBe("•••••••• 5678");

    // Encrypted account masking (decrypts internally before masking)
    const cipher = encrypt("50200012345678");
    expect(maskAccountNumber(cipher)).toBe("•••••••• 5678");

    // Short account masking
    expect(maskAccountNumber("123")).toBe("••••");
    expect(maskAccountNumber(null)).toBeNull();
  });
});

