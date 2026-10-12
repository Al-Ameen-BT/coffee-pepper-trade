// Modal component

import { esc } from "../format.js";

export function modalForm(title: string, fields: string, submitLabel = "Save"): string {
  return `
    <h3 class="modal-title">${esc(title)}</h3>
    <form class="stack" id="modal-form">
      ${fields}
      <div class="actions">
        <button class="btn" type="submit">${esc(submitLabel)}</button>
        <button class="btn secondary" type="button" data-close-modal onclick="window.closeModal()">Cancel</button>
      </div>
    </form>
  `;
}

import { openModal, closeModal } from "../main.js";
export { openModal, closeModal };
