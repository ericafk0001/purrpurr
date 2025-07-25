// Import core variables
import {
  ctx,
  assets,
  camera,
  canvas,
  config,
  items,
} from "../utils/constants.js";

// World rendering variables
export const wallShakes = new Map(); // Track wall shake animations

/**
 * Renders a tree object at its world coordinates on the canvas, applying rotation and scaling according to configuration.
 *
 * The tree is drawn only if its asset is loaded. The image is centered at the tree's position relative to the camera and scaled to the configured radius.
 */
export function drawTree(tree) {
  if (assets.tree && assets.loadStatus.tree) {
    ctx.save();
    ctx.translate(tree.x - camera.x, tree.y - camera.y);
    ctx.rotate(tree.rotation || 0);
    ctx.drawImage(
      assets.tree,
      -config.trees.radius,
      -config.trees.radius,
      config.trees.radius * 2,
      config.trees.radius * 2
    );
    ctx.restore();
  }
}
/**
 * Renders a stone object on the canvas at its world coordinates, applying rotation and scaling according to configuration.
 *
 * The stone is drawn only if its asset is loaded. The image is centered at the stone's position relative to the camera and scaled to the configured radius.
 */
export function drawStone(stone) {
  if (assets.stone && assets.loadStatus.stone) {
    ctx.save();
    ctx.translate(stone.x - camera.x, stone.y - camera.y);
    ctx.rotate(stone.rotation || 0);
    ctx.drawImage(
      assets.stone,
      -config.stones.radius,
      -config.stones.radius,
      config.stones.radius * 2,
      config.stones.radius * 2
    );
    ctx.restore();
  }
}

/**
 * Draws a wall at its world position with optional rotation, shake animation, and damage transparency effects.
 *
 * The wall is rendered using the wall asset, scaled according to configuration. If a shake animation is active for the wall, a decaying random offset is applied. The wall's transparency reflects its current health, becoming more transparent as it takes damage.
 * @param {Object} wall - The wall object containing position, rotation, and health properties.
 */
export function drawWall(wall) {
  if (assets.wall) {
    ctx.save();
    // Calculate shake offset
    let shakeX = 0;
    let shakeY = 0;
    const shakeData = wallShakes.get(`${wall.x},${wall.y}`);

    if (shakeData) {
      const elapsed = performance.now() - shakeData.startTime;
      if (elapsed < shakeData.duration) {
        const progress = elapsed / shakeData.duration;
        const decay = 1 - progress; // Shake gets weaker over time
        shakeX = (Math.random() * 2 - 1) * shakeData.magnitude * decay;
        shakeY = (Math.random() * 2 - 1) * shakeData.magnitude * decay;
      } else {
        wallShakes.delete(`${wall.x},${wall.y}`);
      }
    } // Apply position, rotation and shake in a single translation
    ctx.translate(wall.x - camera.x + shakeX, wall.y - camera.y + shakeY);
    ctx.rotate(wall.rotation || 0); // Use wall's stored rotation

    const wallScale = items.wall.renderOptions.scale;
    const baseSize = 60;
    const wallWidth = baseSize * wallScale;
    const wallHeight = Math.floor(wallWidth * (417 / 480));

    // Apply damage visual effect
    if (wall.health < items.wall.maxHealth) {
      ctx.globalAlpha = 0.3 + (0.7 * wall.health) / items.wall.maxHealth;
    }

    ctx.drawImage(
      assets.wall,
      -wallWidth / 2,
      -wallHeight / 2,
      wallWidth,
      wallHeight
    );

    ctx.restore();
  }
}

/**
 * Draws the border of the world as a rectangle on the canvas, positioned relative to the camera.
 */
export function drawWorldBorder() {
  ctx.strokeStyle = config.colors.worldBorder;
  ctx.lineWidth = 4;
  ctx.strokeRect(-camera.x, -camera.y, config.worldWidth, config.worldHeight);
}

/**
 * Checks if a world object is visible within the current camera viewport.
 *
 * Uses the object's `radius` property, or a default size if not present, to determine if any part of the object overlaps the visible canvas area.
 * @param {Object} object - The object with `x`, `y`, and optional `radius` properties representing its position and size.
 * @return {boolean} True if any portion of the object is within the viewport; otherwise, false.
 */
export function isInViewport(object) {
  const radius = object.radius || Math.max(30, config.collision.sizes.player);
  return (
    object.x + radius > camera.x &&
    object.x - radius < camera.x + canvas.width &&
    object.y + radius > camera.y &&
    object.y - radius < camera.y + canvas.height
  );
}

/**
 * Renders a spike object on the canvas at its world position, applying rotation, shake animation, and damage transparency effects.
 *
 * The spike is drawn using the spike asset, scaled according to configuration. If a shake animation is active for the spike, a decaying random offset is applied to its position. The spike becomes more transparent as its health decreases.
 * @param {Object} spike - The spike object with position, rotation, and health properties.
 */
export function drawSpike(spike) {
  if (assets.spike && assets.loadStatus.spike) {
    ctx.save();
    // Calculate shake offset
    let shakeX = 0;
    let shakeY = 0;
    const shakeData = wallShakes.get(`spike_${spike.x},${spike.y}`);

    if (shakeData) {
      const elapsed = performance.now() - shakeData.startTime;
      if (elapsed < shakeData.duration) {
        const progress = elapsed / shakeData.duration;
        const decay = 1 - progress; // Shake gets weaker over time
        shakeX = (Math.random() * 2 - 1) * shakeData.magnitude * decay;
        shakeY = (Math.random() * 2 - 1) * shakeData.magnitude * decay;
      } else {
        wallShakes.delete(`spike_${spike.x},${spike.y}`);
      }
    } // Apply position, rotation and shake in a single translation
    ctx.translate(spike.x - camera.x + shakeX, spike.y - camera.y + shakeY);
    ctx.rotate(spike.rotation || 0); // Use spike's stored rotation

    // Calculate size
    const spikeScale = items.spike.renderOptions.scale;
    const baseSize = 60;
    const spikeWidth = baseSize * spikeScale;
    const spikeHeight = spikeWidth; // Spikes are square

    // Apply damage visual effect
    if (spike.health < items.spike.maxHealth) {
      ctx.globalAlpha = 0.3 + (0.7 * spike.health) / items.spike.maxHealth;
    }

    ctx.drawImage(
      assets.spike,
      -spikeWidth / 2,
      -spikeHeight / 2,
      spikeWidth,
      spikeHeight
    );

    ctx.restore();
  }
}
