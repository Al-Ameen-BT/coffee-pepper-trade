import { login } from "../main.js";
import { esc } from "../format.js";

export function renderLogin(): void {
  document.getElementById("app")!.innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <h1>Hill Trade Ledger</h1>
        <p>Coffee · Black Pepper trading management</p>
        <div id="login-error" class="alert error" style="display:none;margin-bottom:16px;padding:10px 14px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;font-size:13px;line-height:1.4;"></div>
        <form id="login-form" class="stack">
          <!-- Honeypot anti-bot field (invisible to users, filled by automated bots) -->
          <input type="text" name="hp_field" tabindex="-1" autocomplete="off" aria-hidden="true" style="opacity:0;position:absolute;top:0;left:0;height:0;width:0;z-index:-1;pointer-events:none;">
          <label>Email
            <input required type="email" name="email" placeholder="Enter your email" autocomplete="email">
          </label>
          <label>Password
            <input required type="password" name="password" placeholder="Enter password" autocomplete="current-password">
          </label>
          <button class="btn gold" type="submit" style="width:100%;margin-top:8px;">Sign In</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById("login-form") as HTMLFormElement;
  const errBox = document.getElementById("login-error") as HTMLDivElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errBox) {
      errBox.style.display = "none";
      errBox.textContent = "";
    }

    const fd = new FormData(form);
    const hp = (fd.get("hp_field") as string)?.trim();
    if (hp) {
      // Bot detected via honeypot
      if (errBox) {
        errBox.textContent = "Automated submission rejected.";
        errBox.style.display = "block";
      }
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing In...";
    }

    const email = (fd.get("email") as string)?.trim();
    const password = fd.get("password") as string;

    try {
      await login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (errBox) {
        errBox.textContent = msg;
        errBox.style.display = "block";
      } else {
        alert(msg);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    }
  });
}
