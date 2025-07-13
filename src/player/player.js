// Import core variables
import { myPlayer, config, keys, targetCamera } from "../utils/constants.js";
import { isMobileDevice } from "../ui/mobile.js";
import { getVirtualKeys } from "../physics/movement.js";
import { getMovementSpeedMultiplier } from "../physics/movement.js";
import { clampWithEasing } from "../utils/helpers.js";
import {
  handleCollisions,
  resolvePlayerCollisions,
  resolveCollisionPenetration,
  resolveWallCollisions,
  resolveSpikeCollisions,
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

// Client-side prediction variables
let movementSequence = 0;
let movementHistory = [];
let lastServerSequence = -1;
const MAX_MOVEMENT_HISTORY = 100;

// Store predicted state
let predictedPosition = { x: 0, y: 0, rotation: 0 };

/**
 * Records a movement for client-side prediction
 */
function recordMovement(deltaTime, dx, dy, rotation) {
  const movement = {
    sequence: movementSequence++,
    timestamp: Date.now(),
    deltaTime,
    dx,
    dy,
    rotation,
    position: { x: myPlayer.x, y: myPlayer.y, rotation: myPlayer.rotation },
  };

  movementHistory.push(movement);

  // Limit history size
  if (movementHistory.length > MAX_MOVEMENT_HISTORY) {
    movementHistory.shift();
  }

  return movement;
}

/**
 * Re-applies movements after server reconciliation
 */
function reapplyMovements(fromSequence) {
  const movementsToReapply = movementHistory.filter((m) => m.sequence > fromSequence);

  for (const movement of movementsToReapply) {
    // Re-apply the movement
    applyMovementDelta(movement.deltaTime, movement.dx, movement.dy);
    myPlayer.rotation = movement.rotation;
  }
}

/**
 * Applies movement delta with collision detection
 */
function applyMovementDelta(deltaTime, dx, dy) {
  // Apply movement restriction multiplier
  const speedMultiplier = getMovementSpeedMultiplier();
  dx *= speedMultiplier;
  dy *= speedMultiplier;

  const { dx: slidingDx, dy: slidingDy } = handleCollisions(dx, dy);

  const newX = myPlayer.x + slidingDx;
  const newY = myPlayer.y + slidingDy;

  if (newX > 0 && newX < config.worldWidth) myPlayer.x = newX;
  if (newY > 0 && newY < config.worldHeight) myPlayer.y = newY;

  resolvePlayerCollisions();
  resolveCollisionPenetration();
  resolveWallCollisions();
  resolveSpikeCollisions();
}

/**
 * Updates the player's position each frame based on input, velocity, and collision resolution.
 *
 * Applies server reconciliation if required, processes input for movement, integrates velocity with decay, and resolves collisions with players, walls, and spikes. Ensures the player's position remains within world bounds and sends the updated movement state to the server.
 *
 * @param {number} deltaTime - Time elapsed since the last update, used for frame-rate independent movement.
 */
export function updatePosition(deltaTime) {
  if (!myPlayer) return;

  // Handle position correction from server
  if (needsPositionReconciliation && correctedPosition) {
    // Server correction - reconcile with prediction
    const serverSequence = correctedPosition.sequence || lastServerSequence;

    // Set to server position
    myPlayer.x = correctedPosition.x;
    myPlayer.y = correctedPosition.y;
    myPlayer.rotation = correctedPosition.rotation;

    // Re-apply movements that happened after this server update
    if (serverSequence >= 0) {
      reapplyMovements(serverSequence);
      lastServerSequence = serverSequence;
    }

    needsPositionReconciliation = false;
    correctedPosition = null;
    return;
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

    // IMPORTANT: Resolve collisions after velocity movement
    resolvePlayerCollisions();
    resolveCollisionPenetration();
    resolveWallCollisions();
    resolveSpikeCollisions();
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

  // Apply movement restriction if active
  if (myPlayer.movementRestriction && myPlayer.movementRestriction.active) {
    const restriction = myPlayer.movementRestriction;
    const now = Date.now();
    const elapsed = now - restriction.startTime;
    const restrictionConfig = config.player.knockback.movementRestriction;

    if (elapsed < restrictionConfig.duration) {
      // Only apply restriction if player is actually trying to move
      if (dx !== 0 || dy !== 0) {
        // Calculate movement direction relative to knockback direction
        const moveAngle = Math.atan2(dy, dx);
        const knockbackAngle = restriction.knockbackDirection;

        // Calculate angle difference (shortest path)
        let angleDiff = moveAngle - knockbackAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const absAngleDiff = Math.abs(angleDiff);

        // Determine movement penalty based on direction
        let speedMultiplier = 1.0;

        if (absAngleDiff < Math.PI / 3) {
          // Moving in knockback direction (60 degree cone) - heavily penalized
          speedMultiplier = restrictionConfig.directionPenalty;
        } else if (absAngleDiff > (2 * Math.PI) / 3) {
          // Moving opposite to knockback (60 degree cone) - bonus speed
          speedMultiplier = restrictionConfig.oppositeMovementBonus;
        } else {
          // Moving perpendicular to knockback - moderate penalty
          speedMultiplier = restrictionConfig.sideMovementPenalty;
        }

        // Apply fade out effect if enabled
        if (restrictionConfig.fadeOut) {
          const fadeProgress = elapsed / restrictionConfig.duration;
          // Smoothly interpolate back to normal speed
          const fadeFactor = 1 - Math.pow(1 - fadeProgress, 2); // Ease-out curve
          speedMultiplier = speedMultiplier + (1 - speedMultiplier) * fadeFactor;
        }

        // Apply the restriction
        dx *= speedMultiplier;
        dy *= speedMultiplier;
      }
    } else {
      // Restriction expired, remove it
      myPlayer.movementRestriction.active = false;
    }
  }

  // Scale movement by deltaTime for frame-rate independence
  dx *= config.moveSpeed * deltaTime;
  dy *= config.moveSpeed * deltaTime;

  // Apply movement restriction multiplier
  const speedMultiplier = getMovementSpeedMultiplier();
  dx *= speedMultiplier;
  dy *= speedMultiplier;

  const { dx: slidingDx, dy: slidingDy } = handleCollisions(dx, dy);

  const newX = myPlayer.x + slidingDx;
  const newY = myPlayer.y + slidingDy;

  if (newX > 0 && newX < config.worldWidth) myPlayer.x = newX;
  if (newY > 0 && newY < config.worldHeight) myPlayer.y = newY;
  
  // Only resolve collisions again if there was actual movement input
  if (dx !== 0 || dy !== 0) {
    resolvePlayerCollisions();
    resolveCollisionPenetration();
    resolveWallCollisions();
    resolveSpikeCollisions();
  }

  sendPlayerMovement();
}

/**
 * Rotates the player to face the mouse cursor in world space.
 *
 * Only applies on non-mobile devices. Calculates the angle between the player's position and the mouse's world position using the target camera, then updates the player's rotation. Sends the updated movement data to the server.
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

/**
 * Sets the timestamp of the last server synchronization for the player.
 * @param {number} timestamp - The new server synchronization timestamp.
 */
export function setLastServerSync(timestamp) {
  lastServerSync = timestamp;
}

/**
 * Sets whether the player's position requires reconciliation with the server.
 * @param {boolean} value - True if position reconciliation is needed; otherwise, false.
 */
export function setNeedsPositionReconciliation(value) {
  needsPositionReconciliation = value;
}

/**
 * Sets the corrected player position and rotation received from the server.
 * @param {Object} position - The corrected position and rotation data.
 */
export function setCorrectedPosition(position) {
  correctedPosition = position;
}

/**
 * Gets the movement history for cleanup purposes
 */
export function getMovementHistory() {
  return movementHistory;
}
