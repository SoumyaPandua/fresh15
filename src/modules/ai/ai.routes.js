import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { postChat, getChats, getChat } from "./ai.controller.js";
import { postAgent } from "./ai-agent.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/chat", postChat);
router.post("/agent", postAgent);
router.get("/conversations", getChats);
router.get("/conversations/:id", getChat);

export default router;
