// Import required variables
import { ctx, assets, camera, config } from "../utils/constants.js";
import { drawChatBubble } from "../ui/chat.js";

/**
 * Draws the player character at its current or interpolated position, applying rotation for movement and attack animations, and renders the equipped item and chat bubble if present.
 */
export function drawPlayer(player) {
  if (!player) return;

  // Enhanced position calculation with client-side prediction
  let x, y, rotation;
  
  if (player.renderX !== undefined) {
    // For remote players, use interpolated positions
    x = player.renderX;
    y = player.renderY;
    rotation = player.renderRotation !== undefined ? player.renderRotation : player.rotation;
  } else {
    // For local player, add micro-smoothing for ultra-responsive feel
    x = player.x;
    y = player.y;
    rotation = player.rotation;
    
    // Apply client-side smoothing to local player movement
    if (player === myPlayer) {
      // Store previous render position for smoothing
      if (!player._lastRenderPos) {
        player._lastRenderPos = { x: x, y: y, timestamp: performance.now() };
      }
      
      const now = performance.now();
      const timeDelta = now - player._lastRenderPos.timestamp;
      
      if (timeDelta > 0 && timeDelta < 100) { // Only smooth for reasonable time deltas
        const smoothingFactor = Math.min(1, timeDelta / 16.67); // Target 60fps smoothing
        const lerpFactor = 1 - Math.pow(0.1, smoothingFactor); // Exponential smoothing
        
        x = player._lastRenderPos.x + (x - player._lastRenderPos.x) * lerpFactor;
        y = player._lastRenderPos.y + (y - player._lastRenderPos.y) * lerpFactor;
      }
      
      // Update stored position
      player._lastRenderPos = { x: x, y: y, timestamp: now };
    }
  }

  const screenX = x - camera.x;
  const screenY = y - camera.y;

  // Store the EXACT render position of the sprite for UI alignment
  player.spriteX = screenX;
  player.spriteY = screenY;
  player.spriteRotation = rotation;

  // Store render position for collision debug and health bar alignment
  player.displayX = screenX;
  player.displayY = screenY;
  player.displayRotation = rotation;

  if (assets.player && assets.loadStatus.player) {
    ctx.save();
    
    ctx.translate(screenX, screenY);

    let baseRotation = rotation || 0;

    // Enhanced attack animation with smoother transitions
    if (player.attacking && player.attackProgress !== undefined) {
      const maxSwingAngle = (110 * Math.PI) / 180;
      let swingAngle = 0;

      const attackRotation = player.attackStartRotation !== undefined
        ? player.attackStartRotation
        : baseRotation;

      // Smooth attack animation curve
      if (player.attackProgress < 0.5) {
        // Swing out with ease-out
        const easeOut = 1 - Math.pow(1 - (player.attackProgress / 0.5), 3);
        swingAngle = -easeOut * maxSwingAngle;
      } else {
        // Swing back with ease-in
        const easeIn = Math.pow((player.attackProgress - 0.5) / 0.5, 2);
        swingAngle = -maxSwingAngle + easeIn * maxSwingAngle;
      }

      baseRotation = attackRotation + swingAngle;
    }

    ctx.rotate(baseRotation);

    // Draw equipped item
    if (player.inventory && player.inventory.slots) {
      const activeItem = player.inventory.slots[player.inventory.activeSlot];
      if (activeItem && assets[activeItem.id]) {
        drawEquippedItem(activeItem, player);
      }
    }

    // Draw player sprite
    ctx.drawImage(
      assets.player,
      -config.playerRadius,
      -config.playerRadius,
      config.playerRadius * 2,
      config.playerRadius * 2
    );

    ctx.restore();
    
    // Use render position for chat bubble
    const chatPlayer = { ...player, x: x, y: y };
    drawChatBubble(chatPlayer);
  }
}
/**
 * Renders the player's equipped item on the canvas at the correct position, scale, and rotation relative to the player.
 *
 * Uses item-specific rendering parameters to ensure the item appears naturally in the player's hands.
 */
export function drawEquippedItem(item, player) {
  ctx.save();

  // Get rendering settings for this item type
  const renderInfo = getItemRenderInfo(item, player);

  // Apply position and rotation
  ctx.rotate(renderInfo.rotation);

  // Draw the item with proper scale
  ctx.drawImage(
    assets[item.id],
    renderInfo.x,
    renderInfo.y,
    renderInfo.width,
    renderInfo.height
  );

  ctx.restore();
}
/**
 * Calculates rendering parameters for an equipped item relative to the player, including position offsets, size, and rotation.
 *
 * Uses item-specific render options when available, with defaults for scaling and aspect ratio. Adjusts rotation and other parameters for certain item types such as "hammer" and "spike".
 *
 * @param {Object} item - The equipped item to render.
 * @param {Object} player - The player holding the item.
 * @returns {Object} Rendering parameters: x and y offsets, width, height, and rotation angle.
 */
export function getItemRenderInfo(item, player) {
  // Use item-specific render options or defaults
  const renderOpts = item.renderOptions || {};

  // Get scale - either from item config or use default
  const scaleMultiplier = renderOpts.scale || 1.2;
  const baseScale = config.playerRadius * scaleMultiplier;

  // Calculate dimensions preserving aspect ratio if specified
  let width = baseScale;
  let height = baseScale;

  if (renderOpts.width && renderOpts.height && renderOpts.preserveRatio) {
    const ratio = renderOpts.width / renderOpts.height;
    if (ratio > 1) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  // Get position offsets - either from item config or use defaults
  const offsetXMultiplier =
    renderOpts.offsetX !== undefined ? renderOpts.offsetX : 0.9;
  const offsetYMultiplier =
    renderOpts.offsetY !== undefined ? renderOpts.offsetY : -0.25;

  const offsetX = config.playerRadius * offsetXMultiplier;
  const offsetY = baseScale * offsetYMultiplier;

  // Base settings that apply to most items
  const info = {
    x: offsetX,
    y: offsetY,
    width: width,
    height: height,
    rotation: Math.PI / 2, // horizontal by default
  };

  // Customize based on item type
  switch (item.id) {
    case "hammer":
      // No additional rotation for hammer since the entire body rotates now
      break;

    case "spike":
      // Make spike held orientation match placement orientation
      info.rotation = renderOpts.rotationOffset || 0;
      break;

    // Add more cases for future items here
    // case "sword":
    //   info.x = ...
    //   break;

    // Default rendering for unknown items
    default:
      break;
  }

  return info;
}
