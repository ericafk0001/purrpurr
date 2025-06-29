// Import required variables
import {
  ctx,
  canvas,
  config,
  players,
  myPlayer,
  camera,
  assets,
} from "../utils/constants.js";

/**
 * Draws health bars above all players with defined health values.
 *
 * For each player, renders a rounded rectangular health bar above their position on the canvas, with the fill proportionate to their current health.
 */
export function drawHealthBars() {
  Object.values(players).forEach((player) => {
    // Skip if player doesn't have health
    if (typeof player.health === "undefined") return;

    const healthBarY = player.y - camera.y + config.player.health.barOffset;
    const healthBarX = player.x - camera.x - config.player.health.barWidth / 2;
    const healthPercent = player.health / config.player.health.max;
    const barHeight = config.player.health.barHeight;
    const radius = barHeight / 2;

    // Draw background
    ctx.beginPath();
    ctx.fillStyle = config.colors.healthBar.background;
    ctx.roundRect(
      healthBarX,
      healthBarY,
      config.player.health.barWidth,
      barHeight,
      radius
    );
    ctx.fill();

    // Draw health fill
    ctx.beginPath();
    ctx.fillStyle = config.colors.healthBar.fill;
    ctx.roundRect(
      healthBarX,
      healthBarY,
      config.player.health.barWidth * healthPercent,
      barHeight,
      radius
    );
    ctx.fill();

    // Draw border
    ctx.beginPath();
    ctx.strokeStyle = config.colors.healthBar.border;
    ctx.lineWidth = config.colors.healthBar.borderWidth;
    ctx.roundRect(
      healthBarX,
      healthBarY,
      config.player.health.barWidth,
      barHeight,
      radius
    );
    ctx.stroke();
  });
}
/**
 * Renders the player's inventory UI at the bottom of the canvas if enabled and available.
 *
 * Each inventory slot is drawn as a rounded rectangle, with the active slot highlighted. If a slot contains an item and its asset is loaded, the item image is centered within the slot, preserving its aspect ratio if specified. Slot numbers are displayed in the top-left corner of each slot.
 */
export function drawInventory() {
  if (!config.player.inventory.enabled || !myPlayer?.inventory) return;

  const inv = config.player.inventory;
  const slotSize = inv.displayUI.slotSize;
  const padding = inv.displayUI.padding;
  const slots = myPlayer.inventory.slots;
  const startX = (canvas.width - (slotSize + padding) * slots.length) / 2;
  const startY = canvas.height - slotSize - inv.displayUI.bottomOffset;

  // Draw all slots
  slots.forEach((item, i) => {
    const x = startX + i * (slotSize + padding);
    const y = startY;
    const isSelected = i === myPlayer.inventory.activeSlot;

    // Draw slot background (back to simple style)
    ctx.fillStyle = isSelected
      ? "rgba(100, 100, 100, 0.5)"
      : inv.displayUI.backgroundColor;
    ctx.strokeStyle = isSelected
      ? inv.displayUI.selectedBorderColor
      : inv.displayUI.borderColor;
    ctx.lineWidth = inv.displayUI.borderWidth;

    // Draw slot
    ctx.beginPath();
    ctx.roundRect(x, y, slotSize, slotSize, inv.displayUI.cornerRadius);
    ctx.fill();
    ctx.stroke();

    // Draw item if exists
    if (item && assets[item.id]) {
      // Handle aspect ratio for non-square images
      let drawWidth = slotSize - 10;
      let drawHeight = slotSize - 10;

      if (item.renderOptions?.width && item.renderOptions?.height) {
        const ratio = item.renderOptions.width / item.renderOptions.height;
        if (ratio > 1) {
          drawHeight = drawWidth / ratio;
        } else {
          drawWidth = drawHeight * ratio;
        }
      }

      // Center the item in the slot
      const itemX = x + 5 + (slotSize - 10 - drawWidth) / 2;
      const itemY = y + 5 + (slotSize - 10 - drawHeight) / 2;

      ctx.drawImage(assets[item.id], itemX, itemY, drawWidth, drawHeight);
    }

    // Draw slot number
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${i + 1}`, x + 5, y + 15);
  });
}

/**
 * Displays a full-screen overlay with a "You died! Respawning..." message.
 *
 * Creates and appends a semi-transparent death screen overlay to the document body, covering the entire viewport.
 */
export function showDeathScreen() {
  const deathScreen = document.createElement("div");
  deathScreen.id = "death-screen";
  deathScreen.style.position = "fixed";
  deathScreen.style.top = 0;
  deathScreen.style.left = 0;
  deathScreen.style.width = "100%";
  deathScreen.style.height = "100%";
  deathScreen.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  deathScreen.style.color = "white";
  deathScreen.style.display = "flex";
  deathScreen.style.justifyContent = "center";
  deathScreen.style.alignItems = "center";
  deathScreen.style.fontSize = "32px";
  deathScreen.style.zIndex = 1001;
  deathScreen.innerHTML = "<div>You died! Respawning...</div>";
  document.body.appendChild(deathScreen);
}

/**
 * Removes the death screen overlay from the document if it is present.
 */
export function hideDeathScreen() {
  const deathScreen = document.getElementById("death-screen");
  if (deathScreen) {
    document.body.removeChild(deathScreen);
  }
}
