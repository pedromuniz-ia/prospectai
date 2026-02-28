import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

type LoadRuntimeEnvOptions = {
  cwd?: string;
  nodeEnv?: string;
  env?: Record<string, string | undefined>;
};

export function getRuntimeEnvFiles(nodeEnv?: string) {
  return nodeEnv === "production"
    ? [".env.production", ".env"]
    : [".env.local", ".env"];
}

export function loadRuntimeEnv(options: LoadRuntimeEnvOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const files = getRuntimeEnvFiles(nodeEnv);

  let loaded = false;
  for (const file of files) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    config({
      path: fullPath,
      processEnv: env,
      override: false,
    });
    loaded = true;
  }

  // In production (Docker/Portainer), env vars come from the container
  // runtime — no .env file is expected inside the image.
  if (!loaded && nodeEnv === "production") {
    console.log("[env] Production mode — using container environment variables");
  }
}
