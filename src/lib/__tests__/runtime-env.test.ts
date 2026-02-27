import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRuntimeEnvFiles, loadRuntimeEnv } from "@/lib/runtime-env";

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "prospectai-env-"));
}

describe("runtime env loader", () => {
  it("prefers .env.local outside production", () => {
    const cwd = createTempDir();
    fs.writeFileSync(
      path.join(cwd, ".env.local"),
      "TURSO_CONNECTION_URL=file:local-dev.db\n"
    );

    const env: Record<string, string> = {};
    loadRuntimeEnv({ cwd, nodeEnv: "development", env });

    expect(env.TURSO_CONNECTION_URL).toBe("file:local-dev.db");
  });

  it("prefers .env.production in production", () => {
    const cwd = createTempDir();
    fs.writeFileSync(
      path.join(cwd, ".env.production"),
      "TURSO_CONNECTION_URL=libsql://prod-db.turso.io\n"
    );

    const env: Record<string, string> = {};
    loadRuntimeEnv({ cwd, nodeEnv: "production", env });

    expect(env.TURSO_CONNECTION_URL).toBe("libsql://prod-db.turso.io");
  });

  it("returns expected file priority order", () => {
    expect(getRuntimeEnvFiles("production")).toEqual([
      ".env.production",
      ".env",
    ]);
    expect(getRuntimeEnvFiles("test")).toEqual([".env.local", ".env"]);
  });
});
