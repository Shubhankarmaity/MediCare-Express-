const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const env = require("./config/env");
const connectDb = require("./config/db");

const start = async () => {
  await connectDb();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.frontendUrl,
      credentials: true
    }
  });

  // Make io accessible from route handlers via req.app.get("io")
  app.set("io", io);

  io.on("connection", (socket) => {
    // Join a booking room (used by both patient and driver)
    socket.on("join-booking", (bookingId) => {
      socket.join(`booking:${bookingId}`);
    });

    // Driver broadcasts their live GPS position
    socket.on("driver-location-update", (data) => {
      // data = { bookingId, latitude, longitude }
      if (data && data.bookingId) {
        socket.to(`booking:${data.bookingId}`).emit("driver-location", {
          latitude: data.latitude,
          longitude: data.longitude
        });
      }
    });

    // Leave a booking room
    socket.on("leave-booking", (bookingId) => {
      socket.leave(`booking:${bookingId}`);
    });
  });

  server.listen(env.port, () => {
    console.log(`Backend listening on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error("Backend failed to start", error);
  process.exit(1);
});
