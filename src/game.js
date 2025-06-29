// Import modules
import { handleChatKeydown, getChatMode } from "./ui/chat.js";
import { handleDebugKeydown } from "./ui/debug.js";
import {
  handleInventoryKeydown,
  handleInventoryMouseClick,
} from "./player/inventory.js";
import {
  handleAttackKeydown,
  handleAttackMouseClick,
} from "./player/attack.js";
import {
  handleMovementKeydown,
  handleMovementKeyup,
} from "./physics/movement.js";
import { handleMouseMove } from "./player/player.js";
import { initializeResizeHandler, resizeCanvas } from "./core/camera.js";
import { loadAssets } from "./core/assets.js";
import { gameLoop } from "./core/gameLoop.js";
import { ctx, canvas } from "./utils/constants.js";
import {
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  isMobileDevice,
} from "./ui/mobile.js";
// Import socket handlers to register them
import "./network/socketHandlers.js";

// Initialize canvas rendering context settings
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

// Set initial canvas size
resizeCanvas();
initializeResizeHandler();

// Unified keyboard event handler
window.addEventListener("keydown", (e) => {
  // Handle chat input first (highest priority)
  if (handleChatKeydown(e)) return;

  // Don't process any other keys when in chat mode
  if (getChatMode()) return;

  // Handle debug commands
  if (handleDebugKeydown(e)) return;

  // Handle inventory selection
  if (handleInventoryKeydown(e)) return;

  // Handle attack commands
  if (handleAttackKeydown(e)) return;

  // Handle movement
  handleMovementKeydown(e);
});

window.addEventListener("keyup", (e) => {
  handleMovementKeyup(e);
});

window.addEventListener("mousemove", (e) => {
  handleMouseMove(e);
});

// Mouse click handler
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    // Left click
    // Check inventory click first
    if (handleInventoryMouseClick(e)) return;

    // Handle attack click
    handleAttackMouseClick(e);
  }
});

// Touch event handlers for mobile compatibility
if (isMobileDevice) {
  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  // Prevent context menu on mobile
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

// Load assets and start game loop
loadAssets();
requestAnimationFrame(gameLoop);
