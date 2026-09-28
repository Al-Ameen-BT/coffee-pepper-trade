import { login } from "../main.js";
import { esc } from "../format.js";

export function renderLogin(): void {
  document.getElementById("app")!.innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <h1>Hill Trade Ledger</h1>
        <p>Coffee · Black Pepper trading management</p>
        <form id="login-form" class="stack">
          <label>Email
            <input required type="email" name="email" placeholder="admin@hilltrade.com">
          </label>
          <label>Password
            <input required type="password" name="password" placeholder="Enter password">
          </label>
          <button class="btn gold" type="submit" style="width:100%">Sign In</button>
        </form>
        <p style="margin-top:16px;font-size:12px;color:var(--muted)">Default: admin@hilltrade.com / admin12345</p>
      </div>
    </div>
  `;

  document.getElementById("login-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await login(fd.get("email") as string, fd.get("password") as string);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Login failed");
    }
  });
}
