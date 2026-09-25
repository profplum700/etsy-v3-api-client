import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { AuthHelper, EtsyClient, type EtsyTokens } from "@profplum700/etsy-v3-api-client";
import { describe, expect, it, vi } from "vitest";
import { OAUTH_REDIRECT_URI, REQUIRED_SCOPES } from "../src/constants.js";
import type { OAuthHelper } from "../src/oauth.js";
import { connectShop } from "../src/oauth.js";
import { createMemoryStore } from "./fixtures.js";

async function unusedLocalCallback(): Promise<string> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const address = reservation.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return "http://127.0.0.1:" + address.port + "/oauth/redirect";
}

function fakeTokens(scope: string): EtsyTokens {
  return {
    access_token: "access-token-from-oauth",
    refresh_token: "refresh-token-from-oauth",
    expires_at: new Date("2030-01-01T00:00:00.000Z"),
    token_type: "Bearer",
    scope,
  };
}

describe("Etsy OAuth setup", () => {
  it("uses PKCE S256, a state value, and only the two required read scopes", async () => {
    const auth = new AuthHelper({
      keystring: "test-keystring",
      redirectUri: OAUTH_REDIRECT_URI,
      scopes: [...REQUIRED_SCOPES],
    });
    const expectedState = await auth.getState();
    const authUrl = new URL(await auth.getAuthUrl());

    expect(authUrl.origin + authUrl.pathname).toBe("https://www.etsy.com/oauth/connect");
    expect(authUrl.searchParams.get("state")).toBe(expectedState);
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authUrl.searchParams.get("scope")).toBe("shops_r listings_r");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(OAUTH_REDIRECT_URI);
  });

  it("ignores a mismatched local callback state and saves only after shop verification", async () => {
    const redirectUri = await unusedLocalCallback();
    const { store } = createMemoryStore();
    const acceptedCode = vi.fn();
    let factoryOptions: { keystring: string; redirectUri: string; scopes: string[] } | undefined;
    const fakeAuth: OAuthHelper = {
      getState: async () => "expected-state",
      getAuthUrl: async () => "https://www.etsy.com/oauth/connect?state=expected-state",
      setAuthorizationCode: async (code, state) => { acceptedCode(code, state); },
      getAccessToken: async () => fakeTokens("shops_r listings_r"),
    };
    const client = {
      getUser: async () => ({ shop_id: 12345 }),
      getShop: async () => ({ shop_id: 12345, shop_name: "Verified print shop" }),
    } as unknown as EtsyClient;
    const result = await connectShop("app-keystring", "app-shared-secret", store, {
      redirectUri,
      createAuthHelper: (options) => {
        factoryOptions = options;
        return fakeAuth;
      },
      openBrowser: async () => {
        const invalid = new URL(redirectUri);
        invalid.searchParams.set("state", "attacker-state");
        invalid.searchParams.set("code", "untrusted-code");
        expect((await fetch(invalid)).status).toBe(400);

        const valid = new URL(redirectUri);
        valid.searchParams.set("state", "expected-state");
        valid.searchParams.set("code", "valid-authorization-code");
        expect((await fetch(valid)).status).toBe(200);
      },
      createClient: () => client,
    });

    expect(factoryOptions).toEqual({
      keystring: "app-keystring",
      redirectUri,
      scopes: ["shops_r", "listings_r"],
    });
    expect(acceptedCode).toHaveBeenCalledExactlyOnceWith("valid-authorization-code", "expected-state");
    expect(result).toEqual({ shopName: "Verified print shop", shopId: "12345" });
    expect(store.read()).toMatchObject({
      keystring: "app-keystring",
      sharedSecret: "app-shared-secret",
      shopId: "12345",
      scope: "shops_r listings_r",
    });
  });

  it("does not save credentials when Etsy grants an extra or write scope", async () => {
    const redirectUri = await unusedLocalCallback();
    const { store } = createMemoryStore();
    const fakeAuth: OAuthHelper = {
      getState: async () => "expected-state",
      getAuthUrl: async () => "https://www.etsy.com/oauth/connect?state=expected-state",
      setAuthorizationCode: async () => undefined,
      getAccessToken: async () => fakeTokens("shops_r listings_r transactions_w"),
    };
    const createClient = vi.fn();

    await expect(connectShop("app-keystring", "app-shared-secret", store, {
      redirectUri,
      createAuthHelper: () => fakeAuth,
      openBrowser: async () => {
        const callback = new URL(redirectUri);
        callback.searchParams.set("state", "expected-state");
        callback.searchParams.set("code", "authorization-code");
        await fetch(callback);
      },
      createClient,
    })).rejects.toThrow("exactly shops_r and listings_r");

    expect(createClient).not.toHaveBeenCalled();
    expect(store.read()).toBeNull();
  });
});
