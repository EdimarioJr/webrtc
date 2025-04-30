import express from "express";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: "*",
  })
);

const server = app.listen(3002);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);
    socket.to(roomId).emit("peer-joined", socket.id);
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // New WebSocket streaming handlers
  socket.on("join-stream-room", (roomId: string) => {
    socket.join(roomId);
    console.log(`Client ${socket.id} joined streaming room ${roomId}`);
  });

  socket.on("video-chunk", ({ roomId, chunk }) => {
    // Broadcast the video chunk to all other clients in the room
    socket.to(roomId).emit("video-chunk", chunk);
  });
});
