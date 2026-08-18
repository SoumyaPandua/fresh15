import Audit from "./audit.model.js";

export const writeAuditLog = async ({ actorId, action, resourceType, resourceId = null, details = {} }) => {
  try {
    return await Audit.create({ actorId, action, resourceType, resourceId, details });
  } catch (error) {
    console.error("Audit log failed:", error.message);
    return null;
  }
};
