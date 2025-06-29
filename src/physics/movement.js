// Import required variables
import { keys, myPlayer } from "../utils/constants.js";
import { virtualKeys, isMobileDevice, touchControls } from "../ui/mobile.js";
import { sendPlayerMovement } from "../network/socketHandlers.js";

/**
 * Returns the current movement key states for the active input method.
 *
 * On desktop, returns the standard keyboard movement keys. On mobile devices, updates and returns the virtual movement keys based on joystick input.
 * @return {Object} The current movement key states.
 */
export function getVirtualKeys() {
  if (!isMobileDevice) return keys;

  updateVirtualMovement();
  return virtualKeys;
}

/**
 * Updates the virtual movement key states based on the current position of the mobile joystick.
 *
 * Calculates directional input from the joystick's displacement, setting the virtual movement keys (`w`, `a`, `s`, `d`) for 8-directional movement. If auto-facing is enabled and a player exists, updates the player's rotation to match the joystick direction and synchronizes this with the server. Resets all movement keys if the joystick is inactive or within the deadzone.
 */
function updateVirtualMovement() {
  if (!touchControls.joystick.active) {
    virtualKeys.w = virtualKeys.s = virtualKeys.a = virtualKeys.d = false;
    return;
  }

  const deltaX =
    touchControls.joystick.currentX - touchControls.joystick.startX;
  const deltaY =
    touchControls.joystick.currentY - touchControls.joystick.startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance > touchControls.joystick.deadzone) {
    // Normalize the input but cap it at the joystick radius
    const maxDistance = Math.min(distance, touchControls.joystick.radius);
    const normalizedX =
      (deltaX / distance) * (maxDistance / touchControls.joystick.radius);
    const normalizedY =
      (deltaY / distance) * (maxDistance / touchControls.joystick.radius);

    // Use a lower threshold for smoother 8-directional movement
    const threshold = 0.2;
    virtualKeys.w = normalizedY < -threshold;
    virtualKeys.s = normalizedY > threshold;
    virtualKeys.a = normalizedX < -threshold;
    virtualKeys.d = normalizedX > threshold;

    // Auto-face movement direction if enabled
    if (
      touchControls.autoFaceMovement &&
      myPlayer &&
      distance > touchControls.joystick.deadzone
    ) {
      const angle = Math.atan2(deltaY, deltaX) - Math.PI / 2;
      myPlayer.rotation = angle;

      // Send rotation update to server
      sendPlayerMovement();
    }
  } else {
    virtualKeys.w = virtualKeys.s = virtualKeys.a = virtualKeys.d = false;
  }
}

/**
 * Handles keydown events for movement keys, updating their state.
 * @param {KeyboardEvent} e - The keydown event.
 * @return {boolean} True if the event corresponds to a movement key and was handled; otherwise, false.
 */
export function handleMovementKeydown(e) {
  // Movement keys
  if (Object.hasOwn(keys, e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true;
    return true; // Event handled
  }

  return false; // Event not handled
}

/**
 * Handles keyup events for movement keys, updating their state to inactive.
 * @param {KeyboardEvent} e - The keyup event object.
 * @return {boolean} True if the event corresponds to a movement key and was handled; otherwise, false.
 */
export function handleMovementKeyup(e) {
  if (Object.hasOwn(keys, e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false;
    return true; // Event handled
  }

  return false; // Event not handled
}
