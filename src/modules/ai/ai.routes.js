import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { postChat, getChats, getChat } from "./ai.controller.js";
import {
  postAgent,
  confirmAgent,
  declineAgent,
} from "./ai-agent.controller.js";
import { postCustomerAgent } from "./customer-agent.controller.js";
import { postCustomerProductDiscovery } from "./customer-discovery.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/chat", postChat);
router.post("/agent", postAgent);
router.post("/agent/confirm", confirmAgent);
router.post("/agent/decline", declineAgent);
router.post("/customer-agent", postCustomerAgent);
router.post("/customer-product-discovery", postCustomerProductDiscovery);
router.get("/conversations", getChats);
router.get("/conversations/:id", getChat);

export default router;
