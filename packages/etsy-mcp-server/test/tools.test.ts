import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CredentialStore, EtsyCredentials } from "../src/credentials.js";
import { createCachedClientFactory, createEtsyMcpServer, ETSY_TOOL_NAMES, persistRefreshedTokens, type ToolDependencies } from "../src/tools.js";
import { createMemoryStore, validCredentials } from "./fixtures.js";

interface ConnectedTestServer {
  client: Client;
  close: () => Promise<void>;
}

async function connectServer(dependencies: ToolDependencies): Promise<ConnectedTestServer> {
  const server = await createEtsyMcpServer(dependencies);
  const client = new Client({ name: "etsy-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function credentialStore(credentials: EtsyCredentials | null): CredentialStore {
  return {
    read: () => credentials,
    save: vi.fn(),
    clear: vi.fn(),
    probe: vi.fn(),
  } as unknown as CredentialStore;
}

function clientFactory(client: Record<string, unknown>): NonNullable<ToolDependencies["createClient"]> {
  return () => client as ReturnType<NonNullable<ToolDependencies["createClient"]>>;
}

function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((item) => item.type === "text");
  return block?.text ?? "";
}

describe("read-only Etsy MCP tools", () => {
  const activeClients: ConnectedTestServer[] = [];

  afterEach(async () => {
    await Promise.all(activeClients.splice(0).map((server) => server.close()));
  });

  it("reuses one Etsy client while credentials stay unchanged and rebuilds after rotation", () => {
    const store = credentialStore(validCredentials);
    const createClient = vi.fn(() => ({} as ReturnType<NonNullable<ToolDependencies["createClient"]>>));
    const factory = createCachedClientFactory(createClient);
    const first = factory(validCredentials, store);
    const second = factory({ ...validCredentials }, store);
    const rotated = factory({ ...validCredentials, accessToken: "refreshed-access-token" }, store);

    expect(second).toBe(first);
    expect(rotated).not.toBe(first);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("does not restore a disconnected profile when an in-flight token refresh completes", async () => {
    const { store } = createMemoryStore();
    await store.save(validCredentials);
    await store.clear(validCredentials.shopId);

    await expect(persistRefreshedTokens(
      store,
      validCredentials,
      "refreshed-access-token",
      "refreshed-refresh-token",
      new Date("2030-01-01T01:00:00.000Z"),
    )).rejects.toThrow("The Etsy connection changed during token refresh.");
    expect(await store.read()).toBeNull();
  });

  it("does not overwrite a newer profile after an out-of-order token refresh", async () => {
    const { store } = createMemoryStore();
    const newerCredentials = { ...validCredentials, accessToken: "newer-access-token" };
    await store.save(validCredentials);
    await store.save(newerCredentials);

    await expect(persistRefreshedTokens(
      store,
      validCredentials,
      "stale-access-token",
      "stale-refresh-token",
      new Date("2030-01-01T01:00:00.000Z"),
    )).rejects.toThrow("The Etsy connection changed during token refresh.");
    expect(await store.read()).toEqual(newerCredentials);
  });

  it("registers exactly the three read-only tools", async () => {
    const connected = await connectServer({ store: credentialStore(null) });
    activeClients.push(connected);
    const { tools } = await connected.client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([...ETSY_TOOL_NAMES]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
  });

  it("lists active listings with major-unit prices and pagination metadata", async () => {
    const getListingsByShop = vi.fn(async () => [{
      listing_id: 444,
      title: "Blue Mountain Print",
      price: { amount: 4250, divisor: 100, currency_code: "USD" },
      url: "https://www.etsy.com/listing/444",
      state: "active",
    }]);
    const getUser = vi.fn(async () => ({ shop_id: 12345 }));
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser, getListingsByShop }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({
      name: "etsy_list_active_listings",
      arguments: { limit: 2, offset: 4 },
    });
    const value = JSON.parse(resultText(result)) as {
      state: string;
      next_offset: number | null;
      listings: Array<{ price: { amount: number; currency_code: string } }>;
    };

    expect(getListingsByShop).toHaveBeenCalledExactlyOnceWith("12345", { state: "active", limit: 2, offset: 4 });
    expect(value.state).toBe("active");
    expect(value.next_offset).toBeNull();
    expect(value.listings[0]?.price).toEqual({ amount: 42.5, currency_code: "USD" });
  });

  it.each([
    { offset: 9950, limit: 50, count: 50, hasMore: true, nextOffset: 10000 },
    { offset: 10000, limit: 50, count: 50, hasMore: false, nextOffset: null },
    { offset: 9950, limit: 50, count: 12, hasMore: false, nextOffset: null },
    { offset: 10000, limit: 50, count: 12, hasMore: false, nextOffset: null },
  ])("keeps maximum-offset pagination actionable: $offset/$count", async ({ offset, limit, count, hasMore, nextOffset }) => {
    const getListingsByShop = vi.fn(async () => Array.from({ length: count }, (_, index) => ({
      listing_id: 1000 + index,
      title: `Print ${index}`,
      price: { amount: 4200, divisor: 100, currency_code: "USD" },
      url: `https://www.etsy.com/listing/${1000 + index}`,
      state: "active",
    })));
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser: vi.fn(async () => ({ shop_id: 12345 })), getListingsByShop }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({
      name: "etsy_list_active_listings",
      arguments: { limit, offset },
    });
    const value = JSON.parse(resultText(result)) as { has_more: boolean; next_offset: number | null };

    expect(value.has_more).toBe(hasMore);
    expect(value.next_offset).toBe(nextOffset);
    if (value.next_offset !== null) expect(value.next_offset).toBeLessThanOrEqual(10000);
  });

  it("keeps a running server bound to its startup shop after the active profile changes", async () => {
    const secondShop: EtsyCredentials = {
      ...validCredentials,
      shopId: "67890",
      shopName: "Live Print Shop",
    };
    const profiles = new Map([
      [validCredentials.shopId, validCredentials],
      [secondShop.shopId, secondShop],
    ]);
    let activeShopId = validCredentials.shopId;
    const store = {
      read: (shopId?: string) => profiles.get(shopId ?? activeShopId) ?? null,
      save: vi.fn(),
      clear: vi.fn(),
      probe: vi.fn(),
    } as unknown as CredentialStore;
    const getListingsByShop = vi.fn(async () => []);
    const connected = await connectServer({
      store,
      createClient: (credentials) => {
        expect(credentials.shopId).toBe(validCredentials.shopId);
        return {
          getUser: async () => ({ shop_id: Number(validCredentials.shopId) }),
          getListingsByShop,
        } as unknown as ReturnType<NonNullable<ToolDependencies["createClient"]>>;
      },
    });
    activeClients.push(connected);
    activeShopId = secondShop.shopId;

    const result = await connected.client.callTool({
      name: "etsy_list_active_listings",
      arguments: { limit: 10, offset: 0 },
    });
    const value = JSON.parse(resultText(result)) as { shop_id: string };

    expect(await store.read(validCredentials.shopId)).toEqual(validCredentials);
    expect(getListingsByShop).toHaveBeenCalledExactlyOnceWith(validCredentials.shopId, {
      state: "active",
      limit: 10,
      offset: 0,
    });
    expect(value.shop_id).toBe(validCredentials.shopId);
  });

  it.each([
    { limit: 51, offset: 0 },
    { limit: 1, offset: 10_001 },
    { limit: 0, offset: 0 },
  ])("rejects listing page arguments outside safe bounds: %j", async (arguments_) => {
    const getListingsByShop = vi.fn();
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser: async () => ({ shop_id: 12345 }), getListingsByShop }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({ name: "etsy_list_active_listings", arguments: arguments_ });

    expect(result.isError).toBe(true);
    expect(getListingsByShop).not.toHaveBeenCalled();
  });

  it("checks authenticated shop identity and listing ownership before Etsy reads", async () => {
    const getUser = vi.fn(async () => ({ shop_id: 12345 }));
    const getListing = vi.fn(async () => ({ shop_id: 54321, title: "Another seller's print" }));
    const getListingInventory = vi.fn();
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser, getListing, getListingInventory }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({
      name: "etsy_get_listing_inventory",
      arguments: { listing_id: "99" },
    });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("does not belong to the connected Etsy shop");
    expect(getListingInventory).not.toHaveBeenCalled();
  });

  it("accepts a numeric listing ID directly from the active-listings result", async () => {
    const getListingsByShop = vi.fn(async () => [{
      listing_id: 99,
      title: "A print",
      price: { amount: 4200, divisor: 100, currency_code: "GBP" },
      url: "https://etsy.test/listing/99",
      state: "active",
    }]);
    const getListing = vi.fn(async () => ({ shop_id: 12345, title: "A print" }));
    const getListingInventory = vi.fn(async () => ({ products: [] }));
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({
        getUser: async () => ({ shop_id: 12345 }),
        getListingsByShop,
        getListing,
        getListingInventory,
      }),
    });
    activeClients.push(connected);

    const listings = await connected.client.callTool({
      name: "etsy_list_active_listings",
      arguments: { limit: 1, offset: 0 },
    });
    const listingId = JSON.parse(resultText(listings)).listings[0].listing_id;
    const inventory = await connected.client.callTool({
      name: "etsy_get_listing_inventory",
      arguments: { listing_id: listingId },
    });

    expect(inventory.isError).not.toBe(true);
    expect(getListing).toHaveBeenCalledWith("99");
    expect(getListingInventory).toHaveBeenCalledWith("99", { show_deleted: false });
  });

  it.each([99.5, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe numeric listing IDs before Etsy access: %s", async (listingId) => {
    const getListing = vi.fn();
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser: async () => ({ shop_id: 12345 }), getListing }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({
      name: "etsy_get_listing_inventory",
      arguments: { listing_id: listingId },
    });

    expect(result.isError).toBe(true);
    expect(getListing).not.toHaveBeenCalled();
  });

  it("retrieves oversized variation inventory in complete, bounded pages", async () => {
    const productCount = 120;
    const products = Array.from({ length: productCount }, (_, index) => ({
      product_id: 10_000 + index,
      sku: `sku-${index}-` + "x".repeat(180),
      property_values: [{ property_name: "Finish", values: [`Finish ${index}`] }],
      offerings: index === 0 ? [] : [0, 1].map((variation) => ({
        offering_id: 20_000 + index * 2 + variation,
        price: { amount: 4200 + index + variation, divisor: 100, currency_code: "GBP" },
        quantity: index + variation,
        is_enabled: true,
      })),
    }));
    const expectedOfferingIds = products.flatMap((product) => product.offerings.map((offering) => offering.offering_id));
    const expectedEntries = expectedOfferingIds.length + 1;
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({
        getUser: async () => ({ shop_id: 12345 }),
        getListing: async () => ({ shop_id: 12345, title: "A variation-rich print" }),
        getListingInventory: async () => ({ products }),
      }),
    });
    activeClients.push(connected);

    const retrieved: Array<{ product_id: number; offerings: Array<{ offering_id: number }> }> = [];
    let offset = 0;
    let expectedTotal: number | undefined;
    do {
      const result = await connected.client.callTool({
        name: "etsy_get_listing_inventory",
        arguments: { listing_id: 99, limit: 50, offset },
      });
      expect(result.isError).not.toBe(true);
      expect(resultText(result).length).toBeLessThanOrEqual(25_000);
      const page = JSON.parse(resultText(result)) as {
        count: number;
        total_count: number;
        next_offset: number | null;
        products: Array<{ product_id: number; offerings: Array<{ offering_id: number }> }>;
      };
      expectedTotal ??= page.total_count;
      expect(page.total_count).toBe(expectedEntries);
      expect(page.count).toBe(page.products.length);
      retrieved.push(...page.products);
      offset = page.next_offset ?? -1;
    } while (offset >= 0);

    expect(expectedTotal).toBe(expectedEntries);
    expect(retrieved).toHaveLength(expectedEntries);
    expect(retrieved.flatMap((entry) => entry.offerings.map((offering) => offering.offering_id))).toEqual(expectedOfferingIds);
    expect(retrieved.filter((entry) => entry.offerings.length === 0)).toHaveLength(1);
    expect(retrieved.map((entry) => entry.product_id)).toEqual(products.flatMap((product) =>
      product.offerings.length === 0 ? [product.product_id] : product.offerings.map(() => product.product_id)));
  });

  it.each([
    { listing_id: 99, limit: 51, offset: 0 },
    { listing_id: 99, limit: 1, offset: -1 },
  ])("rejects inventory pagination arguments outside safe bounds: %j", async (arguments_) => {
    const getListing = vi.fn();
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser: async () => ({ shop_id: 12345 }), getListing }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({ name: "etsy_get_listing_inventory", arguments: arguments_ });

    expect(result.isError).toBe(true);
    expect(getListing).not.toHaveBeenCalled();
  });

  it("rejects a mismatched Etsy account before listing or shop data is returned", async () => {
    const getUser = vi.fn(async () => ({ shop_id: 99999 }));
    const getShop = vi.fn();
    const connected = await connectServer({
      store: credentialStore(validCredentials),
      createClient: clientFactory({ getUser, getShop }),
    });
    activeClients.push(connected);

    const result = await connected.client.callTool({ name: "etsy_get_my_shop", arguments: {} });

    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("authorized Etsy account no longer matches");
    expect(getShop).not.toHaveBeenCalled();
  });
});
