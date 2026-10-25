const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9]\d*[smh]$/).default('15m'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

function readEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Invalid environment variables: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const env = result.data;
  const origin = new URL(env.CLIENT_URL);
  if (origin.origin !== env.CLIENT_URL || origin.username || origin.password) throw new Error('CLIENT_URL must be a single origin without a trailing slash');
  if (env.NODE_ENV === 'production' && (origin.protocol !== 'https:' || env.JWT_SECRET.startsWith('replace-'))) throw new Error('Production requires HTTPS and a generated JWT_SECRET');
  const cloud = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET].filter(Boolean);
  if (cloud.length && cloud.length !== 3) throw new Error('All three CLOUDINARY variables must be supplied together');
  return Object.freeze(env);
}
module.exports = { readEnv };
