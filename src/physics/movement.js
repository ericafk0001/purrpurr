// Import required variables
import { keys, myPlayer } from "../utils/constants.js";
import { virtualKeys, isMobileDevice, touchControls } from "../ui/mobile.js";
import { sendPlayerMovement } from "../network/socketHandlers.js";

// Touch and mobile control functions
export function getVirtualKeys() {
  if (!isMobileDevice) return keys;

  updateVirtualMovement();
  return virtualKeys;
}

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

// Movement input handling functions
export function handleMovementKeydown(e) {
  // Movement keys
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = true;
    return true; // Event handled
  }

  return false; // Event not handled
}

export function handleMovementKeyup(e) {
  if (keys.hasOwnProperty(e.key.toLowerCase())) {
    keys[e.key.toLowerCase()] = false;
    return true; // Event handled
  }

  return false; // Event not handled
}
