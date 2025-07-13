// Import required functions
import { updatePosition, updateRotation } from "../player/player.js";
import { updateCamera } from "./camera.js";
import { drawPlayers } from "../rendering/renderer.js";
import {
  startAttack,
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
export const MAX_FRAME_SKIP = 5; // Maximum physics updates per frame
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

  // Cap deltaTime to prevent spiral of death
  if (deltaTime > 250) {
    deltaTime = 250;
  }

  // Accumulate time for fixed timestep updates
  accumulatedTime += deltaTime;
  lastUpdateTime = currentTime;

  // Process game logic in fixed timestep increments with frame skip limit
  let updateCount = 0;
  while (accumulatedTime >= FIXED_TIMESTEP && updateCount < MAX_FRAME_SKIP) {
    // Update game physics at exactly 60 FPS regardless of render FPS
    updateGameLogic(FIXED_TIMESTEP); // Pass fixed timestep in milliseconds
    accumulatedTime -= FIXED_TIMESTEP;
    updateCount++;
  }

  // If we hit the frame skip limit, reset accumulated time to prevent buildup
  if (updateCount >= MAX_FRAME_SKIP) {
    accumulatedTime = 0;
  }

  // Calculate interpolation fraction for rendering
  const interpolation = Math.min(1, accumulatedTime / FIXED_TIMESTEP);

  // Render at interpolated state with frame-rate independent camera
  const cameraDeltaTime = Math.min(frameDelta, FIXED_TIMESTEP) / 1000; // Cap camera delta
  updateCamera(cameraDeltaTime);
  drawPlayers(interpolation);
  requestAnimationFrame(gameLoop);
}

/**
 * Advances the game state by a fixed timestep, ensuring consistent physics regardless of FPS.
 *
 * Updates the local player's attack animation progress and handles state transitions, including auto-attack queuing based on weapon cooldowns. Iterates through all players to update their attack animation states. Applies movement and rotation updates for all players using the provided timestep.
 * @param {number} fixedDeltaTime - The fixed timestep duration in milliseconds for this update cycle.
 */
export function updateGameLogic(fixedDeltaTime) {
  if (!myPlayer) return;

  // Convert fixed timestep to seconds for calculations
  const deltaTime = fixedDeltaTime / 1000;

  // Update attack animation for local player
  if (isAttacking && myPlayer) {
    const attackTime = Date.now();
    const attackElapsed = attackTime - lastAttackTime;

    if (attackElapsed <= attackDuration) {
      // Update animation progress
      const newProgress = Math.min(1, attackElapsed / attackDuration);
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
        const activeItem = myPlayer.inventory?.slots?.[myPlayer.inventory.activeSlot];
        const weaponCooldown = activeItem ? items[activeItem.id]?.cooldown || 800 : 800;
        const cooldownRemaining = weaponCooldown - attackDuration;
        setTimeout(startAttack, Math.max(0, cooldownRemaining));
      }
    }
  }

  // Update all players' attack animations
  const animTime = Date.now();
  Object.values(players).forEach((player) => {
    if (!player.attacking || !player.attackStartTime) return;

    const elapsed = animTime - player.attackStartTime;
    const activeItem = player.inventory?.slots?.[player.inventory.activeSlot];
    const attackDuration = activeItem ? items[activeItem.id]?.useTime || 400 : 400;

    if (elapsed <= attackDuration) {
      player.attackProgress = Math.min(1, elapsed / attackDuration);
    } else {
      player.attacking = false;
      player.attackProgress = 0;
      player.attackStartTime = null;
      player.attackStartRotation = null;
    }
  });

  // Update player position and rotation with FIXED timestep (always 1/60th second)
  updatePosition(deltaTime);
  updateRotation();
}
