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

/**
 * Initiates a player attack if the current item supports auto-attack and cooldown conditions are met.
 *
 * Starts the attack animation, updates player attack state, and emits an "attackStart" event to the server. Attack initiation is allowed if the cooldown has elapsed or within a buffer window after a recent attempt.
 */
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
/**
 * Executes the appropriate attack or item action based on the currently active inventory item.
 *
 * Uses consumable items, places walls or spikes in front of the player if a placeable item is selected, or initiates a standard attack for other item types.
 */
export function handleAttackAction() {
  const activeItem =
    myPlayer?.inventory?.slots[myPlayer?.inventory?.activeSlot];
  if (!activeItem) return;

  if (activeItem.type === "consumable") {
    useItem(myPlayer.inventory.activeSlot);
  } else if (activeItem.type === "placeable") {
    // Calculate placement position in front of player
    const placeDistance = 69; // Distance from player center
    const angle = myPlayer.rotation + Math.PI / 2; // Player's facing angle
    const placeX = myPlayer.x + Math.cos(angle) * placeDistance;
    const placeY = myPlayer.y + Math.sin(angle) * placeDistance;

    if (activeItem.id === "wall") {
      // Request wall placement from server - rotate wall 90 degrees to match player orientation
      socket.emit("placeWall", {
        x: placeX,
        y: placeY,
        rotation: myPlayer.rotation + Math.PI / 2, // Rotate wall 90 degrees to match player orientation
      });
    } else if (activeItem.id === "spike") {
      // Request spike placement from server
      socket.emit("placeSpike", {
        x: placeX,
        y: placeY,
        rotation: myPlayer.rotation, // Spikes use player rotation directly
      });
    }
  } else {
    startAttack();
  }
}

/**
 * Toggles the auto-attack mode for the player.
 *
 * If auto-attack is enabled and the currently equipped item supports auto-attacking, immediately initiates an attack.
 */
export function toggleAutoAttack() {
  autoAttackEnabled = !autoAttackEnabled;

  // If enabling auto-attack and we have a valid weapon, start attacking
  if (autoAttackEnabled && canAutoAttackWithCurrentItem()) {
    startAttack();
  }
}

/**
 * Determines if the currently active inventory item supports auto-attack.
 * @return {boolean} True if the active item allows auto-attack; otherwise, false.
 */
export function canAutoAttackWithCurrentItem() {
  if (!myPlayer?.inventory?.slots) return false;

  const activeItem = myPlayer.inventory.slots[myPlayer.inventory.activeSlot];
  if (!activeItem) return false;

  // List of items that support auto-attack
  const autoAttackableItems = ["hammer"];
  return autoAttackableItems.includes(activeItem.id);
}

/**
 * Handles keyboard input for attack actions, toggling auto-attack mode when the "e" key is pressed.
 * @param {KeyboardEvent} e - The keyboard event to process.
 * @return {boolean} True if the event was handled (i.e., "e" key pressed), otherwise false.
 */
export function handleAttackKeydown(e) {
  if (e.key.toLowerCase() === "e") {
    toggleAutoAttack();
    return true; // Event handled
  }

  return false; // Event not handled
}

/**
 * Handles mouse click events for initiating attacks.
 *
 * If the player is not interacting with chat or inventory UI, triggers the unified attack action and returns `true` to indicate the event was handled. Returns `false` if the click occurs while in chat mode.
 * @param {MouseEvent} e - The mouse event object.
 * @return {boolean} `true` if the attack action was triggered; otherwise, `false`.
 */
export function handleAttackMouseClick(e) {
  if (!chatMode) {
    // Not clicking inventory, use unified attack handler
    handleAttackAction();
    return true; // Event handled
  }

  return false; // Event not handled
}

/**
 * Sets the attack state to indicate whether an attack is currently in progress.
 * @param {boolean} value - True if an attack is in progress; otherwise, false.
 */
export function setIsAttacking(value) {
  isAttacking = value;
}

/**
 * Sets the current progress value of the attack animation.
 * @param {number} value - The new progress value for the attack animation.
 */
export function setAttackAnimationProgress(value) {
  attackAnimationProgress = value;
}

/**
 * Updates the timestamp of the last successful attack.
 * @param {number} value - The new timestamp to set for the last attack time.
 */
export function setLastAttackTime(value) {
  lastAttackTime = value;
}

// Attack system
