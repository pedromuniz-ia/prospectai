import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Enable WAL mode and busy_timeout for local SQLite to prevent SQLITE_BUSY locks
// when multiple workers or the web app access the DB concurrently.
if (!process.env.TURSO_CONNECTION_URL?.startsWith("libsql://") &&
  !process.env.TURSO_CONNECTION_URL?.startsWith("https://")) {
  client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;").catch(console.error);
}

export const db = drizzle(client, { schema });
