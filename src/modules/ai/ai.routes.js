import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { postChat, getChats, getChat } from "./ai.controller.js";
import { postAgent, confirmAgent, declineAgent } from "./ai-agent.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/chat", postChat);
router.post("/agent", postAgent);
router.post("/agent/confirm", confirmAgent);
router.post("/agent/decline", declineAgent);
router.get("/conversations", getChats);
router.get("/conversations/:id", getChat);

export default router;
