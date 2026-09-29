import { api, getToken, setToken, clearToken } from "./api.js";
import { esc } from "./format.js";
import type { UserDTO } from "../../shared/types.js";

// ─── Router ───────────────────────────────────────────────────────────────────

type RouteHandler = () => void;

const routes: Record<string, RouteHandler> = {
  "/": () => import("./pages/dashboard.js").then((m) => m.render()),
  "/parties": () => import("./pages/parties.js").then((m) => m.render()),
  "/purchases": () => import("./pages/purchases.js").then((m) => m.render()),
  "/sales": () => import("./pages/sales.js").then((m) => m.render()),
  "/statements": () => import("./pages/statements.js").then((m) => m.render()),
  "/payments": () => import("./pages/payments.js").then((m) => m.render()),
  "/funds": () => import("./pages/funds.js").then((m) => m.render()),
  "/loans": () => import("./pages/loans.js").then((m) => m.render()),
  "/ledger": () => import("./pages/ledger.js").then((m) => m.render()),
  "/bills": () => import("./pages/bills.js").then((m) => m.render()),
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

const NAV_LINKS = [
  { path: "/", label: "Dashboard" },
  { path: "/parties", label: "Parties" },
  { path: "/purchases", label: "Purchases" },
  { path: "/sales", label: "Sales" },
  { path: "/statements", label: "Financial Statements" },
  { path: "/payments", label: "Payments" },
  { path: "/funds", label: "Cash & Bank" },
  { path: "/loans", label: "Loans & Advances" },
  { path: "/ledger", label: "Personal Ledger" },
  { path: "/bills", label: "Bills & Print" },
];

export function renderShell(content: string): void {
  const path = currentPath();
  const nav = NAV_LINKS.map(
    (l) => `<a href="${l.path}" class="${path === l.path ? "active" : ""}" data-nav="${l.path}">${l.label}</a>`,
  ).join("");

  document.getElementById("app")!.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">CP</div>
          <div>
            <h1>Hill Trade Ledger</h1>
            <p>Coffee · Black Pepper</p>
          </div>
        </div>
        <nav>${nav}</nav>
        <div class="sidebar-footer">
          <button id="logout-btn" class="logout-btn" type="button" title="Log out of application">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <main class="main" id="page">${content}</main>
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
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

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

  bg.innerHTML = `
    <div class="modal">
      <div style="display:flex;justify-content:flex-end;margin-bottom:-10px;position:relative;z-index:10;">
        <button type="button" class="modal-close-x" style="background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:var(--muted);padding:4px 8px;" title="Close (Esc)">&times;</button>
      </div>
      ${html}
    </div>
  `;
  bg.classList.add("open");
  bg.style.display = "grid";

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
    m.innerHTML = "";
  });
  const bg = document.getElementById("global-modal-bg");
  if (bg) {
    bg.classList.remove("open");
    bg.style.display = "none";
    bg.innerHTML = "";
  }
}

// Expose to global window object for inline onclick handlers (e.g. onclick="closeModal()" or onclick="window.closeModal()")
(window as any).closeModal = closeModal;
(window as any).openModal = openModal;

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

  const handler = routes[path] || routes["/"];
  try {
    await handler();
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
