import crypto from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = "enc:";

// Derive guaranteed 32-byte key from ENCRYPTION_KEY
function getDerivedKey(): Buffer {
  return crypto.createHash("sha256").update(config.ENCRYPTION_KEY).digest();
}

/**
 * Encrypt sensitive plain text using AES-256-GCM.
 * Output format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext || typeof plaintext !== "string") return null;
  // If already encrypted, avoid double encryption
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}${iv.toString("hex")}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt AES-256-GCM encrypted string.
 * Gracefully returns original string if it is not encrypted.
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText || typeof encryptedText !== "string") return null;
  if (!encryptedText.startsWith(PREFIX)) return encryptedText;

  const parts = encryptedText.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format: expected iv:authTag:ciphertext");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Returns a masked representation of an account number for safe display.
 * E.g., "50200012345678" -> "•••• •••• 5678"
 */
export function maskAccountNumber(accountNumber: string | null | undefined): string | null {
  if (!accountNumber) return null;

  // Decrypt if it's currently encrypted
  const plain = isEncrypted(accountNumber) ? decrypt(accountNumber) : accountNumber;
  if (!plain) return null;

  const clean = plain.trim();
  if (clean.length <= 4) return "••••";

  const last4 = clean.slice(-4);
  const maskedLength = clean.length - 4;
  const dots = "•".repeat(Math.min(8, maskedLength));
  return `${dots} ${last4}`;
}

/**
 * Checks if a string is encrypted with our prefix.
 */
export function isEncrypted(text: string | null | undefined): boolean {
  return typeof text === "string" && text.startsWith(PREFIX);
}
