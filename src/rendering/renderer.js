// Import required functions
import { drawPlayer } from "./drawPlayer.js";
import {
  drawTree,
  drawStone,
  drawWall,
  drawWorldBorder,
  isInViewport,
} from "./drawWorld.js";
import { drawHealthBars, drawInventory } from "../ui/hud.js";
import { drawChatInput } from "../ui/chat.js";
import { drawDebugPanel } from "../ui/debug.js";
import { drawFloatingNumbers, drawCollisionCircles } from "./effects.js";
import { drawMobileControls } from "../ui/mobile.js";
// Import required variables
import {
  ctx,
  canvas,
  config,
  players,
  walls,
  stones,
  trees,
  camera,
  myPlayer,
} from "../utils/constants.js";
import { isMobileDevice } from "../ui/mobile.js";

/**
 * Renders the entire game scene and UI elements on the canvas.
 *
 * Draws the background, world objects (walls, players with interpolated positions, stones, trees) in fixed layers, the world border, optional collision debug overlays, and all UI components including health bars, inventory, chat input, floating numbers, and debug panel. Mobile controls are rendered if the device is mobile.
 *
 * @param {number} [interpolation=1] - Interpolation factor for smoothing non-local player movement between previous and current positions.
 */
export function drawPlayers(interpolation = 1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background and grid first
  drawBackground();

  // Define draw layers with fixed order (no Y-sorting)
  const drawLayers = [
    // Layer 1 - Walls (bottom)
    ...walls
      .filter((wall) => isInViewport(wall))
      .map((wall) => ({ ...wall, type: "wall" })),

    // Layer 2 - Players and Stones (middle)
    ...Object.entries(players).map(([id, player]) => {
      // Store the player with interpolated position if available
      if (player.previousPosition && player !== myPlayer) {
        // Interpolate between previous and current position
        const interpolatedX =
          player.previousPosition.x +
          (player.x - player.previousPosition.x) * interpolation;
        const interpolatedY =
          player.previousPosition.y +
          (player.y - player.previousPosition.y) * interpolation;

        return {
          ...player,
          renderX: interpolatedX,
          renderY: interpolatedY,
          id: id,
          type: "player",
        };
      }

      return {
        ...player,
        renderX: player.x,
        renderY: player.y,
        id: id,
        type: "player",
      };
    }),
    ...stones
      .filter((stone) => isInViewport(stone))
      .map((stone) => ({ ...stone, type: "stone" })),

    // Layer 3 - Trees (top)
    ...trees
      .filter((tree) => isInViewport(tree))
      .map((tree) => ({ ...tree, type: "tree" })),
  ];

  // Draw everything in fixed layer order
  drawLayers.forEach((obj) => {
    switch (obj.type) {
      case "wall":
        drawWall(obj);
        break;
      case "player":
        drawPlayer(obj);
        break;
      case "stone":
        drawStone(obj);
        break;
      case "tree":
        drawTree(obj);
        break;
    }
  });

  drawWorldBorder();
  if (config.collision.debug) {
    drawCollisionCircles();
  }

  // Draw UI elements last
  drawHealthBars();
  drawInventory();
  drawChatInput();
  drawFloatingNumbers(); // Add this line before debug panel
  drawDebugPanel(); // Add this line

  // Draw mobile controls for touch devices
  if (isMobileDevice) {
    drawMobileControls();
  }
}
/**
 * Fills the canvas with the configured background color and optionally draws a grid overlay aligned with the camera position.
 */
export function drawBackground() {
  // Fill background with light green
  ctx.fillStyle = config.colors.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid if enabled
  if (config.colors.grid && config.colors.grid.enabled) {
    const gridSize = config.colors.grid.size;
    const startX = Math.floor(-camera.x % gridSize);
    const startY = Math.floor(-camera.y % gridSize);
    const endX = canvas.width;
    const endY = canvas.height;

    ctx.strokeStyle = config.colors.grid.lineColor;
    ctx.lineWidth = config.colors.grid.lineWidth || 1;
    ctx.beginPath();

    // Draw vertical lines
    for (let x = startX; x < endX; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, endY);
    }

    // Draw horizontal lines
    for (let y = startY; y < endY; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(endX, y);
    }

    ctx.stroke();
  }
}
