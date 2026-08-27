import multer from "multer";

const storage = multer.memoryStorage();
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
  return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 30,
    fieldSize: 64 * 1024,
  },
});

export const uploadSingleImage = upload.single("image");
export const uploadMultipleImages = upload.array("images", 5);
