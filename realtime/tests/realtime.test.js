
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { registerRealtimeHandlers } = require("../src");

class MockSocket {
  constructor(id, userId) {
    this.id = id;
    this.userId = userId;
    this.data = {};
    this.connected = true;
    this.received = [];
    this.joinedRooms = [];

    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    this.handlers.get(event).push(handler);
    return this;
  }

  emit(event, payload) {
    this.received.push({ event, payload });
    return true;
  }

  join(room) {
    this.joinedRooms.push(room);
    return Promise.resolve();
  }

  disconnect() {
    this.connected = false;
  }

  trigger(event, ...args) {
    for (const handler of this.handlers.get(event) || []) {
      handler(...args);
    }
  }
}

class MockIO extends EventEmitter {
  constructor() {
    super();
    this.broadcasts = [];
    this.roomEvents = [];
    }

    to(room) {
    return {
        emit: (event, payload) => {
        this.roomEvents.push({ room, event, payload });
        return true;
        },
    };
  }

  emit(event, payload) {
    if (event === "connection") {
      return super.emit(event, payload);
    }

    this.broadcasts.push({ event, payload });
    return true;
  }

  connect(socket) {
    super.emit("connection", socket);
  }
}

test("registers authenticated user presence", () => {
  const io = new MockIO();
  const { getPresence } = registerRealtimeHandlers(io);
  const socket = new MockSocket("socket-1", "671a12345678901234567890");

  io.connect(socket);

  assert.deepEqual(getPresence(socket.userId), {
    userId: socket.userId,
    status: "online",
    lastActiveAt: getPresence(socket.userId).lastActiveAt,
  });

  assert.ok(getPresence(socket.userId).lastActiveAt instanceof Date);

  assert.ok(
    socket.received.some(
      (item) => item.event === "presence:snapshot"
    )
  );

  assert.ok(
    socket.joinedRooms.includes(`user:${socket.userId}`)
  );
});

test("rejects sockets without an authenticated user ID", () => {
  const io = new MockIO();
  registerRealtimeHandlers(io);

  const socket = new MockSocket("socket-2", undefined);
  io.connect(socket);

  assert.equal(socket.connected, false);
});

test("rejects activity from a hidden browser tab", () => {
  const io = new MockIO();
  registerRealtimeHandlers(io);

  const socket = new MockSocket("socket-3", "user-123");
  io.connect(socket);

  let acknowledgement;

  socket.trigger(
    "presence:activity",
    { isVisible: false },
    (result) => {
      acknowledgement = result;
    }
  );

  assert.deepEqual(acknowledgement, {
    success: false,
    code: "INVALID_ACTIVITY",
  });
});

test("marks the user offline after their last socket disconnects", () => {
  const io = new MockIO();
  const { getPresence } = registerRealtimeHandlers(io);
  const socket = new MockSocket("socket-4", "user-456");

  io.connect(socket);
  socket.trigger("disconnect");

  assert.equal(getPresence("user-456").status, "offline");
});

test("keeps a user online when one of multiple sockets disconnects", () => {
  const io = new MockIO();
  const { getPresence } = registerRealtimeHandlers(io);

  const userId = "671a12345678901234567890";
  const socket1 = new MockSocket("socket-device-1", userId);
  const socket2 = new MockSocket("socket-device-2", userId);

  io.connect(socket1);
  io.connect(socket2);

  assert.equal(getPresence(userId).status, "online");

  socket1.trigger("disconnect");

  assert.equal(
    getPresence(userId).status,
    "online",
    "User should remain online while another socket is connected"
  );

  socket2.trigger("disconnect");

  assert.equal(getPresence(userId).status, "offline");
});

test("throttles rapid presence activity events", () => {
  const io = new MockIO();
  registerRealtimeHandlers(io);

  const socket = new MockSocket("socket-throttle", "user-throttle");
  io.connect(socket);

  const results = [];

  socket.trigger("presence:activity", { isVisible: true }, (result) => {
    results.push(result);
  });

  socket.trigger("presence:activity", { isVisible: true }, (result) => {
    results.push(result);
  });

  assert.equal(results.length, 2);

  assert.equal(results[0].success, true);
  assert.equal(results[0].throttled, true);

  assert.equal(results[1].success, true);
  assert.equal(results[1].throttled, true);
});


test("persists and delivers a message using the authenticated sender ID", async () => {
  const io = new MockIO();
  const senderId = "671a12345678901234567890";
  const recipientId = "671a12345678901234567891";
  const conversationId = "671a12345678901234567892";

  let savedMessage;
  let saveCalls = 0;

  const message = {
    messageId: "671a12345678901234567893",
    conversationId,
    senderId,
    content: "Hello!",
    clientMessageId: "client-msg-1",
    status: "sent",
    timestamp: new Date(),
  };

  const messageService = {
    async saveMessage(args) {
      saveCalls++;
      savedMessage = args;
      return message;
    },
    async updateMessageStatus() {
      throw new Error("Not expected in this test");
    },
  };

  const Conversation = {
    async findOne() {
      return {
        participants: [senderId, recipientId],
      };
    },
  };

  const { registerMessagingHandlers } = require("../src");

  registerMessagingHandlers(io, { messageService, Conversation });

  const socket = new MockSocket("sender-socket", senderId);
  io.connect(socket);

  const acknowledgement = new Promise((resolve) => {
    socket.trigger(
      "message:send",
      {
        conversationId,
        content: "Hello!",
        clientMessageId: "client-msg-1",
        senderId: "attacker-supplied-id",
      },
      resolve
    );
  });

  const result = await acknowledgement;

  assert.equal(result.success, true);
  assert.equal(saveCalls, 1);
  assert.equal(savedMessage.senderId, senderId);
  assert.notEqual(savedMessage.senderId, "attacker-supplied-id");

  assert.ok(
    io.roomEvents.some(
      (event) =>
        event.room === `user:${recipientId}` &&
        event.event === "message:new" &&
        event.payload.messageId === message.messageId
    )
  );
});

test("rejects an invalid message without saving it", async () => {
  const io = new MockIO();
  const userId = "671a12345678901234567890";
  let saveCalls = 0;

  const messageService = {
    async saveMessage() {
      saveCalls++;
      throw new Error("Should not be called");
    },
    async updateMessageStatus() {},
  };

  const Conversation = {
    async findOne() {
      throw new Error("Should not be called");
    },
  };

  const { registerMessagingHandlers } = require("../src");

  registerMessagingHandlers(io, { messageService, Conversation });

  const socket = new MockSocket("invalid-sender", userId);
  io.connect(socket);

  const result = await new Promise((resolve) => {
    socket.trigger(
      "message:send",
      {
        conversationId: "conversation-id",
        content: "",
      },
      resolve
    );
  });

  assert.equal(result.success, false);
  assert.equal(result.code, "INVALID_PAYLOAD");
  assert.equal(saveCalls, 0);
});

test("updates a delivery receipt and notifies the original sender", async () => {
  const io = new MockIO();
  const senderId = "671a12345678901234567890";
  const recipientId = "671a12345678901234567891";
  const conversationId = "671a12345678901234567892";
  const messageId = "671a12345678901234567893";

  let statusArgs;

  const messageService = {
    async saveMessage() {
      throw new Error("Not expected in this test");
    },
    async updateMessageStatus(args) {
      statusArgs = args;
      return {
        messageId,
        conversationId,
        status: args.status,
        deliveredAt: new Date(),
        readAt: null,
      };
    },
  };

  const Conversation = {
    async findOne() {
      return {
        participants: [senderId, recipientId],
      };
    },
  };

  const { registerMessagingHandlers } = require("../src");

  registerMessagingHandlers(io, { messageService, Conversation });

  const socket = new MockSocket("recipient-socket", recipientId);
  io.connect(socket);

  const result = await new Promise((resolve) => {
    socket.trigger("message:delivered", { messageId }, resolve);
  });

  assert.equal(result.success, true);
  assert.equal(statusArgs.userId, recipientId);
  assert.equal(statusArgs.messageId, messageId);
  assert.equal(statusArgs.status, "delivered");

  assert.ok(
    io.roomEvents.some(
      (event) =>
        event.room === `user:${senderId}` &&
        event.event === "message:status" &&
        event.payload.status === "delivered"
    )
  );
});

test("updates a read receipt through the database service", async () => {
  const io = new MockIO();
  const senderId = "671a12345678901234567890";
  const recipientId = "671a12345678901234567891";
  const conversationId = "671a12345678901234567892";
  const messageId = "671a12345678901234567893";

  let statusArgs;

  const messageService = {
    async saveMessage() {},
    async updateMessageStatus(args) {
      statusArgs = args;
      return {
        messageId,
        conversationId,
        status: "read",
        deliveredAt: new Date(),
        readAt: new Date(),
      };
    },
  };

  const Conversation = {
    async findOne() {
      return {
        participants: [senderId, recipientId],
      };
    },
  };

  const { registerMessagingHandlers } = require("../src");

  registerMessagingHandlers(io, { messageService, Conversation });

  const socket = new MockSocket("reader-socket", recipientId);
  io.connect(socket);

  const result = await new Promise((resolve) => {
    socket.trigger("message:read", { messageId }, resolve);
  });

  assert.equal(result.success, true);
  assert.equal(statusArgs.userId, recipientId);
  assert.equal(statusArgs.status, "read");

  assert.ok(
    io.roomEvents.some(
      (event) =>
        event.room === `user:${senderId}` &&
        event.event === "message:status" &&
        event.payload.status === "read"
    )
  );
});


test("automatically broadcasts away after the inactivity timeout", async () => {
  const io = new MockIO();
  const awayTimeoutMs = 40;

  const { getPresence } = registerRealtimeHandlers(io, {
    awayTimeoutMs,
  });

  const socket = new MockSocket("socket-away", "user-away");
  io.connect(socket);

  assert.equal(getPresence("user-away").status, "online");

  await new Promise((resolve) =>
    setTimeout(resolve, awayTimeoutMs + 40)
  );

  assert.equal(getPresence("user-away").status, "away");

  assert.ok(
    io.broadcasts.some(
      (event) =>
        event.event === "presence:update" &&
        event.payload.userId === "user-away" &&
        event.payload.status === "away"
    ),
    "The server should broadcast the away transition automatically"
  );

  socket.trigger("disconnect");
});


test("restores online presence when a disconnected user reconnects", () => {
  const io = new MockIO();
  const { getPresence } = registerRealtimeHandlers(io, {
    awayTimeoutMs: 1000,
  });

  const firstSocket = new MockSocket("socket-reconnect-1", "user-reconnect");
  io.connect(firstSocket);

  assert.equal(getPresence("user-reconnect").status, "online");

  firstSocket.trigger("disconnect");

  assert.equal(getPresence("user-reconnect").status, "offline");

  const secondSocket = new MockSocket("socket-reconnect-2", "user-reconnect");
  io.connect(secondSocket);

  assert.equal(getPresence("user-reconnect").status, "online");

  const userUpdates = io.broadcasts.filter(
    (event) =>
      event.event === "presence:update" &&
      event.payload.userId === "user-reconnect"
  );

  assert.deepEqual(
    userUpdates.map((event) => event.payload.status),
    ["online", "offline", "online"]
  );

  secondSocket.trigger("disconnect");
});
