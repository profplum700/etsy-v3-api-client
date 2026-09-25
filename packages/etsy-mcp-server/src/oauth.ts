import { createServer, type Server } from "node:http";
import { AuthHelper, EtsyClient, type EtsyTokens } from "@profplum700/etsy-v3-api-client";
import open from "open";
import { CredentialStore, type EtsyCredentials } from "./credentials.js";
import { OAUTH_REDIRECT_URI, REQUIRED_SCOPES } from "./constants.js";

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupError";
  }
}

function safeScope(scope: string): string {
  const scopes = scope.split(/\s+/).filter(Boolean);
  const uniqueScopes = new Set(scopes);
  if (uniqueScopes.size !== REQUIRED_SCOPES.length || REQUIRED_SCOPES.some((required) => !uniqueScopes.has(required))) {
    throw new SetupError("Etsy did not grant exactly shops_r and listings_r. No credentials were saved; run setup again and approve only those read permissions.");
  }
  return REQUIRED_SCOPES.join(" ");
}

function callbackPage(message: string): string {
  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Etsy setup</title></head><body><p>" + message + "</p><p>You can close this tab and return to your terminal.</p></body></html>";
}

function sendCallbackResponse(response: import("node:http").ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(callbackPage(message));
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

export async function getAuthorizationCode(
  auth: OAuthHelper,
  authUrl: string,
  expectedState: string,
  browserOpener: (url: string) => Promise<unknown>,
  redirectUri: string,
): Promise<{ code: string; state: string }> {
  const callbackUrl = new URL(redirectUri);
  const expectedPath = callbackUrl.pathname;
  const expectedHost = callbackUrl.hostname;
  const port = Number(callbackUrl.port);
  let resolveCode: (value: { code: string; state: string }) => void = () => undefined;
  let rejectCode: (reason: Error) => void = () => undefined;
  let callbackHandled = false;
  const codePromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  void codePromise.catch(() => undefined);

  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      sendCallbackResponse(response, 405, "Use the Etsy authorization link to complete setup.");
      return;
    }

    const requestUrl = new URL(request.url ?? "/", redirectUri);
    if (requestUrl.pathname !== expectedPath) {
      sendCallbackResponse(response, 404, "This local callback is only for Etsy setup.");
      return;
    }
    if (callbackHandled) {
      sendCallbackResponse(response, 409, "This Etsy authorization request has already been used.");
      return;
    }

    const state = requestUrl.searchParams.get("state") ?? "";
    const code = requestUrl.searchParams.get("code") ?? "";
    const oauthError = requestUrl.searchParams.get("error");

    if (state !== expectedState) {
      sendCallbackResponse(response, 400, "Etsy authorization could not be validated. Return to the setup terminal and try again.");
      return;
    }

    callbackHandled = true;
    if (oauthError || !code) {
      sendCallbackResponse(response, 400, "Etsy authorization could not be validated. Return to the setup terminal and try again.");
      rejectCode(new SetupError("Etsy authorization was declined or the local callback did not match. No credentials were saved."));
      return;
    }

    sendCallbackResponse(response, 200, "Etsy authorization received.");
    resolveCode({ code, state });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", (error: Error & { code?: string }) => {
        if (error.code === "EADDRINUSE") {
          reject(new SetupError("Local callback port 3030 is already in use. Close the process using it and run setup again."));
        } else {
          reject(new SetupError("The local Etsy OAuth callback could not start. No credentials were saved."));
        }
      });
      server.listen(port, expectedHost, () => resolve());
    });

    const timeout = setTimeout(() => {
      rejectCode(new SetupError("Etsy authorization did not return within five minutes. Run setup again."));
    }, CALLBACK_TIMEOUT_MS);
    try {
      try {
        await browserOpener(authUrl);
      } catch {
        console.error("Open this Etsy authorization URL in the browser profile signed in to the Etsy shop you want to connect:");
        console.error(authUrl);
      }
      return await codePromise;
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await closeServer(server);
  }
}

export interface OAuthHelper {
  getState(): Promise<string>;
  getAuthUrl(): Promise<string>;
  setAuthorizationCode(code: string, state: string): Promise<void>;
  getAccessToken(): Promise<EtsyTokens>;
}

export interface OAuthSetupDependencies {
  redirectUri?: string;
  openBrowser?: (url: string) => Promise<unknown>;
  createAuthHelper?: (options: { keystring: string; redirectUri: string; scopes: string[] }) => OAuthHelper;
  createClient?: (credentials: EtsyCredentials, store: CredentialStore) => EtsyClient;
}

export async function connectShop(
  keystring: string,
  sharedSecret: string,
  store: CredentialStore,
  dependencies: OAuthSetupDependencies = {},
): Promise<{ shopName: string; shopId: string }> {
  const redirectUri = dependencies.redirectUri ?? OAUTH_REDIRECT_URI;
  const authOptions = { keystring, redirectUri, scopes: [...REQUIRED_SCOPES] };
  const auth = dependencies.createAuthHelper?.(authOptions) ?? new AuthHelper(authOptions);
  const expectedState = await auth.getState();
  const authUrl = await auth.getAuthUrl();
  const callback = await getAuthorizationCode(
    auth,
    authUrl,
    expectedState,
    dependencies.openBrowser ?? open,
    redirectUri,
  );
  await auth.setAuthorizationCode(callback.code, callback.state);
  const tokens: EtsyTokens = await auth.getAccessToken();
  const scope = safeScope(tokens.scope);

  const initialCredentials: EtsyCredentials = {
    version: 1,
    keystring,
    sharedSecret,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at.toISOString(),
    scope,
    shopId: "1",
    shopName: "Pending Etsy shop verification",
  };
  let latestAccessToken = tokens.access_token;
  let latestRefreshToken = tokens.refresh_token;
  let latestExpiry = tokens.expires_at;
  const verifiedCredentials: { current?: EtsyCredentials } = {};
  const client = dependencies.createClient?.(initialCredentials, store) ?? new EtsyClient({
    keystring,
    sharedSecret,
    accessToken: latestAccessToken,
    refreshToken: latestRefreshToken,
    expiresAt: latestExpiry,
    caching: { enabled: false },
    refreshSaveAsync: async (accessToken, refreshToken, expiresAt): Promise<void> => {
      latestAccessToken = accessToken;
      latestRefreshToken = refreshToken;
      latestExpiry = expiresAt;
      if (verifiedCredentials.current) {
        await store.save({
          ...verifiedCredentials.current,
          accessToken,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
        });
      }
    },
  });

  const user = await client.getUser();
  if (!user.shop_id) throw new SetupError("The Etsy account authorized for this connection has no shop. No credentials were saved.");
  const shopId = String(user.shop_id);
  const shop = await client.getShop(shopId);
  const credentials: EtsyCredentials = {
    ...initialCredentials,
    accessToken: latestAccessToken,
    refreshToken: latestRefreshToken,
    expiresAt: latestExpiry.toISOString(),
    shopId: String(shop.shop_id),
    shopName: shop.shop_name,
  };

  verifiedCredentials.current = credentials;
  await store.save(credentials);
  return { shopName: shop.shop_name, shopId: String(shop.shop_id) };
}
