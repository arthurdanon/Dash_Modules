// backend/src/config/env.js
const { z } = require('zod');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default('http://localhost:3000'),

  // CORS (liste d’origines séparées par des virgules)
  CORS_ORIGINS: z.string().optional(),

  // Rate limit global & mail (ms / max)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_MAIL_WINDOW_MS: z.coerce.number().default(60 * 60 * 1000),
  RATE_LIMIT_MAIL_MAX: z.coerce.number().default(20),
});

const env = EnvSchema.parse(process.env);
module.exports = env;
