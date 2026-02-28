import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// In production (Docker), env vars come from the container — no dotenv file needed.
// In dev, load from .env.local as usual.
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

const dbCredentials: { url: string; authToken?: string } = {
  url: process.env.TURSO_CONNECTION_URL!,
};

if (process.env.TURSO_AUTH_TOKEN) {
  dbCredentials.authToken = process.env.TURSO_AUTH_TOKEN;
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  dialect: "turso",
  dbCredentials,
});
