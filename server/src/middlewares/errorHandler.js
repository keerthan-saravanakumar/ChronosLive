const AppError = require('../utils/AppError');

function notFound(_req, _res, next) { next(new AppError(404, 'NOT_FOUND', 'This endpoint does not exist.')); }
function errorHandler(error, _req, res, _next) {
  let err = error;
  if (err.code === 11000) err = new AppError(409, 'DUPLICATE_RECORD', 'This record already exists.');
  if (err.name === 'ValidationError' || err.name === 'CastError') err = new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.');
  if (err.type === 'entity.parse.failed') err = new AppError(400, 'INVALID_JSON', 'Send a valid JSON request.');
  if (err.type === 'entity.too.large') err = new AppError(413, 'BODY_TOO_LARGE', 'The request is too large.');
  if (err.name === 'MulterError') err = new AppError(400, 'INVALID_UPLOAD', 'Choose one image no larger than 2 MB.');
  const status = err instanceof AppError ? err.status : 500;
  if (status === 500 && process.env.NODE_ENV !== 'test') console.error('Request failed:', err.name, err.code || 'INTERNAL_ERROR');
  res.status(status).json({ success: false, error: {
    code: status === 500 ? 'INTERNAL_ERROR' : err.code,
    message: status === 500 ? 'Something went wrong. Please try again.' : err.message,
    ...(err.details === undefined ? {} : { details: err.details }),
  } });
}
module.exports = { notFound, errorHandler };
