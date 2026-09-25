import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { EtsyClient, type EtsyListing, type EtsyListingInventory } from "@profplum700/etsy-v3-api-client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CredentialStore, CredentialStoreError, type EtsyCredentials } from "./credentials.js";
import {
  MAX_LISTING_OFFSET,
  MAX_LISTING_PAGE_SIZE,
  MAX_TOOL_RESPONSE_CHARACTERS,
  REQUIRED_SCOPES,
  SERVER_NAME,
} from "./constants.js";

export const ETSY_TOOL_NAMES = [
  "etsy_get_my_shop",
  "etsy_list_active_listings",
  "etsy_get_listing_inventory",
] as const;

type EtsyReadClient = Pick<EtsyClient,
  "getUser" | "getShop" | "getListingsByShop" | "getListing" | "getListingInventory"
>;

export interface ToolDependencies {
  store?: CredentialStore;
  createClient?: (credentials: EtsyCredentials, store: CredentialStore) => EtsyReadClient;
}

type TextToolResult = CallToolResult;

const emptyInput = z.object({}).strict();
const listingPageInput = z.object({
  limit: z.number().int().min(1).max(MAX_LISTING_PAGE_SIZE).default(25)
    .describe("Listings to return in this page (1-50; default 25). Use next_offset to request the next page."),
  offset: z.number().int().min(0).max(MAX_LISTING_OFFSET).default(0)
    .describe("Number of active listings to skip (0-10000; default 0)."),
}).strict();
const listingInventoryInput = z.object({
  listing_id: z.string().regex(/^\d+$/).describe("Numeric Etsy listing ID from the connected shop."),
}).strict();

const packageManifest = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version: string };

function safeError(error: unknown): string {
  if (error instanceof CredentialStoreError) return error.message;
  if (error instanceof Error && error.message.startsWith("The authorized Etsy account")) return error.message;
  if (error instanceof Error && error.message.startsWith("That listing")) return error.message;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status > 0) {
      return "Etsy returned HTTP " + status + ". Check the local authorization with `etsy-mcp-server status` or reconnect with setup.";
    }
  }
  return "Etsy read request failed. Check the local connection with `etsy-mcp-server status` and retry.";
}

function jsonResult(value: unknown): TextToolResult {
  const text = JSON.stringify(value, null, 2) ?? "null";
  if (text.length > MAX_TOOL_RESPONSE_CHARACTERS) {
    return {
      content: [{ type: "text", text: "This Etsy result exceeds the 25,000 character response limit. Request a smaller listing page or inspect one listing at a time." }],
      isError: true,
    };
  }
  return { content: [{ type: "text", text }] };
}

function errorResult(error: unknown): TextToolResult {
  return { content: [{ type: "text", text: safeError(error) }], isError: true };
}

function priceInMajorUnits(price: { amount: number; divisor: number; currency_code: string }): {
  amount: number;
  currency_code: string;
} {
  if (!Number.isFinite(price.divisor) || price.divisor <= 0) {
    throw new Error("Invalid Etsy price divisor");
  }
  return { amount: price.amount / price.divisor, currency_code: price.currency_code };
}

function defaultClient(credentials: EtsyCredentials, store: CredentialStore): EtsyReadClient {
  let currentCredentials = { ...credentials };
  return new EtsyClient({
    keystring: credentials.keystring,
    sharedSecret: credentials.sharedSecret,
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    expiresAt: new Date(credentials.expiresAt),
    caching: { enabled: false },
    refreshSaveAsync: async (accessToken, refreshToken, expiresAt): Promise<void> => {
      currentCredentials = await persistRefreshedTokens(store, currentCredentials, accessToken, refreshToken, expiresAt);
    },
  });
}

function sameCredentials(left: EtsyCredentials, right: EtsyCredentials): boolean {
  return left.keystring === right.keystring
    && left.sharedSecret === right.sharedSecret
    && left.accessToken === right.accessToken
    && left.refreshToken === right.refreshToken
    && left.expiresAt === right.expiresAt
    && left.scope === right.scope
    && left.shopId === right.shopId
    && left.shopName === right.shopName;
}

export function createCachedClientFactory(
  createClient: NonNullable<ToolDependencies["createClient"]> = defaultClient,
): NonNullable<ToolDependencies["createClient"]> {
  let cachedCredentials: EtsyCredentials | undefined;
  let cachedClient: EtsyReadClient | undefined;

  return (credentials, store) => {
    if (!cachedClient || !cachedCredentials || !sameCredentials(cachedCredentials, credentials)) {
      cachedCredentials = { ...credentials };
      cachedClient = createClient(credentials, store);
    }
    return cachedClient;
  };
}

export async function persistRefreshedTokens(
  store: CredentialStore,
  credentials: EtsyCredentials,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
): Promise<EtsyCredentials> {
  return store.saveRefreshedTokensIfCurrent(credentials, {
    ...credentials,
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
  });
}

async function requireCredentials(store: CredentialStore, selectedShopId: string | null): Promise<EtsyCredentials> {
  if (selectedShopId === null) {
    throw new CredentialStoreError("No Etsy shop was selected when this MCP server started. Connect a shop and restart the MCP client.");
  }
  const credentials = await store.read(selectedShopId);
  if (!credentials) {
    throw new CredentialStoreError("The Etsy shop selected when this MCP server started is no longer connected. Reconnect it or restart the MCP client with another saved shop.");
  }
  return credentials;
}

async function withClient<T>(
  store: CredentialStore,
  createClient: (credentials: EtsyCredentials, store: CredentialStore) => EtsyReadClient,
  selectedShopId: string | null,
  operation: (client: EtsyReadClient, credentials: EtsyCredentials) => Promise<T>,
): Promise<T> {
  const credentials = await requireCredentials(store, selectedShopId);
  const grantedScopes = new Set(credentials.scope.split(/\s+/).filter(Boolean));
  if (grantedScopes.size !== REQUIRED_SCOPES.length || REQUIRED_SCOPES.some((scope) => !grantedScopes.has(scope))) {
    throw new CredentialStoreError("The saved Etsy connection must have exactly shops_r and listings_r. Run setup again and approve only those read permissions.");
  }
  return operation(createClient(credentials, store), credentials);
}

async function getMyShop(
  client: EtsyReadClient,
  credentials: EtsyCredentials,
): Promise<Record<string, unknown>> {
  const user = await client.getUser();
  if (!user.shop_id || String(user.shop_id) !== credentials.shopId) {
    throw new Error("The authorized Etsy account no longer matches the connected shop.");
  }
  const shop = await client.getShop(credentials.shopId);
  return {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    currency_code: shop.currency_code,
    listing_active_count: shop.listing_active_count,
    url: shop.url,
  };
}

async function listActiveListings(
  client: EtsyReadClient,
  credentials: EtsyCredentials,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>> {
  const listings: EtsyListing[] = await client.getListingsByShop(credentials.shopId, {
    state: "active",
    limit,
    offset,
  });
  return {
    shop_id: credentials.shopId,
    state: "active",
    offset,
    limit,
    count: listings.length,
    has_more: listings.length === limit,
    next_offset: listings.length === limit ? offset + listings.length : null,
    listings: listings.map((listing) => ({
      listing_id: listing.listing_id,
      title: listing.title,
      price: priceInMajorUnits(listing.price),
      url: listing.url,
      state: listing.state,
    })),
  };
}

async function getListingInventory(
  client: EtsyReadClient,
  credentials: EtsyCredentials,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await client.getListing(listingId);
  if (String(listing.shop_id) !== credentials.shopId) {
    throw new Error("That listing does not belong to the connected Etsy shop.");
  }

  const inventory: EtsyListingInventory = await client.getListingInventory(listingId, { show_deleted: false });
  return {
    shop_id: credentials.shopId,
    listing_id: listingId,
    title: listing.title,
    products: inventory.products.map((product) => ({
      product_id: product.product_id,
      sku: product.sku,
      options: (product.property_values ?? []).map((property) => ({
        name: property.property_name,
        values: property.values,
      })),
      offerings: product.offerings.map((offering) => ({
        offering_id: offering.offering_id,
        price: priceInMajorUnits(offering.price),
        quantity: offering.quantity,
        is_enabled: offering.is_enabled,
      })),
    })),
  };
}

export async function createEtsyMcpServer(dependencies: ToolDependencies = {}): Promise<McpServer> {
  const store = dependencies.store ?? new CredentialStore();
  const selectedShopId = (await store.read())?.shopId ?? null;
  const createClient = dependencies.createClient ?? createCachedClientFactory();
  const server = new McpServer(
    { name: SERVER_NAME, version: packageManifest.version },
    { instructions: "This server is read-only and is bound to the Etsy shop that was active when this server process started. All tool calls in this process stay on that shop. After selecting a different shop with the local CLI, restart this MCP client to switch. Use etsy_list_active_listings with pagination for active listings; use etsy_get_listing_inventory only for a listing from this shop." },
  );

  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as const;

  server.registerTool("etsy_get_my_shop", {
    title: "Get my Etsy shop",
    description: "Input: no fields. Read the identity and public summary of the Etsy shop connected on this machine. Returns JSON with shop_id, shop_name, currency_code, listing_active_count, and url. This uses only Etsy read permissions.",
    inputSchema: emptyInput,
    annotations,
  }, async () => {
    try {
      return jsonResult(await withClient(store, createClient, selectedShopId, getMyShop));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool("etsy_list_active_listings", {
    title: "List active Etsy listings",
    description: "Inputs: limit (1-50, default 25) and offset (0-10000, default 0). Returns JSON with shop_id, state, offset, limit, count, has_more, next_offset, and listings containing listing_id, title, price, url, and state. Price amounts use major currency units. For example, pass the returned next_offset to get the next page while has_more is true. Prices are base listing prices; variation prices are available from etsy_get_listing_inventory.",
    inputSchema: listingPageInput,
    annotations,
  }, async ({ limit, offset }) => {
    try {
      const result = await withClient(store, createClient, selectedShopId, (client, credentials) =>
        listActiveListings(client, credentials, limit, offset));
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool("etsy_get_listing_inventory", {
    title: "Get Etsy listing variation inventory",
    description: "Input: listing_id, a numeric Etsy listing ID. Read variation products, option names and values, offering prices, and quantities. Returns JSON with listing_id, title, and products; each product includes product_id, sku, options, and offerings. Price amounts use major currency units. The listing must belong to the Etsy shop connected on this machine.",
    inputSchema: listingInventoryInput,
    annotations,
  }, async ({ listing_id }) => {
    try {
      const result = await withClient(store, createClient, selectedShopId, (client, credentials) =>
        getListingInventory(client, credentials, listing_id));
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  });

  return server;
}
