// Import required functions from attack module
import {
  startAttack,
  autoAttackEnabled,
  setIsAttacking,
  setLastAttackTime,
} from "./attack.js";
import { myPlayer, canvas, socket, config } from "../utils/constants.js";
import { chatMode } from "../ui/chat.js";

// Track inventory clicks for double-click detection
export let lastInventoryClick = { slot: -1, time: 0 };

// Setter function for lastInventoryClick
export function setLastInventoryClick(clickData) {
  lastInventoryClick = clickData;
}

// Inventory functions
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
    // Force start a new attack sequence
    setIsAttacking(false);
    setLastAttackTime(0);
    startAttack();
  }

  // Notify server of slot change
  socket.emit("inventorySelect", { slot: index });
}
// Add useItem function
export function useItem(slot) {
  if (!myPlayer?.inventory?.slots[slot]) return;

  const item = myPlayer.inventory.slots[slot];
  if (item.type === "consumable") {
    socket.emit("useItem", { slot });
    // Let server event handler switch back to hammer
  }
}
// Helper function to get inventory slot from screen coordinates
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
// Function to expand inventory (for future use)
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

// Inventory input handling functions
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

// Mouse click handling for inventory
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
