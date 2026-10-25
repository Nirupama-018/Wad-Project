
import { io } from "socket.io-client";

const ACK_TIMEOUT_MS = 10000;

/**
 * Creates the Socket.IO client without assuming how Member 2
 * authenticates connections.
 *
 * Pass the server URL and authentication payload when those
 * contracts are confirmed.
 */
export function createChatSocket({ serverUrl, auth = {} }) {
  if (!serverUrl) {
    throw new Error("A Socket.IO server URL is required.");
  }

  return io(serverUrl, {
    autoConnect: false,
    auth,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: ACK_TIMEOUT_MS,
  });
}

/**
 * Sends a message using Member 3's existing event contract.
 * The server derives senderId from the authenticated socket.
 */
export function sendChatMessage(socket, {
  conversationId,
  content,
  clientMessageId,
}) {
  if (!socket?.connected) {
    return Promise.reject(new Error("Not connected to the chat server."));
  }

  if (!conversationId || !content?.trim()) {
    return Promise.reject(
      new Error("A conversation and message are required.")
    );
  }

  const payload = {
    conversationId,
    content: content.trim(),
    clientMessageId,
  };

  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(
      "message:send",
      payload,
      (timeoutError, response) => {
        if (timeoutError) {
          reject(new Error("The server did not acknowledge the message."));
          return;
        }

        if (!response?.success) {
          reject(
            new Error(response?.message || "Message could not be sent.")
          );
          return;
        }

        // Use the persisted server response, not a fabricated message ID.
        resolve(response.message);
      }
    );
  });
}

/**
 * Sends a delivery or read receipt using the existing event names.
 */
export function sendMessageReceipt(socket, event, messageId) {
  const allowedEvents = ["message:delivered", "message:read"];

  if (!allowedEvents.includes(event)) {
    return Promise.reject(new Error("Unsupported receipt event."));
  }

  if (!socket?.connected || !messageId) {
    return Promise.reject(
      new Error("A connection and message ID are required.")
    );
  }

  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(
      event,
      { messageId },
      (timeoutError, response) => {
        if (timeoutError) {
          reject(new Error("The server did not acknowledge the receipt."));
          return;
        }

        if (!response?.success) {
          reject(new Error(response?.message || "Receipt failed."));
          return;
        }

        resolve(response.receipt);
      }
    );
  });
}

/**
 * Reports client activity for online/away presence.
 */
export function reportActivity(socket, isVisible = true) {
  if (!socket?.connected) return;

  socket.emit("presence:activity", { isVisible }, (response) => {
    if (response && !response.success) {
      console.warn("Presence activity was rejected:", response.code);
    }
  });
}
