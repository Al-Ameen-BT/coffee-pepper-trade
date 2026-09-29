/**
 * Client-side crypto and sensitive data masking utilities.
 */

export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return "—";
  const clean = accountNumber.trim();
  if (clean.length <= 4) return "••••";
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Basic payload obfuscation / hash verification for client transmission
 */
export async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
