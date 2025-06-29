// Import core variables
import { items, myPlayer, socket } from "../utils/constants.js";
import { chatMode } from "../ui/chat.js";
import { useItem } from "./inventory.js";

// Attack variables
export let lastAttackTime = 0;
export let attackAnimationProgress = 0;
export let isAttacking = false;
export const attackDuration = 250; // Faster animation (reduced from 400ms)
export let autoAttackEnabled = false; // New toggle for auto-attack mode
export const ATTACK_BUFFER_WINDOW = 200; // Buffer window in milliseconds
export let lastAttackAttempt = 0;

// Modify startAttack function
export function startAttack() {
  if (!canAutoAttackWithCurrentItem()) return;

  const now = Date.now();
  const cooldown = items.hammer.cooldown || 800;
  lastAttackAttempt = now; // Record the attempt time

  // Check if we're in cooldown
  const timeSinceLastAttack = now - lastAttackTime;

  // Allow attack if either:
  // 1. Cooldown is completely finished, or
  // 2. We're within buffer window and have a recent attack attempt
  if (
    timeSinceLastAttack > cooldown ||
    (timeSinceLastAttack > cooldown - ATTACK_BUFFER_WINDOW &&
      lastAttackAttempt > lastAttackTime)
  ) {
    isAttacking = true;
    lastAttackTime = now;
    attackAnimationProgress = 0;

    if (myPlayer) {
      myPlayer.attacking = true;
      myPlayer.attackProgress = 0;
      myPlayer.attackStartTime = now;
      // Capture the rotation at attack start for consistent animation
      myPlayer.attackStartRotation = myPlayer.rotation;
    }

    socket.emit("attackStart");
  }
}
// Unified attack handler for both desktop and mobile
export function handleAttackAction() {
  const activeItem =
    myPlayer?.inventory?.slots[myPlayer?.inventory?.activeSlot];
  if (!activeItem) return;

  if (activeItem.type === "consumable") {
    useItem(myPlayer.inventory.activeSlot);
  } else if (activeItem.type === "placeable") {
    // Calculate wall position in front of player
    const wallDistance = 69; // Distance from player center
    const angle = myPlayer.rotation + Math.PI / 2; // Player's facing angle
    const wallX = myPlayer.x + Math.cos(angle) * wallDistance;
    const wallY = myPlayer.y + Math.sin(angle) * wallDistance;
    // Request wall placement from server - rotate wall 90 degrees to match player orientation
    socket.emit("placeWall", {
      x: wallX,
      y: wallY,
      rotation: myPlayer.rotation + Math.PI / 2, // Rotate wall 90 degrees to match player orientation
    });
  } else {
    startAttack();
  }
}

// Toggle auto attack function
export function toggleAutoAttack() {
  autoAttackEnabled = !autoAttackEnabled;

  // If enabling auto-attack and we have a valid weapon, start attacking
  if (autoAttackEnabled && canAutoAttackWithCurrentItem()) {
    startAttack();
  }
}

// New helper function to check if current item supports auto-attack
export function canAutoAttackWithCurrentItem() {
  if (!myPlayer?.inventory?.slots) return false;

  const activeItem = myPlayer.inventory.slots[myPlayer.inventory.activeSlot];
  if (!activeItem) return false;

  // List of items that support auto-attack
  const autoAttackableItems = ["hammer"];
  return autoAttackableItems.includes(activeItem.id);
}

// Attack input handling functions
export function handleAttackKeydown(e) {
  if (e.key.toLowerCase() === "e") {
    toggleAutoAttack();
    return true; // Event handled
  }

  return false; // Event not handled
}

// Mouse click handling for attacks
export function handleAttackMouseClick(e) {
  if (!chatMode) {
    // Not clicking inventory, use unified attack handler
    handleAttackAction();
    return true; // Event handled
  }

  return false; // Event not handled
}

// Setter functions for external modules
export function setIsAttacking(value) {
  isAttacking = value;
}

export function setAttackAnimationProgress(value) {
  attackAnimationProgress = value;
}

export function setLastAttackTime(value) {
  lastAttackTime = value;
}

// Attack system
