import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import {
  getAvailableSlots, getSlots, createSlot, updateSlot, deleteSlot,
  getZones, createZone, updateZone, deleteZone,
  getStores, createStore, updateStore, deleteStore,
} from "./deliverySlot.controller.js";
import {
  getAvailableSlotsValidation, createSlotValidation, updateSlotValidation, idValidation,
  zoneValidation, storeValidation,
} from "./deliverySlot.validation.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/available/:addressId", getAvailableSlotsValidation, validateRequest, getAvailableSlots);

router.get("/admin/slots", authorize("ADMIN", "SUPER_ADMIN"), getSlots);
router.post("/admin/slots", authorize("ADMIN", "SUPER_ADMIN"), createSlotValidation, validateRequest, createSlot);
router.patch("/admin/slots/:id", authorize("ADMIN", "SUPER_ADMIN"), updateSlotValidation, validateRequest, updateSlot);
router.delete("/admin/slots/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, validateRequest, deleteSlot);

router.get("/admin/zones", authorize("ADMIN", "SUPER_ADMIN"), getZones);
router.post("/admin/zones", authorize("ADMIN", "SUPER_ADMIN"), zoneValidation, validateRequest, createZone);
router.patch("/admin/zones/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, zoneValidation, validateRequest, updateZone);
router.delete("/admin/zones/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, validateRequest, deleteZone);

router.get("/admin/stores", authorize("ADMIN", "SUPER_ADMIN"), getStores);
router.post("/admin/stores", authorize("ADMIN", "SUPER_ADMIN"), storeValidation, validateRequest, createStore);
router.patch("/admin/stores/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, storeValidation, validateRequest, updateStore);
router.delete("/admin/stores/:id", authorize("ADMIN", "SUPER_ADMIN"), idValidation, validateRequest, deleteStore);

export default router;
