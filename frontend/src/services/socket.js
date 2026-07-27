import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace("/api", "") || "http://localhost:5000";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"]
});

export default socket;
