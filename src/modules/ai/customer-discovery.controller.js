import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  buildDiscoveryResponse,
  discoverProducts,
} from "./customer-discovery.service.js";

export async function postCustomerProductDiscovery(req, res) {
  try {
    const query = req.body?.query ?? req.body?.message ?? "";
    const products = await discoverProducts(query);

    return sendResponse(
      res,
      200,
      true,
      "Customer product discovery completed",
      buildDiscoveryResponse(query, products),
    );
  } catch (error) {
    return sendError(res, error);
  }
}
