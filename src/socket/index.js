import registerSocketEvents from "./events.js";
import socketAuth from "./socketAuth.js";

let initialized = false;

const initializeSocket = (io) => {
    if (initialized) return;

    io.use(socketAuth);

    registerSocketEvents(io);

    initialized = true;

    console.log("✅ Socket.IO initialized");
};

export default initializeSocket;