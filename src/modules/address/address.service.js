import Address from "./address.model.js";

export const getAllAddressesService = async (userId) => {
  return await Address.find({ userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });
};

export const getAddressByIdService = async (userId, addressId) => {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  return address;
};

export const createAddressService = async (userId, payload) => {
  if (payload.isDefault) {
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );
  }

  const address = await Address.create({
    ...payload,
    userId,
  });

  return address;
};

export const updateAddressService = async (
  userId,
  addressId,
  payload
) => {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  if (payload.isDefault) {
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );
  }

  Object.assign(address, payload);

  await address.save();

  return address;
};

export const deleteAddressService = async (
  userId,
  addressId
) => {
  const address = await Address.findOneAndDelete({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  return;
};

export const setDefaultAddressService = async (
  userId,
  addressId
) => {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw new Error("Address not found");
  }

  await Address.updateMany(
    { userId },
    { $set: { isDefault: false } }
  );

  address.isDefault = true;

  await address.save();

  return address;
};