import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import { customerAgent } from "./customer-agent.service.js";

export async function postCustomerAgent(req, res) {
  try {
    const data = await customerAgent({
      user: req.user,
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      req,
    });

    return sendResponse(
      res,
      200,
      true,
      "Customer AI agent completed",
      data,
    );
  } catch (error) {
    return sendError(res, error);
  }
}
