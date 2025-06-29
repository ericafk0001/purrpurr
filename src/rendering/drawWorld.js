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

// World drawing functions
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

// Add new function to draw walls
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

export function drawWorldBorder() {
  ctx.strokeStyle = config.colors.worldBorder;
  ctx.lineWidth = 4;
  ctx.strokeRect(-camera.x, -camera.y, config.worldWidth, config.worldHeight);
}

// Update isInViewport to handle non-circular objects
export function isInViewport(object) {
  const radius = object.radius || Math.max(30, config.collision.sizes.player);
  return (
    object.x + radius > camera.x &&
    object.x - radius < camera.x + canvas.width &&
    object.y + radius > camera.y &&
    object.y - radius < camera.y + canvas.height
  );
}
