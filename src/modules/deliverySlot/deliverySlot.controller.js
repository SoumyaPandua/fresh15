import sendResponse from "../../utils/sendResponse.js";
import { sendError } from "../../utils/errorResponse.js";
import {
  getAvailableDeliverySlotsService, createDeliverySlotService, updateDeliverySlotService,
  deleteDeliverySlotService, getAllDeliverySlotsService,
  createDeliveryZoneService, getAllDeliveryZonesService, updateDeliveryZoneService, deleteDeliveryZoneService,
  createDeliveryStoreService, getAllDeliveryStoresService, updateDeliveryStoreService, deleteDeliveryStoreService,
} from "./deliverySlot.service.js";

export const getAvailableSlots = async (req, res) => {
  try { return sendResponse(res, 200, true, "Delivery slots fetched successfully", await getAvailableDeliverySlotsService(req.user._id, req.params.addressId)); }
  catch (e) { return sendError(res, e); }
};
const ok = (fn, status = 200, message = "Operation successful") => async (req, res) => {
  try { return sendResponse(res, status, true, message, await fn(req)); } catch (e) { return sendError(res, e); }
};
export const getSlots = ok(() => getAllDeliverySlotsService(), 200, "Delivery slots fetched successfully");
export const createSlot = ok((req) => createDeliverySlotService(req.user._id, req.body), 201, "Delivery slot created successfully");
export const updateSlot = ok((req) => updateDeliverySlotService(req.params.id, req.user._id, req.body), 200, "Delivery slot updated successfully");
export const deleteSlot = ok(async (req) => { await deleteDeliverySlotService(req.params.id); return null; }, 200, "Delivery slot deleted successfully");

export const getZones = ok(() => getAllDeliveryZonesService(), 200, "Delivery zones fetched successfully");
export const createZone = ok((req) => createDeliveryZoneService(req.user._id, req.body), 201, "Delivery zone created successfully");
export const updateZone = ok((req) => updateDeliveryZoneService(req.params.id, req.user._id, req.body), 200, "Delivery zone updated successfully");
export const deleteZone = ok(async (req) => { await deleteDeliveryZoneService(req.params.id); return null; }, 200, "Delivery zone deleted successfully");

export const getStores = ok(() => getAllDeliveryStoresService(), 200, "Delivery stores fetched successfully");
export const createStore = ok((req) => createDeliveryStoreService(req.user._id, req.body), 201, "Delivery store created successfully");
export const updateStore = ok((req) => updateDeliveryStoreService(req.params.id, req.user._id, req.body), 200, "Delivery store updated successfully");
export const deleteStore = ok(async (req) => { await deleteDeliveryStoreService(req.params.id); return null; }, 200, "Delivery store deleted successfully");
