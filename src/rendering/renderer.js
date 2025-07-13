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
  
  // Detect client FPS to adjust interpolation strategy
  const estimatedFPS = 1000 / (performance.now() - (window.lastFrameTime || performance.now()));
  window.lastFrameTime = performance.now();
  
  // Adaptive interpolation based on client FPS and network conditions
  let baseDelay = 80; // Base delay for interpolation
  let maxDelay = 150;  // Maximum delay
  
  // Increase interpolation buffer for high FPS clients
  if (estimatedFPS > 100) {
    baseDelay = 120; // More buffer for high FPS
    maxDelay = 200;
  }
  
  // Calculate network jitter and adapt delay accordingly
  let avgTimeDelta = 80;
  let jitter = 0;
  
  if (player.positionHistory && player.positionHistory.length >= 4) {
    const recent = player.positionHistory.slice(-4);
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
      const delta = recent[i].timestamp - recent[i-1].timestamp;
      if (delta > 0 && delta < 500) { // Filter out invalid deltas
        deltas.push(delta);
      }
    }
    
    if (deltas.length > 0) {
      avgTimeDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      
      // Calculate jitter (variance in timing)
      const variance = deltas.reduce((sum, delta) => sum + Math.pow(delta - avgTimeDelta, 2), 0) / deltas.length;
      jitter = Math.sqrt(variance);
    }
  }
  
  // Adaptive delay based on network conditions and client FPS
  const jitterMultiplier = Math.min(1.5, 1 + jitter / 50);
  const adaptiveDelay = Math.min(maxDelay, Math.max(baseDelay, avgTimeDelta * jitterMultiplier));
  
  const targetTime = now - adaptiveDelay;

  if (!player.positionHistory || player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Clean old history more conservatively for high FPS
  const cutoffTime = now - Math.max(1000, adaptiveDelay * 3);
  player.positionHistory = player.positionHistory.filter(pos => pos.timestamp > cutoffTime);

  if (player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Sort by timestamp to ensure proper ordering
  const sortedHistory = [...player.positionHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  let before = null;
  let after = null;

  // Find the two positions that bracket our target time
  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];

    if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
      before = current;
      after = next;
      break;
    }
  }

  // Enhanced fallback with limited extrapolation for high FPS smoothness
  if (!before || !after) {
    if (sortedHistory.length >= 3) {
      const p1 = sortedHistory[sortedHistory.length - 3];
      const p2 = sortedHistory[sortedHistory.length - 2];
      const p3 = sortedHistory[sortedHistory.length - 1];
      
      const extrapolationTime = targetTime - p3.timestamp;
      
      // Very conservative extrapolation for high FPS
      if (extrapolationTime > 0 && extrapolationTime < adaptiveDelay * 0.3) {
        const dt1 = p2.timestamp - p1.timestamp;
        const dt2 = p3.timestamp - p2.timestamp;
        
        if (dt1 > 0 && dt2 > 0) {
          // Calculate smooth velocity
          const vx1 = (p2.x - p1.x) / dt1;
          const vy1 = (p2.y - p1.y) / dt1;
          const vx2 = (p3.x - p2.x) / dt2;
          const vy2 = (p3.y - p2.y) / dt2;
          
          // Weighted average favoring recent velocity
          const avgVx = (vx1 * 0.3 + vx2 * 0.7);
          const avgVy = (vy1 * 0.3 + vy2 * 0.7);
          
          return {
            x: p3.x + avgVx * extrapolationTime,
            y: p3.y + avgVy * extrapolationTime,
            rotation: p3.rotation,
          };
        }
      }
    }
    
    // Final fallback
    const latest = sortedHistory[sortedHistory.length - 1];
    return {
      x: latest?.x || player.x,
      y: latest?.y || player.y,
      rotation: latest?.rotation || player.rotation,
    };
  }

  // High-quality interpolation with adaptive smoothing
  const timeDiff = after.timestamp - before.timestamp;
  const targetDiff = targetTime - before.timestamp;
  let factor = timeDiff > 0 ? targetDiff / timeDiff : 0;
  
  // More conservative bounds for high FPS
  factor = Math.min(1.05, Math.max(-0.05, factor));

  // Apply temporal smoothing optimized for high FPS
  const smoothingFactor = Math.min(1, Math.max(0, factor));
  const easedFactor = easeInOutCubic(smoothingFactor);

  // Interpolate with high precision
  const interpolatedX = before.x + (after.x - before.x) * easedFactor;
  const interpolatedY = before.y + (after.y - before.y) * easedFactor;

  // Tighter anti-jitter validation for high FPS
  const distanceFromActual = Math.sqrt(
    Math.pow(interpolatedX - player.x, 2) + Math.pow(interpolatedY - player.y, 2)
  );
  
  // Adaptive threshold based on estimated FPS
  const errorThreshold = estimatedFPS > 100 ? 50 : 75;
  
  if (distanceFromActual > errorThreshold) {
    const blendFactor = estimatedFPS > 100 ? 0.01 : 0.02; // Gentler for high FPS
    return {
      x: interpolatedX * (1 - blendFactor) + player.x * blendFactor,
      y: interpolatedY * (1 - blendFactor) + player.y * blendFactor,
      rotation: player.rotation,
    };
  }

  // Smooth rotation interpolation
  let rotationDiff = after.rotation - before.rotation;
  if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
  else if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

  const interpolatedRotation = before.rotation + rotationDiff * easedFactor;

  return {
    x: interpolatedX,
    y: interpolatedY,
    rotation: interpolatedRotation,
  };
}

/**
 * Temporal easing function optimized for high refresh rate smoothness
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

