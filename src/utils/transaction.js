import mongoose from "mongoose";

export const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      {
        readPreference: "primary",
        writeConcern: { w: "majority" },
      },
    );
    return result;
  } finally {
    await session.endSession();
  }
};
