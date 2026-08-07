import http from "http";
import { Server } from "socket.io";

import app from "./app.js";
import connectDB from "./config/database.js";

import initializeSocket from "./socket/index.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

export const io = new Server(server, {
    cors: {
        origin: "*",
        credentials: true,
    },
    transports: ["websocket", "polling"],
});

initializeSocket(io);

connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error);
        process.exit(1);
    });