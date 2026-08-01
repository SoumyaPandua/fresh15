import sendResponse from "../../utils/sendResponse.js";

import {
  createOrderService,
  deleteOrderService,
  getMyOrdersService,
  getOrderByIdService,
  updateOrderStatusService,
} from "./order.service.js";

export const getMyOrders = async (req, res) => {
  try {
    const data = await getMyOrdersService(req.user._id);

    return sendResponse(
      res,
      200,
      true,
      "Orders fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const getOrderById = async (req, res) => {
  try {
    const data = await getOrderByIdService(
      req.params.id,
      req.user._id
    );

    return sendResponse(
      res,
      200,
      true,
      "Order fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const createOrder = async (req, res) => {
  try {
    const data = await createOrderService(
      req.user._id,
      req.body
    );

    return sendResponse(
      res,
      201,
      true,
      "Order placed successfully",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const updateOrderStatus = async (
  req,
  res
) => {
  try {
    const data = await updateOrderStatusService(
      req.params.id,
      req.user._id,
      req.body.orderStatus
    );

    return sendResponse(
      res,
      200,
      true,
      "Order status updated successfully",
      data
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};

export const deleteOrder = async (req, res) => {
  try {
    await deleteOrderService(req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Order deleted successfully"
    );
  } catch (error) {
    return sendResponse(res, 400, false, error.message);
  }
};