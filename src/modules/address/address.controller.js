import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";

import {
  createAddressService,
  deleteAddressService,
  getAddressByIdService,
  getAllAddressesService,
  setDefaultAddressService,
  updateAddressService,
} from "./address.service.js";

export const getAllAddresses = async (req, res) => {
  try {
    const data = await getAllAddressesService(req.user._id);

    return sendResponse(res, 200, true, "Addresses fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAddressById = async (req, res) => {
  try {
    const data = await getAddressByIdService(req.user._id, req.params.id);

    return sendResponse(res, 200, true, "Address fetched successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const createAddress = async (req, res) => {
  try {
    const data = await createAddressService(req.user._id, req.body);

    return sendResponse(res, 201, true, "Address created successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateAddress = async (req, res) => {
  try {
    const data = await updateAddressService(
      req.user._id,
      req.params.id,
      req.body
    );

    return sendResponse(res, 200, true, "Address updated successfully", data);
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteAddress = async (req, res) => {
  try {
    await deleteAddressService(req.user._id, req.params.id);

    return sendResponse(res, 200, true, "Address deleted successfully");
  } catch (error) {
    return sendError(res, error);
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const data = await setDefaultAddressService(req.user._id, req.params.id);

    return sendResponse(
      res,
      200,
      true,
      "Default address updated successfully",
      data
    );
  } catch (error) {
    return sendError(res, error);
  }
};