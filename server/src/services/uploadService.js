const { v2: cloudinary } = require('cloudinary');
const { validateImage } = require('../middlewares/upload');
const AppError = require('../utils/AppError');
function uploadImage(file, folder, env) {
  validateImage(file);
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new AppError(503, 'UPLOAD_UNAVAILABLE', 'Image uploads are temporarily unavailable. Please try again later.');
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], transformation: [{ width: 1200, height: 1200, crop: 'limit' }] },
      (error, result) => error ? reject(new AppError(502, 'UPLOAD_FAILED', 'The image could not be uploaded. Please try again.')) : resolve(result));
    stream.on('error', () => reject(new AppError(502, 'UPLOAD_FAILED', 'The image could not be uploaded. Please try again.')));
    stream.end(file.buffer);
  });
}
async function discardUpload(publicId) {
  try { await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }); }
  catch { console.error('Orphan upload cleanup failed'); }
}
module.exports = { uploadImage, discardUpload };
