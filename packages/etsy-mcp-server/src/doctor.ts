import type { CredentialStore } from "./credentials.js";

export interface DoctorCheck {
  code: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface DoctorReport {
  schema_version: 1;
  ok: boolean;
  checks: DoctorCheck[];
}

interface DoctorOptions {
  loadStore?: () => Promise<Pick<CredentialStore, "read">>;
  nodeVersion?: string;
  platform?: string;
  now?: number;
}

export async function diagnose(options: DoctorOptions = {}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const add = (code: string, status: DoctorCheck["status"], message: string): void => {
    checks.push({ code, status, message });
  };
  const finish = (): DoctorReport => ({ schema_version: 1, ok: !checks.some((check) => check.status === "fail"), checks });
  const major = Number((options.nodeVersion ?? process.versions.node).split(".")[0]);
  if (!Number.isInteger(major) || major < 24) {
    add("NODE_UNSUPPORTED", "fail", "Install Node.js 24 or later, then restart the terminal and MCP client.");
    return finish();
  }
  add("NODE_SUPPORTED", "pass", "Node.js meets the package minimum version.");
  const platform = options.platform ?? process.platform;
  if (!["win32", "darwin", "linux"].includes(platform)) {
    add("PLATFORM_UNSUPPORTED", "fail", "Use Windows, macOS, or Linux with an operating system credential store.");
    return finish();
  }

  let store: Pick<CredentialStore, "read">;
  try {
    store = await (options.loadStore ?? (async (): Promise<Pick<CredentialStore, "read">> => {
      const { CredentialStore } = await import("./credentials.js");
      return new CredentialStore();
    }))();
  } catch {
    add("NATIVE_LOAD_FAILED", "fail", "The credential-store module could not load. Reinstall the package on this OS and architecture with npm optional dependencies enabled. On Linux, install the Secret Service runtime libraries.");
    return finish();
  }
  add("NATIVE_LOADED", "pass", "The credential-store module loaded.");

  try {
    const credentials = await store.read();
    add("STORE_READABLE", "pass", "The credential store was read under the local transaction lock; write capability was not tested.");
    if (!credentials) {
      add("NOT_CONNECTED", "fail", "No active Etsy connection is saved. Run etsy-mcp-server setup in an interactive local terminal.");
      return finish();
    }
    add("READ_ONLY_SCOPES", "pass", "The saved connection has exactly shops_r and listings_r.");
    const expiry = Date.parse(credentials.expiresAt);
    if (expiry <= (options.now ?? Date.now())) {
      add("TOKEN_EXPIRED", "warn", "The saved access token has expired. A tool request may refresh it; refresh-token validity has not been checked. Reconnect with setup if a request fails.");
    } else {
      add("TOKEN_UNEXPIRED", "pass", "The saved access-token expiry is in the future; Etsy has not validated the token.");
    }
  } catch {
    add("STORE_READ_FAILED", "fail", platform === "linux"
      ? "Unlock a Secret Service keyring in this desktop session. Check local credential-lock permissions and saved profiles with etsy-mcp-server status; reconnect with setup if profiles or scopes are invalid. No credentials were changed."
      : "Unlock the operating system credential store. Check local credential-lock permissions and saved profiles with etsy-mcp-server status; reconnect with setup if profiles or scopes are invalid. No credentials were changed.");
  }
  add("LIVE_CHECKS_NOT_RUN", "warn", "Offline diagnostic only. No Etsy request, token refresh, credential write probe, or MCP client registration check was performed. Restart the MCP client after changing the active shop.");
  return finish();
}

export function formatDoctorReport(report: DoctorReport): string {
  return ["Etsy MCP local diagnostics", ...report.checks.map((check) => `${check.status.toUpperCase()} ${check.code}: ${check.message}`)].join("\n");
}
