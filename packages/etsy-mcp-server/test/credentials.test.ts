import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CredentialStore, CredentialStoreError, type EtsyCredentials } from "../src/credentials.js";
import { acquireCredentialLock } from "../src/credential-lock.js";
import { persistRefreshedTokens } from "../src/tools.js";
import { createMemoryStore, validCredentials } from "./fixtures.js";

describe("CredentialStore", () => {
  it("retires only its owned lock directory before a later owner can acquire", async () => {
    const root = await mkdtemp(join(tmpdir(), "etsy-mcp-lock-release-"));
    const lockPath = join(root, "credential-store.lock");
    try {
      const releaseFirst = await acquireCredentialLock(lockPath);
      await releaseFirst();

      const releaseSecond = await acquireCredentialLock(lockPath);
      await releaseSecond();

      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves an unowned stale lock and reports its owner and path", async () => {
    const root = await mkdtemp(join(tmpdir(), "etsy-mcp-stale-lock-"));
    const lockPath = join(root, "credential-store.lock");
    try {
      await mkdir(lockPath);
      await writeFile(join(lockPath, "owner.json"), JSON.stringify({ version: 1, pid: 987654, token: "synthetic-token" }));

      await expect(acquireCredentialLock(lockPath, { retries: 0, retryDelayMs: 0 }))
        .rejects.toThrow(`process 987654 at ${lockPath}`);
      expect(await readFile(join(lockPath, "owner.json"), "utf8"))
        .toContain("synthetic-token");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("round-trips credentials through the injected operating-system store provider", async () => {
    const { store } = createMemoryStore();
    await store.save(validCredentials);

    expect(await store.read()).toEqual(validCredentials);
    expect(await store.listProfiles()).toEqual([{
      shopId: validCredentials.shopId,
      shopName: validCredentials.shopName,
      active: true,
    }]);
  });

  it("migrates the existing single-shop credential without losing it when adding a second shop", async () => {
    const { store, entries } = createMemoryStore();
    const service = "com.profplum700.etsy-mcp-server";
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    entries.set(service + ":default", JSON.stringify(validCredentials));

    await store.save(secondShop);

    expect(await store.read()).toEqual(secondShop);
    expect(await store.read(validCredentials.shopId)).toEqual(validCredentials);
    expect(await store.listProfiles()).toEqual([
      { shopId: validCredentials.shopId, shopName: validCredentials.shopName, active: false },
      { shopId: secondShop.shopId, shopName: secondShop.shopName, active: true },
    ]);
    expect(JSON.parse(entries.get(service + ":default") ?? "null")).toMatchObject({
      version: 2,
      activeShopId: secondShop.shopId,
    });
    expect(entries.has(service + ":shop-" + validCredentials.shopId)).toBe(true);
    expect(entries.has(service + ":shop-" + secondShop.shopId)).toBe(true);
  });

  it("preserves the legacy connection and removes partial profile writes when a new shop save fails", async () => {
    const entries = new Map<string, string>();
    const service = "com.profplum700.etsy-mcp-server";
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    entries.set(service + ":default", JSON.stringify(validCredentials));
    const store = new CredentialStore((entryService, account) => {
      const key = entryService + ":" + account;
      return {
        getPassword: () => entries.get(key) ?? null,
        setPassword: (value) => {
          if (account === "shop-" + secondShop.shopId) throw new Error("credential store write failed");
          entries.set(key, value);
        },
        deletePassword: () => entries.delete(key),
      };
    });

    await expect(store.save(secondShop)).rejects.toThrow("Existing saved shops were preserved");
    expect(await store.read()).toEqual(validCredentials);
    expect(entries.has(service + ":default")).toBe(true);
    expect(entries.has(service + ":shop-" + validCredentials.shopId)).toBe(false);
    expect(entries.has(service + ":shop-" + secondShop.shopId)).toBe(false);
  });

  it("switches and disconnects one profile while preserving the other", async () => {
    const { store } = createMemoryStore();
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    await store.save(validCredentials);
    await store.save(secondShop);

    expect((await store.setActive(validCredentials.shopName)).active).toBe(true);
    expect(await store.read()).toEqual(validCredentials);

    const disconnected = await store.clear(secondShop.shopId);
    expect(disconnected).toMatchObject({ shopId: secondShop.shopId, shopName: secondShop.shopName });
    expect(await store.read()).toEqual(validCredentials);
    expect(await store.listProfiles()).toEqual([{
      shopId: validCredentials.shopId,
      shopName: validCredentials.shopName,
      active: true,
    }]);
  });

  it("keeps the active shop unchanged when saving refreshed tokens for another profile", async () => {
    const { store } = createMemoryStore();
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    await store.save(validCredentials);
    await store.save(secondShop);

    await persistRefreshedTokens(
      store,
      validCredentials,
      "rotated-test-access-token",
      "rotated-test-refresh-token",
      new Date("2031-01-01T00:00:00.000Z"),
    );

    expect(await store.read()).toEqual(secondShop);
    expect(await store.read(validCredentials.shopId)).toMatchObject({
      accessToken: "rotated-test-access-token",
      refreshToken: "rotated-test-refresh-token",
      expiresAt: "2031-01-01T00:00:00.000Z",
    });
  });

  it("probes the credential store using a disposable entry and removes it", () => {
    const { store, entries } = createMemoryStore();

    store.probe();

    expect(entries.size).toBe(0);
  });

  it("rejects write-scoped or duplicate OAuth scopes", async () => {
    const { store } = createMemoryStore();

    await expect(store.save({ ...validCredentials, scope: "shops_r listings_r transactions_w" }))
      .rejects.toThrow("exactly the required read-only scopes");
    await expect(store.save({ ...validCredentials, scope: "shops_r shops_r listings_r" }))
      .rejects.toThrow("exactly the required read-only scopes");
  });

  it("fails with OS credential-store instructions when the provider is unavailable", () => {
    const store = new CredentialStore(() => {
      throw new Error("native keyring unavailable");
    });

    expect(() => store.probe()).toThrow(CredentialStoreError);
    expect(() => store.probe()).toThrow(/unavailable/i);
  });

  it("persists refreshed OAuth tokens to the same credential entry", async () => {
    const { store } = createMemoryStore();
    await store.save(validCredentials);

    await persistRefreshedTokens(
      store,
      validCredentials,
      "rotated-access-token",
      "rotated-refresh-token",
      new Date("2031-01-01T00:00:00.000Z"),
    );

    expect(await store.read()).toEqual({
      ...validCredentials,
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: "2031-01-01T00:00:00.000Z",
    });
  });

  it("allows later refreshes to compare against the last successfully rotated tokens", async () => {
    const { store } = createMemoryStore();
    await store.save(validCredentials);

    const firstRotation = await persistRefreshedTokens(
      store,
      validCredentials,
      "rotated-once-access-token",
      "rotated-once-refresh-token",
      new Date("2031-01-01T00:00:00.000Z"),
    );
    const secondRotation = await persistRefreshedTokens(
      store,
      firstRotation,
      "rotated-twice-access-token",
      "rotated-twice-refresh-token",
      new Date("2031-01-01T01:00:00.000Z"),
    );

    expect(secondRotation).toMatchObject({
      accessToken: "rotated-twice-access-token",
      refreshToken: "rotated-twice-refresh-token",
    });
    expect(await store.read()).toEqual(secondRotation);
  });

  it("rejects unreadable credential data without echoing stored content", async () => {
    const entries = new Map<string, string>();
    const store = new CredentialStore((service, account) => {
      const key = service + ":" + account;
      return {
        getPassword: () => entries.get(key) ?? null,
        setPassword: (value) => { entries.set(key, value); },
        deletePassword: () => entries.delete(key),
      };
    });
    const account = "default";
    const service = "com.profplum700.etsy-mcp-server";
    entries.set(service + ":" + account, "secret-token-that-is-not-json");

    await expect(store.read()).rejects.toThrow("saved Etsy connection is unreadable");
    await expect(store.read()).rejects.not.toThrow("secret-token-that-is-not-json");
  });
});
