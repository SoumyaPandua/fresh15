import Outbox from "./outbox.model.js";

let timer = null;
let running = false;

const backoffSeconds = (attempts) => Math.min(300, 2 ** Math.min(attempts, 8));

const deliver = async (job) => {
  const { emitRealtimeEvent } = await import("../../socket/emitters.js");
  return emitRealtimeEvent(
    job.payload.eventName,
    job.payload.payload,
    job.payload.roomType,
    job.payload.roomId,
  );
};

export const processOutboxBatch = async (limit = 25) => {
  if (running) return 0;
  running = true;
  let processed = 0;
  try {
    await Outbox.updateMany(
      { status: "PROCESSING", lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
      { $set: { status: "PENDING", lockedAt: null, nextAttemptAt: new Date() } },
    );

    for (let i = 0; i < limit; i += 1) {
      const job = await Outbox.findOneAndUpdate(
        {
          $or: [
            { status: "PENDING", nextAttemptAt: { $lte: new Date() } },
            { status: "FAILED", attempts: { $lt: 12 }, nextAttemptAt: { $lte: new Date() } },
          ],
        },
        { $set: { status: "PROCESSING", lockedAt: new Date() }, $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, new: true },
      );
      if (!job) break;

      try {
        await deliver(job);
        await Outbox.updateOne(
          { _id: job._id },
          { $set: { status: "DONE", processedAt: new Date(), lockedAt: null, lastError: null } },
        );
        processed += 1;
      } catch (error) {
        const terminal = job.attempts >= 12;
        const delay = backoffSeconds(job.attempts);
        await Outbox.updateOne(
          { _id: job._id },
          {
            $set: {
              status: terminal ? "FAILED" : "PENDING",
              nextAttemptAt: new Date(Date.now() + delay * 1000),
              lockedAt: null,
              lastError: String(error?.message || error).slice(0, 1000),
            },
          },
        );
      }
    }
  } finally {
    running = false;
  }
  return processed;
};

export const startOutboxWorker = ({ intervalMs = 1000 } = {}) => {
  if (timer) return;
  void processOutboxBatch();
  timer = setInterval(() => { void processOutboxBatch(); }, intervalMs);
  timer.unref?.();
};

export const stopOutboxWorker = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
