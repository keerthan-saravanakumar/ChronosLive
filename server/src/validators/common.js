const { z } = require('zod');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid resource ID');
const empty = z.object({}).strict();
const route = (body = empty, params = empty, query = empty) => z.object({ body: body.default({}), params, query });
const idParams = z.object({ id: objectId }).strict();
const pagination = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(12) };
module.exports = { z, objectId, empty, route, idParams, pagination };
