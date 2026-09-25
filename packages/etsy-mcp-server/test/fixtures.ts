import type { CredentialStore, EtsyCredentials } from "../src/credentials.js";
import { CredentialStore as CredentialStoreImplementation } from "../src/credentials.js";

export const validCredentials: EtsyCredentials = {
  version: 1,
  keystring: "test-keystring",
  sharedSecret: "test-shared-secret",
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  scope: "shops_r listings_r",
  shopId: "12345",
  shopName: "Test Print Shop",
};

export function createMemoryStore(): { store: CredentialStore; entries: Map<string, string> } {
  const entries = new Map<string, string>();
  const store = new CredentialStoreImplementation((service, account) => {
    const key = service + ":" + account;
    return {
      getPassword: (): string | null => entries.get(key) ?? null,
      setPassword: (value: string): void => { entries.set(key, value); },
      deletePassword: (): boolean => entries.delete(key),
    };
  });
  return { store, entries };
}
