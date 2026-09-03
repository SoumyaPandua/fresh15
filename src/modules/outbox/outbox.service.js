import Outbox from "./outbox.model.js";

export const enqueueOutbox = async ({ eventKey, type, aggregateType, aggregateId, payload }) => {
  try {
    return await Outbox.create({
      eventKey,
      type,
      aggregateType,
      aggregateId: aggregateId ? String(aggregateId) : null,
      payload,
    });
  } catch (error) {
    if (error?.code === 11000) return Outbox.findOne({ eventKey });
    throw error;
  }
};

export const enqueueRealtimeEvent = (eventKey, eventName, payload, roomType = null, roomId = null, aggregateType = "Realtime", aggregateId = null) =>
  enqueueOutbox({
    eventKey,
    type: "SOCKET_EVENT",
    aggregateType,
    aggregateId,
    payload: { eventName, payload, roomType, roomId },
  });
