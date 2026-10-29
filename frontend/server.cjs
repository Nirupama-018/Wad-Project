
const express = require("express");
const http = require("http");
const path = require("path");
const { createProxyServer } = require("http-proxy");

const app = express();
const server = http.createServer(app);

const BACKEND_URL = "https://wavelength-backend-fyhi.onrender.com";

const proxy = createProxyServer({
  target: BACKEND_URL,
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err.message);

  if (res && !res.headersSent && typeof res.writeHead === "function") {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: false,
      message: "The Wavelength backend is temporarily unavailable.",
    }));
  } else if (res && typeof res.destroy === "function") {
    res.destroy();
  }
});

// Forward API and Socket.IO requests to the existing backend.
// Do not parse the request body before proxying it.
app.use((req, res, next) => {
  if (
    req.path === "/api" ||
    req.path.startsWith("/api/") ||
    req.path === "/socket.io" ||
    req.path.startsWith("/socket.io/")
  ) {
    return proxy.web(req, res);
  }

  next();
});

// Serve the built React/Vite frontend.
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

// Support React client-side routes.
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Forward Socket.IO WebSocket upgrades.
server.on("upgrade", (req, socket, head) => {
  if (
    req.url === "/socket.io" ||
    req.url.startsWith("/socket.io/")
  ) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Wavelength frontend proxy listening on port ${PORT}`);
});
