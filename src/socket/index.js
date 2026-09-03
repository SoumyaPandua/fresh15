import registerSocketEvents from "./events.js";
import registerReconciliation from "./reconciliation.js";
import socketAuth from "./socketAuth.js";

let initialized = false;

const initializeSocket = (io) => {
  if (initialized) return;
  io.use(socketAuth);
  registerSocketEvents(io);
  registerReconciliation(io);
  initialized = true;
  console.log("✅ Socket.IO initialized");
};

export default initializeSocket;
