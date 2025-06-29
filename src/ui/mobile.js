// Import core variables
import {
  canvas,
  ctx,
  config,
  camera,
  myPlayer,
  socket,
} from "../utils/constants.js";
import {
  handleInventorySelection,
  useItem,
  getInventorySlotFromPosition,
  lastInventoryClick,
  setLastInventoryClick,
} from "../player/inventory.js";
import {
  handleAttackAction,
  autoAttackEnabled,
  toggleAutoAttack,
} from "../player/attack.js";
import {
  sendChatMessage,
  getChatMode,
  setChatMode,
  getChatInput,
  setChatInput,
} from "./chat.js";
import { debugPanelVisible, toggleDebugPanel } from "./debug.js";
import { sendPlayerMovement } from "../network/socketHandlers.js";

/**
 * Calculates the position of a touch event relative to the canvas.
 * @param {TouchEvent} e - The touch event.
 * @param {Touch} touch - The specific touch point to evaluate.
 * @return {{x: number, y: number}} The x and y coordinates relative to the top-left corner of the canvas.
 */
export function getTouchPos(e, touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

/**
 * Determines whether a point lies within or on the boundary of a given circle.
 * @param {number} x - The x-coordinate of the point to test.
 * @param {number} y - The y-coordinate of the point to test.
 * @param {number} centerX - The x-coordinate of the circle's center.
 * @param {number} centerY - The y-coordinate of the circle's center.
 * @param {number} radius - The radius of the circle.
 * @return {boolean} True if the point is inside or on the circle; otherwise, false.
 */
export function isPointInCircle(x, y, centerX, centerY, radius) {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Determines whether a point lies within a specified rectangle.
 * @param {number} x - The x-coordinate of the point to check.
 * @param {number} y - The y-coordinate of the point to check.
 * @param {number} rectX - The x-coordinate of the rectangle's top-left corner.
 * @param {number} rectY - The y-coordinate of the rectangle's top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @return {boolean} True if the point is inside the rectangle, false otherwise.
 */
export function isPointInRect(x, y, rectX, rectY, width, height) {
  return x >= rectX && x <= rectX + width && y >= rectY && y <= rectY + height;
}

/**
 * Returns the key of the mobile menu button at the specified coordinates, or null if none is pressed or the menu is hidden.
 * @param {number} x - The x-coordinate of the touch point.
 * @param {number} y - The y-coordinate of the touch point.
 * @return {string|null} The key of the touched button, or null if no button is pressed.
 */
export function getTouchedMobileButton(x, y) {
  if (!touchControls.showMobileMenu) return null;

  const buttons = touchControls.mobileButtons;
  for (const [key, button] of Object.entries(buttons)) {
    if (isPointInRect(x, y, button.x, button.y, button.width, button.height)) {
      return key;
    }
  }
  return null;
}

// Touch and mobile compatibility - improved iPad detection
export let isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) ||
  (navigator.userAgent.toLowerCase().indexOf("macintosh") > -1 &&
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2);

// Log mobile detection for debugging
console.log("Mobile device detected:", isMobileDevice);

export let touchControls = {
  joystick: {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    radius: 50,
    deadzone: 10,
    touchId: null,
  },
  // Mobile rotation settings
  autoFaceMovement: true, // Auto-face the direction you're moving
  tapToRotate: true, // Tap screen to face that direction
  // Mobile UI buttons
  showMobileMenu: false, // Toggle for mobile menu
  mobileButtons: {
    chat: { x: 0, y: 0, width: 60, height: 30, label: "CHAT" },
    debug: { x: 0, y: 0, width: 60, height: 30, label: "DEBUG" },
    autoAttack: { x: 0, y: 0, width: 60, height: 30, label: "AUTO" },
    apple: { x: 0, y: 0, width: 60, height: 30, label: "APPLE" },
    teleport: { x: 0, y: 0, width: 60, height: 30, label: "TP" },
    collisionDebug: { x: 0, y: 0, width: 80, height: 30, label: "COLLISION" },
    weaponDebug: { x: 0, y: 0, width: 80, height: 30, label: "WEAPON" },
  },
};

export let virtualKeys = { w: false, a: false, s: false, d: false };

/**
 * Renders the mobile control UI elements on the game canvas, including the virtual joystick, rotation mode toggle, menu button, and context-specific instructions or menus.
 */
export function drawMobileControls() {
  if (!isMobileDevice) return;

  ctx.save();

  // Draw virtual joystick
  const joystickBaseX = 100;
  const joystickBaseY = canvas.height - 100;

  // Draw joystick outer ring
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    joystickBaseX,
    joystickBaseY,
    touchControls.joystick.radius,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Draw joystick base
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "gray";
  ctx.beginPath();
  ctx.arc(
    joystickBaseX,
    joystickBaseY,
    touchControls.joystick.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Draw joystick knob
  let knobX = joystickBaseX;
  let knobY = joystickBaseY;

  if (touchControls.joystick.active) {
    const deltaX =
      touchControls.joystick.currentX - touchControls.joystick.startX;
    const deltaY =
      touchControls.joystick.currentY - touchControls.joystick.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Constrain knob to joystick radius
    if (distance <= touchControls.joystick.radius) {
      knobX = joystickBaseX + deltaX;
      knobY = joystickBaseY + deltaY;
    } else {
      const angle = Math.atan2(deltaY, deltaX);
      knobX = joystickBaseX + Math.cos(angle) * touchControls.joystick.radius;
      knobY = joystickBaseY + Math.sin(angle) * touchControls.joystick.radius;
    }
  }

  // Draw knob shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(knobX + 2, knobY + 2, 22, 0, Math.PI * 2);
  ctx.fill();

  // Draw knob
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = touchControls.joystick.active ? "#4CAF50" : "white";
  ctx.beginPath();
  ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
  ctx.fill();

  // Draw knob border
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Draw rotation mode indicator
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const modeText = touchControls.autoFaceMovement
    ? "Auto-Face: ON"
    : "Tap to Face: ON";
  ctx.fillText(modeText, 10, 10);

  // Draw rotation mode toggle button (small button in top-right)
  const toggleButtonX = canvas.width - 30;
  const toggleButtonY = 30;
  ctx.fillStyle = touchControls.autoFaceMovement
    ? "rgba(100, 255, 100, 0.8)"
    : "rgba(255, 100, 100, 0.8)";
  ctx.beginPath();
  ctx.arc(toggleButtonX, toggleButtonY, 20, 0, Math.PI * 2);
  ctx.fill();

  // Add border
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "black";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("↻", toggleButtonX, toggleButtonY);

  // Draw menu toggle button (hamburger menu)
  const menuButtonX = canvas.width - 80;
  const menuButtonY = 30;
  ctx.fillStyle = touchControls.showMobileMenu
    ? "rgba(100, 255, 100, 0.8)"
    : "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.roundRect(menuButtonX - 20, menuButtonY - 15, 40, 30, 5);
  ctx.fill();

  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw hamburger lines
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(menuButtonX - 12, menuButtonY - 8);
  ctx.lineTo(menuButtonX + 12, menuButtonY - 8);
  ctx.moveTo(menuButtonX - 12, menuButtonY);
  ctx.lineTo(menuButtonX + 12, menuButtonY);
  ctx.moveTo(menuButtonX - 12, menuButtonY + 8);
  ctx.lineTo(menuButtonX + 12, menuButtonY + 8);
  ctx.stroke();

  // Draw mobile menu if open
  if (touchControls.showMobileMenu) {
    drawMobileMenu();
  }

  // Draw attack instruction for mobile
  if (!touchControls.showMobileMenu) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Tap anywhere to attack", canvas.width / 2, 10);
  }

  ctx.restore();
}

/**
 * Renders the mobile menu UI, displaying interactive buttons for chat, debug, auto-attack, inventory, teleport, and debug toggles.
 *
 * Button positions and colors reflect their current state and availability, with disabled buttons grayed out when not accessible (e.g., debug-only features). The menu background and all buttons are drawn on the game canvas.
 */
function drawMobileMenu() {
  // Calculate button positions
  const startX = canvas.width - 200;
  const startY = 80;
  const buttonSpacing = 40;

  // Update button positions
  const buttons = touchControls.mobileButtons;
  let yOffset = 0;

  Object.keys(buttons).forEach((key, index) => {
    buttons[key].x = startX;
    buttons[key].y = startY + index * buttonSpacing;
  });

  // Draw menu background
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.beginPath();
  ctx.roundRect(
    startX - 10,
    startY - 10,
    180,
    Object.keys(buttons).length * buttonSpacing + 10,
    10
  );
  ctx.fill();

  // Draw menu buttons
  Object.entries(buttons).forEach(([key, button]) => {
    // Determine button state and color
    let isActive = false;
    let buttonColor = "rgba(255, 255, 255, 0.8)";

    switch (key) {
      case "debug":
        isActive = debugPanelVisible;
        buttonColor = isActive
          ? "rgba(100, 255, 100, 0.8)"
          : "rgba(255, 255, 255, 0.8)";
        break;
      case "autoAttack":
        isActive = autoAttackEnabled;
        buttonColor = isActive
          ? "rgba(100, 255, 100, 0.8)"
          : "rgba(255, 255, 255, 0.8)";
        break;
      case "chat":
        isActive = getChatMode();
        buttonColor = isActive
          ? "rgba(100, 255, 255, 0.8)"
          : "rgba(255, 255, 255, 0.8)";
        break;
      case "teleport":
        // Only show teleport if debug is enabled
        buttonColor = debugPanelVisible
          ? "rgba(255, 255, 255, 0.8)"
          : "rgba(128, 128, 128, 0.5)"; // Grayed out if debug is off
        break;
      case "collisionDebug":
        isActive = config.collision.debug;
        // Only show if debug panel is enabled
        buttonColor = debugPanelVisible
          ? isActive
            ? "rgba(255, 100, 100, 0.8)"
            : "rgba(255, 255, 255, 0.8)"
          : "rgba(128, 128, 128, 0.5)"; // Grayed out if debug is off
        break;
      case "weaponDebug":
        isActive = config.collision.weaponDebug;
        // Only show if debug panel is enabled
        buttonColor = debugPanelVisible
          ? isActive
            ? "rgba(255, 150, 100, 0.8)"
            : "rgba(255, 255, 255, 0.8)"
          : "rgba(128, 128, 128, 0.5)"; // Grayed out if debug is off
        break;
    }

    // Draw button background
    ctx.fillStyle = buttonColor;
    ctx.beginPath();
    ctx.roundRect(button.x, button.y, button.width, button.height, 5);
    ctx.fill();

    // Draw button border
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw button text
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      button.label,
      button.x + button.width / 2,
      button.y + button.height / 2
    );
  });
}
/**
 * Handles actions for mobile menu button presses based on the provided button key.
 *
 * Depending on the button pressed, this function toggles chat mode and manages the mobile keyboard, toggles debug and auto-attack modes, selects the apple inventory slot, sends a teleport request, or toggles collision and weapon debug flags. Some actions are only available when the debug panel is visible.
 * @param {string} buttonKey - The key identifying the mobile button pressed.
 */
function handleMobileButtonPress(buttonKey) {
  switch (buttonKey) {
    case "chat":
      // Toggle chat mode (same as desktop Enter key)
      if (!getChatMode()) {
        setChatMode(true);
        setChatInput("");
        // Show mobile keyboard immediately in response to user touch
        if (isMobileDevice) {
          // Create and focus input immediately in the touch handler
          const hiddenInput = document.createElement("input");
          hiddenInput.type = "text";
          hiddenInput.style.position = "fixed";
          hiddenInput.style.left = "50%";
          hiddenInput.style.top = "50%";
          hiddenInput.style.transform = "translate(-50%, -50%)";
          hiddenInput.style.width = "10px";
          hiddenInput.style.height = "10px";
          hiddenInput.style.opacity = "0.01";
          hiddenInput.style.border = "none";
          hiddenInput.style.outline = "none";
          hiddenInput.style.fontSize = "16px";
          hiddenInput.style.zIndex = "9999";
          hiddenInput.autocomplete = "off";
          hiddenInput.autocorrect = "off";
          hiddenInput.autocapitalize = "off";
          hiddenInput.spellcheck = false;

          document.body.appendChild(hiddenInput);
          hiddenInput.focus();

          // Adjust viewport for keyboard with delay
          setTimeout(() => {
            adjustViewportForKeyboard();
          }, 150);

          // Add event listeners
          hiddenInput.addEventListener("input", (e) => {
            if (getChatMode()) {
              setChatInput(e.target.value);
            }
          });

          hiddenInput.addEventListener("keydown", (e) => {
            if (!getChatMode()) return;
            if (e.key === "Enter") {
              e.preventDefault();
              sendChatMessage(getChatInput());
              setChatMode(false);
              setChatInput("");
              hideMobileKeyboard();
            }
          });

          hiddenInput.addEventListener("blur", () => {
            if (getChatMode()) {
              setTimeout(() => {
                if (
                  hiddenInput &&
                  getChatMode() &&
                  document.body.contains(hiddenInput)
                ) {
                  hiddenInput.focus();
                }
              }, 10);
            }
          });

          window.mobileKeyboardInput = hiddenInput;
        }
      } else {
        // Send message and exit chat mode
        sendChatMessage(getChatInput());
        setChatMode(false);
        setChatInput("");
        hideMobileKeyboard();
      }
      break;

    case "debug":
      // Toggle debug panel (equivalent to ';' key)
      toggleDebugPanel();
      break;

    case "autoAttack":
      // Toggle auto attack (equivalent to 'e' key)
      toggleAutoAttack();
      break;

    case "apple":
      // Quick select apple (equivalent to 'q' key)
      const appleSlot = myPlayer?.inventory?.slots.findIndex(
        (item) => item?.id === "apple"
      );
      if (appleSlot !== -1) {
        handleInventorySelection(appleSlot);
      }
      break;

    case "teleport":
      // Teleport (equivalent to 't' key) - only works when debug is enabled
      if (debugPanelVisible) {
        socket.emit("teleportRequest");
      }
      break;

    case "collisionDebug":
      // Toggle collision debug (equivalent to 'p' key) - only works when debug panel is enabled
      if (debugPanelVisible) {
        config.collision.debug = !config.collision.debug;
      }
      break;

    case "weaponDebug":
      // Toggle weapon debug (equivalent to 'o' key) - only works when debug panel is enabled
      if (debugPanelVisible) {
        config.collision.weaponDebug = !config.collision.weaponDebug;
      }
      break;
  }
}

/**
 * Displays the native mobile keyboard for chat input by creating and focusing a hidden input element.
 *
 * For mobile devices, this function appends a hidden text input to the DOM, focuses it to trigger the keyboard, synchronizes its value with the chat input state, and ensures the keyboard remains open while in chat mode. Adjusts the viewport to accommodate the keyboard as needed.
 */
export function showMobileKeyboard() {
  // For mobile devices, we'll add an on-screen keyboard or focus tricks
  if (isMobileDevice) {
    // Clean up any existing input first
    if (window.mobileKeyboardInput) {
      hideMobileKeyboard();
    }

    // Create a simple input to trigger mobile keyboard
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "text";
    hiddenInput.style.position = "absolute";
    hiddenInput.style.left = "-999px";
    hiddenInput.style.top = "-999px";
    hiddenInput.style.width = "1px";
    hiddenInput.style.height = "1px";
    hiddenInput.style.fontSize = "16px"; // Prevent zoom on iOS
    hiddenInput.autocomplete = "off";
    hiddenInput.autocorrect = "off";
    hiddenInput.autocapitalize = "off";
    hiddenInput.spellcheck = false;
    hiddenInput.value = getChatInput() || "";

    document.body.appendChild(hiddenInput);
    hiddenInput.focus();

    // Adjust viewport for keyboard with a slight delay to ensure keyboard is triggering
    setTimeout(() => {
      adjustViewportForKeyboard();
    }, 150);

    // Add event listeners
    hiddenInput.addEventListener("input", (e) => {
      if (getChatMode()) {
        setChatInput(e.target.value);
      }
    });

    hiddenInput.addEventListener("blur", () => {
      if (getChatMode() && hiddenInput && document.body.contains(hiddenInput)) {
        setTimeout(() => hiddenInput.focus(), 0);
      }
    });

    // Store reference
    window.mobileKeyboardInput = hiddenInput;
  }
}

/**
 * Hides and removes the mobile keyboard input element and restores the original viewport and body styles.
 */
export function hideMobileKeyboard() {
  if (window.mobileKeyboardInput) {
    try {
      window.mobileKeyboardInput.blur();
      if (window.mobileKeyboardInput.parentNode) {
        window.mobileKeyboardInput.parentNode.removeChild(
          window.mobileKeyboardInput
        );
      }
    } catch (e) {
      console.log("Error removing mobile keyboard input:", e);
    }
    window.mobileKeyboardInput = null;
  }

  // Reset viewport when keyboard is hidden
  resetViewportForKeyboard();
}

/**
 * Adjusts the viewport and body styles to accommodate the mobile keyboard, ensuring UI elements remain visible when the keyboard appears.
 *
 * On mobile devices, this function sets appropriate viewport meta tag properties, modifies body styles to prevent scrolling and zooming, and shifts the page content upward when the keyboard is shown. It also adds event listeners to detect keyboard visibility changes and updates the layout accordingly.
 */
function adjustViewportForKeyboard() {
  if (isMobileDevice) {
    // Add viewport meta tag if it doesn't exist
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.appendChild(viewport);
    }

    // Set viewport to prevent zooming and allow proper keyboard handling
    viewport.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

    // Store original body styles if not already stored
    if (!window.originalBodyStyles) {
      window.originalBodyStyles = {
        height: document.body.style.height,
        paddingBottom: document.body.style.paddingBottom,
        overflow: document.body.style.overflow,
        position: document.body.style.position,
      };
    }

    // Prepare body for keyboard
    document.body.style.height = "100vh";
    document.body.style.overflow = "hidden";
    document.body.style.position = "relative";

    // Function to handle viewport changes
    const handleKeyboardChange = () => {
      // Use a timeout to ensure the keyboard animation has started
      setTimeout(() => {
        if (window.visualViewport) {
          const keyboardHeight =
            window.innerHeight - window.visualViewport.height;
          if (keyboardHeight > 100) {
            // Keyboard is visible
            // Push the entire page content up
            document.body.style.transform = `translateY(-${keyboardHeight}px)`;
            document.body.style.transition = "transform 0.3s ease-out";

            // Also add padding to ensure chat input is visible
            document.body.style.paddingBottom = `${keyboardHeight}px`;
          } else {
            // Keyboard is hidden
            document.body.style.transform = "translateY(0px)";
            document.body.style.paddingBottom = "0px";
          }
        } else {
          // Fallback: detect keyboard by window height change
          const currentHeight = window.innerHeight;
          if (!window.mobileOriginalHeight) {
            window.mobileOriginalHeight = currentHeight;
          }

          const heightDiff = window.mobileOriginalHeight - currentHeight;
          if (heightDiff > 150) {
            // Keyboard likely visible
            document.body.style.transform = `translateY(-${heightDiff}px)`;
            document.body.style.transition = "transform 0.3s ease-out";
            document.body.style.paddingBottom = `${heightDiff}px`;
          } else {
            document.body.style.transform = "translateY(0px)";
            document.body.style.paddingBottom = "0px";
          }
        }
      }, 100);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleKeyboardChange);
      window.mobileViewportHandler = handleKeyboardChange;
    } else {
      window.addEventListener("resize", handleKeyboardChange);
      window.mobileResizeHandler = handleKeyboardChange;
    }

    // Trigger initial check
    handleKeyboardChange();
  }
}

/**
 * Restores the original viewport and body styles after the mobile keyboard is hidden.
 *
 * Resets any transformations, transitions, and event listeners added for keyboard handling on mobile devices.
 */
function resetViewportForKeyboard() {
  if (isMobileDevice) {
    // Reset body styles to original
    if (window.originalBodyStyles) {
      document.body.style.height = window.originalBodyStyles.height;
      document.body.style.paddingBottom =
        window.originalBodyStyles.paddingBottom;
      document.body.style.overflow = window.originalBodyStyles.overflow;
      document.body.style.position = window.originalBodyStyles.position;
    }

    // Reset transform
    document.body.style.transform = "translateY(0px)";
    document.body.style.transition = "transform 0.3s ease-out";

    // Clean up event listeners
    if (window.visualViewport && window.mobileViewportHandler) {
      window.visualViewport.removeEventListener(
        "resize",
        window.mobileViewportHandler
      );
      window.mobileViewportHandler = null;
    }

    if (window.mobileResizeHandler) {
      window.removeEventListener("resize", window.mobileResizeHandler);
      window.mobileResizeHandler = null;
    }

    // Reset after transition
    setTimeout(() => {
      document.body.style.transition = "";
    }, 300);
  }
}
/**
 * Handles touch start events for mobile devices, enabling joystick control, UI button interaction, inventory selection and usage, chat input, player rotation, and attack actions.
 * 
 * Processes each touch to determine if it interacts with the joystick, rotation toggle, menu toggle, mobile menu buttons, inventory slots (including double-tap to use consumables), chat send button, or triggers player actions such as rotation and attack. Exits chat mode if tapping outside chat controls. Prevents default browser behavior to ensure smooth game input handling.
 * @param {TouchEvent} e - The touch start event.
 */
export function handleTouchStart(e) {
  e.preventDefault();

  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    const pos = getTouchPos(e, touch);

    // Check joystick area - allow dragging from anywhere in the joystick area
    const joystickBaseX = 100;
    const joystickBaseY = canvas.height - 100;
    if (
      isPointInCircle(
        pos.x,
        pos.y,
        joystickBaseX,
        joystickBaseY,
        touchControls.joystick.radius
      )
    ) {
      touchControls.joystick.active = true;
      touchControls.joystick.startX = joystickBaseX;
      touchControls.joystick.startY = joystickBaseY;
      touchControls.joystick.touchId = touch.identifier; // Store the touch ID

      // Start the joystick at the touch position (clamped to radius)
      const deltaX = pos.x - joystickBaseX;
      const deltaY = pos.y - joystickBaseY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance <= touchControls.joystick.radius) {
        touchControls.joystick.currentX = pos.x;
        touchControls.joystick.currentY = pos.y;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        touchControls.joystick.currentX =
          joystickBaseX + Math.cos(angle) * touchControls.joystick.radius;
        touchControls.joystick.currentY =
          joystickBaseY + Math.sin(angle) * touchControls.joystick.radius;
      }
      continue;
    }

    // Check rotation mode toggle button
    const toggleButtonX = canvas.width - 30;
    const toggleButtonY = 30;
    if (isPointInCircle(pos.x, pos.y, toggleButtonX, toggleButtonY, 20)) {
      // Toggle between auto-face and tap-to-rotate modes
      touchControls.autoFaceMovement = !touchControls.autoFaceMovement;
      console.log(
        "Rotation mode toggled. Auto-face:",
        touchControls.autoFaceMovement
      );
      continue;
    }

    // Check menu toggle button
    const menuButtonX = canvas.width - 80;
    const menuButtonY = 30;
    if (
      isPointInRect(pos.x, pos.y, menuButtonX - 20, menuButtonY - 15, 40, 30)
    ) {
      touchControls.showMobileMenu = !touchControls.showMobileMenu;
      continue;
    }

    // Check mobile menu buttons
    const buttonPressed = getTouchedMobileButton(pos.x, pos.y);
    if (buttonPressed) {
      handleMobileButtonPress(buttonPressed);
      continue;
    }

    // Check if tapping on inventory slot
    const slotIndex = getInventorySlotFromPosition(pos.x, pos.y);
    if (slotIndex !== -1) {
      // Double-tap logic: if tapping the same slot twice quickly, use the item
      const now = Date.now();
      const timeSinceLastTap = now - (lastInventoryClick?.time || 0);
      const tappedSameSlot = slotIndex === (lastInventoryClick?.slot || -1);

      if (tappedSameSlot && timeSinceLastTap < 500) {
        // 500ms double-tap window
        // Double-tap: use the item
        const item = myPlayer?.inventory?.slots[slotIndex];
        if (item?.type === "consumable") {
          useItem(slotIndex);
        }
      } else {
        // Single tap: select the slot
        handleInventorySelection(slotIndex);
      }
      // Remember this tap for double-tap detection
      setLastInventoryClick({ slot: slotIndex, time: now });
      continue; // Don't process as rotation
    }

    // Check mobile send button (if in chat mode)
    const chatMode = getChatMode();
    const chatInput = getChatInput();

    if (chatMode && isMobileDevice && window.mobileSendButton) {
      const btn = window.mobileSendButton;
      if (isPointInRect(pos.x, pos.y, btn.x, btn.y, btn.width, btn.height)) {
        // Send message if there's text
        sendChatMessage(chatInput);
        setChatMode(false);
        setChatInput("");
        hideMobileKeyboard();
        continue;
      }
    }

    // Check if tapping outside chat to exit chat mode
    if (chatMode) {
      // If we get here, the tap wasn't on the chat input box or send button
      // Exit chat mode
      setChatMode(false);
      setChatInput("");
      hideMobileKeyboard();
      continue; // Don't process as attack or rotation
    }

    // Handle touch attack/rotation (tap anywhere else on screen)
    if (myPlayer && !getChatMode()) {
      // Check if tap is on mobile controls that should prevent attacks
      let skipAttack = false;

      if (touchControls.showMobileMenu) {
        // Check if tap is within the mobile menu area (updated for wider menu)
        const menuStartY = canvas.height - 320; // Menu height increased for more buttons
        const menuStartX = canvas.width - 220; // Menu width increased for wider buttons

        if (pos.y >= menuStartY && pos.x >= menuStartX) {
          skipAttack = true;
        }
      }

      // Check if tap is on hamburger menu button
      const menuButtonX = canvas.width - 80;
      const menuButtonY = 30;
      if (
        isPointInRect(pos.x, pos.y, menuButtonX - 20, menuButtonY - 15, 40, 30)
      ) {
        skipAttack = true;
      }

      // Check if tap is on rotation toggle button
      const toggleButtonX = canvas.width - 80;
      const toggleButtonY = 90;
      if (
        isPointInRect(
          pos.x,
          pos.y,
          toggleButtonX - 20,
          toggleButtonY - 15,
          40,
          30
        )
      ) {
        skipAttack = true;
      }

      if (!skipAttack) {
        // First, handle rotation if in tap-to-face mode
        if (!touchControls.autoFaceMovement && touchControls.tapToRotate) {
          const worldTouchX = pos.x + camera.x;
          const worldTouchY = pos.y + camera.y;
          const dx = worldTouchX - myPlayer.x;
          const dy = worldTouchY - myPlayer.y;
          const oldRotation = myPlayer.rotation;
          myPlayer.rotation = Math.atan2(dy, dx) - Math.PI / 2;

          sendPlayerMovement();
        }

        // Then handle attack - use unified attack handler
        handleAttackAction();
      } // Close the if (!skipAttack) block
    }
  }
}

/**
 * Handles touch move events to update the virtual joystick position on mobile devices.
 *
 * If a touch corresponds to the active joystick, updates the joystick knob position, constraining it within the joystick's radius. Does not handle player rotation or other actions during touch move.
 * @param {TouchEvent} e - The touch move event.
 */
export function handleTouchMove(e) {
  e.preventDefault();

  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    const pos = getTouchPos(e, touch);

    // Update joystick - check if this touch belongs to the joystick
    if (
      touchControls.joystick.active &&
      touch.identifier === touchControls.joystick.touchId
    ) {
      const deltaX = pos.x - touchControls.joystick.startX;
      const deltaY = pos.y - touchControls.joystick.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Constrain movement to joystick radius
      if (distance <= touchControls.joystick.radius) {
        touchControls.joystick.currentX = pos.x;
        touchControls.joystick.currentY = pos.y;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        touchControls.joystick.currentX =
          touchControls.joystick.startX +
          Math.cos(angle) * touchControls.joystick.radius;
        touchControls.joystick.currentY =
          touchControls.joystick.startY +
          Math.sin(angle) * touchControls.joystick.radius;
      }
      continue;
    }

    // Note: Removed rotation from touchmove to prevent accidental rotation while dragging
    // Rotation now only happens on deliberate taps (touchstart) outside of controls
  }
}

/**
 * Handles touch end events to reset the virtual joystick state when the controlling touch is released.
 * 
 * Deactivates the joystick, returns the knob to its center position, and clears the associated touch identifier.
 */
export function handleTouchEnd(e) {
  e.preventDefault();

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];

    // Reset joystick
    if (
      touchControls.joystick.active &&
      touch.identifier === touchControls.joystick.touchId
    ) {
      touchControls.joystick.active = false;
      // Return joystick to center
      touchControls.joystick.currentX = touchControls.joystick.startX;
      touchControls.joystick.currentY = touchControls.joystick.startY;
      // Clear the joystick touch ID
      touchControls.joystick.touchId = null;
    }
  }
}
