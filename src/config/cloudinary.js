import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import "./env.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const normalizeFolder = (folder) => {
  const value = String(folder || "general").replace(/^\/+|\/+$/g, "");
  return value.startsWith("fresh15/") ? value : `fresh15/${value}`;
};

export const uploadImage = (buffer, folder) => new Promise((resolve, reject) => {
  const assetFolder = normalizeFolder(folder);
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: assetFolder,
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
    },
    (error, result) => {
      if (error) return reject(error);
      resolve(result);
    },
  );
  streamifier.createReadStream(buffer).pipe(stream);
});

export default cloudinary;
