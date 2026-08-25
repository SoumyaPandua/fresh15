import express from "express";
import { chat } from "./ai.controller.js";

const router = express.Router();
router.post("/chat", chat);

export default router;
