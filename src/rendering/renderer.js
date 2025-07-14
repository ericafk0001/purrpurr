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
  
  // Enhanced adaptive interpolation system
  const baseDelay = 120; // Slightly increased for more stability
  const maxDelay = 250;  // Higher max for poor connections
  
  // Detect client refresh rate and network conditions
  const estimatedRefreshRate = Math.min(240, Math.max(60, 1000 / (performance.now() - (window.lastRenderTime || performance.now()))));
  window.lastRenderTime = performance.now();
  
  // Calculate network jitter and packet timing
  let avgTimeDelta = 80;
  let jitterVariance = 0;
  
  if (player.positionHistory && player.positionHistory.length >= 4) {
    const recent = player.positionHistory.slice(-6); // Use more samples
    const deltas = [];
    
    for (let i = 1; i < recent.length; i++) {
      const timeDelta = recent[i].timestamp - recent[i-1].timestamp;
      if (timeDelta > 0 && timeDelta < 500) {
        deltas.push(timeDelta);
      }
    }
    
    if (deltas.length > 2) {
      avgTimeDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      
      // Calculate jitter (variance in packet timing)
      const variance = deltas.reduce((sum, delta) => sum + Math.pow(delta - avgTimeDelta, 2), 0) / deltas.length;
      jitterVariance = Math.sqrt(variance);
    }
  }
  
  // Adaptive delay based on refresh rate and network conditions
  let adaptiveDelay = baseDelay;
  
  // Increase buffer for high refresh rates to prevent stuttering
  if (estimatedRefreshRate > 120) {
    adaptiveDelay = Math.max(adaptiveDelay, avgTimeDelta * 1.8);
  }
  
  // Increase buffer for jittery connections
  if (jitterVariance > 15) {
    adaptiveDelay = Math.max(adaptiveDelay, avgTimeDelta * 1.5 + jitterVariance);
  }
  
  adaptiveDelay = Math.min(maxDelay, adaptiveDelay);
  const targetTime = now - adaptiveDelay;

  if (!player.positionHistory || player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  // Keep longer history for better interpolation quality
  const cutoffTime = now - Math.max(2000, adaptiveDelay * 6);
  player.positionHistory = player.positionHistory.filter(pos => pos.timestamp > cutoffTime);

  if (player.positionHistory.length < 2) {
    return {
      x: player.x || 0,
      y: player.y || 0,
      rotation: player.rotation || 0,
    };
  }

  const sortedHistory = [...player.positionHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  let before = null;
  let after = null;

  // Find optimal interpolation bracket
  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];

    if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
      before = current;
      after = next;
      break;
    }
  }

  // Enhanced extrapolation with velocity-based prediction
  if (!before || !after) {
    if (sortedHistory.length >= 3) {
      const p1 = sortedHistory[sortedHistory.length - 3];
      const p2 = sortedHistory[sortedHistory.length - 2];
      const p3 = sortedHistory[sortedHistory.length - 1];
      
      const extrapolationTime = targetTime - p3.timestamp;
      
      // Allow reasonable extrapolation for smoother movement
      if (extrapolationTime > 0 && extrapolationTime < adaptiveDelay * 0.4) {
        // Calculate velocity with acceleration consideration
        const dt1 = p2.timestamp - p1.timestamp;
        const dt2 = p3.timestamp - p2.timestamp;
        
        if (dt1 > 0 && dt2 > 0) {
          // Current velocity
          const vx2 = (p3.x - p2.x) / dt2;
          const vy2 = (p3.y - p2.y) / dt2;
          
          // Previous velocity
          const vx1 = (p2.x - p1.x) / dt1;
          const vy1 = (p2.y - p1.y) / dt1;
          
          // Acceleration
          const ax = (vx2 - vx1) / dt2;
          const ay = (vy2 - vy1) / dt2;
          
          // Predict position with velocity + acceleration
          const predictedX = p3.x + vx2 * extrapolationTime + 0.5 * ax * extrapolationTime * extrapolationTime;
          const predictedY = p3.y + vy2 * extrapolationTime + 0.5 * ay * extrapolationTime * extrapolationTime;
          
          // Dampen acceleration for stability
          const dampingFactor = Math.max(0.3, 1 - extrapolationTime / (adaptiveDelay * 0.4));
          
          return {
            x: p3.x + (predictedX - p3.x) * dampingFactor,
            y: p3.y + (predictedY - p3.y) * dampingFactor,
            rotation: p3.rotation,
          };
        }
      }
    }
    
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
  
  // Adaptive bounds based on network conditions
  const maxExtrapolation = jitterVariance > 10 ? 1.05 : 1.1;
  factor = Math.min(maxExtrapolation, Math.max(-0.05, factor));

  // Choose easing based on refresh rate and network quality
  let easedFactor;
  if (estimatedRefreshRate > 144 && jitterVariance < 5) {
    // High refresh + stable network: use linear for minimal latency
    easedFactor = Math.max(0, Math.min(1, factor));
  } else if (jitterVariance > 20) {
    // Jittery network: use heavy smoothing
    easedFactor = easeInOutQuart(Math.max(0, Math.min(1, factor)));
  } else {
    // Standard case: balanced smoothing
    easedFactor = easeInOutQuint(Math.max(0, Math.min(1, factor)));
  }

  const interpolatedX = before.x + (after.x - before.x) * easedFactor;
  const interpolatedY = before.y + (after.y - before.y) * easedFactor;

  // Adaptive error correction based on network quality
  const distanceFromActual = Math.sqrt(
    Math.pow(interpolatedX - player.x, 2) + Math.pow(interpolatedY - player.y, 2)
  );
  
  // Dynamic error threshold
  let errorThreshold = 60;
  if (estimatedRefreshRate > 120) errorThreshold = 40;
  if (jitterVariance > 15) errorThreshold = 100;
  
  if (distanceFromActual > errorThreshold) {
    // Gentler correction for high refresh rates
    const blendFactor = estimatedRefreshRate > 120 ? 0.02 : 0.08;
    return {
      x: interpolatedX * (1 - blendFactor) + player.x * blendFactor,
      y: interpolatedY * (1 - blendFactor) + player.y * blendFactor,
      rotation: player.rotation,
    };
  }

  // Enhanced rotation interpolation with wraparound handling
  let rotationDiff = after.rotation - before.rotation;
  
  // Handle angle wraparound more smoothly
  if (rotationDiff > Math.PI) {
    rotationDiff -= 2 * Math.PI;
  } else if (rotationDiff < -Math.PI) {
    rotationDiff += 2 * Math.PI;
  }
  
  // Use same easing for rotation
  const interpolatedRotation = before.rotation + rotationDiff * easedFactor;

  return {
    x: interpolatedX,
    y: interpolatedY,
    rotation: interpolatedRotation,
  };
}

/**
 * Enhanced easing functions for different scenarios
 */
function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

