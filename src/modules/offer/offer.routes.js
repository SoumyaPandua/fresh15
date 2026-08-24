import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import authorize from "../../middleware/authorize.middleware.js";
import validateRequest from "../../middleware/validateRequest.middleware.js";
import {
    createOfferValidation,
    updateOfferStatusValidation,
    updateOfferValidation,
} from "./offer.validation.js";
import {
    createOffer,
    deleteOffer,
    getActiveOffers,
    getAllOffers,
    getOfferById,
    updateOffer,
    updateOfferStatus,
} from "./offer.controller.js";

const router = express.Router();

router.get("/active", getActiveOffers);

router.use(authMiddleware);

router.get("/", authorize("ADMIN", "SUPER_ADMIN"), getAllOffers);
router.get("/:id", authorize("ADMIN", "SUPER_ADMIN"), getOfferById);
router.post("/", authorize("ADMIN", "SUPER_ADMIN"), createOfferValidation, validateRequest, createOffer);
router.patch("/:id", authorize("ADMIN", "SUPER_ADMIN"), updateOfferValidation, validateRequest, updateOffer);
router.patch("/:id/status", authorize("ADMIN", "SUPER_ADMIN"), updateOfferStatusValidation, validateRequest, updateOfferStatus);
router.delete("/:id", authorize("ADMIN", "SUPER_ADMIN"), deleteOffer);

export default router;
