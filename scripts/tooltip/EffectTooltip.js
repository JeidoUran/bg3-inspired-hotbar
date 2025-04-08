// EffectTooltip.js
import { BaseTooltip } from "./BaseTooltip.js";
import { enrichHTMLClean } from "../utils/tooltipUtils.js";

export class EffectTooltip extends BaseTooltip {
  constructor(item) {
    super(item);
    this.tooltipType = "effect"; // Set the tooltip type for effects
  }

  async buildContent() {
    if (!this.item || !this.element) return;
    this.element.dataset.type = "effect";

    const content = document.createElement("div");
    content.classList.add("tooltip-content");

    // Header: Icon and Name
    const header = document.createElement("div");
    header.classList.add("effect-tooltip-header");

    const icon = document.createElement("img");
    icon.src = this.item.img || this.item.icon || "";
    icon.classList.add("tooltip-icon");
    header.appendChild(icon);

    const nameEl = document.createElement("div");
    nameEl.classList.add("tooltip-name");
    nameEl.textContent = this.item.name || this.item.label || "";
    header.appendChild(nameEl);
    content.appendChild(header);

    // Details Section
    const detailsEl = document.createElement("div");
    detailsEl.classList.add("tooltip-details-list");

    // Duration and Status
    let durationText = game.i18n.localize("BG3.Hotbar.Tooltips.Permanent");
    const duration = this.item.duration || this.item.system?.duration;
    if (duration) {
      if (duration.type === "rounds" || duration.type === "turns") {
        const remaining = Math.max(0, duration.remaining || 0);
        const key = duration.type === "rounds" ? "BG3.Hotbar.Tooltips.RoundsRemaining" : "BG3.Hotbar.Tooltips.TurnsRemaining";
        durationText = game.i18n.format(key, { count: remaining });
      } else if (duration.seconds) {
        const totalSeconds = duration.seconds;
        const startTime = duration.startTime;
        const currentTime = game.time.worldTime;
        const elapsedSeconds = Math.max(0, currentTime - startTime);
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        durationText = game.i18n.format("BG3.Hotbar.Tooltips.SecondsRemaining", { count: remainingSeconds });
      }
    }

    const isDisabled = this.item.disabled ?? this.item.system?.disabled ?? false;
    detailsEl.innerHTML = `
      <div><strong>${game.i18n.localize("BG3.Hotbar.Tooltips.Duration")}:</strong> ${durationText}</div>
      <div><strong>${game.i18n.localize("BG3.Hotbar.Tooltips.Status")}:</strong> ${isDisabled ? game.i18n.localize("BG3.Hotbar.Tooltips.Disabled") : game.i18n.localize("BG3.Hotbar.Tooltips.Active")}</div>
    `;
    content.appendChild(detailsEl);

    // Description Section
    if (this.item.description || this.item.system?.description?.value) {
      const descHeader = document.createElement("div");
      descHeader.classList.add("tooltip-description-header");
      descHeader.textContent = game.i18n.localize("BG3.Hotbar.Tooltips.Description");
      content.appendChild(descHeader);

      const descContainer = document.createElement("div");
      descContainer.classList.add("tooltip-description-container");
      const descEl = document.createElement("div");
      descEl.classList.add("tooltip-description");
      descEl.textContent = game.i18n.localize("BG3.Hotbar.Tooltips.LoadingDescription");
      descContainer.appendChild(descEl);
      content.appendChild(descContainer);

      const description = this.item.description || this.item.system?.description?.value || "";
      // Attempt to get the parent actor for better context
      const actor = this.item.parent;
      const rollData = actor ? actor.getRollData() : this.item.getRollData ? this.item.getRollData() : {};
      
      // Use async/await and proper error handling
      try {
        const cleanedHTML = await enrichHTMLClean(description, rollData, this.item);
        descEl.innerHTML = cleanedHTML || game.i18n.localize("BG3.Hotbar.Tooltips.NoDescription");
      } catch (err) {
        console.warn("BG3 Hotbar - Failed to enrich effect description:", err);
        descEl.textContent = game.i18n.localize("BG3.Hotbar.Tooltips.NoDescription");
      }
    } else {
      const noDesc = document.createElement("div");
      noDesc.classList.add("tooltip-description");
      noDesc.textContent = game.i18n.localize("BG3.Hotbar.Tooltips.NoDescription");
      content.appendChild(noDesc);
    }

    this.element.appendChild(content);
  }
}
