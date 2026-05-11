import { io } from "socket.io-client";

export const socket = io({
  autoConnect: false
});

socket.on("server_ping", (data) => {
  socket.emit("server_pong", data);
});
