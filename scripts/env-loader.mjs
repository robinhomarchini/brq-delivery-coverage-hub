import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv(files = [".env.local", ".env"]) {
  for (const file of files) {
    const absolutePath = path.join(process.cwd(), file);
    if (!fs.existsSync(absolutePath)) continue;

    const content = fs.readFileSync(absolutePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = normalizeEnvValue(trimmed.slice(equalsIndex + 1).trim());
    }
  }
}

function normalizeEnvValue(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
