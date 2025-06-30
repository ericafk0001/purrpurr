// Import required variables
import { ctx, assets, camera, config } from "../utils/constants.js";
import { drawChatBubble } from "../ui/chat.js";

/**
 * Draws the player character at its current or interpolated position, applying rotation for movement and attack animations, and renders the equipped item and chat bubble if present.
 *
 * The player sprite is rendered relative to the camera, with attack swings smoothly animating the sprite's rotation. If the player has an equipped item, it is drawn with appropriate positioning and scaling. A chat bubble is displayed if the player has active chat content.
 */
export function drawPlayer(player) {
  if (assets.player && assets.loadStatus.player) {
    ctx.save();
    // Use interpolated position if available, otherwise use normal position
    const renderX = player.renderX !== undefined ? player.renderX : player.x;
    const renderY = player.renderY !== undefined ? player.renderY : player.y;
    ctx.translate(renderX - camera.x, renderY - camera.y);

    let baseRotation = player.rotation || 0;

    if (player.attacking && player.attackProgress !== undefined) {
      const maxSwingAngle = (110 * Math.PI) / 180;
      let swingAngle = 0;

      // Use the rotation from when the attack started for consistent direction
      const attackRotation =
        player.attackStartRotation !== undefined
          ? player.attackStartRotation
          : baseRotation;

      if (player.attackProgress < 0.5) {
        swingAngle = -(player.attackProgress / 0.5) * maxSwingAngle;
      } else {
        swingAngle =
          -maxSwingAngle +
          ((player.attackProgress - 0.5) / 0.5) * maxSwingAngle;
      }

      // Apply swing to the attack start rotation, not current rotation
      baseRotation = attackRotation + swingAngle;
    }

    ctx.rotate(baseRotation);

    // Draw equipped item for all players if they have inventory
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
    drawChatBubble(player);
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
