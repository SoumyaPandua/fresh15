import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { errorHandler } from "./utils/errorResponse.js";
import auditContextMiddleware from "./middleware/audit-context.middleware.js";

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(auditContextMiddleware);
app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "ROUTE_NOT_FOUND",
    data: null,
    errors: [],
  });
});

app.use(errorHandler);

export default app;
