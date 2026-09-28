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
  let bg = document.querySelector(".modal-bg");
  if (!bg) {
    bg = document.createElement("div");
    bg.className = "modal-bg";
    document.body.appendChild(bg);
    bg.addEventListener("click", (e) => { if (e.target === bg) closeModal(); });
  }
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.classList.add("open");
}

export function closeModal(): void {
  document.querySelector(".modal-bg")?.classList.remove("open");
}

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
