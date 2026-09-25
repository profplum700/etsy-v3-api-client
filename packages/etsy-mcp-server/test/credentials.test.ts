import { describe, expect, it } from "vitest";
import { CredentialStore, CredentialStoreError, type EtsyCredentials } from "../src/credentials.js";
import { persistRefreshedTokens } from "../src/tools.js";
import { createMemoryStore, validCredentials } from "./fixtures.js";

describe("CredentialStore", () => {
  it("round-trips credentials through the injected operating-system store provider", () => {
    const { store } = createMemoryStore();
    store.save(validCredentials);

    expect(store.read()).toEqual(validCredentials);
    expect(store.listProfiles()).toEqual([{
      shopId: validCredentials.shopId,
      shopName: validCredentials.shopName,
      active: true,
    }]);
  });

  it("migrates the existing single-shop credential without losing it when adding a second shop", () => {
    const { store, entries } = createMemoryStore();
    const service = "com.profplum700.etsy-mcp-server";
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    entries.set(service + ":default", JSON.stringify(validCredentials));

    store.save(secondShop);

    expect(store.read()).toEqual(secondShop);
    expect(store.read(validCredentials.shopId)).toEqual(validCredentials);
    expect(store.listProfiles()).toEqual([
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

  it("preserves the legacy connection and removes partial profile writes when a new shop save fails", () => {
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

    expect(() => store.save(secondShop)).toThrow("Existing saved shops were preserved");
    expect(store.read()).toEqual(validCredentials);
    expect(entries.has(service + ":default")).toBe(true);
    expect(entries.has(service + ":shop-" + validCredentials.shopId)).toBe(false);
    expect(entries.has(service + ":shop-" + secondShop.shopId)).toBe(false);
  });

  it("switches and disconnects one profile while preserving the other", () => {
    const { store } = createMemoryStore();
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    store.save(validCredentials);
    store.save(secondShop);

    expect(store.setActive(validCredentials.shopName).active).toBe(true);
    expect(store.read()).toEqual(validCredentials);

    const disconnected = store.clear(secondShop.shopId);
    expect(disconnected).toMatchObject({ shopId: secondShop.shopId, shopName: secondShop.shopName });
    expect(store.read()).toEqual(validCredentials);
    expect(store.listProfiles()).toEqual([{
      shopId: validCredentials.shopId,
      shopName: validCredentials.shopName,
      active: true,
    }]);
  });

  it("keeps the active shop unchanged when saving refreshed tokens for another profile", () => {
    const { store } = createMemoryStore();
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    store.save(validCredentials);
    store.save(secondShop);

    persistRefreshedTokens(
      store,
      validCredentials,
      "rotated-test-access-token",
      "rotated-test-refresh-token",
      new Date("2031-01-01T00:00:00.000Z"),
    );

    expect(store.read()).toEqual(secondShop);
    expect(store.read(validCredentials.shopId)).toMatchObject({
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

  it("rejects write-scoped or duplicate OAuth scopes", () => {
    const { store } = createMemoryStore();

    expect(() => store.save({ ...validCredentials, scope: "shops_r listings_r transactions_w" }))
      .toThrow("exactly the required read-only scopes");
    expect(() => store.save({ ...validCredentials, scope: "shops_r shops_r listings_r" }))
      .toThrow("exactly the required read-only scopes");
  });

  it("fails with OS credential-store instructions when the provider is unavailable", () => {
    const store = new CredentialStore(() => {
      throw new Error("native keyring unavailable");
    });

    expect(() => store.probe()).toThrow(CredentialStoreError);
    expect(() => store.probe()).toThrow("credential store is unavailable");
  });

  it("persists refreshed OAuth tokens to the same credential entry", () => {
    const { store } = createMemoryStore();
    store.save(validCredentials);

    persistRefreshedTokens(
      store,
      validCredentials,
      "rotated-access-token",
      "rotated-refresh-token",
      new Date("2031-01-01T00:00:00.000Z"),
    );

    expect(store.read()).toEqual({
      ...validCredentials,
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: "2031-01-01T00:00:00.000Z",
    });
  });

  it("rejects unreadable credential data without echoing stored content", () => {
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

    expect(() => store.read()).toThrow("saved Etsy connection is unreadable");
    expect(() => store.read()).not.toThrow("secret-token-that-is-not-json");
  });
});
