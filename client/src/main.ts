import { api, getToken, setToken, clearToken } from "./api.js";
import { esc } from "./format.js";
import type { UserDTO } from "../../shared/types.js";
// print.css is linked from index.html (not a JS import) so the strict CSP
// style-src 'self' applies — Vite dev injects JS-imported CSS inline, which is blocked.

// ─── Router ───────────────────────────────────────────────────────────────────

type RouteHandler = () => void;

const routes: Record<string, RouteHandler> = {
  "/": () => import("./pages/dashboard.js").then((m) => m.render()),
  "/parties": () => import("./pages/parties.js").then((m) => m.render()),
  "/purchases": () => import("./pages/purchases.js").then((m) => m.render()),
  "/sales": () => import("./pages/sales.js").then((m) => m.render()),
  "/statements": () => import("./pages/statements.js").then((m) => m.render()),
  "/payments": () => import("./pages/payments.js").then((m) => m.render()),
  "/other-txn": () => import("./pages/other-txn.js").then((m) => m.render()),
  "/funds": () => import("./pages/funds.js").then((m) => m.render()),
  "/loans": () => import("./pages/loans.js").then((m) => m.render()),
  "/ledger": () => import("./pages/ledger.js").then((m) => m.render()),
  "/bills": () => import("./pages/bills.js").then((m) => m.render()),
  "/print-bill": () => import("./pages/print-bill.js").then((m) => m.render()),
  "/print-statement": () => import("./pages/print-statement.js").then((m) => m.render()),
  "/bill-book": () => import("./pages/bill-book.js").then((m) => m.render()),
  "/bill-register": () => import("./pages/bill-register.js").then((m) => m.render()),
  "/invoice/new": () => import("./pages/invoice-new.js").then((m) => m.render()),
  "/gst": () => import("./pages/gst.js").then((m) => m.render()),
  "/items": () => import("./pages/gst.js").then((m) => m.render()),
  "/settings": () => import("./pages/settings.js").then((m) => m.render()),
};

function currentPath(): string {
  return window.location.pathname;
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
  render();
}

export function routerNavigate(path: string): void {
  navigate(path);
}

// ─── App shell ────────────────────────────────────────────────────────────────

const NAV_GROUPS: { label: string | null; links: { path: string; label: string }[] }[] = [
  { label: null, links: [{ path: "/", label: "Dashboard" }] },
  {
    label: "Trade",
    links: [
      { path: "/purchases", label: "Purchases" },
      { path: "/sales", label: "Sales" },
    ],
  },
  {
    label: "Money",
    links: [
      { path: "/payments", label: "Trade Payments" },
      { path: "/funds", label: "Cash & Bank" },
      { path: "/loans", label: "Loans & Advances" },
      { path: "/other-txn", label: "Other Expense / Other Income" },
    ],
  },
  {
    label: "People",
    links: [
      { path: "/parties", label: "Parties" },
      { path: "/ledger", label: "Personal Ledger" },
    ],
  },
  {
    label: "Invoices & Reports",
    links: [
      { path: "/bill-register", label: "Invoices Register" },
      { path: "/print-bill?kind=PURCHASE", label: "Purchase Invoice" },
      { path: "/print-bill?kind=SALE", label: "Tax Invoice Cum Bill of Supply" },
      { path: "/bill-book", label: "Blank Bill Book (Manual)" },
      { path: "/bills", label: "Party Statements" },
      { path: "/statements", label: "Financial Statements" },
    ],
  },
  {
    label: "System",
    links: [
      { path: "/gst", label: "GST Customisation" },
      { path: "/settings", label: "Company Settings" },
    ],
  },
];

export function renderShell(content: string): void {
  const path = currentPath();
  const fullLoc = window.location.pathname + window.location.search;
  const nav = NAV_GROUPS.map((g) => {
    const links = g.links
      .map(
        (l) => {
          const lBase = l.path.split("?")[0];
          const isActive = l.path.includes("?") ? fullLoc === l.path : path === lBase;
          return `<a href="${l.path}" class="${isActive ? "active" : ""}" ${isActive ? 'aria-current="page"' : ""} data-nav="${l.path}">${l.label}</a>`;
        },
      )
      .join("");
    return g.label ? `<div class="nav-label" aria-hidden="true">${g.label}</div>${links}` : links;
  }).join("");

  const active = NAV_GROUPS.flatMap((g) => g.links).find((l) => l.path.includes("?") ? fullLoc === l.path : l.path.split("?")[0] === path);
  document.title = active ? `${active.label} · Uzhunnungal Traders` : "Uzhunnungal Traders";

  document.getElementById("app")!.innerHTML = `
    <div class="app">
      <a href="#page" class="skip-link">Skip to content</a>
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">CP</div>
          <div>
            <h1>Uzhunnungal Traders</h1>
            <p>Hill Produce Dealer · Coffee · Black Pepper</p>
          </div>
        </div>
        <nav aria-label="Main navigation">${nav}</nav>
        <div class="sidebar-footer">
          <button id="logout-btn" class="logout-btn" type="button" title="Log out of application">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <main class="main" id="page" tabindex="-1">${content}</main>
    </div>
  `;

  // Intercept nav clicks
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate((el as HTMLElement).dataset.nav!);
    });
  });

  // Intercept logout click
  document.getElementById("logout-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function toast(message: string, type: "success" | "error" | "info" = "info"): void {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  // Errors assert themselves and stay until dismissed; success/info are polite and fade.
  el.setAttribute("role", type === "error" ? "alert" : "status");
  const text = document.createElement("span");
  text.textContent = message;
  el.appendChild(text);
  if (type === "error") {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss error");
    close.textContent = "×";
    close.addEventListener("click", () => el.remove());
    el.appendChild(close);
  } else {
    setTimeout(() => el.remove(), 4000);
  }
  container.appendChild(el);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

let modalLastFocused: HTMLElement | null = null;

function modalFocusables(modal: HTMLElement): HTMLElement[] {
  return Array.from(
    modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute("disabled"));
}

export function openModal(html: string): void {
  let bg = document.getElementById("global-modal-bg") as HTMLElement | null;
  if (!bg) {
    document.querySelectorAll(".modal-bg").forEach((el) => el.remove());
    bg = document.createElement("div");
    bg.id = "global-modal-bg";
    bg.className = "modal-bg";
    document.body.appendChild(bg);

    bg.addEventListener("click", (e) => {
      if (e.target === bg) {
        closeModal();
      }
    });
  }

  modalLastFocused = document.activeElement as HTMLElement | null;

  bg.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button type="button" class="modal-close-x" aria-label="Close dialog" title="Close (Esc)">&times;</button>
      ${html}
    </div>
  `;
  bg.classList.add("open");
  bg.style.display = "grid";

  const modal = bg.querySelector(".modal") as HTMLElement;

  // Name the dialog from its heading when one exists
  const heading = modal.querySelector("h3");
  if (heading) {
    if (!heading.id) heading.id = "modal-title";
    modal.setAttribute("aria-labelledby", heading.id);
  } else {
    modal.setAttribute("aria-label", "Dialog");
  }

  // Focus trap: keep Tab cycling inside the dialog
  bg.onkeydown = (e) => {
    if (e.key !== "Tab") return;
    const focusables = modalFocusables(modal);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      first.focus();
      e.preventDefault();
    }
  };

  // Initial focus: first field, else first focusable
  const initial = modal.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea") ?? modalFocusables(modal)[0];
  initial?.focus();

  // Bind close to all close and cancel buttons in the modal
  bg.querySelectorAll("button").forEach((btn) => {
    const text = btn.textContent?.trim().toLowerCase();
    const isCancel =
      text === "cancel" ||
      text === "close" ||
      text === "×" ||
      btn.classList.contains("modal-close-x") ||
      btn.hasAttribute("data-close-modal") ||
      (btn.getAttribute("type") === "button" && btn.classList.contains("secondary"));

    if (isCancel) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      };
    }
  });
}

export function closeModal(): void {
  document.querySelectorAll(".modal-bg").forEach((m) => {
    m.classList.remove("open");
    (m as HTMLElement).style.display = "none";
    (m as HTMLElement).onkeydown = null;
    m.innerHTML = "";
  });
  const bg = document.getElementById("global-modal-bg");
  if (bg) {
    bg.classList.remove("open");
    bg.style.display = "none";
    bg.onkeydown = null;
    bg.innerHTML = "";
  }
  if (modalLastFocused && document.contains(modalLastFocused)) {
    modalLastFocused.focus();
  }
  modalLastFocused = null;
}

// Universal back navigation that handles same-window history, tabs, and direct visits
export function goBack(fallbackUrl = "/bill-register"): void {
  const hasLocalReferrer = document.referrer && new URL(document.referrer, window.location.origin).origin === window.location.origin;

  if (hasLocalReferrer && window.history.length > 1) {
    window.history.back();
    return;
  }

  if (window.opener) {
    try { window.close(); return; } catch {}
  }

  // Attempt to close if opened as new tab
  try {
    window.close();
  } catch {}

  // Fallback to safe navigation if tab doesn't close
  setTimeout(() => {
    window.location.href = fallbackUrl;
  }, 100);
}

// Expose to global window object for inline onclick handlers (e.g. onclick="closeModal()" or onclick="goBack()")
(window as any).closeModal = closeModal;
(window as any).openModal = openModal;
(window as any).goBack = goBack;

// Close active modal on Escape key press
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

// Global capturing click listener for any cancel / close buttons anywhere in a modal
document.addEventListener(
  "click",
  (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest("button");
    if (!btn) return;

    const text = btn.textContent?.trim().toLowerCase();
    const isCancel =
      text === "cancel" ||
      text === "close" ||
      text === "×" ||
      btn.classList.contains("modal-close-x") ||
      btn.hasAttribute("data-close-modal");

    if (isCancel && btn.closest(".modal-bg, .modal")) {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
  },
  true,
);

// ─── Render ───────────────────────────────────────────────────────────────────

async function render(): Promise<void> {
  const path = currentPath();

  if (!getToken() && path !== "/login") {
    navigate("/login");
    return;
  }

  if (path === "/login") {
    const { renderLogin } = await import("./pages/login.js");
    renderLogin();
    return;
  }

  try {
    // Shareable digital bill: /bill/<id>
    if (path.startsWith("/bill/")) {
      const { render: renderDigitalBill } = await import("./pages/digital-bill.js");
      await renderDigitalBill();
      return;
    }

    // Shareable multi-line invoice: /invoice/<id>
    if (path.startsWith("/invoice/")) {
      const { render: renderInvoice } = await import("./pages/invoice.js");
      await renderInvoice();
      return;
    }

    const handler = routes[path];
    if (!handler) {
      window.history.replaceState({}, "", "/");
    }
    await (handler ?? routes["/"])();
  } catch (err) {
    console.error("Render error:", err);
    renderShell(`<div class="card"><h3>Error loading page</h3><p>${esc(String(err))}</p></div>`);
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<void> {
  const res = await api.post<{ token: string; user: UserDTO }>("/auth/login", { email, password });
  setToken(res.token);
  navigate("/");
}

export function logout(): void {
  clearToken();
  navigate("/login");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener("popstate", () => render());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => render());
} else {
  render();
}
