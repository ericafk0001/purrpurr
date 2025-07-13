// Import required functions
import { drawPlayer } from "./drawPlayer.js";
import {
  drawTree,
  drawStone,
  drawWall,
  drawSpike,
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
  spikes,
  stones,
  trees,
  camera,
  myPlayer,
} from "../utils/constants.js";
import { isMobileDevice } from "../ui/mobile.js";

/**
 * Renders the complete game scene and user interface on the canvas.
 *
 * Draws the background, world objects (walls, spikes, players with interpolated positions, stones, trees) in fixed layers, the world border, optional collision debug overlays, and all UI components including health bars, inventory, chat input, floating numbers, and debug panel. Mobile controls are rendered if the device is mobile.
 *
 * @param {number} [interpolation=1] - Interpolation factor for smoothing non-local player movement between previous and current positions.
 */
export function drawPlayers(interpolation = 1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background and grid first
  drawBackground();

  // Define draw layers with interpolated positions
  const drawLayers = [
    // Layer 1 - Walls and Spikes (bottom)
    ...walls
      .filter((wall) => isInViewport(wall))
      .map((wall) => ({ ...wall, type: "wall" })),
    ...spikes
      .filter((spike) => isInViewport(spike))
      .map((spike) => ({ ...spike, type: "spike" })),

    // Layer 2 - Players and Stones (middle)
    ...Object.entries(players).map(([id, player]) => {
      if (player === myPlayer) {
        // Local player uses immediate position
        return {
          ...player,
          renderX: player.x,
          renderY: player.y,
          renderRotation: player.rotation,
          id: id,
          type: "player",
        };
      } else {
        // Other players: calculate interpolated render position but don't modify actual position
        const interpolatedPos = getInterpolatedPosition(player);
        
        return {
          ...player,
          renderX: interpolatedPos.x,
          renderY: interpolatedPos.y,
          renderRotation: interpolatedPos.rotation,
          id: id,
          type: "player",
        };
      }
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
      case "spike":
        drawSpike(obj);
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

/**
 * Calculates interpolated position for a player based on their position history
 */
function getInterpolatedPosition(player) {
  const now = Date.now();
  
  // Adaptive interpolation delay based on network conditions
  const baseDelay = 150; // Increased from 100ms for better network tolerance
  const maxDelay = 300;  // Maximum delay for poor connections
  
  // Calculate average time between position updates to adapt to network conditions
  let avgTimeDelta = 100; // Default assumption
  if (player.positionHistory && player.positionHistory.length >= 3) {
    const recent = player.positionHistory.slice(-3);
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].timestamp - recent[i-1].timestamp);
    }
    avgTimeDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }
  
  // Adaptive delay: use longer delay for higher latency
  const adaptiveDelay = Math.min(maxDelay, Math.max(baseDelay, avgTimeDelta * 1.5));
  const targetTime = now - adaptiveDelay;

  if (!player.positionHistory || player.positionHistory.length < 2) {
    // Fallback to current position if no history
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Clean old history to prevent memory bloat and improve performance
  const cutoffTime = now - 1000; // Keep only last 1 second of history
  player.positionHistory = player.positionHistory.filter(pos => pos.timestamp > cutoffTime);

  // Find two positions to interpolate between with better tolerance
  let before = null;
  let after = null;

  // Look for the best interpolation points
  for (let i = player.positionHistory.length - 2; i >= 0; i--) {
    const current = player.positionHistory[i];
    const next = player.positionHistory[i + 1];

    if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
      before = current;
      after = next;
      break;
    }
  }

  // Fallback strategies for poor network conditions
  if (!before || !after) {
    // Try to find closest available positions
    if (player.positionHistory.length >= 2) {
      const sortedByTime = [...player.positionHistory].sort((a, b) => Math.abs(a.timestamp - targetTime) - Math.abs(b.timestamp - targetTime));
      before = sortedByTime[0];
      after = sortedByTime[1];
      
      // Ensure proper ordering
      if (before.timestamp > after.timestamp) {
        [before, after] = [after, before];
      }
    }
  }

  // Final fallback to most recent position
  if (!before || !after) {
    const latest = player.positionHistory[player.positionHistory.length - 1];
    return {
      x: latest?.x || player.x,
      y: latest?.y || player.y,
      rotation: latest?.rotation || player.rotation,
    };
  }

  // Calculate interpolation factor with bounds checking
  const timeDiff = after.timestamp - before.timestamp;
  const targetDiff = targetTime - before.timestamp;
  let factor = timeDiff > 0 ? targetDiff / timeDiff : 0;
  
  // Clamp factor to prevent extrapolation beyond reasonable bounds
  factor = Math.min(1.2, Math.max(-0.2, factor)); // Allow slight extrapolation

  // Smooth factor to reduce jitter
  const smoothedFactor = factor; // Could add easing here if needed

  // Interpolate position with distance-based validation
  const interpolatedX = before.x + (after.x - before.x) * smoothedFactor;
  const interpolatedY = before.y + (after.y - before.y) * smoothedFactor;

  // Validate interpolated position isn't too far from actual position (anti-teleport)
  const distanceFromActual = Math.sqrt(
    Math.pow(interpolatedX - player.x, 2) + Math.pow(interpolatedY - player.y, 2)
  );
  
  // If interpolated position is too far from actual, gradually move towards actual
  if (distanceFromActual > 200) { // 200px threshold
    const blendFactor = 0.1; // 10% blend towards actual position
    return {
      x: interpolatedX * (1 - blendFactor) + player.x * blendFactor,
      y: interpolatedY * (1 - blendFactor) + player.y * blendFactor,
      rotation: player.rotation, // Use actual rotation when correcting
    };
  }

  // Interpolate rotation with improved angle wrapping
  let rotationDiff = after.rotation - before.rotation;
  
  // Handle angle wrapping more smoothly
  if (rotationDiff > Math.PI) {
    rotationDiff -= 2 * Math.PI;
  } else if (rotationDiff < -Math.PI) {
    rotationDiff += 2 * Math.PI;
  }

  const interpolatedRotation = before.rotation + rotationDiff * smoothedFactor;

  return {
    x: interpolatedX,
    y: interpolatedY,
    rotation: interpolatedRotation,
  };
}

