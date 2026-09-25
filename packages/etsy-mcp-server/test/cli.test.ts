import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { readHiddenPrompt, registerWithCodex, removeFromCodex, runDisconnect, runUse, safeCliError } from "../src/cli.js";
import { EtsyAuthError } from "@profplum700/etsy-v3-api-client";
import { createMemoryStore, validCredentials } from "./fixtures.js";

describe("hidden terminal credential prompt", () => {
  it("masks input and never writes the secret to terminal output", async () => {
    const input = new PassThrough() as PassThrough & {
      isTTY: boolean;
      setRawMode: (enabled: boolean) => void;
    };
    input.isTTY = true;
    input.setRawMode = vi.fn();
    const writes: string[] = [];
    const output = { write: (value: string) => { writes.push(value); } };

    const prompt = readHiddenPrompt(
      "Etsy shared secret: ",
      input as unknown as NonNullable<Parameters<typeof readHiddenPrompt>[1]>,
      output,
    );
    input.write("very-secret-value\n");

    await expect(prompt).resolves.toBe("very-secret-value");
    expect(writes.join("")).not.toContain("very-secret-value");
    expect(writes.join("")).toContain("*****************");
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenNthCalledWith(2, false);
  });

  it("refuses to read credentials when stdin is not an interactive TTY", async () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean };
    input.isTTY = false;
    const output = { write: vi.fn() };

    await expect(readHiddenPrompt(
      "Etsy app keystring: ",
      input as unknown as NonNullable<Parameters<typeof readHiddenPrompt>[1]>,
      output,
    )).rejects.toThrow("interactive local terminal");
    expect(output.write).not.toHaveBeenCalled();
  });

  it("pins Codex registration to the package version without putting credentials in arguments", () => {
    const run = vi.fn();

    registerWithCodex(run, "1.2.3");

    expect(run).toHaveBeenCalledExactlyOnceWith([
      "mcp",
      "add",
      "etsy-mcp-server",
      "--",
      "npx",
      "--yes",
      "@profplum700/etsy-mcp-server@1.2.3",
      "serve",
    ]);
    expect(JSON.stringify(run.mock.calls)).not.toContain("app-shared-secret");
  });

  it("rejects package versions that could alter the Codex command line", () => {
    const run = vi.fn();

    expect(() => registerWithCodex(run, "1.0.0 & whoami")).toThrow("package version is invalid");
    expect(run).not.toHaveBeenCalled();
  });

  it("does not expose Etsy OAuth response bodies in command errors", () => {
    const error = new EtsyAuthError(
      "Token exchange failed: 401 Unauthorized - private-response-body-sentinel",
      "TOKEN_EXCHANGE_FAILED",
    );

    expect(safeCliError(error)).not.toContain("private-response-body-sentinel");
    expect(safeCliError(error)).toBe("Etsy setup failed. No credential values were printed. Check the local app callback and authorization, then retry.");
  });

  it("removes the Codex user-level MCP entry without clearing Etsy credentials", () => {
    const run = vi.fn();

    removeFromCodex(run);

    expect(run).toHaveBeenCalledExactlyOnceWith(["mcp", "remove", "etsy-mcp-server"]);
  });
});

describe("shop profile commands", () => {
  it("switches the active shop and disconnects only that profile by default", async () => {
    const { store } = createMemoryStore();
    const liveShop = { ...validCredentials, shopId: "67890", shopName: "Live Print Shop" };
    store.save(validCredentials);
    store.save(liveShop);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const confirm = vi.fn(async () => true);

    try {
      await runUse(store, validCredentials.shopName);
      expect(store.read()).toEqual(validCredentials);

      await runDisconnect(store, [], confirm);

      expect(confirm).toHaveBeenCalledExactlyOnceWith(
        "Disconnect Etsy shop " + validCredentials.shopName + " (ID " + validCredentials.shopId + ")?",
      );
      expect(store.listProfiles()).toEqual([{
        shopId: liveShop.shopId,
        shopName: liveShop.shopName,
        active: true,
      }]);
      expect(log).toHaveBeenCalledWith("Disconnected Etsy shop " + validCredentials.shopName + " (ID " + validCredentials.shopId + ").");
    } finally {
      log.mockRestore();
    }
  });

  it("requires an explicit confirmation to disconnect every shop", async () => {
    const { store } = createMemoryStore();
    const liveShop = { ...validCredentials, shopId: "67890", shopName: "Live Print Shop" };
    store.save(validCredentials);
    store.save(liveShop);
    const confirm = vi.fn(async () => true);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await runDisconnect(store, ["--all"], confirm);

      expect(confirm).toHaveBeenCalledExactlyOnceWith("Clear credentials for all 2 connected Etsy shops?");
      expect(store.listProfiles()).toEqual([]);
      expect(log).toHaveBeenCalledWith("Cleared 2 Etsy shop connection(s) from the operating system credential store.");
    } finally {
      log.mockRestore();
    }
  });
});
