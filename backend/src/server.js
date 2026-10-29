
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

// Work around the Node.js DNS issue encountered with MongoDB Atlas.
if (process.env.NODE_ENV !== "production") {
  require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
}

const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("../../database/src/config/db");

const User = require("../../database/src/models/User");
const Conversation = require("../../database/src/models/Conversation");

const messageService = require("../../database/src/services/messageService");
const {
  processDueScheduledMessages,
} = require("../../database/src/services/scheduledMessageService");

const {
  registerRealtimeHandlers,
  registerMessagingHandlers,
} = require("../../realtime/src");

const PORT = Number(process.env.PORT) || 5000;

const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function getSessionToken(cookieHeader = "") {
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("wavelength_token="));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(
      cookie.slice("wavelength_token=".length)
    );
  } catch {
    return null;
  }
}

async function startServer() {
  try {
    await connectDB();

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGINS,
        credentials: true,
        methods: ["GET", "POST"],
    },
    });

    // Authenticate every socket using the existing HTTP-only JWT cookie.
    // No user ID supplied by the frontend is trusted.
    io.use(async (socket, next) => {
      try {
        const token = getSessionToken(
          socket.handshake.headers.cookie
        );

        if (!token) {
          return next(new Error("AUTHENTICATION_REQUIRED"));
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (!payload.userId) {
          return next(new Error("INVALID_SESSION"));
        }

        const user = await User.findById(payload.userId).select(
          "_id isVerified"
        );

        if (!user || !user.isVerified) {
          return next(new Error("INVALID_SESSION"));
        }

        socket.userId = user._id.toString();

        return next();
      } catch {
        return next(new Error("AUTHENTICATION_REQUIRED"));
      }
    });

    // Register the existing presence and activity handlers.
    registerRealtimeHandlers(io);

    // Register persistent messaging and delivery/read receipt handlers.
    const { deliverMessage } = registerMessagingHandlers(io, {
      messageService,
      Conversation,
    });

    console.log("Socket.IO authentication enabled.");
    console.log("Realtime presence and messaging handlers registered.");

    // Process due scheduled messages without overlapping worker runs.
    let workerRunning = false;

    async function runScheduledWorker() {
      if (workerRunning) {
        return;
      }

      workerRunning = true;

      try {
        const results = await processDueScheduledMessages(
          deliverMessage
        );

        for (const result of results) {
          console.log(
            `Scheduled message ${result.scheduledMessageId}: ${result.status}`
          );
        }
      } catch (error) {
        console.error(
          "Scheduled-message worker error:",
          error.message
        );
      } finally {
        workerRunning = false;
      }
    }

    const workerTimer = setInterval(runScheduledWorker, 5000);
    void runScheduledWorker();

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Backend listening on port ${PORT}`);
    });

    let shuttingDown = false;

    async function shutdown() {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;
      console.log("Shutting down backend...");

      clearInterval(workerTimer);

      io.close(async () => {
        try {
          await mongoose.disconnect();
          console.log("MongoDB disconnected.");
        } catch (error) {
          console.error("MongoDB shutdown error:", error.message);
        }

        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
