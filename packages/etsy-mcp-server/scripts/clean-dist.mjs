import { rmSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(packageRoot, "dist");

if (!outputDirectory.startsWith(packageRoot + sep)) {
  throw new Error("Refusing to clean a build output directory outside the Etsy MCP package.");
}

rmSync(outputDirectory, { recursive: true, force: true });
