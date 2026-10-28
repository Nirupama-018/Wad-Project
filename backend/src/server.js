
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

// Work around local Node.js DNS resolution issues.
if (process.env.NODE_ENV !== "production") {
  require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
}

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("../../database/src/config/db");

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDB();

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin:
          process.env.FRONTEND_ORIGIN || "http://localhost:5173",
        credentials: true,
      },
    });

    // Socket authentication and realtime handlers will be
    // registered here after the authentication middleware exists.
    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);
    });

    httpServer.listen(PORT, () => {
      console.log(`Backend listening on http://localhost:${PORT}`);
    });

    async function shutdown() {
      console.log("Shutting down backend...");

      io.close();

      httpServer.close(async () => {
        const mongoose = require("../../database/node_modules/mongoose");
        await mongoose.disconnect();
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
