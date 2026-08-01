import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// your existing cloudinary.config({...})

export const uploadImage = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);

        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export default cloudinary;