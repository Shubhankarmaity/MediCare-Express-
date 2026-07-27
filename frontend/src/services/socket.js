import { io } from "socket.io-client";
import { getBackendUrl } from "./api";

export const getSocketUrl = () => {
  const apiUrl = getBackendUrl();
  return apiUrl.replace(/\/api\/?$/, "");
};

const socket = io(getSocketUrl(), {
  autoConnect: false,
  transports: ["websocket", "polling"]
});

export default socket;
