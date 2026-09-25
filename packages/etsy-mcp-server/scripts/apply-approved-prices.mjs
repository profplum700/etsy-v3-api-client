#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AuthHelper, EtsyClient } from "@profplum700/etsy-v3-api-client";
import { CredentialStore } from "../dist/credentials.js";
import { getAuthorizationCode } from "../dist/oauth.js";
import { inventoryFingerprint } from "./inventory-fingerprint.mjs";

const DEFAULT_REDIRECT_URI = "http://localhost:3030/oauth/redirect";
const READ_SCOPES = ["shops_r", "listings_r"];
const WRITE_SCOPES = [...READ_SCOPES, "listings_w"];
const REQUIRED_COLUMNS = ["listing_id", "pricing_scope", "current_gbp", "proposed_gbp"];
const REPORT_COLUMNS = ["execution_status", "verified_at_utc", "detail"];

function usage() {
  return `Usage:
  node packages/etsy-mcp-server/scripts/apply-approved-prices.mjs --proposal <csv> --shop-id <id> --shop-name <name> [options]

Options:
  --currency <code>       Expected listing currency (default: GBP)
  --redirect-uri <url>    OAuth callback (default: ${DEFAULT_REDIRECT_URI})
  --report <csv>          Execution report path (default: <proposal>.execution.csv)
  --resume-report <csv>   Skip rows already verified in this report
  --apply                 Request listings_w and apply the approved target prices
  --help                  Show this help

Without --apply, the command performs a read-only preflight and writes no Etsy data.
Credentials come from the OS keyring for the selected saved shop; tokens are never
accepted as command-line arguments or written to disk by this command.
`;
}

function parseArgs(args) {
  const options = {
    currency: "GBP",
    redirectUri: DEFAULT_REDIRECT_URI,
    apply: false,
    help: false,
  };
  const valueFlags = new Set(["--proposal", "--shop-id", "--shop-name", "--currency", "--redirect-uri", "--report", "--resume-report"]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--help") {
      options.help = true;
      continue;
    }
    if (flag === "--apply") {
      options.apply = true;
      continue;
    }
    if (!valueFlags.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    index += 1;
    const key = {
      "--proposal": "proposalPath",
      "--shop-id": "shopId",
      "--shop-name": "shopName",
      "--currency": "currency",
      "--redirect-uri": "redirectUri",
      "--report": "reportPath",
      "--resume-report": "resumeReportPath",
    }[flag];
    options[key] = value;
  }
  if (options.help) return options;
  for (const key of ["proposalPath", "shopId", "shopName"]) {
    if (!options[key]) throw new Error(`Missing required option --${key === "proposalPath" ? "proposal" : key === "shopId" ? "shop-id" : "shop-name"}`);
  }
  if (!/^\d+$/.test(options.shopId)) throw new Error("--shop-id must be a numeric Etsy shop ID.");
  if (!/^[A-Z]{3}$/.test(options.currency)) throw new Error("--currency must be a three-letter uppercase currency code.");
  return options;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += character;
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [headers, ...data] = rows;
  if (!headers?.length) throw new Error("The proposal CSV is empty.");
  const normalizedHeaders = headers.map((header) => header.trim());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error("The CSV contains duplicate column names.");
  return data.map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function encodeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function serializeCsv(rows, columns) {
  return [columns.map(encodeCsv).join(","), ...rows.map((row) => columns.map((column) => encodeCsv(row[column])).join(","))].join("\r\n") + "\r\n";
}

function major(price) {
  if (!price || !Number.isFinite(price.amount) || !Number.isFinite(price.divisor) || price.divisor <= 0) {
    throw new Error("Etsy returned invalid price data.");
  }
  return price.amount / price.divisor;
}

function closePrice(left, right) {
  return Math.abs(left - right) < 0.005;
}

function identity(row) {
  return [row.listing_id, row.pricing_scope, row.product_id ?? "", row.offering_id ?? ""].join(":");
}

function validateProposal(rows) {
  if (rows.length === 0) throw new Error("The proposal CSV has no data rows.");
  for (const column of REQUIRED_COLUMNS) {
    if (!(column in rows[0])) throw new Error(`The proposal CSV is missing required column: ${column}`);
  }
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (!/^\d+$/.test(row.listing_id)) throw new Error(`Row ${index + 2} has an invalid listing_id.`);
    if (!["listing", "variation"].includes(row.pricing_scope)) throw new Error(`Row ${index + 2} has an invalid pricing_scope.`);
    if (row.pricing_scope === "variation" && (!/^\d+$/.test(row.product_id) || !/^\d+$/.test(row.offering_id))) {
      throw new Error(`Row ${index + 2} needs product_id and offering_id for variation pricing.`);
    }
    for (const column of ["current_gbp", "proposed_gbp"]) {
      const value = Number(row[column]);
      if (!Number.isFinite(value) || value <= 0 || !/^\d+\.\d{2}$/.test(row[column])) {
        throw new Error(`Row ${index + 2} has an invalid ${column}; use a positive amount with two decimal places.`);
      }
    }
    if (closePrice(Number(row.current_gbp), Number(row.proposed_gbp))) throw new Error(`Row ${index + 2} has identical current and proposed prices.`);
    const key = identity(row);
    if (seen.has(key)) throw new Error(`The proposal contains duplicate target ${key}.`);
    seen.add(key);
  }
}

function getResumeStatuses(path) {
  if (!path) return new Map();
  const rows = parseCsv(readFileSync(path, "utf8"));
  return new Map(rows.filter((row) => row.execution_status === "VERIFIED").map((row) => [identity(row), row]));
}

function createReadClient(credentials, store) {
  let latest = credentials;
  return new EtsyClient({
    keystring: credentials.keystring,
    sharedSecret: credentials.sharedSecret,
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    expiresAt: new Date(credentials.expiresAt),
    caching: { enabled: false },
    rateLimiting: { maxRequestsPerSecond: 3, minRequestInterval: 350 },
    refreshSaveAsync: async (accessToken, refreshToken, expiresAt) => {
      const updated = { ...latest, accessToken, refreshToken, expiresAt: expiresAt.toISOString() };
      await store.saveRefreshedTokensIfCurrent(latest, updated);
      latest = updated;
    },
  });
}

function createTemporaryWriteClient(credentials, tokens) {
  let latestAccessToken = tokens.access_token;
  let latestRefreshToken = tokens.refresh_token;
  let latestExpiry = tokens.expires_at;
  const client = new EtsyClient({
    keystring: credentials.keystring,
    sharedSecret: credentials.sharedSecret,
    accessToken: latestAccessToken,
    refreshToken: latestRefreshToken,
    expiresAt: latestExpiry,
    caching: { enabled: false },
    rateLimiting: { maxRequestsPerSecond: 3, minRequestInterval: 350 },
    refreshSave: (accessToken, refreshToken, expiresAt) => {
      latestAccessToken = accessToken;
      latestRefreshToken = refreshToken;
      latestExpiry = expiresAt;
    },
  });
  return { client, getLatestTokens: () => ({ latestAccessToken, latestRefreshToken, latestExpiry }) };
}

async function authorizeWrite(credentials, shopId, shopName, redirectUri) {
  const scopes = [...WRITE_SCOPES];
  const auth = new AuthHelper({ keystring: credentials.keystring, redirectUri, scopes });
  const state = await auth.getState();
  const authUrl = await auth.getAuthUrl();
  const callback = await getAuthorizationCode(auth, authUrl, state, async (url) => {
    console.log("Open this URL in the Etsy browser profile for " + shopName + " (shop " + shopId + ") and approve listings_w:");
    console.log(url);
  }, redirectUri);
  await auth.setAuthorizationCode(callback.code, callback.state);
  const tokens = await auth.getAccessToken();
  const granted = tokens.scope.split(/\s+/).filter(Boolean).sort();
  const required = [...scopes].sort();
  if (granted.length !== required.length || granted.some((scope, index) => scope !== required[index])) {
    throw new Error("Etsy did not grant exactly shops_r, listings_r, and listings_w. No price updates were made.");
  }
  const { client } = createTemporaryWriteClient(credentials, tokens);
  const user = await client.getUser();
  if (String(user.shop_id ?? "") !== shopId) throw new Error("Etsy authorized shop " + String(user.shop_id ?? "(none)") + ", expected " + shopId + ". No price updates were made.");
  const shop = await client.getShop(shopId);
  if (shop.shop_name !== shopName) throw new Error("Etsy returned shop name " + shop.shop_name + ", expected " + shopName + ". No price updates were made.");
  return client;
}

function purchasableOffers(inventory) {
  const found = [];
  for (const product of inventory.products ?? []) {
    if (product.is_deleted) continue;
    for (const offering of product.offerings ?? []) {
      if (!offering.is_deleted && offering.is_enabled && offering.quantity > 0) found.push({ product, offering });
    }
  }
  return found;
}

function findTarget(listing, inventory, row) {
  const offers = purchasableOffers(inventory);
  if (row.pricing_scope === "variation") {
    if (!listing.has_variations) throw new Error("Listing variation state changed.");
    const found = offers.find(({ product, offering }) =>
      String(product.product_id) === row.product_id && String(offering.offering_id) === row.offering_id);
    if (!found) throw new Error("Approved variation is no longer purchasable.");
    return found;
  }
  if (listing.has_variations) throw new Error("Listing now has variations.");
  if (offers.length !== 1) throw new Error("Single-price listing has " + offers.length + " purchasable offerings.");
  return offers[0];
}

function assertInventoryCurrency(inventory, currency) {
  for (const { product, offering } of purchasableOffers(inventory)) {
    if (offering.price.currency_code !== currency) {
      throw new Error("Listing inventory currency changed or does not match --currency " + currency + " (listing " + product.product_id + ").");
    }
  }
}

function assertListing(listing, row, shopId) {
  if (String(listing.shop_id ?? "") !== shopId) throw new Error("Listing belongs to Etsy shop " + String(listing.shop_id ?? "(unknown)") + ", not selected shop " + shopId + ".");
  if (listing.state !== "active") throw new Error("Listing is no longer active.");
}

function verifyResumeTarget(row, previous) {
  return Boolean(previous && previous.proposed_gbp === row.proposed_gbp && previous.current_gbp === row.current_gbp);
}

function preflightOne(listing, inventory, row, shopId, currency, resume) {
  assertListing(listing, row, shopId);
  assertCompleteInventory(inventory);
  assertInventoryCurrency(inventory, currency);
  const { product, offering } = findTarget(listing, inventory, row);
  const actual = major(offering.price);
  if (resume && !verifyResumeTarget(row, resume)) throw new Error("Resume report target does not match this proposal row.");
  if (closePrice(actual, Number(row.proposed_gbp))) {
    return { state: "VERIFIED", detail: "Target price was already present at preflight." };
  }
  if (!closePrice(actual, Number(row.current_gbp))) {
    return { state: "STALE", detail: "Current price is £" + actual.toFixed(2) + "; approved old price was £" + row.current_gbp + "." };
  }
  return { state: "READY", productId: String(product.product_id), offeringId: String(offering.offering_id), inventory };
}

function propertyValuesForWrite(values) {
  if (!Array.isArray(values)) {
    throw new Error("Etsy inventory omitted property_values; refusing to guess whether the product has variations.");
  }
  return values.map((property) => {
    if (!Array.isArray(property.value_ids) || !Array.isArray(property.values)) {
      throw new Error("Etsy inventory omitted variation value IDs or values; refusing to guess replacement data.");
    }
    return {
      property_id: property.property_id,
      ...(property.property_name === undefined ? {} : { property_name: property.property_name }),
      ...(property.scale_id === undefined ? {} : { scale_id: property.scale_id }),
      value_ids: property.value_ids,
      values: property.values,
    };
  });
}

function assertCompleteInventory(inventory) {
  if (!Array.isArray(inventory.products) || inventory.products.length === 0) {
    throw new Error("Etsy inventory has no products; refusing to replace it with an empty inventory.");
  }
  for (const product of inventory.products) {
    if (product.is_deleted) continue;
    propertyValuesForWrite(product.property_values);
    if (!Array.isArray(product.offerings) || product.offerings.length === 0) {
      throw new Error("Etsy inventory omitted product offerings; refusing an incomplete replacement.");
    }
    for (const offering of product.offerings) {
      if (!offering.is_deleted && offering.readiness_state_id === undefined) {
        throw new Error("Etsy inventory omitted readiness_state_id; refusing to clear an existing processing profile.");
      }
    }
  }
}

function inventoryPayload(inventory, targetProductId, targetOfferingId, newPrice) {
  assertCompleteInventory(inventory);
  const payload = {
    products: inventory.products.filter((product) => !product.is_deleted).map((product) => ({
      ...(product.sku === undefined ? {} : { sku: product.sku }),
      property_values: propertyValuesForWrite(product.property_values),
      offerings: (product.offerings ?? []).filter((offering) => !offering.is_deleted).map((offering) => ({
        price: String(product.product_id) === targetProductId && String(offering.offering_id) === targetOfferingId
          ? Number(newPrice.toFixed(2))
          : major(offering.price),
        quantity: offering.quantity,
        is_enabled: offering.is_enabled,
        readiness_state_id: offering.readiness_state_id,
      })),
    })),
  };
  if (payload.products.length === 0 || payload.products.some((product) => product.offerings.length === 0)) {
    throw new Error("Etsy inventory has no active products or offerings; refusing an incomplete replacement.");
  }
  for (const key of ["price_on_property", "quantity_on_property", "sku_on_property", "readiness_state_on_property"]) {
    if (key in inventory) payload[key] = inventory[key];
  }
  return payload;
}

function redact(value, secrets) {
  let text = String(value ?? "");
  for (const secret of secrets) {
    if (secret) text = text.replaceAll(secret, "[redacted]");
  }
  return text.replace(/[\r\n\t]+/g, " ").slice(0, 1200);
}

function safeError(error, secrets) {
  const message = error instanceof Error ? error.message : "Etsy request failed.";
  const status = Number.isInteger(error?._statusCode) ? " (HTTP " + error._statusCode + ")" : "";
  const body = typeof error?._response === "string" ? error._response : "";
  return redact(message + status + (body ? ": " + body : ""), secrets);
}

function writeReport(path, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  for (const column of REPORT_COLUMNS) if (!columns.includes(column)) columns.push(column);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeCsv(rows, columns), "utf8");
}

function statusRow(row, executionStatus, detail = "", verifiedAt = "") {
  return { ...row, execution_status: executionStatus, verified_at_utc: verifiedAt, detail };
}

function inventoryTargetState(listing, inventory, row, shopId, currency) {
  assertListing(listing, row, shopId);
  assertInventoryCurrency(inventory, currency);
  const { product, offering } = findTarget(listing, inventory, row);
  return { productId: String(product.product_id), offeringId: String(offering.offering_id), price: major(offering.price) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const proposalPath = resolve(options.proposalPath);
  const reportPath = resolve(options.reportPath ?? proposalPath.replace(/\.csv$/i, ".execution.csv"));
  const resumePath = options.resumeReportPath ? resolve(options.resumeReportPath) : undefined;
  const rows = parseCsv(readFileSync(proposalPath, "utf8"));
  validateProposal(rows);
  const resume = getResumeStatuses(resumePath);
  const store = new CredentialStore();
  const credentials = await store.read(options.shopId);
  if (!credentials) throw new Error("No saved keyring profile exists for shop " + options.shopId + ". Run `etsy-mcp-server setup` for that shop first.");
  if (credentials.shopId !== options.shopId || credentials.shopName !== options.shopName) {
    throw new Error("The saved keyring profile does not match --shop-id/--shop-name. No Etsy requests were made.");
  }
  const savedScopes = credentials.scope.split(/\s+/).filter(Boolean).sort();
  const requiredReadScopes = [...READ_SCOPES].sort();
  if (savedScopes.length !== requiredReadScopes.length || savedScopes.some((scope, index) => scope !== requiredReadScopes[index])) {
    throw new Error("The saved keyring profile is missing shops_r/listings_r. Reconnect the selected shop before running this script.");
  }
  const secrets = [credentials.keystring, credentials.sharedSecret, credentials.accessToken, credentials.refreshToken];
  const reader = createReadClient(credentials, store);

  console.log("Preflighting " + rows.length + " approved rows for " + options.shopName + " (shop " + options.shopId + ")...");
  const preflight = [];
  for (const row of rows) {
    try {
      const previous = resume.get(identity(row));
      if (previous && !verifyResumeTarget(row, previous)) throw new Error("Resume report target does not match this proposal row.");
      const listing = await reader.getListing(row.listing_id);
      const inventory = await reader.getListingInventory(row.listing_id, { show_deleted: false });
      const checked = preflightOne(listing, inventory, row, options.shopId, options.currency, previous);
      if (previous && previous.execution_status === "VERIFIED" && checked.state !== "VERIFIED") {
        preflight.push({ row, state: "STALE", detail: "Previously verified row no longer has its approved target price." });
      } else {
        preflight.push({ row, ...checked });
      }
    } catch (error) {
      preflight.push({ row, state: "STALE", detail: safeError(error, secrets) });
    }
    if (preflight.length % 10 === 0 || preflight.length === rows.length) {
      console.log("Preflight read " + preflight.length + "/" + rows.length + " rows.");
    }
  }

  const stale = preflight.filter((item) => item.state === "STALE");
  const ready = preflight.filter((item) => item.state === "READY");
  const already = preflight.filter((item) => item.state === "VERIFIED");
  console.log(JSON.stringify({ total: rows.length, ready: ready.length, already_at_target: already.length, stale: stale.length, writes_requested: options.apply }, null, 2));
  if (stale.length > 0) {
    const outputRows = preflight.map((item) => statusRow(item.row, item.state === "READY" ? "PREFLIGHT_READY" : item.state === "VERIFIED" ? "VERIFIED" : "SKIPPED_STALE", item.detail ?? ""));
    writeReport(reportPath, outputRows);
    throw new Error("Preflight found stale or invalid rows. No Etsy updates were sent; inspect " + reportPath);
  }
  const results = preflight.map((item) => statusRow(item.row, item.state === "READY" ? "PREFLIGHT_READY" : "VERIFIED", item.detail ?? ""));
  writeReport(reportPath, results);
  if (!options.apply) {
    console.log("Read-only preflight passed. No Etsy updates were sent. Report: " + reportPath);
    return;
  }

  const writer = await authorizeWrite(credentials, options.shopId, options.shopName, options.redirectUri);
  console.log("Write scope and selected shop identity verified. Applying the approved target prices.");
  const resultIndexByIdentity = new Map(results.map((row, index) => [identity(row), index]));
  const baselineFingerprints = new Map();
  const targetOfferingsByListing = new Map();
  for (const item of ready) {
    const listingId = String(item.row.listing_id);
    const targets = targetOfferingsByListing.get(listingId) ?? new Set();
    targets.add(`${item.productId}:${item.offeringId}`);
    targetOfferingsByListing.set(listingId, targets);
  }

  for (const item of ready) {
    const row = item.row;
    const resultIndex = resultIndexByIdentity.get(identity(row));
    if (resultIndex === undefined) throw new Error("Internal report row is missing.");
    try {
      const listing = await writer.getListing(row.listing_id);
      const inventory = await writer.getListingInventory(row.listing_id, { show_deleted: false });
      const current = inventoryTargetState(listing, inventory, row, options.shopId, options.currency);
      if (current.productId !== item.productId || current.offeringId !== item.offeringId || !closePrice(current.price, Number(row.current_gbp))) {
        results[resultIndex] = statusRow(row, "SKIPPED_STALE", "Live inventory changed after preflight; no update sent.");
        writeReport(reportPath, results);
        throw new Error("Listing " + row.listing_id + " changed after preflight; stopping before any further updates.");
      }
      const beforeFingerprint = inventoryFingerprint(inventory, new Set([`${current.productId}:${current.offeringId}`]));
      if (!baselineFingerprints.has(String(row.listing_id))) {
        baselineFingerprints.set(String(row.listing_id), inventoryFingerprint(
          inventory,
          targetOfferingsByListing.get(String(row.listing_id)) ?? new Set(),
        ));
      }
      const payload = inventoryPayload(inventory, current.productId, current.offeringId, Number(row.proposed_gbp));
      try {
        await writer.updateListingInventory(row.listing_id, payload);
      } catch (writeError) {
        const afterError = await writer.getListingInventory(row.listing_id, { show_deleted: false });
        const target = findTarget(listing, afterError, row);
        const afterPrice = major(target.offering.price);
        const sameOtherFields = inventoryFingerprint(afterError, current.productId, current.offeringId) === beforeFingerprint;
        if (!closePrice(afterPrice, Number(row.proposed_gbp)) || !sameOtherFields) throw writeError;
      }
      const inventoryAfter = await writer.getListingInventory(row.listing_id, { show_deleted: false });
      const after = inventoryTargetState(listing, inventoryAfter, row, options.shopId, options.currency);
      const afterFingerprint = inventoryFingerprint(inventoryAfter, current.productId, current.offeringId);
      if (after.productId !== current.productId || after.offeringId !== current.offeringId || !closePrice(after.price, Number(row.proposed_gbp)) || afterFingerprint !== beforeFingerprint) {
        throw new Error("Readback did not match the approved target or another inventory field changed.");
      }
      results[resultIndex] = statusRow(row, "VERIFIED", "Target price and all other inventory fields verified.", new Date().toISOString());
      writeReport(reportPath, results);
      console.log("Verified " + row.listing_id + " at £" + Number(row.proposed_gbp).toFixed(2));
    } catch (error) {
      const currentStatus = results[resultIndex]?.execution_status;
      if (currentStatus !== "SKIPPED_STALE") {
        results[resultIndex] = statusRow(row, "FAILED_OR_READBACK_MISMATCH", safeError(error, secrets));
      }
      writeReport(reportPath, results);
      throw new Error("Stopped at listing " + row.listing_id + "; inspect " + reportPath + ". " + safeError(error, secrets));
    }
  }

  let finalMismatch = false;
  for (const item of preflight.filter((candidate) => candidate.state === "READY")) {
    const row = item.row;
    try {
      const inventory = await writer.getListingInventory(row.listing_id, { show_deleted: false });
      const target = findTarget({ has_variations: row.pricing_scope === "variation", state: "active", shop_id: options.shopId }, inventory, row);
      const unchanged = inventoryFingerprint(
        inventory,
        targetOfferingsByListing.get(String(row.listing_id)) ?? new Set(),
      ) === baselineFingerprints.get(String(row.listing_id));
      if (!closePrice(major(target.offering.price), Number(row.proposed_gbp)) || !unchanged) throw new Error("Final independent readback mismatch.");
      const resultIndex = resultIndexByIdentity.get(identity(row));
      if (resultIndex !== undefined) results[resultIndex] = statusRow(row, "VERIFIED", "Target and full inventory read back again after the batch.", new Date().toISOString());
    } catch (error) {
      finalMismatch = true;
      const resultIndex = resultIndexByIdentity.get(identity(row));
      if (resultIndex !== undefined) results[resultIndex] = statusRow(row, "FAILED_OR_READBACK_MISMATCH", safeError(error, secrets));
    }
    writeReport(reportPath, results);
  }

  const verified = results.filter((row) => row.execution_status === "VERIFIED").length;
  console.log(JSON.stringify({ shop_id: options.shopId, shop_name: options.shopName, currency: options.currency, proposal_rows: rows.length, verified_rows: verified, report: reportPath, write_token_saved_to_disk: false }, null, 2));
  if (finalMismatch || verified !== rows.length) throw new Error("Batch did not fully verify; inspect the execution report.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Price update failed.");
  process.exitCode = 1;
});
