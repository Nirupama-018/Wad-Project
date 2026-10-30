const AWAY_TIMEOUT_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5 * 1000;


function registerRealtimeHandlers(
  io,
  { awayTimeoutMs = AWAY_TIMEOUT_MS } = {}
) {
  if (!io || typeof io.on !== "function" || typeof io.emit !== "function") {
    throw new Error("A valid shared Socket.IO server instance is required.");
  }

  if (!Number.isFinite(awayTimeoutMs) || awayTimeoutMs < 1) {
    throw new Error("awayTimeoutMs must be a positive number.");
  }

  // userId -> { sockets: Set<socketId>, lastActiveAt: Date, awayTimer }
  const presence = new Map();

  function getStatus(userId, now = Date.now()) {
    const entry = presence.get(userId);

    if (!entry || entry.sockets.size === 0) {
      return "offline";
    }

    return now - entry.lastActiveAt.getTime() >= awayTimeoutMs
      ? "away"
      : "online";
  }

  function getPresence(userId) {
    const entry = presence.get(userId);

    return {
      userId,
      status: getStatus(userId),
      lastActiveAt: entry?.lastActiveAt ?? null,
    };
  }

  function broadcastPresence(userId) {
    io.emit("presence:update", getPresence(userId));
  }

  function clearAwayTimer(entry) {
    if (entry.awayTimer) {
      clearTimeout(entry.awayTimer);
      entry.awayTimer = null;
    }
  }

  function scheduleAwayTimer(userId, entry) {
    clearAwayTimer(entry);

    if (entry.sockets.size === 0) {
      return;
    }

    const elapsed = Date.now() - entry.lastActiveAt.getTime();
    const remaining = Math.max(1, awayTimeoutMs - elapsed);

    entry.awayTimer = setTimeout(() => {
      // Ignore stale timers for removed or replaced presence entries.
      if (presence.get(userId) !== entry || entry.sockets.size === 0) {
        return;
      }

      const timeSinceActivity =
        Date.now() - entry.lastActiveAt.getTime();

      // Recheck in case the timer fired slightly early.
      if (timeSinceActivity < awayTimeoutMs) {
        scheduleAwayTimer(userId, entry);
        return;
      }

      entry.awayTimer = null;

      if (getStatus(userId) === "away") {
        broadcastPresence(userId);
      }
    }, remaining);

    // Don't keep a standalone Node.js process alive just for this timer.
    if (typeof entry.awayTimer.unref === "function") {
      entry.awayTimer.unref();
    }
  }

  function sendPresenceSnapshot(socket) {
    const users = [...presence.keys()].map(getPresence);
    socket.emit("presence:snapshot", { users });
  }

  io.on("connection", (socket) => {
    // Populated by the existing backend socketAuth middleware.
    const userId = socket.userId;

    if (typeof userId !== "string" || userId.length === 0) {
      socket.disconnect(true);
      return;
    }

    let entry = presence.get(userId);

    if (!entry) {
      entry = {
        sockets: new Set(),
        lastActiveAt: new Date(),
        awayTimer: null,
      };
      presence.set(userId, entry);
    }

    const previousStatus = getStatus(userId);

    entry.sockets.add(socket.id);
    entry.lastActiveAt = new Date();

    // A new connection makes the user active again.
    scheduleAwayTimer(userId, entry);

    socket.join(`user:${userId}`);
    socket.data.lastActivityUpdate = Date.now();

    sendPresenceSnapshot(socket);

    if (previousStatus !== getStatus(userId)) {
      broadcastPresence(userId);
    }

    socket.on("presence:activity", (payload = {}, acknowledge) => {
      const reply =
        typeof acknowledge === "function" ? acknowledge : () => {};

      if (
        !payload ||
        typeof payload !== "object" ||
        payload.isVisible !== true
      ) {
        reply({ success: false, code: "INVALID_ACTIVITY" });
        return;
      }

      const now = Date.now();
      const lastUpdate = socket.data.lastActivityUpdate ?? 0;

      if (now - lastUpdate < ACTIVITY_THROTTLE_MS) {
        reply({ success: true, throttled: true });
        return;
      }

      const currentEntry = presence.get(userId);

      if (!currentEntry || !currentEntry.sockets.has(socket.id)) {
        reply({ success: false, code: "NOT_CONNECTED" });
        return;
      }

      const previousActivityStatus = getStatus(userId);

      currentEntry.lastActiveAt = new Date(now);
      socket.data.lastActivityUpdate = now;

      // Reset the away countdown whenever accepted activity arrives.
      scheduleAwayTimer(userId, currentEntry);

      if (previousActivityStatus !== getStatus(userId)) {
        broadcastPresence(userId);
      }

      reply({ success: true, throttled: false });
    });

    socket.on("disconnect", () => {
      const currentEntry = presence.get(userId);

      if (!currentEntry) {
        return;
      }

      currentEntry.sockets.delete(socket.id);

      // Another tab/device may still be connected.
      if (currentEntry.sockets.size === 0) {
        clearAwayTimer(currentEntry);
        presence.delete(userId);
        broadcastPresence(userId);
      }
    });
  });

  return {
    getPresence,
  };
}


function registerMessagingHandlers(io, { messageService, Conversation }) {
  if (
    !io ||
    typeof io.on !== "function" ||
    typeof io.to !== "function"
  ) {
    throw new Error("A valid shared Socket.IO server is required.");
  }

  if (
    !messageService ||
    typeof messageService.saveMessage !== "function" ||
    typeof messageService.updateMessageStatus !== "function"
  ) {
    throw new Error("A valid messageService is required.");
  }

  if (!Conversation || typeof Conversation.findOne !== "function") {
    throw new Error("The Conversation model is required.");
  }

  async function getOtherParticipant(conversationId, userId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (
      !conversation ||
      !Array.isArray(conversation.participants)
    ) {
      throw new Error("Conversation not found or access denied.");
    }

    const recipientId = conversation.participants
      .map((participant) => participant.toString())
      .find((participantId) => participantId !== userId);

    if (!recipientId) {
      throw new Error("Conversation recipient could not be resolved.");
    }

    return recipientId;
  }

  // Used for both live messages and Member 4's scheduled-message callback.
  // This function delivers an already-persisted message; it never saves it.
  function deliverMessage({ message, recipientId }) {
    if (
      !message ||
      typeof message !== "object" ||
      typeof recipientId !== "string" ||
      !recipientId
    ) {
      throw new Error("A message and recipientId are required.");
    }

    io.to(`user:${recipientId}`).emit("message:new", message);
  }

  async function handleReceipt(socket, status, payload, acknowledge) {
    const reply =
      typeof acknowledge === "function" ? acknowledge : () => {};

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.messageId !== "string" ||
      !payload.messageId
    ) {
      reply({
        success: false,
        code: "INVALID_PAYLOAD",
      });
      return;
    }

    const userId = socket.userId;

    if (typeof userId !== "string" || !userId) {
      reply({
        success: false,
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    try {
      // The database service checks conversation membership and ensures
      // the sender cannot acknowledge their own message.
      const result = await messageService.updateMessageStatus({
        messageId: payload.messageId,
        userId,
        status,
      });

      const senderId = await getOtherParticipant(
        result.conversationId,
        userId
      );

      // Notify the original sender's connected devices.
      io.to(`user:${senderId}`).emit("message:status", result);

      reply({
        success: true,
        receipt: result,
      });
    } catch {
      reply({
        success: false,
        code: "RECEIPT_FAILED",
        message: "The message status could not be updated.",
      });
    }
  }

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Identity must be supplied by the shared authentication middleware.
    if (typeof userId !== "string" || !userId) {
      return;
    }

    socket.on("message:send", async (payload = {}, acknowledge) => {
      const reply =
        typeof acknowledge === "function" ? acknowledge : () => {};

      if (
        !payload ||
        typeof payload !== "object" ||
        typeof payload.conversationId !== "string" ||
        !payload.conversationId ||
        typeof payload.content !== "string" ||
        !payload.content.trim() ||
        (payload.clientMessageId !== undefined &&
            (typeof payload.clientMessageId !== "string" ||
            !payload.clientMessageId.trim() ||
            payload.clientMessageId.length > 100))
        ) {
            reply({
                success: false,
                code: "INVALID_PAYLOAD",
            });
            return;
        }

      try {
        const recipientId = await getOtherParticipant(
          payload.conversationId,
          userId
        );

        const message = await messageService.saveMessage({
  conversationId: payload.conversationId,
  senderId: userId,
  content: payload.content,
  clientMessageId: payload.clientMessageId,
});

// When a user replies, mark their previously received messages as read.
try {
  const readReceipts =
    await messageService.markConversationMessagesAsRead({
      conversationId: payload.conversationId,
      userId,
    });

  // Notify the original senders so their ticks update immediately.
  for (const receipt of readReceipts) {
    io.to(`user:${receipt.senderId}`).emit("message:status", receipt);
  }
} catch (error) {
  console.error(
    "Could not automatically mark previous messages as read:",
    error.message
  );
}

// Deliver the newly saved reply.
deliverMessage({ message, recipientId });

        reply({
          success: true,
          message,
        });
      } catch {
        reply({
          success: false,
          code: "MESSAGE_SEND_FAILED",
          message: "The message could not be sent.",
        });
      }
    });

    socket.on("message:delivered", (payload, acknowledge) => {
      void handleReceipt(
        socket,
        "delivered",
        payload,
        acknowledge
      );
    });

    socket.on("message:read", (payload, acknowledge) => {
      void handleReceipt(socket, "read", payload, acknowledge);
    });
  });

  return { deliverMessage };
}

module.exports = {
  registerRealtimeHandlers,
  registerMessagingHandlers,
  AWAY_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
};
