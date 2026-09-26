import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CredentialStore } from "../dist/credentials.js";
import { acquireCredentialLock } from "../dist/credential-lock.js";

const [root, action, shopId] = process.argv.slice(2);
if (!root || !action) throw new Error("Missing worker arguments");

const dbPath = join(root, "keyring.json");
const baseCredentials = {
  version: 1,
  keystring: "synthetic-test-keystring",
  sharedSecret: "synthetic-test-shared-secret",
  accessToken: "synthetic-test-access-token",
  refreshToken: "synthetic-test-refresh-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  scope: "shops_r listings_r",
  shopId: "12345",
  shopName: "Synthetic Test Shop",
};

function readEntries() {
  try {
    return JSON.parse(readFileSync(dbPath, "utf8"));
  } catch {
    return {};
  }
}

function entryFactory(_service, account) {
  return {
    getPassword() {
      const value = readEntries()[account] ?? null;
      if (action === "refresh-held" && account === "shop-12345" && value !== null && !existsSync(join(root, "refresh-paused"))) {
        writeFileSync(join(root, "refresh-paused"), "paused");
        const waitCell = new Int32Array(new SharedArrayBuffer(4));
        const deadline = Date.now() + 20_000;
        while (!existsSync(join(root, "release-refresh")) && Date.now() < deadline) {
          Atomics.wait(waitCell, 0, 0, 25);
        }
        if (!existsSync(join(root, "release-refresh"))) throw new Error("Test interleaving timed out");
      }
      return value;
    },
    setPassword(value) {
      const entries = readEntries();
      entries[account] = value;
      writeFileSync(dbPath, JSON.stringify(entries));
    },
    deletePassword() {
      const entries = readEntries();
      const existed = Object.hasOwn(entries, account);
      delete entries[account];
      writeFileSync(dbPath, JSON.stringify(entries));
      return existed;
    },
  };
}

const store = new CredentialStore(entryFactory, join(root, "credential-store.lock"));

try {
  if (action === "init") {
    await store.save(baseCredentials);
  } else if (action === "lock-churn") {
    const lockPath = join(root, "credential-store.lock");
    for (let iteration = 0; iteration < 30; iteration += 1) {
      const release = await acquireCredentialLock(lockPath);
      const countPath = join(root, "lock-churn-complete");
      const count = existsSync(countPath) ? Number(readFileSync(countPath, "utf8")) : 0;
      writeFileSync(countPath, String(count + 1));
      await new Promise((resolve) => setTimeout(resolve, 1));
      await release();
    }
  } else if (action === "hold-lock") {
    const lockPath = join(root, "credential-store.lock");
    const release = await acquireCredentialLock(lockPath);
    writeFileSync(join(root, "lock-held"), "held");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await release();
  } else if (action === "refresh-held") {
    const updated = {
      ...baseCredentials,
      accessToken: "synthetic-refreshed-access-token",
      refreshToken: "synthetic-refreshed-refresh-token",
      expiresAt: "2030-01-01T01:00:00.000Z",
    };
    writeFileSync(join(root, "refresh-paused"), "new tokens received; persistence not started");
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    const deadline = Date.now() + 20_000;
    while (!existsSync(join(root, "release-refresh")) && Date.now() < deadline) {
      Atomics.wait(waitCell, 0, 0, 25);
    }
    if (!existsSync(join(root, "release-refresh"))) throw new Error("Test interleaving timed out");
    await store.saveRefreshedTokensIfCurrent(baseCredentials, updated);
  } else if (action === "refresh-a" || action === "refresh-b") {
    const gate = join(root, "start-refreshes");
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    const deadline = Date.now() + 20_000;
    while (!existsSync(gate) && Date.now() < deadline) Atomics.wait(waitCell, 0, 0, 25);
    if (!existsSync(gate)) throw new Error("Test start gate timed out");
    const updated = {
      ...baseCredentials,
      accessToken: `synthetic-${action}-access-token`,
      refreshToken: `synthetic-${action}-refresh-token`,
      expiresAt: "2030-01-01T01:00:00.000Z",
    };
    await store.saveRefreshedTokensIfCurrent(baseCredentials, updated);
  } else if (action === "clear") {
    writeFileSync(join(root, "clear-started"), "started");
    await store.clear(baseCredentials.shopId);
  } else if (action === "add") {
    const gate = join(root, "start-adds");
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    const deadline = Date.now() + 20_000;
    while (!existsSync(gate) && Date.now() < deadline) Atomics.wait(waitCell, 0, 0, 25);
    if (!existsSync(gate)) throw new Error("Test start gate timed out");
    await store.save({
      ...baseCredentials,
      shopId,
      shopName: "Synthetic Shop " + shopId,
      accessToken: "synthetic-access-token-" + shopId,
      refreshToken: "synthetic-refresh-token-" + shopId,
    });
  } else {
    throw new Error("Unknown worker action");
  }
  process.stdout.write("ok\n");
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "Credential worker failed");
  process.exitCode = action.startsWith("refresh-") ? 2 : 1;
}
