// Import required functions
import { canvas, ctx, socket, config, camera } from "../utils/constants.js";
import {
  isMobileDevice,
  showMobileKeyboard,
  hideMobileKeyboard,
} from "./mobile.js";

// Chat variables
export let chatMode = false;
export let chatInput = "";
export let playerMessages = {}; // store messages for each player

export const chatUIState = {
  inputBox: null,
  mobileSendButton: null,
};

/**
 * Returns whether chat input mode is currently active.
 * @return {boolean} True if chat mode is enabled; otherwise, false.
 */
export function getChatMode() {
  return chatMode;
}

/**
 * Sets the chat mode state to enable or disable chat input.
 * @param {boolean} mode - If true, activates chat input mode; if false, deactivates it.
 */
export function setChatMode(mode) {
  chatMode = mode;
}

/**
 * Returns the current text entered in the chat input field.
 * @return {string} The current chat input text.
 */
export function getChatInput() {
  return chatInput;
}

/**
 * Sets the current chat input text.
 * @param {string} input - The text to set as the current chat input.
 */
export function setChatInput(input) {
  chatInput = input;
}

/**
 * Renders the chat input box on the canvas when chat mode is active.
 *
 * On desktop, displays a text input area with a blinking cursor. On mobile devices, includes a "SEND" button and adjusts the input area to avoid overlap. Stores the positions of the input box and send button in global variables for interaction detection.
 */
export function drawChatInput() {
  // Only draw chat input when in chat mode
  if (!chatMode) return;

  const inputBoxX = 10;
  const inputBoxY = canvas.height - 40;
  const inputBoxWidth = canvas.width - 20;
  const inputBoxHeight = 30;

  // Active chat input
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight);

  // Draw a border to make it look more clickable
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight);

  // Store chat input box position for click detection
  chatUIState.inputBox = {
    x: inputBoxX,
    y: inputBoxY,
    width: inputBoxWidth,
    height: inputBoxHeight,
  };

  // On mobile, add a send button
  if (isMobileDevice) {
    const sendButtonWidth = 60;
    const sendButtonX = canvas.width - 70;
    const sendButtonY = canvas.height - 35;

    // Draw send button
    ctx.fillStyle =
      chatInput.trim().length > 0
        ? "rgba(100, 255, 100, 0.8)"
        : "rgba(150, 150, 150, 0.8)";
    ctx.fillRect(sendButtonX, sendButtonY, sendButtonWidth, 20);

    // Draw send button border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(sendButtonX, sendButtonY, sendButtonWidth, 20);

    // Draw send button text
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SEND", sendButtonX + sendButtonWidth / 2, sendButtonY + 14);

    // Store send button position for touch detection
    chatUIState.mobileSendButton = {
      x: sendButtonX,
      y: sendButtonY,
      width: sendButtonWidth,
      height: 20,
    };

    // Adjust chat input area to not overlap with send button
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Chat: " + chatInput + "|", 15, canvas.height - 20);

    // Update chat input box to exclude send button area
    chatUIState.inputBox.width = sendButtonX - inputBoxX - 5;
  } else {
    // Desktop version (original)
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Chat: " + chatInput + "|", 15, canvas.height - 20);
  }
}
/**
 * Renders a chat bubble above the specified player if they have a recent message.
 *
 * The chat bubble displays the player's latest message, positioned above their avatar, and automatically expires after a configured duration.
 * @param {Object} player - The player object containing at least `id`, `x`, and `y` properties.
 */
export function drawChatBubble(player) {
  const message = playerMessages[player.id];
  if (!message) return;

  // check if message is still valid (not expired)
  if (Date.now() - message.timestamp > config.chat.bubbleDisplayTime) {
    delete playerMessages[player.id];
    return;
  }

  const bubbleX = player.x - camera.x;
  const bubbleY = player.y - camera.y - config.playerRadius - 30;
  const bubbleWidth = Math.max(60, message.text.length * 8);
  const bubbleHeight = 25;

  // draw bubble background
  ctx.fillStyle = config.chat.bubbleColor;
  ctx.fillRect(bubbleX - bubbleWidth / 2, bubbleY, bubbleWidth, bubbleHeight);

  // draw text
  ctx.fillStyle = config.chat.textColor;
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message.text, bubbleX, bubbleY + 16);
}

/**
 * Sends a chat message after validating and truncating its length.
 *
 * Trims the input message, enforces the maximum allowed length, stores it locally for immediate display, and emits it to the server for broadcast.
 * @param {string} messageText - The message to send.
 */
export function sendChatMessage(messageText) {
  if (!messageText || messageText.trim().length === 0) return;

  // Use imported config instead of global window access
  const message = messageText.trim().substring(0, config.chat.maxMessageLength);

  // Show own message immediately
  playerMessages[socket.id] = {
    text: message,
    timestamp: Date.now(),
  };

  // Send to server
  socket.emit("chatMessage", {
    message: message,
  });
}

/**
 * Handles keyboard events for chat input, managing chat mode activation, message sending, and input updates.
 *
 * Activates chat mode on Enter, sends messages and exits chat mode on Enter if already active, and exits chat mode on Escape. Updates the chat input string with typed characters or backspace when in chat mode. Integrates with mobile keyboard input when on mobile devices.
 *
 * @param {KeyboardEvent} e - The keyboard event to process.
 * @returns {boolean} True if the event was handled by the chat system; otherwise, false.
 */
export function handleChatKeydown(e) {
  if (e.key === "Enter") {
    if (!chatMode) {
      // enter chat mode
      setChatMode(true);
      setChatInput("");
      // Show mobile keyboard if on mobile device - call the function
      if (isMobileDevice) {
        showMobileKeyboard();
      }
    } else {
      // send message and exit chat mode
      sendChatMessage(chatInput);
      setChatMode(false);
      setChatInput("");
      // Hide mobile keyboard if on mobile device
      if (isMobileDevice) {
        hideMobileKeyboard();
      }
    }
    return true; // Event handled
  }

  if (e.key === "Escape" && chatMode) {
    // Exit chat mode without sending message
    setChatMode(false);
    setChatInput("");
    if (isMobileDevice) {
      hideMobileKeyboard();
    }
    return true; // Event handled
  }

  if (chatMode) {
    // On mobile, don't process desktop keyboard events if mobile input exists
    if (isMobileDevice && window.mobileKeyboardInput) {
      return true; // Let the mobile input handle all typing
    }

    if (e.key === "Backspace") {
      setChatInput(chatInput.slice(0, -1));
    } else if (e.key.length === 1) {
      setChatInput(chatInput + e.key);
    }

    // Sync with mobile keyboard input if it exists
    if (
      window.mobileKeyboardInput &&
      window.mobileKeyboardInput.value !== chatInput
    ) {
      window.mobileKeyboardInput.value = chatInput;
    }
    return true; // Event handled
  }

  return false; // Event not handled
}
