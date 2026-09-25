import { Entry, type EntryOptions } from "@napi-rs/keyring";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CredentialStore, type EtsyCredentials } from "../src/credentials.js";

describe.runIf(process.env.ETSY_MCP_KEYRING_INTEGRATION === "1")("native OS credential store integration", () => {
  it("probes, saves, reads, refreshes, and clears synthetic credentials", async () => {
    const root = await mkdtemp(join(tmpdir(), "etsy-mcp-native-keyring-"));
    const serviceNamespace = "com.profplum700.etsy-mcp-server.integration." + randomUUID();
    const lockPath = join(root, "credential-store.lock");
    const options: EntryOptions | undefined = process.platform === "linux"
      ? { linux: { store: "secret-service" } }
      : undefined;
    const store = new CredentialStore(
      (service, account) => new Entry(serviceNamespace + "." + service, account, options),
      lockPath,
    );
    const shopId = String(Date.now());
    const credentials: EtsyCredentials = {
      version: 1,
      keystring: "synthetic-integration-keystring-" + randomUUID(),
      sharedSecret: "synthetic-integration-shared-secret-" + randomUUID(),
      accessToken: "synthetic-integration-access-token-" + randomUUID(),
      refreshToken: "synthetic-integration-refresh-token-" + randomUUID(),
      expiresAt: "2030-01-01T00:00:00.000Z",
      scope: "shops_r listings_r",
      shopId,
      shopName: "Synthetic Etsy Keyring Integration Shop",
    };

    try {
      store.probe();
      await store.save(credentials);
      expect(await store.read(shopId)).toEqual(credentials);

      const refreshed: EtsyCredentials = {
        ...credentials,
        accessToken: "synthetic-integration-rotated-access-token-" + randomUUID(),
        refreshToken: "synthetic-integration-rotated-refresh-token-" + randomUUID(),
        expiresAt: "2030-01-01T01:00:00.000Z",
      };
      expect(await store.saveRefreshedTokensIfCurrent(credentials, refreshed)).toEqual(refreshed);
      expect(await store.read(shopId)).toEqual(refreshed);
      expect(await store.clear(shopId)).toMatchObject({ shopId, shopName: credentials.shopName });
      expect(await store.read(shopId)).toBeNull();

      const args = process.argv.join(" ");
      for (const sentinel of [credentials.keystring, credentials.sharedSecret, credentials.accessToken, credentials.refreshToken]) {
        expect(args).not.toContain(sentinel);
      }
    } finally {
      try {
        await store.clear(shopId);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });
});
