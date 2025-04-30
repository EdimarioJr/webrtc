"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = app.listen(3002);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("join-room", (roomId) => {
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
    socket.on("join-stream-room", (roomId) => {
        socket.join(roomId);
        console.log(`Client ${socket.id} joined streaming room ${roomId}`);
    });
    socket.on("video-chunk", ({ roomId, chunk }) => {
        // Broadcast the video chunk to all other clients in the room
        socket.to(roomId).emit("video-chunk", chunk);
    });
});
