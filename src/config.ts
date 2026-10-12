import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ENCRYPTION_KEY: z.string().min(32),
  COOKIE_SECRET: z.string().min(16).default("dev-cookie-secret-change"),
  // z.coerce.boolean() treats any non-empty string (including "false") as true,
  // so parse the flag explicitly: only "true"/"1" enable it.
  FORCE_HTTPS: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data!;
