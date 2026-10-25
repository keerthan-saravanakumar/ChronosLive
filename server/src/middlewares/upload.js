const multer = require('multer');
const AppError = require('../utils/AppError');
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2, fieldSize: 8192 },
  fileFilter: (_req, file, callback) => callback(ALLOWED.includes(file.mimetype) ? null : new AppError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG or WebP image.'), ALLOWED.includes(file.mimetype)),
});
function validateImage(file) {
  if (!file) throw new AppError(400, 'IMAGE_REQUIRED', 'Choose an image to upload.');
  const bytes = file.buffer;
  const valid = file.mimetype === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : file.mimetype === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.mimetype === 'image/webp' && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new AppError(400, 'INVALID_IMAGE', 'The file contents do not match a supported image format.');
}
module.exports = { upload, validateImage };
