// Modal component

import { esc } from "../format.js";

export function modalForm(title: string, fields: string, submitLabel = "Save"): string {
  return `
    <h3 style="font-family:Fraunces,serif;font-size:22px;margin:0 0 12px">${esc(title)}</h3>
    <form class="stack" id="modal-form">
      ${fields}
      <div class="actions">
        <button class="btn" type="submit">${esc(submitLabel)}</button>
        <button class="btn secondary" type="button" onclick="window.closeModal()">Cancel</button>
      </div>
    </form>
  `;
}

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

// Expose to window for inline onclick handlers
(window as any).closeModal = closeModal;
