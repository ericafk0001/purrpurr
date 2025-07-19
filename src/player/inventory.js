// Import required functions from attack module
import {
  requestAttack,
  autoAttackEnabled,
  setIsAttacking,
  setLastAttackTime,
  resetAttackState,
} from "./attack.js";
import { myPlayer, canvas, socket, config } from "../utils/constants.js";
import { chatMode } from "../ui/chat.js";

// Track inventory clicks for double-click detection
export let lastInventoryClick = { slot: -1, time: 0 };

/**
 * Updates the record of the last inventory slot click with the provided data.
 * @param {{ slot: number, time: number }} clickData - The slot index and timestamp of the last inventory click.
 */
export function setLastInventoryClick(clickData) {
  lastInventoryClick = clickData;
}

/**
 * Selects the specified inventory slot, updates the player's active slot and selected item, and notifies the server.
 *
 * If auto-attack is enabled and the selected item is a "hammer," resets the attack state and initiates a new attack sequence.
 * Does nothing if the slot index is invalid or the player inventory is uninitialized.
 */
export function handleInventorySelection(index) {
  if (!myPlayer?.inventory) return;

  // Validate slot index
  if (index < 0 || index >= myPlayer.inventory.slots.length) return;

  const newSlotItem = myPlayer.inventory.slots[index];

  // Update active slot
  myPlayer.inventory.activeSlot = index;
  myPlayer.inventory.selectedItem = newSlotItem;

  // Check if switching to a weapon slot while auto-attack is enabled
  if (autoAttackEnabled && newSlotItem?.id === "hammer") {
    // Reset attack state and start a new attack sequence
    resetAttackState();
    requestAttack();
  }

  // Notify server of slot change
  socket.emit("inventorySelect", { slot: index });
}
/**
 * Uses a consumable item from the specified inventory slot if available.
 * Emits a "useItem" event to the server for the given slot.
 * @param {number} slot - The index of the inventory slot to use.
 */
export function useItem(slot) {
  if (!myPlayer?.inventory?.slots[slot]) return;

  const item = myPlayer.inventory.slots[slot];
  if (item.type === "consumable") {
    socket.emit("useItem", { slot });
    // Let server event handler switch back to hammer
  }
}
/**
 * Returns the inventory slot index at the given screen coordinates, or -1 if no slot is found.
 *
 * Calculates the position of each inventory slot based on UI configuration and canvas size, then checks if the provided (x, y) coordinates fall within any slot's boundaries.
 *
 * @param {number} x - The x-coordinate relative to the canvas.
 * @param {number} y - The y-coordinate relative to the canvas.
 * @return {number} The index of the inventory slot at the given position, or -1 if none.
 */
export function getInventorySlotFromPosition(x, y) {
  if (!config.player.inventory.enabled || !myPlayer?.inventory) return -1;

  const inv = config.player.inventory;
  const slotSize = inv.displayUI.slotSize;
  const padding = inv.displayUI.padding;
  const slots = myPlayer.inventory.slots;
  const startX = (canvas.width - (slotSize + padding) * slots.length) / 2;
  const startY = canvas.height - slotSize - inv.displayUI.bottomOffset;

  // Check each slot
  for (let i = 0; i < slots.length; i++) {
    const slotX = startX + i * (slotSize + padding);
    const slotY = startY;

    // Check if point is within this slot
    if (
      x >= slotX &&
      x <= slotX + slotSize &&
      y >= slotY &&
      y <= slotY + slotSize
    ) {
      return i;
    }
  }

  return -1; // No slot found
}
/**
 * Increases the player's inventory slot count by one if below the maximum allowed.
 * @return {boolean} True if the inventory was expanded; false if already at maximum slots.
 */
export function expandInventory() {
  const inv = config.player.inventory;
  if (inv.currentSlots < inv.maxSlots) {
    inv.currentSlots++;

    // If player has inventory initialized, add a new slot
    if (myPlayer && myPlayer.inventory) {
      myPlayer.inventory.slots.push(null);
    }

    // Could emit event to server to sync inventory size
    // socket.emit("inventoryExpand");

    return true;
  }
  return false;
}

/**
 * Handles keyboard input for inventory slot selection and quick item access.
 *
 * Number keys 1-5 select the corresponding inventory slot. Pressing "Q" selects the first slot containing an apple, if available.
 * @param {KeyboardEvent} e - The keyboard event to process.
 * @return {boolean} True if the event was handled for inventory actions; otherwise, false.
 */
export function handleInventoryKeydown(e) {
  // Number keys for inventory selection (1-5)
  const keyNum = parseInt(e.key);
  if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 5) {
    handleInventorySelection(keyNum - 1);
    return true; // Event handled
  }

  // Quick select apple with Q
  if (e.key.toLowerCase() === "q") {
    // Find first apple slot
    const appleSlot = myPlayer?.inventory?.slots.findIndex(
      (item) => item?.id === "apple"
    );
    if (appleSlot !== -1) {
      handleInventorySelection(appleSlot);
    }
    return true; // Event handled
  }

  return false; // Event not handled
}

/**
 * Handles mouse clicks on the inventory UI, supporting slot selection and double-click item usage.
 *
 * If the user clicks on an inventory slot, a single click selects the slot, while a double-click within 500ms on the same slot uses the item if it is consumable. Returns `true` if the click was on an inventory slot and handled; otherwise, returns `false`.
 *
 * @param {MouseEvent} e - The mouse event triggered by the user's click.
 * @return {boolean} Whether the inventory click was handled.
 */
export function handleInventoryMouseClick(e) {
  if (!chatMode) {
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if clicking on inventory slot first
    const slotIndex = getInventorySlotFromPosition(mouseX, mouseY);
    if (slotIndex !== -1) {
      // Double-click logic: if clicking the same slot twice quickly, use the item
      const now = Date.now();
      const timeSinceLastClick = now - (lastInventoryClick?.time || 0);
      const clickedSameSlot = slotIndex === (lastInventoryClick?.slot || -1);

      if (clickedSameSlot && timeSinceLastClick < 500) {
        // 500ms double-click window
        // Double-click: use the item
        const item = myPlayer?.inventory?.slots[slotIndex];
        if (item?.type === "consumable") {
          useItem(slotIndex);
        }
      } else {
        // Single click: select the slot
        handleInventorySelection(slotIndex);
      }

      // Remember this click for double-click detection
      setLastInventoryClick({ slot: slotIndex, time: now });
      return true; // Event handled (don't process as attack)
    }
  }

  return false; // Event not handled
}
