
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/database.js";
import initializeSocket from "./socket/index.js";
import { startOutboxWorker } from "./modules/outbox/outbox.worker.js";
import { processPendingCatalogImports } from "./modules/catalogOperations/catalog-operations.service.js";
import { startProductSearchSyncWorker } from "./modules/product/product-search.service.js";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const configuredOrigins = [
  process.env.CUSTOMER_WEB_ORIGIN,
  process.env.PARTNER_WEB_ORIGIN,
  process.env.ADMIN_WEB_ORIGIN,
].filter(Boolean);

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Socket origin is not allowed"));
    },
    credentials: true,
  },
  transports: ["websocket", "polling"],
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: false,
  },
});

initializeSocket(io);

let catalogWorkerTimer = null;
const startCatalogWorker = () => {
  if (catalogWorkerTimer) return;
  void processPendingCatalogImports();
  catalogWorkerTimer = setInterval(() => { void processPendingCatalogImports(); }, 5000);
  catalogWorkerTimer.unref?.();
};

connectDB()
  .then(() => {
    startOutboxWorker({ intervalMs: 1000 });
    startCatalogWorker();
    startProductSearchSyncWorker({ intervalMs: 15000 });
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });

const shutdown = () => {
  if (catalogWorkerTimer) clearInterval(catalogWorkerTimer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref?.();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
