import { sendError } from "../../utils/errorResponse.js";
import sendResponse from "../../utils/sendResponse.js";
import { getPersonalizedRecommendations, getSmartBasket, getOptimizedOffers, getRecommendationDashboard } from "./recommendation.service.js";
import { recordRecommendationEvents, getRecommendationAnalytics } from "./recommendation-events.service.js";

export const recommendations = async (req, res) => {
  try { return sendResponse(res, 200, true, "Personalized recommendations fetched", await getPersonalizedRecommendations(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const smartBasket = async (req, res) => {
  try { return sendResponse(res, 200, true, "Smart basket fetched", await getSmartBasket(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const optimizedOffers = async (req, res) => {
  try { return sendResponse(res, 200, true, "Personalized offers fetched", await getOptimizedOffers(req.user._id, req.query)); }
  catch (error) { return sendError(res, error); }
};

export const dashboard = async (req, res) => {
  try { return sendResponse(res, 200, true, "Personalization dashboard fetched", await getRecommendationDashboard(req.user._id)); }
  catch (error) { return sendError(res, error); }
};

export const recordEvents = async (req, res) => {
  try { return sendResponse(res, 202, true, "Recommendation events accepted", await recordRecommendationEvents(req.user._id, req.body)); }
  catch (error) { return sendError(res, error); }
};

export const adminAnalytics = async (req, res) => {
  try { return sendResponse(res, 200, true, "Recommendation analytics fetched", await getRecommendationAnalytics(req.query)); }
  catch (error) { return sendError(res, error); }
};
