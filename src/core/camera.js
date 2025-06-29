// Import core variables
import {
  config,
  canvas,
  camera,
  targetCamera,
  myPlayer,
} from "../utils/constants.js";

// Camera configuration
export const CAMERA_SMOOTHING_BASE = config.camera?.smoothing || 0.04; // Base smoothing factor to calculate actual smoothing

// Camera functions
/**
 * Smoothly updates the camera position to follow the player, centering the view and applying frame-rate independent smoothing.
 * @param {number} [deltaTime=1/60] - The elapsed time since the last update, in seconds.
 */
export function updateCamera(deltaTime = 1 / 60) {
  if (!myPlayer) return;

  // Get current rendering position (which may be interpolated)
  const playerRenderX =
    myPlayer.renderX !== undefined ? myPlayer.renderX : myPlayer.x;
  const playerRenderY =
    myPlayer.renderY !== undefined ? myPlayer.renderY : myPlayer.y;

  // Calculate target camera position (centered on player)
  targetCamera.x = playerRenderX - canvas.width / 2;
  targetCamera.y = playerRenderY - canvas.height / 2;

  // Calculate frame-rate independent smoothing factor
  // Lower value = smoother but slower camera
  const smoothingFactor =
    1 - Math.pow(1 - CAMERA_SMOOTHING_BASE, deltaTime * 60);

  // Smoothly interpolate current camera position toward target
  camera.x += (targetCamera.x - camera.x) * smoothingFactor;
  camera.y += (targetCamera.y - camera.y) * smoothingFactor;
}
/**
 * Sets the canvas size to match the current window dimensions.
 */
export function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Sets up a window resize event listener to automatically resize the canvas when the window size changes.
 */
export function initializeResizeHandler() {
  window.addEventListener("resize", resizeCanvas);
}
