import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(7),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.6-flash'),
  GEMINI_VISION_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  // Tried in order when the main model is overloaded or rate limited.
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-3.5-flash,gemini-3.5-flash-lite'),
  CLIENT_URL: z.string().refine(
    (value) => value.split(',').every((url) => URL.canParse(url.trim())),
    'CLIENT_URL must contain one or more comma-separated URLs',
  ).default('http://localhost:5173'),
});

export const env = schema.parse(process.env);
