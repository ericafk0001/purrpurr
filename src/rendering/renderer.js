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
        const playerData = {
          ...player,
          renderX: player.x,
          renderY: player.y,
          renderRotation: player.rotation,
          id: id,
          type: "player",
        };
        // Set renderX/Y on the actual player object for health bar access
        player.renderX = player.x;
        player.renderY = player.y;
        player.renderRotation = player.rotation;
        return playerData;
      } else {
        // Other players: calculate interpolated render position
        const interpolatedPos = getInterpolatedPosition(player);
        
        // Set interpolated values on the actual player object for health bar access
        player.renderX = interpolatedPos.x;
        player.renderY = interpolatedPos.y;
        player.renderRotation = interpolatedPos.rotation;
        
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
  
  // Reduce interpolation delay for more responsive movement
  const baseDelay = 80; // Reduced from 150ms
  const maxDelay = 200;  // Reduced from 300ms
  
  // Calculate average time between position updates to adapt to network conditions
  let avgTimeDelta = 80; // Default assumption
  if (player.positionHistory && player.positionHistory.length >= 3) {
    const recent = player.positionHistory.slice(-3);
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].timestamp - recent[i-1].timestamp);
    }
    avgTimeDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }
  
  // More aggressive adaptive delay for better responsiveness
  const adaptiveDelay = Math.min(maxDelay, Math.max(baseDelay, avgTimeDelta * 1.2));
  const targetTime = now - adaptiveDelay;

  if (!player.positionHistory || player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Clean old history more aggressively
  const cutoffTime = now - 500; // Keep only last 500ms of history
  player.positionHistory = player.positionHistory.filter(pos => pos.timestamp > cutoffTime);

  if (player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Find interpolation points with improved logic
  let before = null;
  let after = null;

  // Sort by timestamp to ensure proper ordering
  const sortedHistory = [...player.positionHistory].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];

    if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
      before = current;
      after = next;
      break;
    }
  }

  // Improved fallback strategy
  if (!before || !after) {
    // Use the two most recent positions for extrapolation
    if (sortedHistory.length >= 2) {
      before = sortedHistory[sortedHistory.length - 2];
      after = sortedHistory[sortedHistory.length - 1];
      
      // Allow limited extrapolation for smoother movement
      const timeDiff = after.timestamp - before.timestamp;
      const extrapolationTime = targetTime - after.timestamp;
      
      if (extrapolationTime > 0 && extrapolationTime < timeDiff * 0.5) {
        // Safe extrapolation - extend the trend slightly
        const extrapolationFactor = extrapolationTime / timeDiff;
        const velocityX = (after.x - before.x) / timeDiff;
        const velocityY = (after.y - before.y) / timeDiff;
        
        return {
          x: after.x + velocityX * extrapolationTime,
          y: after.y + velocityY * extrapolationTime,
          rotation: after.rotation,
        };
      }
    }
    
    // Final fallback to most recent position
    const latest = sortedHistory[sortedHistory.length - 1];
    return {
      x: latest?.x || player.x,
      y: latest?.y || player.y,
      rotation: latest?.rotation || player.rotation,
    };
  }

  // Calculate interpolation factor
  const timeDiff = after.timestamp - before.timestamp;
  const targetDiff = targetTime - before.timestamp;
  let factor = timeDiff > 0 ? targetDiff / timeDiff : 0;
  
  // Allow slight extrapolation but clamp to reasonable bounds
  factor = Math.min(1.1, Math.max(-0.1, factor));

  // Apply easing for smoother movement
  const easedFactor = easeInOutCubic(Math.max(0, Math.min(1, factor)));

  // Interpolate position
  const interpolatedX = before.x + (after.x - before.x) * easedFactor;
  const interpolatedY = before.y + (after.y - before.y) * easedFactor;

  // Validate interpolated position isn't too far from actual (reduced threshold)
  const distanceFromActual = Math.sqrt(
    Math.pow(interpolatedX - player.x, 2) + Math.pow(interpolatedY - player.y, 2)
  );
  
  // Reduce correction threshold for smoother movement
  if (distanceFromActual > 100) { // Reduced from 200px
    const blendFactor = 0.05; // Reduced from 0.1 for gentler correction
    return {
      x: interpolatedX * (1 - blendFactor) + player.x * blendFactor,
      y: interpolatedY * (1 - blendFactor) + player.y * blendFactor,
      rotation: player.rotation,
    };
  }

  // Improved rotation interpolation
  let rotationDiff = after.rotation - before.rotation;
  
  // Handle angle wrapping more smoothly
  if (rotationDiff > Math.PI) {
    rotationDiff -= 2 * Math.PI;
  } else if (rotationDiff < -Math.PI) {
    rotationDiff += 2 * Math.PI;
  }

  const interpolatedRotation = before.rotation + rotationDiff * easedFactor;

  return {
    x: interpolatedX,
    y: interpolatedY,
    rotation: interpolatedRotation,
  };
}
//67 mustard
/**
 * Easing function for smoother interpolation
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

