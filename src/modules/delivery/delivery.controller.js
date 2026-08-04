import sendResponse from "../../utils/sendResponse.js";

import {
  assignRiderService,
  createDeliveryService,
  deleteDeliveryService,
  getAllDeliveriesService,
  getDeliveryByIdService,
  getMyActiveDeliveryService,
  getMyDeliveriesService,
  updateDeliveryStatusService,
} from "./delivery.service.js";

export const getAllDeliveries = async (
  req,
  res
) => {
  try {
    const data =
      await getAllDeliveriesService();

    return sendResponse(
      res,
      200,
      true,
      "Deliveries fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getDeliveryById = async (
  req,
  res
) => {
  try {
    const data =
      await getDeliveryByIdService(
        req.params.id,
        req.user._id,
        req.user.role
      );

    return sendResponse(
      res,
      200,
      true,
      "Delivery fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getMyDeliveries = async (
  req,
  res
) => {
  try {
    const data =
      await getMyDeliveriesService(
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "My deliveries fetched successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const getMyActiveDelivery = async (
  req,
  res
) => {
  try {
    const data =
      await getMyActiveDeliveryService(
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      data
        ? "Active delivery fetched successfully"
        : "No active delivery",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const createDelivery = async (
  req,
  res
) => {
  try {
    const data =
      await createDeliveryService(
        req.user._id,
        req.body
      );

    return sendResponse(
      res,
      201,
      true,
      "Delivery created successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const assignRider = async (
  req,
  res
) => {
  try {
    const data =
      await assignRiderService(
        req.params.id,
        req.body.riderId,
        req.user._id
      );

    return sendResponse(
      res,
      200,
      true,
      "Rider assigned successfully",
      data
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};

export const updateDeliveryStatus =
  async (req, res) => {
    try {
      const data =
        await updateDeliveryStatusService(
          req.params.id,
          req.body.status,
          req.user._id,
          req.user.role
        );

      return sendResponse(
        res,
        200,
        true,
        "Delivery status updated successfully",
        data
      );
    } catch (error) {
      return sendResponse(
        res,
        400,
        false,
        error.message
      );
    }
  };

export const deleteDelivery = async (
  req,
  res
) => {
  try {
    await deleteDeliveryService(
      req.params.id
    );

    return sendResponse(
      res,
      200,
      true,
      "Delivery deleted successfully"
    );
  } catch (error) {
    return sendResponse(
      res,
      400,
      false,
      error.message
    );
  }
};