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
  const files = getRuntimeEnvFiles(options.nodeEnv ?? process.env.NODE_ENV);

  for (const file of files) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    config({
      path: fullPath,
      processEnv: env,
      override: false,
    });
  }
}
