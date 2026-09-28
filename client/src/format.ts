// Port of js/ui.js helpers

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] ?? c));
}

export function money(n: number | string): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return (v < 0 ? "-₹" : "₹") + abs;
}

export function kg(n: number | string): string {
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 }) + " kg";
}

export function fundType(t: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    current: "Current A/c",
    cc: "Cash Credit",
  };
  return map[t] || t;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d: string | Date): string {
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}
