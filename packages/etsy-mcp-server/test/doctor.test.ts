import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnose, formatDoctorReport } from "../src/doctor.js";
import { main } from "../src/cli.js";
import { CredentialStoreError } from "../src/credentials.js";
import { createMemoryStore, validCredentials } from "./fixtures.js";

describe("offline doctor", () => {
  afterEach(() => { vi.restoreAllMocks(); process.exitCode = 0; });

  it("reports local readiness without changing any shop or leaking profile or credential values", async () => {
    const { store, entries } = createMemoryStore();
    await store.save(validCredentials);
    await store.save({ ...validCredentials, shopId: "67890", shopName: "Other Shop" });
    const before = [...entries];
    const probe = vi.spyOn(store, "probe");
    const save = vi.spyOn(store, "save");
    const clear = vi.spyOn(store, "clear");
    const setActive = vi.spyOn(store, "setActive");
    const refresh = vi.spyOn(store, "saveRefreshedTokensIfCurrent");
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Doctor must stay offline"));
    const report = await diagnose({ loadStore: async () => store, now: 0 });
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.code)).toContain("READ_ONLY_SCOPES");
    expect([...entries]).toEqual(before);
    expect(probe).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    for (const value of [validCredentials.keystring, validCredentials.sharedSecret, validCredentials.accessToken, validCredentials.refreshToken, validCredentials.shopName, validCredentials.shopId, "Other Shop", "67890"]) {
      expect(JSON.stringify(report) + formatDoctorReport(report)).not.toContain(value);
    }
    expect(report.checks.at(-1)?.code).toBe("LIVE_CHECKS_NOT_RUN");
  });

  it.each(["shops_r listings_r", "listings_r shops_r", " shops_r\tlistings_r "])("accepts exactly both read scopes in any ordering %s", async (scope) => {
    const { store } = createMemoryStore();
    await store.save({ ...validCredentials, scope });
    const report = await diagnose({ loadStore: async () => store, now: 0 });
    expect(report.ok).toBe(true);
  });

  it("explains missing connection and expired access token separately", async () => {
    const { store } = createMemoryStore();
    const missing = await diagnose({ loadStore: async () => store });
    expect(missing.ok).toBe(false);
    expect(missing.checks.at(-1)?.code).toBe("NOT_CONNECTED");
    await store.save({ ...validCredentials, expiresAt: "2000-01-01T00:00:00.000Z" });
    const expired = await diagnose({ loadStore: async () => store });
    expect(expired.ok).toBe(true);
    expect(expired.checks).toContainEqual(expect.objectContaining({ code: "TOKEN_EXPIRED", status: "warn" }));
  });

  it.each(["shops_r shops_r", "listings_r listings_r", "shops_r", "shops_r listings_r listings_w"])("rejects invalid stored scopes %s", async (scope) => {
    const { store, entries } = createMemoryStore();
    entries.set("com.profplum700.etsy-mcp-server:default", JSON.stringify({ ...validCredentials, scope }));
    await expect(store.read()).rejects.toThrow("exactly the required read-only scopes");
    const report = await diagnose({ loadStore: async () => store });
    expect(report.ok).toBe(false);
    expect(report.checks.at(-2)?.code).toBe("STORE_READ_FAILED");
    expect(JSON.stringify(report)).not.toContain(validCredentials.accessToken);
  });

  it.each([new Error("secret-sentinel /private/path"), new CredentialStoreError("secret-sentinel /private/path")])("does not echo provider or lock errors", async (error) => {
    const report = await diagnose({ loadStore: async () => ({ read: async () => { throw error; } }), platform: "linux" });
    expect(report.ok).toBe(false);
    expect(formatDoctorReport(report)).toContain("Secret Service");
    expect(JSON.stringify(report)).not.toContain("secret-sentinel");
    expect(formatDoctorReport(report)).not.toContain("/private/path");
  });

  it("handles native loader failure without echoing its message", async () => {
    const report = await diagnose({ loadStore: async () => { throw new Error("native-private-path"); } });
    expect(report.ok).toBe(false);
    expect(report.checks.at(-1)?.code).toBe("NATIVE_LOAD_FAILED");
    expect(JSON.stringify(report)).not.toContain("native-private-path");
  });

  it.each([{ nodeVersion: "22.1.0" }, { platform: "freebsd" }])("stops before loading unsupported runtime %j", async (options) => {
    const loadStore = vi.fn();
    expect((await diagnose({ ...options, loadStore })).ok).toBe(false);
    expect(loadStore).not.toHaveBeenCalled();
  });

  it("rejects malformed saved records without exposing their contents", async () => {
    const { store, entries } = createMemoryStore();
    entries.set("com.profplum700.etsy-mcp-server:default", "private-corrupt-record");
    const report = await diagnose({ loadStore: async () => store });
    expect(report.ok).toBe(false);
    expect(JSON.stringify(report)).not.toContain("private-corrupt-record");
  });

  it.each([{ args: ["--network"] }, { args: ["--json", "--json"] }, { args: ["secret-argument"] }])("rejects unsupported arguments without echoing them", async ({ args }) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await main(["doctor", ...args]);
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledExactlyOnceWith("Usage: etsy-mcp-server doctor [--json]");
  });
});
