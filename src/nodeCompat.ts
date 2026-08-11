import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Minimum supported Node.js major version.
 * Keep in sync with the `engines` field in package.json.
 */
export const MIN_NODE_MAJOR_VERSION = 20;

/**
 * Returns the directory containing the calling module file.
 *
 * Uses `fileURLToPath` instead of `new URL(import.meta.url).pathname` so that
 * Windows paths containing spaces or non-ASCII characters are decoded correctly
 * (e.g. `C:\My Projects\app` instead of `C:\My%20Projects\app`).
 *
 * Compatible with Node.js >= 12 (ESM) and works identically on all platforms.
 *
 * @param callerMetaUrl Pass `import.meta.url` from the calling module.
 */
export function getModuleDir(callerMetaUrl: string): string {
  return path.dirname(fileURLToPath(callerMetaUrl));
}

/**
 * Checks whether the current Node.js runtime satisfies the minimum supported
 * major version. Returns an object with the detected version and a human
 * readable message when the runtime is too old.
 */
export function checkNodeVersion(): { ok: boolean; message?: string } {
  const current = process.versions.node;
  const major = Number.parseInt(current.split(".")[0], 10);

  if (Number.isNaN(major) || major < MIN_NODE_MAJOR_VERSION) {
    return {
      ok: false,
      message:
        `skills-manager-mcp requires Node.js >= ${MIN_NODE_MAJOR_VERSION}.0.0 ` +
        `(current: v${current}). Please upgrade Node.js: https://nodejs.org/`,
    };
  }

  return { ok: true };
}

/**
 * Throws a descriptive error and exits the process when running on an
 * unsupported Node.js version. Call this at process startup (CLI & server).
 */
export function assertNodeVersion(): void {
  const result = checkNodeVersion();
  if (!result.ok) {
    console.error(`\n✗ ${result.message}\n`);
    process.exit(1);
  }
}
