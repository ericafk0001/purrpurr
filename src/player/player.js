// Import core variables
import { myPlayer, config, keys, targetCamera } from "../utils/constants.js";
import { isMobileDevice } from "../ui/mobile.js";
import { getVirtualKeys } from "../physics/movement.js";
import { clampWithEasing } from "../utils/helpers.js";
import {
  handleCollisions,
  resolvePlayerCollisions,
  resolveCollisionPenetration,
  resolveWallCollisions,
} from "../physics/collision.js";
import { sendPlayerMovement } from "../network/socketHandlers.js";

// Mouse state - moved from constants.js since only used here
const mouse = {
  x: 0,
  y: 0,
};

/**
 * Sets the current mouse position in screen coordinates.
 * @param {number} x - The x-coordinate of the mouse.
 * @param {number} y - The y-coordinate of the mouse.
 */
function setMousePosition(x, y) {
  mouse.x = x;
  mouse.y = y;
}

// Player sync variables
export let lastServerSync = Date.now();
export let needsPositionReconciliation = false;
export let correctedPosition = null;

// Player functions
/**
 * Updates the player's position based on input, velocity, and collision handling.
 *
 * Applies server reconciliation corrections if needed, integrates velocity with decay for smooth movement, processes input from keyboard or virtual keys, normalizes movement, and resolves collisions. Sends updated movement data to the server after applying all adjustments.
 *
 * @param {number} deltaTime - The elapsed time since the last update, used to ensure frame-rate independent movement.
 */
export function updatePosition(deltaTime) {
  if (!myPlayer) return;

  // Handle position correction from server
  if (needsPositionReconciliation && correctedPosition) {
    myPlayer.x = correctedPosition.x;
    myPlayer.y = correctedPosition.y;
    myPlayer.rotation = correctedPosition.rotation;
    needsPositionReconciliation = false;
    correctedPosition = null;
    return; // Skip normal movement this frame
  }

  // Don't allow movement if dead
  if (myPlayer.isDead) return;

  // Apply velocity with deltaTime for frame-rate independence and boundary checks
  if (myPlayer.velocity) {
    const newX = myPlayer.x + myPlayer.velocity.x * deltaTime;
    const newY = myPlayer.y + myPlayer.velocity.y * deltaTime;

    // Clamp position within world bounds
    myPlayer.x = clampWithEasing(newX, 0, config.worldWidth);
    myPlayer.y = clampWithEasing(newY, 0, config.worldHeight);

    // Apply velocity decay
    const decayFactor = Math.pow(0.9, deltaTime * 60); // Scale decay to frame time
    myPlayer.velocity.x *= decayFactor;
    myPlayer.velocity.y *= decayFactor;

    // Zero out small velocities
    if (Math.abs(myPlayer.velocity.x) < 0.1) myPlayer.velocity.x = 0;
    if (Math.abs(myPlayer.velocity.y) < 0.1) myPlayer.velocity.y = 0;
  }

  let dx = 0;
  let dy = 0;

  // Use different input source based on device type
  const activeKeys = isMobileDevice ? getVirtualKeys() : keys;

  if (activeKeys.w && myPlayer.y > 0) dy -= 1;
  if (activeKeys.s && myPlayer.y < config.worldHeight) dy += 1;
  if (activeKeys.a && myPlayer.x > 0) dx -= 1;
  if (activeKeys.d && myPlayer.x < config.worldWidth) dx += 1;

  // normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const normalizer = 1 / Math.sqrt(2);
    dx *= normalizer;
    dy *= normalizer;
  }

  // Scale movement by deltaTime for frame-rate independence
  dx *= config.moveSpeed * deltaTime;
  dy *= config.moveSpeed * deltaTime;

  const { dx: slidingDx, dy: slidingDy } = handleCollisions(dx, dy);

  const newX = myPlayer.x + slidingDx;
  const newY = myPlayer.y + slidingDy;

  if (newX > 0 && newX < config.worldWidth) myPlayer.x = newX;
  if (newY > 0 && newY < config.worldHeight) myPlayer.y = newY;
  resolvePlayerCollisions();
  resolveCollisionPenetration();
  resolveWallCollisions(); // Add wall collision resolution

  sendPlayerMovement();
}
/**
 * Updates the player's rotation to face the mouse cursor based on the target camera position.
 * 
 * Only applies on non-mobile devices. Calculates the angle between the player's position and the mouse's world position, then updates the player's rotation accordingly. Sends the updated movement data to the server.
 */
export function updateRotation() {
  // Only update rotation based on mouse for desktop devices
  if (!myPlayer || isMobileDevice) return;

  const screenMouseX = mouse.x;
  const screenMouseY = mouse.y;

  // Use targetCamera instead of camera for consistent aiming
  const worldMouseX = screenMouseX + targetCamera.x;
  const worldMouseY = screenMouseY + targetCamera.y;

  const dx = worldMouseX - myPlayer.x;
  const dy = worldMouseY - myPlayer.y;
  myPlayer.rotation = Math.atan2(dy, dx) - Math.PI / 2;

  sendPlayerMovement();
}

/**
 * Updates the internal mouse position based on a mouse move event.
 * @param {MouseEvent} e - The mouse move event containing the new cursor coordinates.
 */
export function handleMouseMove(e) {
  setMousePosition(e.clientX, e.clientY);
}
