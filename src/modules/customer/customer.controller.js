import sendResponse from "../../utils/sendResponse.js";

import {
  getCustomersService,
  getCustomerSummaryService,
  createCustomerService,
  updateCustomerStatusService,
  updateCustomerTierService,
  deleteCustomerService,
} from "./customer.service.js";

export const getCustomers = async (
  req,
  res
) => {
  try {
    const data =
      await getCustomersService({
        search: req.query.search,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
      });

    return sendResponse(
      res,
      200,
      true,
      "Customers fetched successfully",
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

export const getCustomerSummary =
  async (req, res) => {
    try {
      const data =
        await getCustomerSummaryService();

      return sendResponse(
        res,
        200,
        true,
        "Customer summary fetched successfully",
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

export const createCustomer = async (
  req,
  res
) => {
  try {
    const data =
      await createCustomerService(
        req.body
      );

    return sendResponse(
      res,
      201,
      true,
      "Customer created successfully",
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

export const updateCustomerStatus =
  async (req, res) => {
    try {
      const data =
        await updateCustomerStatusService(
          req.params.id,
          req.body.status
        );

      return sendResponse(
        res,
        200,
        true,
        "Customer status updated successfully",
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

export const updateCustomerTier =
  async (req, res) => {
    try {
      const data =
        await updateCustomerTierService(
          req.params.id,
          req.body.tier
        );

      return sendResponse(
        res,
        200,
        true,
        "Customer tier updated successfully",
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

export const deleteCustomer = async (
  req,
  res
) => {
  try {
    await deleteCustomerService(
      req.params.id
    );

    return sendResponse(
      res,
      200,
      true,
      "Customer deleted successfully"
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