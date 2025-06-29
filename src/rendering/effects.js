// Import core variables
import {
  ctx,
  camera,
  config,
  players,
  trees,
  stones,
  walls,
  items,
} from "../utils/constants.js";
import { isInViewport } from "./drawWorld.js";

// Effects variables
export const floatingNumbers = [];

/**
 * Renders and updates floating number effects, such as damage or healing indicators, on the game canvas.
 *
 * Removes expired floating numbers, updates their positions and transparency, and draws them with color coding based on type.
 */
export function drawFloatingNumbers() {
  const now = performance.now();

  // Update and draw each floating number
  for (let i = floatingNumbers.length - 1; i >= 0; i--) {
    const number = floatingNumbers[i];
    const age = now - number.createdAt;

    if (age >= number.duration) {
      floatingNumbers.splice(i, 1);
      continue;
    }

    // Calculate alpha based on age
    const alpha = Math.max(0, 1 - age / number.duration);

    // Update position
    number.x += number.velocity.x;
    number.y += number.velocity.y;

    // Slow down vertical movement
    number.velocity.y += 0.1;

    // Draw the number
    ctx.save();
    ctx.fillStyle =
      number.type === "heal"
        ? `rgba(100, 247, 42, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`;
    ctx.font = "38px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const screenX = number.x - camera.x;
    const screenY = number.y - camera.y;

    // Draw text
    ctx.fillText(
      `${number.type === "heal" ? "+" : "-"}${number.value}`,
      screenX,
      screenY
    );

    ctx.restore();
  }
}
/**
 * Adds a floating number effect at the specified position to display a value such as damage or healing.
 * 
 * The floating number will animate with a randomized horizontal spread and upward motion, fading out over a fixed duration. The `type` parameter determines the color or style (e.g., "damage" or "heal").
 * 
 * @param {number} x - The x-coordinate where the floating number appears.
 * @param {number} y - The y-coordinate where the floating number appears.
 * @param {number} value - The numeric value to display, rounded to the nearest integer.
 * @param {string} [type="damage"] - The type of floating number, affecting its appearance (e.g., "damage" or "heal").
 */
export function addFloatingNumber(x, y, value, type = "damage") {
  floatingNumbers.push({
    x,
    y,
    value: Math.round(value), // Round to whole numbers
    type,
    createdAt: performance.now(),
    duration: 1000, // How long the number stays visible (ms)
    velocity: { x: (Math.random() - 0.5) * 2, y: -3 }, // Random spread with upward motion
  });
}

/**
 * Renders collision boundaries for players, trees, stones, and walls, and visualizes weapon hitboxes for debugging.
 *
 * Draws collision circles for all relevant game entities within the viewport using configured sizes and colors. If weapon debug mode is enabled, also displays the attack range and angle for players wielding a hammer, including a highlight when attacking.
 */
export function drawCollisionCircles() {
  ctx.strokeStyle = config.collision.debugColor;
  ctx.lineWidth = 2;

  // player collision circles
  Object.values(players).forEach((player) => {
    ctx.beginPath();
    ctx.arc(
      player.x - camera.x,
      player.y - camera.y,
      config.collision.sizes.player,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  });

  // tree collision circles
  trees.forEach((tree) => {
    if (isInViewport(tree)) {
      ctx.beginPath();
      ctx.arc(
        tree.x - camera.x,
        tree.y - camera.y,
        config.collision.sizes.tree,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  });

  // stone collision circles
  stones.forEach((stone) => {
    if (isInViewport(stone)) {
      ctx.beginPath();
      ctx.arc(
        stone.x - camera.x,
        stone.y - camera.y,
        config.collision.sizes.stone,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  });

  // Add wall collision circles
  walls.forEach((wall) => {
    if (isInViewport(wall)) {
      ctx.beginPath();
      ctx.arc(
        wall.x - camera.x,
        wall.y - camera.y,
        config.collision.sizes.wall,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  });

  // Draw weapon hitboxes if enabled
  if (config.collision.weaponDebug) {
    Object.values(players).forEach((player) => {
      if (player.inventory && player.inventory.slots) {
        const activeItem = player.inventory.slots[player.inventory.activeSlot];

        if (activeItem && activeItem.id === "hammer") {
          // Calculate weapon range around player based on facing direction
          const weaponRange = items.hammer.range || 120;

          // Get player's facing angle
          const playerAngle = player.rotation + Math.PI / 2;

          // Calculate the center of the weapon hitbox in front of player
          const hitboxX = player.x + Math.cos(playerAngle) + weaponRange / 2;
          const hitboxY = player.y + Math.sin(playerAngle) + weaponRange / 2;

          // Draw weapon hitbox
          ctx.fillStyle = config.collision.weaponDebugColor;

          // Draw arc showing attack range and angle
          ctx.beginPath();
          // 120 degree arc in front (PI/3 on each side)
          const startAngle = playerAngle - Math.PI / 3;
          const endAngle = playerAngle + Math.PI / 3;
          ctx.moveTo(player.x - camera.x, player.y - camera.y);
          ctx.arc(
            player.x - camera.x,
            player.y - camera.y,
            weaponRange,
            startAngle,
            endAngle
          );
          ctx.closePath();
          ctx.fill();

          // Draw outline
          ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
          ctx.stroke();

          // If attacking, highlight the active area
          if (player.attacking) {
            ctx.fillStyle = "rgba(255, 100, 0, 0.4)";
            ctx.beginPath();
            ctx.arc(
              player.x - camera.x,
              player.y - camera.y,
              weaponRange,
              startAngle,
              endAngle
            );
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    });
  }
}
