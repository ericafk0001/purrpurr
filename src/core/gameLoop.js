// Import required functions
import { updatePosition, updateRotation } from "../player/player.js";
import { updateCamera } from "./camera.js";
import { drawPlayers } from "../rendering/renderer.js";
import {
  requestAttack,
  canAutoAttackWithCurrentItem,
  isAttacking,
  lastAttackTime,
  attackDuration,
  autoAttackEnabled,
  attackAnimationProgress,
  setIsAttacking,
  setAttackAnimationProgress,
} from "../player/attack.js";
import { items, players, myPlayer } from "../utils/constants.js";

// Timing and FPS variables
export let lastFrameTime = performance.now();
export let frameCount = 0;
export let currentFps = 0;
export let lastFpsUpdate = 0;
export const FPS_UPDATE_INTERVAL = 500; // Update FPS every 500ms
export const FIXED_TIMESTEP = 1000 / 60; // 16.67ms for 60 FPS physics
export const MAX_FRAME_SKIP = 3; // Reduced from 5 to prevent accumulation
export let accumulatedTime = 0;
export let lastUpdateTime = performance.now();

/**
 * Main game loop that manages fixed timestep physics updates and variable rendering.
 *
 * Accumulates elapsed time to process game logic updates at consistent intervals for stable physics simulation, while rendering frames with interpolation for smooth visuals. Handles FPS calculation, player attack animation state, auto-attack scheduling, camera updates, and player rendering. Continuously schedules itself using `requestAnimationFrame`.
 *
 * @param {number} timestamp - The current time in milliseconds provided by `requestAnimationFrame`.
 */
export function gameLoop(timestamp) {
  const frameTime = performance.now();
  const frameDelta = frameTime - lastFrameTime;
  lastFrameTime = frameTime;
  frameCount++;

  // Update FPS counter at intervals
  if (frameTime - lastFpsUpdate > FPS_UPDATE_INTERVAL) {
    currentFps = Math.round((frameCount * 1000) / (frameTime - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = frameTime;
  }

  // Calculate time since last game update
  const currentTime = performance.now();
  let deltaTime = currentTime - lastUpdateTime;

  // Cap deltaTime to prevent spiral of death on high refresh rates
  if (deltaTime > 100) {
    deltaTime = 100;
  }

  // Accumulate time for fixed timestep updates
  accumulatedTime += deltaTime;
  lastUpdateTime = currentTime;

  // Process game logic in fixed timestep increments with frame skip limit
  let updateCount = 0;
  while (accumulatedTime >= FIXED_TIMESTEP && updateCount < MAX_FRAME_SKIP) {
    // Update game physics at exactly 60 FPS regardless of render FPS
    updateGameLogic(FIXED_TIMESTEP / 1000); // Pass exactly 1/60th second
    accumulatedTime -= FIXED_TIMESTEP;
    updateCount++;
  }

  // If we hit the frame skip limit, reset accumulated time to prevent buildup
  if (updateCount >= MAX_FRAME_SKIP) {
    accumulatedTime = 0;
  }

  // Update smooth transitions for all players before rendering
  updatePlayerSmoothTransitions(frameDelta);

  // Calculate interpolation fraction for rendering
  const interpolation = accumulatedTime / FIXED_TIMESTEP;

  // Render at interpolated state
  const cameraDeltaTime = frameDelta / 1000; // Convert ms to seconds
  updateCamera(cameraDeltaTime);
  drawPlayers(interpolation);
  requestAnimationFrame(gameLoop);
}

/**
 * Updates smooth position transitions for all players
 */
function updatePlayerSmoothTransitions(frameDelta) {
  const now = performance.now();

  Object.values(players).forEach((player) => {
    if (player._smoothTransition) {
      const elapsed = now - player._smoothTransition.startTime;
      const progress = Math.min(1, elapsed / player._smoothTransition.duration);

      if (progress >= 1) {
        // Transition complete
        player._smoothTransition = null;
      } else {
        // Apply smooth easing
        const easedProgress = easeOutCubic(progress);
        const currentX =
          player._smoothTransition.startX +
          (player._smoothTransition.targetX - player._smoothTransition.startX) *
            easedProgress;
        const currentY =
          player._smoothTransition.startY +
          (player._smoothTransition.targetY - player._smoothTransition.startY) *
            easedProgress;

        // Update render position for ultra-smooth display
        if (!player.renderX) player.renderX = currentX;
        if (!player.renderY) player.renderY = currentY;

        player.renderX += (currentX - player.renderX) * 0.3;
        player.renderY += (currentY - player.renderY) * 0.3;
      }
    }
  });
}

/**
 * Smooth easing function
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Advances the game state by a fixed timestep, updating player attack animations, auto-attack scheduling, movement, and rotation.
 *
 * Updates the local player's attack animation progress and handles state transitions, including auto-attack queuing based on weapon cooldowns. Iterates through all players to update their attack animation states. Applies movement and rotation updates for all players using the provided timestep.
 * @param {number} deltaTime - The fixed timestep duration in milliseconds for this update cycle.
 */
export function updateGameLogic(deltaTime) {
  if (!myPlayer) return;

  // Update attack animation for local player
  if (isAttacking && myPlayer) {
    const attackTime = Date.now();
    const attackElapsed = attackTime - lastAttackTime;

    // Get the actual weapon animation duration
    const activeItem = myPlayer.inventory?.slots?.[myPlayer.inventory.activeSlot];
    const weaponUseTime = activeItem ? items[activeItem.id]?.useTime || 250 : 250;

    if (attackElapsed <= weaponUseTime) {
      // Update animation progress
      const newProgress = Math.min(1, attackElapsed / weaponUseTime);
      setAttackAnimationProgress(newProgress);
      myPlayer.attackProgress = newProgress;
      myPlayer.attackStartTime = lastAttackTime;
    } else {
      // End attack animation
      setIsAttacking(false);
      myPlayer.attacking = false;
      myPlayer.attackProgress = 0;
      myPlayer.attackStartTime = null;
      myPlayer.attackStartRotation = null;

      // Queue next attack only if auto-attack is enabled and we have valid weapon
      if (autoAttackEnabled && canAutoAttackWithCurrentItem()) {
        // Request next attack immediately - the attack system will handle cooldown timing
        requestAttack();
      }
    }
  }

  // Update all players' attack animations
  const animTime = Date.now();
  Object.values(players).forEach((player) => {
    if (!player.attacking || !player.attackStartTime) return;

    const elapsed = animTime - player.attackStartTime;
    // Get attack duration from player's weapon or use default
    const activeItem = player.inventory?.slots?.[player.inventory.activeSlot];
    const attackDuration = activeItem
      ? items[activeItem.id]?.useTime || 400
      : 400;

    // Update animation progress
    if (elapsed <= attackDuration) {
      player.attackProgress = Math.min(1, elapsed / attackDuration);
    } else {
      // End animation
      player.attacking = false;
      player.attackProgress = 0;
      player.attackStartTime = null;
      player.attackStartRotation = null;
    }
  });

  // Update player position and rotation with fixed timestep
  updatePosition(deltaTime);
  updateRotation();
}
