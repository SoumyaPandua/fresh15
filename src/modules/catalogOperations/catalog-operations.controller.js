
import { sendError } from "../../utils/errorResponse.js";
import sendResponse from "../../utils/sendResponse.js";
import {
  catalogTemplateCsv,
  previewCatalogImport,
  createCatalogImport,
  getCatalogImports,
  getCatalogImport,
  getCatalogImportReportCsv,
  retryFailedCatalogImport,
  getCatalogOperationsOverview,
  getCatalogQuality,
} from "./catalog-operations.service.js";

export const getTemplate = (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="fresh15-catalog-template.csv"');
  return res.status(200).send(catalogTemplateCsv());
};

export const preview = async (req, res) => {
  try { return sendResponse(res, 200, true, "Catalog import preview generated", await previewCatalogImport(req.body)); }
  catch (error) { return sendError(res, error); }
};

export const commit = async (req, res) => {
  try { return sendResponse(res, 202, true, "Catalog import queued", await createCatalogImport(req.user._id, req.body, req.get("x-file-name") || "catalog.csv")); }
  catch (error) { return sendError(res, error); }
};

export const listImports = async (req, res) => {
  try { return sendResponse(res, 200, true, "Catalog imports fetched", await getCatalogImports(req.query)); }
  catch (error) { return sendError(res, error); }
};

export const getImport = async (req, res) => {
  try { return sendResponse(res, 200, true, "Catalog import fetched", await getCatalogImport(req.params.id)); }
  catch (error) { return sendError(res, error); }
};

export const getReport = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fresh15-import-${req.params.id}-report.csv"`);
    return res.status(200).send(await getCatalogImportReportCsv(req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
};

export const retryFailed = async (req, res) => {
  try { return sendResponse(res, 202, true, "Failed import rows re-queued", await retryFailedCatalogImport(req.user._id, req.params.id)); }
  catch (error) { return sendError(res, error); }
};

export const overview = async (req, res) => {
  try { return sendResponse(res, 200, true, "Catalog operations overview fetched", await getCatalogOperationsOverview()); }
  catch (error) { return sendError(res, error); }
};

export const quality = async (req, res) => {
  try { return sendResponse(res, 200, true, "Catalog quality report fetched", await getCatalogQuality(req.query)); }
  catch (error) { return sendError(res, error); }
};
