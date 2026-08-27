import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { errorHandler } from "./utils/errorResponse.js";
import auditContextMiddleware from "./middleware/audit-context.middleware.js";
import { redisRateLimit } from "./middleware/rateLimit.middleware.js";
import AppError from "./utils/AppError.js";

const app = express();
app.set("trust proxy", 1);

const configuredOrigins = [
  process.env.CUSTOMER_WEB_ORIGIN,
  process.env.PARTNER_WEB_ORIGIN,
  process.env.ADMIN_WEB_ORIGIN,
].filter(Boolean);

const allowedOrigins = new Set(
  configuredOrigins.length || process.env.NODE_ENV === "production"
    ? configuredOrigins
    : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new AppError(403, "CORS_ORIGIN_NOT_ALLOWED", "Origin is not allowed"));
  },
}));

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production"
    ? {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "https://checkout.razorpay.com"],
          connectSrc: ["'self'", "https:"],
          frameSrc: ["'self'", "https://checkout.razorpay.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      }
    : false,
}));

app.use(morgan("dev"));
app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(auditContextMiddleware);
app.use(redisRateLimit({ name: "global-api", max: 300, windowSeconds: 60 }));
app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", code: "ROUTE_NOT_FOUND", data: null, errors: [] });
});

app.use(errorHandler);
export default app;
