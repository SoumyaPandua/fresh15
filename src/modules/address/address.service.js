import Address from "./address.model.js";

const normalizeCoordinates = (payload) => {
  const hasLatitude =
    payload.latitude !== undefined &&
    payload.latitude !== null &&
    payload.latitude !== "";

  const hasLongitude =
    payload.longitude !== undefined &&
    payload.longitude !== null &&
    payload.longitude !== "";

  if (!hasLatitude && !hasLongitude) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  if (!hasLatitude || !hasLongitude) {
    throw new Error(
      "Latitude and longitude must be provided together"
    );
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "Invalid address coordinates"
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Address coordinates are outside valid range"
    );
  }

  if (
    latitude === 0 &&
    longitude === 0
  ) {
    throw new Error(
      "Address coordinates cannot be 0,0"
    );
  }

  return {
    latitude,
    longitude,
  };
};

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
  const existingAddressCount = await Address.countDocuments({
    userId,
  });

  const shouldBeDefault =
    existingAddressCount === 0 || payload.isDefault === true;

  if (shouldBeDefault) {
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );
  }

  const coordinates =
    normalizeCoordinates(payload);

  const address = await Address.create({
    ...payload,
    ...coordinates,
    userId,
    isDefault: shouldBeDefault,
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

  const coordinates = normalizeCoordinates(payload);

  Object.assign(address, payload, coordinates);

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