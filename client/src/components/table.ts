// Shared table rendering helpers

import { esc } from "../format.js";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => string;
}

export function renderTable<T extends Record<string, unknown>>(
  data: T[],
  columns: Column<T>[],
  emptyMessage = "No records found.",
): string {
  if (data.length === 0) return `<div class="empty">${esc(emptyMessage)}</div>`;

  const headers = columns
    .map((c) => `<th class="${c.align === "right" ? "num" : ""}">${esc(c.label)}</th>`)
    .join("");

  const rows = data
    .map((row) => {
      const cells = columns
        .map((c) => {
          const val = c.render ? c.render(row) : esc(String(row[c.key] ?? ""));
          return `<td class="${c.align === "right" ? "num" : ""}">${val}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}
