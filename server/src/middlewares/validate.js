const AppError = require('../utils/AppError');
module.exports = schema => (req, _res, next) => {
  const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!parsed.success) return next(new AppError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))));
  req.validated = parsed.data;
  next();
};
