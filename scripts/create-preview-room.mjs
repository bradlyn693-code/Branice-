import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { path: "/api/socket.io", transports: ["websocket"] });

const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Preview room timed out")), 5000);
  socket.once("connect", () => {
    socket.emit("room:create", { boardSize: 10, playerToken: `preview-${Date.now()}` }, response => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
  socket.once("connect_error", reject);
});

socket.disconnect();
if (!result.ok) throw new Error(result.error ?? "Preview room could not be created");
console.log(result.room.code);
