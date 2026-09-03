import multer from "multer";
import AppError from "../utils/AppError.js";

const storage = multer.memoryStorage();
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const fileFilter = (req, file, cb) => {
  const expectedExtension = ALLOWED_TYPES.get(file.mimetype);
  const extension = String(file.originalname || "").split(".").pop()?.toLowerCase();
  if (!expectedExtension || extension !== expectedExtension) {
    return cb(new AppError(422, "INVALID_IMAGE_TYPE", "Only valid JPG, PNG, WebP or GIF images are allowed"));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 30,
    fieldSize: 64 * 1024,
    parts: 40,
  },
});

const hasPrefix = (buffer, bytes) => buffer?.length >= bytes.length && bytes.every((value, index) => buffer[index] === value);
const isJpeg = (buffer) => hasPrefix(buffer, [0xff, 0xd8, 0xff]);
const isPng = (buffer) => hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isGif = (buffer) => buffer?.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer?.subarray(0, 6).toString("ascii") === "GIF89a";
const isWebp = (buffer) =>
  buffer?.length >= 12 &&
  buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
  buffer.subarray(8, 12).toString("ascii") === "WEBP";

const signatureMatches = (file) => {
  if (!file?.buffer) return false;
  if (file.mimetype === "image/jpeg") return isJpeg(file.buffer);
  if (file.mimetype === "image/png") return isPng(file.buffer);
  if (file.mimetype === "image/gif") return isGif(file.buffer);
  if (file.mimetype === "image/webp") return isWebp(file.buffer);
  return false;
};

export const validateUploadedImages = (req, res, next) => {
  try {
    const files = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    if (req.files && !Array.isArray(req.files)) {
      for (const value of Object.values(req.files)) if (Array.isArray(value)) files.push(...value);
    }

    for (const file of files) {
      if (!signatureMatches(file)) {
        throw new AppError(422, "INVALID_IMAGE_CONTENT", "Uploaded image content does not match the declared image type");
      }
      const safeName = String(file.originalname || "").replace(/[^a-zA-Z0-9._-]/g, "_");
      if (safeName.length > 120) throw new AppError(422, "INVALID_FILENAME", "Uploaded filename is too long");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const uploadSingleImage = upload.single("image");
export const uploadMultipleImages = upload.array("images", 5);
