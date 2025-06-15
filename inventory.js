class InventorySystem {
  constructor(maxSlots) {
    this.slots = Array(maxSlots).fill(null);
    this.activeSlot = 0;
    this.selectedItem = null;
  }

  addItem(item, slot = null) {
    // If no slot specified, find first empty slot
    if (slot === null) {
      slot = this.slots.findIndex((s) => s === null);
    }

    if (slot >= 0 && slot < this.slots.length) {
      this.slots[slot] = { ...item, slot };
      return true;
    }
    return false;
  }

  selectSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      this.activeSlot = slotIndex;
      this.selectedItem = this.slots[slotIndex];
      return true;
    }
    return false;
  }

  getActiveItem() {
    return this.slots[this.activeSlot];
  }
}

// Make available globally
if (typeof window !== "undefined") {
  window.InventorySystem = InventorySystem;
}

// Support Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = InventorySystem;
}
